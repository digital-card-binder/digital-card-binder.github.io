#!/usr/bin/env python3
"""Keep the artist dex complete for every artist in data/artist-roster.json.

- 대상: 한국에 발매되어 사이트 카탈로그에 있는 카드만 (일본·영문 전용 카드는 제외).
- 작가 정보: TCGdex Asia 데이터의 illustrator (일본판 동일 번호 카드).
- 한국 카드 확인: 공식 포켓몬코리아 이미지가 있으면 그것을, 없으면 시리즈 도감이 쓰는
  같은 한국 카드 이미지를 쓴다. 포켓몬 카드는 도감번호(dexId)와 한국어 카드명이
  맞아야만 추가한다. 맞지 않거나 확인할 수 없는 카드는 보류 목록에 남긴다.
- 기존 카드는 지우거나 순서(order)를 바꾸지 않는다(사용자 수집 기록 보호).
  새 카드는 뒤 번호로 추가하고, 화면 정렬은 displayOrder(최신 시리즈 먼저)로 한다.

사용:
  python scripts/sync_artist_dex.py --tcgdex-dir <cards-database 경로>
  python scripts/sync_artist_dex.py --clone [--ref <commit>]   # 저장소를 받아서 실행
"""
from __future__ import annotations

import argparse
import io
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import build_artist_batch2_data as batch2  # noqa: E402
import build_artist_batch3_data as batch3  # noqa: E402
import build_artist_batch4_data as common  # noqa: E402
import build_popular_artist_data as popular  # noqa: E402
import build_card_visual_fingerprints as fingerprints  # noqa: E402

ARTISTS_PATH = ROOT / "data" / "artists.json"
ROSTER_PATH = ROOT / "data" / "artist-roster.json"
SEARCH_INDEX_PATH = ROOT / "data" / "pokemon-search-index.json"
NAMES_PATH = ROOT / "data" / "pokemon-names-multilang.json"
FINGERPRINTS_PATH = ROOT / "data" / "card-visual-fingerprints.json"
TCGDEX_ASSETS = "https://assets.tcgdex.net"
REPORT_PATH = ROOT / "data" / "audits" / "artist-dex-sync.json"
TCGDEX_REPO = "https://github.com/tcgdex/cards-database.git"
OFFICIAL_CARDS_URL = "https://pokemoncard.co.kr/cards"
OFFICIAL_IMAGE_PREFIX = "https://cards.image.pokemonkorea.co.kr/data/"

ERA_RANK = {"M": 0, "SV": 1, "S": 2, "SM": 3, "XY": 4, "BW": 5, "DP": 6}


def norm_image(url: str) -> str:
    return str(url or "").split("?", 1)[0].strip()


def printed_number(value: str) -> int | None:
    match = re.match(r"\s*0*(\d{1,4})", str(value or ""))
    return int(match.group(1)) if match else None


def era_of_set(set_code: str) -> str:
    code = str(set_code or "").upper()
    if code.startswith("SV"):
        return "SV"
    if code.startswith("SM"):
        return "SM"
    if code.startswith(("XY", "CP")):
        return "XY"
    if code.startswith("BW"):
        return "BW"
    if code.startswith(("DP", "PT")):
        return "DP"
    if code.startswith("M"):
        return "M"
    if code.startswith("S"):
        return "S"
    return ""


def era_of_card(card: dict) -> str:
    match = re.search(r"/wmimages/([^/]+)/", str(card.get("image") or ""))
    folder = match.group(1).upper() if match else ""
    if folder == "MEGA":
        return "M"
    if folder in ERA_RANK:
        return folder
    return era_of_set(card.get("set"))


def display_key(card: dict):
    set_code = str(card.get("set") or "")
    numbers = tuple(-int(x) for x in re.findall(r"\d+", set_code))
    return (
        ERA_RANK.get(era_of_card(card), 99),
        numbers,
        set_code.casefold(),
        printed_number(card.get("cardNumber")) or 0,
        card.get("order") or 0,
    )


def load_overrides():
    overrides: dict = {}
    skips: set = set()
    for module in (popular, batch2, batch3, common):
        overrides.update(getattr(module, "MANUAL_OVERRIDES", {}) or {})
        skips |= set(getattr(module, "EXPLICIT_SKIPS", {}) or {})
    return overrides, skips


def build_catalog_index():
    """(set, number) -> Korean catalog rows that the series dex shows."""
    payload = json.loads(SEARCH_INDEX_PATH.read_text(encoding="utf-8"))
    image_base = str(payload.get("imageBase") or "").rstrip("/")
    dex_names = {int(row[0]): str(row[1]) for row in payload.get("pokedex", []) if row and row[0]}
    index = defaultdict(list)
    for group in payload.get("groups", []):
        set_code = str(group[0] or "").strip()
        for entry in group[4] or []:
            raw = str(entry[0] or "").strip()
            match = re.match(r"^[^_]+_(.+)$", raw)
            number_text = match.group(1) if match else ""
            number = printed_number(number_text)
            image = str(entry[3] or (entry[8] if len(entry) > 8 else "") or "").strip()
            if image.startswith("@/"):
                image = image_base + image[1:]
            image = image.split("?", 1)[0]
            name = str(entry[1] or "").strip()
            if not set_code or number is None or not image or not name:
                continue
            rarity = str(entry[9] if len(entry) > 9 and entry[9] else "").strip()
            card_number = number_text if not rarity or number_text.endswith(rarity) else f"{number_text} {rarity}"
            index[(set_code.casefold(), number)].append({
                "name": name,
                "image": image,
                "cardNumber": card_number,
                "rarity": rarity,
            })
    return index, dex_names


def tcgdex_cards(base: str, roster: list[str]):
    wanted = {name.casefold(): name for name in roster}
    grouped = defaultdict(list)
    for root, _, files in os.walk(base):
        for filename in files:
            if not filename.endswith(".ts"):
                continue
            path = os.path.join(root, filename)
            text = Path(path).read_text(encoding="utf-8", errors="ignore")
            match = re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]", text)
            if not match:
                continue
            artist = wanted.get(match.group(1).strip().casefold())
            if not artist:
                continue
            relative = os.path.relpath(path, base)
            parts = relative.split(os.sep)
            stem = Path(filename).stem
            if len(parts) < 3 or not re.fullmatch(r"0*\d+", stem):
                continue
            names_block = re.search(r"\n\tname:\s*\{([^}]*)\}", text)
            card_names = re.findall(r":\s*['\"]([^'\"]+)['\"]", names_block.group(1)) if names_block else []
            dex = re.search(r"dexId:\s*\[([^\]]*)\]", text)
            dex_ids = [int(x) for x in re.findall(r"\d+", dex.group(1))] if dex else []
            category = re.search(r"category:\s*['\"]([^'\"]+)['\"]", text)
            grouped[artist].append({
                "era": parts[0],
                "set": parts[1],
                "number": int(stem),
                "path": relative,
                "dexIds": dex_ids,
                "category": category.group(1) if category else "",
                "names": card_names,
                "stem": stem,
                "hasJa": bool(names_block and re.search(r"\bja\s*:", names_block.group(1))),
            })
    return grouped


def load_set_fingerprints():
    """set -> [(number, (fullD, artD, artA, colors))] for Korean catalog cards."""
    payload = json.loads(FINGERPRINTS_PATH.read_text(encoding="utf-8"))
    by_set = defaultdict(list)
    for set_code, raw, full, art, average, colors in payload.get("entries", []):
        match = re.match(r"^[^_]+_0*(\d+)", str(raw))
        if match:
            by_set[str(set_code).casefold()].append((int(match.group(1)), (int(full, 16), int(art, 16), int(average, 16), colors)))
    return by_set


def color_distance(left: str, right: str) -> float:
    total = sum(abs(int(a, 16) - int(b, 16)) for a, b in zip(left, right))
    return total / (max(1, len(left)) * 15)


def visual_distance(query, reference) -> float:
    count = lambda value: bin(value).count("1")
    return (count(query[0] ^ reference[0]) * 0.22 + count(query[1] ^ reference[1]) * 0.36 +
            count(query[2] ^ reference[2]) * 0.27 + color_distance(query[3], reference[3]) * 64 * 0.15)


def tcgdex_image_fingerprint(item):
    """Fingerprint of the TCGdex card image (일본판 또는 아시아판). None when unavailable."""
    languages = ["ja", "zh-tw"] if item.get("hasJa") else ["zh-tw", "ja"]
    stems = [item["stem"], str(item["number"])]
    for language in languages:
        for stem in dict.fromkeys(stems):
            url = f"{TCGDEX_ASSETS}/{language}/{item['era']}/{item['set']}/{stem}/high.webp"
            try:
                request = urllib.request.Request(url, headers={"User-Agent": fingerprints.USER_AGENT})
                with urllib.request.urlopen(request, timeout=20) as response:
                    values = fingerprints.fingerprint(response.read(8 * 1024 * 1024))
                return (int(values[0], 16), int(values[1], 16), int(values[2], 16), values[3])
            except Exception:  # noqa: BLE001 - 네트워크 실패는 보류로 처리
                continue
    return None


def visual_match(query, references):
    """Return (number, distance, gap) when one Korean card clearly has the same artwork."""
    if not query or not references:
        return None
    ranked = sorted(((visual_distance(query, fp), number) for number, fp in references))
    best_distance, best_number = ranked[0]
    second = next((distance for distance, number in ranked[1:] if number != best_number), float("inf"))
    gap = second - best_distance
    if (best_distance <= 7.5 and gap >= 4.25) or (best_distance <= 9.0 and gap >= 6.0):
        return best_number, round(best_distance, 2), round(gap, 2) if gap != float("inf") else None
    return None


def load_species_names():
    payload = json.loads(NAMES_PATH.read_text(encoding="utf-8"))
    entries = []
    for dex, _ko, ja, zh, en in payload["species"]:
        for value, minimum in ((ja, 2), (zh, 2), (en, 3)):
            value = str(value or "").strip()
            if len(value) >= minimum:
                entries.append((value.casefold(), int(dex)))
    # 긴 이름부터 찾아야 "ミュウツー"가 "ミュウ"로 잘못 잡히지 않는다.
    entries.sort(key=lambda item: -len(item[0]))
    return entries


def species_from_names(names: list[str], species: list[tuple[str, int]]) -> list[int]:
    found: list[int] = []
    for name in names:
        rest = str(name or "").casefold()
        for value, dex in species:
            if value in rest:
                if dex not in found:
                    found.append(dex)
                rest = rest.replace(value, "\0")
    return found


def name_matches(name: str, dex_ids: list[int], dex_names: dict[int, str]) -> bool:
    korean = [dex_names.get(i, "") for i in dex_ids]
    return any(k and k in name for k in korean)


def sync(tcgdex_base: str, ref: str, visual: bool = True):
    roster_payload = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
    roster = [str(name).strip() for name in roster_payload["artists"] if str(name).strip()]
    payload = json.loads(ARTISTS_PATH.read_text(encoding="utf-8"))
    by_name = {artist["name"]: artist for artist in payload["artists"]}

    missing_from_roster = [name for name in by_name if name not in roster]
    if missing_from_roster:
        raise SystemExit(f"기존 작가가 목록에서 빠졌습니다(삭제하지 않음): {missing_from_roster}")

    artists = [by_name.get(name) or {"name": name, "cards": []} for name in roster]
    overrides, skips = load_overrides()
    official = common.build_local_index()
    catalog, dex_names = build_catalog_index()
    korean_sets = common.korean_sets(tcgdex_base)
    grouped = tcgdex_cards(tcgdex_base, roster)
    species = load_species_names()
    set_fingerprints = load_set_fingerprints()
    pending = [item for name in roster for item in grouped.get(name, [])
               if item["category"] != "Pokemon" and (item["set"].casefold(), item["number"]) not in
               {(str(c["set"]).casefold(), printed_number(c.get("cardNumber"))) for a in artists if a["name"] == name for c in a["cards"]}]
    image_cache: dict[str, object] = {}
    if visual and pending:
        with ThreadPoolExecutor(12) as pool:
            for item, value in zip(pending, pool.map(tcgdex_image_fingerprint, pending)):
                image_cache[item["path"]] = value

    owner_by_image: dict[str, str] = {}
    owner_by_identity: dict[tuple[str, int], set[str]] = defaultdict(set)
    for artist in artists:
        for card in artist["cards"]:
            owner_by_image.setdefault(norm_image(card["image"]), artist["name"])
            number = printed_number(card.get("cardNumber"))
            if number is not None:
                owner_by_identity[(str(card["set"]).casefold(), number)].add(artist["name"])

    added: dict[str, list] = defaultdict(list)
    held: list[dict] = []
    conflicts: list[dict] = []

    for artist in artists:
        name = artist["name"]
        cards = artist["cards"]
        mine_images = {norm_image(card["image"]) for card in cards}
        mine_identities = {
            (str(card["set"]).casefold(), printed_number(card.get("cardNumber")))
            for card in cards
        }
        next_order = max((card.get("order") or 0 for card in cards), default=0) + 1
        items = sorted(
            grouped.get(name, []),
            key=lambda item: common.set_sort_key((item["era"], item["set"], item["number"], item["path"])),
        )
        for item in items:
            key = (name, item["set"], item["number"])
            identity = (item["set"].casefold(), item["number"])
            if key in skips:
                continue
            if identity in mine_identities:
                continue

            if item["category"] != "Pokemon" and key not in overrides:
                # 한국판 트레이너스·에너지는 한국어 이름순으로 번호가 매겨져 일본판 번호와 다르다.
                # 같은 확장팩 안에서 그림이 같은 한국 카드를 찾아 그 번호를 쓴다.
                query = image_cache.get(item["path"]) if visual else None
                if query is None:
                    held.append({"artist": name, "tcgdexPath": item["path"], "reason": "trainer-image-unavailable"})
                    continue
                matched = visual_match(query, set_fingerprints.get(item["set"].casefold(), []))
                if not matched:
                    held.append({"artist": name, "tcgdexPath": item["path"], "reason": "trainer-no-visual-match"})
                    continue
                identity = (item["set"].casefold(), matched[0])
                if identity in mine_identities:
                    continue

            candidates = []
            if key in overrides:
                candidates = [{**overrides[key]}]
            else:
                rows = official.get(identity, [])
                if rows:
                    candidates = common.coalesce_image_rows(rows, item["set"], identity[1])
                if not candidates:
                    for row in catalog.get(identity, []):
                        candidates.append({
                            "name": row["name"],
                            "set": item["set"],
                            "rarity": row["rarity"],
                            "image": row["image"],
                            "source": OFFICIAL_CARDS_URL,
                            "cardNumber": row["cardNumber"],
                        })
            if not candidates:
                if (item["era"], item["set"]) in korean_sets:
                    held.append({"artist": name, "tcgdexPath": item["path"], "reason": "no-korean-catalog-row"})
                continue

            dex_ids = item["dexIds"]
            if not dex_ids and item["category"] == "Pokemon":
                # 도감번호가 없는 카드(대만·아시아판 데이터 등)는 일본어·중국어·영어 카드명에서 포켓몬을 찾는다.
                dex_ids = species_from_names(item["names"], species)
                if not dex_ids:
                    held.append({"artist": name, "tcgdexPath": item["path"], "reason": "unknown-species",
                                 "tcgdexNames": item["names"]})
                    continue
            if dex_ids:
                checked = [card for card in candidates if name_matches(card["name"], dex_ids, dex_names)]
                if not checked:
                    held.append({
                        "artist": name, "tcgdexPath": item["path"], "reason": "name-mismatch",
                        "dexIds": dex_ids, "catalogNames": sorted({c["name"] for c in candidates}),
                    })
                    continue
                candidates = checked

            for card in candidates:
                image = norm_image(card["image"])
                if image in mine_images:
                    continue
                other = owner_by_image.get(image)
                others = owner_by_identity.get(identity, set()) - {name}
                if (other and other != name) or others:
                    conflicts.append({
                        "artist": name, "set": card["set"], "cardNumber": card["cardNumber"],
                        "card": card["name"], "alsoCreditedTo": sorted({other} | others if other else others),
                    })
                    continue
                image_value = card["image"]
                if image_value.startswith(OFFICIAL_IMAGE_PREFIX) and "?" not in image_value:
                    image_value += "?w=400"
                entry = {
                    "order": next_order,
                    "name": card["name"],
                    "owned": False,
                    "set": card["set"],
                    "rarity": card.get("rarity") or "",
                    "image": image_value,
                    "imageBw": "",
                    "source": card.get("source") or OFFICIAL_CARDS_URL,
                    "cardNumber": card["cardNumber"],
                }
                next_order += 1
                cards.append(entry)
                mine_images.add(image)
                mine_identities.add(identity)
                owner_by_image[image] = name
                owner_by_identity[identity].add(name)
                added[name].append({"set": entry["set"], "cardNumber": entry["cardNumber"], "name": entry["name"]})

        for position, card in enumerate(sorted(cards, key=display_key), 1):
            card["displayOrder"] = position

    # 안전장치: 기존 카드는 하나도 빠지거나 바뀌면 안 된다(사용자 수집 기록 보호).
    before = json.loads(ARTISTS_PATH.read_text(encoding="utf-8"))
    after = {a["name"]: {(c["order"], c["set"], c["cardNumber"], c["name"], c["image"]) for c in a["cards"]} for a in artists}
    for artist in before["artists"]:
        for card in artist["cards"]:
            if (card["order"], card["set"], card["cardNumber"], card["name"], card["image"]) not in after.get(artist["name"], set()):
                raise SystemExit(f"기존 카드가 바뀌었습니다: {artist['name']} {card['set']} {card['cardNumber']}")

    payload["artists"] = artists
    payload["artistCount"] = len(artists)
    payload["cardCount"] = sum(len(artist["cards"]) for artist in artists)
    payload["ownedCount"] = 0
    payload["illustratorIndex"] = f"https://github.com/tcgdex/cards-database/tree/{ref}/data-asia"
    report = {
        "tcgdexRef": ref,
        "artistCount": payload["artistCount"],
        "cardCount": payload["cardCount"],
        "addedCount": sum(len(v) for v in added.values()),
        "added": {name: rows for name, rows in added.items()},
        "heldCount": len(held),
        "heldByReason": dict(Counter(item["reason"] for item in held)),
        "held": held,
        "conflictCount": len(conflicts),
        "conflicts": conflicts,
    }
    return payload, report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tcgdex-dir", help="cards-database 저장소 경로")
    parser.add_argument("--clone", action="store_true", help="TCGdex 저장소를 받아서 실행")
    parser.add_argument("--ref", help="사용할 TCGdex 커밋(기본: 목록 파일의 tcgdexRef, --latest면 최신)")
    parser.add_argument("--latest", action="store_true", help="TCGdex 최신 커밋 사용 후 목록 파일에 기록")
    parser.add_argument("--no-visual", action="store_true", help="트레이너스 그림 비교를 하지 않음(전부 보류)")
    args = parser.parse_args()

    roster_payload = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as temp:
        repo = args.tcgdex_dir
        if not repo:
            if not args.clone:
                raise SystemExit("--tcgdex-dir 또는 --clone 이 필요합니다.")
            repo = os.path.join(temp, "tcgdex")
            subprocess.run(["git", "clone", "-q", "--filter=blob:none", "--no-checkout", TCGDEX_REPO, repo], check=True)
            subprocess.run(["git", "-C", repo, "sparse-checkout", "set", "data-asia"], check=True)
            ref = None if args.latest else (args.ref or roster_payload.get("tcgdexRef"))
            subprocess.run(["git", "-C", repo, "checkout", "-q", *( [ref] if ref else [] )], check=True)
        ref = subprocess.run(["git", "-C", repo, "rev-parse", "HEAD"], check=True,
                             capture_output=True, text=True).stdout.strip()
        payload, report = sync(os.path.join(repo, "data-asia"), ref, visual=not args.no_visual)

    ARTISTS_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if roster_payload.get("tcgdexRef") != ref:
        roster_payload["tcgdexRef"] = ref
        ROSTER_PATH.write_text(json.dumps(roster_payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"artists {report['artistCount']} / cards {report['cardCount']} / added {report['addedCount']} / "
          f"held {report['heldCount']} {report['heldByReason']} / conflicts {report['conflictCount']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
