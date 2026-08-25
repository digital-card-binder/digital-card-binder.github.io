#!/usr/bin/env python3
"""Build five verified artist catalogs for the Korean artist dex."""
from __future__ import annotations

import glob
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ARTISTS = ["Naoki Saito", "kawayoo", "Oswaldo KATO", "kantaro", "Saboteri"]
TCGDEX_REPO = "https://github.com/tcgdex/cards-database.git"
TCGDEX_REF = "d9083b73db080979123ebf5e9e97338d4e0745b2"
OFFICIAL_CARDS_URL = "https://pokemoncard.co.kr/cards"
OFFICIAL_IMAGE_PREFIX = "https://cards.image.pokemonkorea.co.kr/data/"
OFFICIAL_DETAIL_PREFIX = "https://pokemoncard.co.kr/cards/detail/"

MANUAL_OVERRIDES = {
    ("Naoki Saito", "S8", 106): dict(name="뮤 V", set="S8", rarity="SR", cardNumber="106/100 SR", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S8/S8_106.png?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2021018106"),
    ("Naoki Saito", "SV4a", 346): dict(name="팔데아의 학생", set="SV4a", rarity="SR", cardNumber="346/190 SR", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_346.png?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2024001346"),
    ("Naoki Saito", "CP2", 19): dict(name="라티오스", set="CP2", rarity="R", cardNumber="019/027 R", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP2/XY_CP2_019.jpg?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2015008019"),
    ("Naoki Saito", "CP2", 5): dict(name="펄기아", set="CP2", rarity="R", cardNumber="005/027 R", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP2/XY_CP2_005.jpg?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2015008005"),
    ("Naoki Saito", "CP2", 9): dict(name="제크로무", set="CP2", rarity="R", cardNumber="009/027 R", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP2/XY_CP2_009.jpg?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2015008009"),
    ("Naoki Saito", "CP1", 9): dict(name="아쿠아단의 세비퍼", set="CP1", rarity="C", cardNumber="009/034 C", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_009.jpg?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2015003009"),
    ("Naoki Saito", "CP1", 4): dict(name="아쿠아단의 씨레오", set="CP1", rarity="C", cardNumber="004/034 C", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_004.jpg?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2015003004"),
    ("kawayoo", "CP2", 4): dict(name="테르나", set="CP2", rarity="U", cardNumber="004/027 U", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP2/XY_CP2_004.jpg?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2015008004"),
    ("kawayoo", "CP1", 7): dict(name="아쿠아단의 질퍽이", set="CP1", rarity="C", cardNumber="007/034 C", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_007.jpg?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2015003007"),
    ("kawayoo", "CP1", 21): dict(name="아쿠아단의 샤크니아", set="CP1", rarity="R", cardNumber="021/034 R", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP1/XY_CP1_021.jpg?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2015003021"),
    ("Oswaldo KATO", "S6H", 85): dict(name="백마 버드렉스 VMAX", set="S6H", rarity="HR", cardNumber="085/070 HR", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S6H/S6H_085.png?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2021004085"),
    ("Oswaldo KATO", "S12a", 73): dict(name="가라르 썬더", set="S12a", rarity="R", cardNumber="073/172 R", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S12a/S12a_073.png?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2023001073"),
    ("kantaro", "SV4a", 242): dict(name="렌트라", set="SV4a", rarity="S", cardNumber="242/190 S", image="https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_242.png?w=400", source="https://pokemoncard.co.kr/cards/detail/BS2024001242"),
}

ERA_RANK = {"M": 0, "SV": 1, "S": 2, "SM": 3, "XY": 4, "BW": 5, "DP": 6}


def normalized_image(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def iter_dicts(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from iter_dicts(value)
    elif isinstance(node, list):
        for value in node:
            yield from iter_dicts(value)


def parse_local_identity(row: dict):
    image = str(row.get("image") or "").strip()
    if not image.startswith(OFFICIAL_IMAGE_PREFIX):
        return []
    raw = str(row.get("code") or "").strip()
    set_name = str(row.get("set") or "").strip()
    card_number = str(row.get("cardNumber") or row.get("number") or "").strip()
    pairs = []
    match = re.match(r"^([^_]+)_0*(\d+)(?:/|$)", raw, re.I)
    if match:
        pairs.append((match.group(1), int(match.group(2))))
    image_match = re.search(r"/wmimages/[^/]+/([^/]+)/([^/?#]+)", image, re.I)
    if image_match:
        folder, filename = image_match.groups()
        num_match = re.search(r"_0*(\d{1,4})(?:[_\.]|$)", filename, re.I)
        if num_match:
            pairs.append((folder, int(num_match.group(1))))
    num_match = re.search(r"(\d{1,4})", card_number)
    if set_name and num_match:
        pairs.append((set_name, int(num_match.group(1))))
    return pairs


def build_local_index():
    index = defaultdict(list)
    excluded = {"data/artists.json", "data/artists-popular.json"}
    for filename in glob.glob("data/*.json"):
        if filename.replace("\\", "/") in excluded:
            continue
        try:
            payload = json.loads(Path(filename).read_text(encoding="utf-8"))
        except Exception:
            continue
        for row in iter_dicts(payload):
            image = str(row.get("image") or "").strip()
            name = str(row.get("name") or "").strip()
            if not image.startswith(OFFICIAL_IMAGE_PREFIX) or not name:
                continue
            for set_name, number in parse_local_identity(row):
                key = (set_name.casefold(), number)
                identity = (name, normalized_image(image), str(row.get("source") or ""))
                if any((str(x.get("name") or ""), normalized_image(str(x.get("image") or "")), str(x.get("source") or "")) == identity for x in index[key]):
                    continue
                index[key].append(row)
    return index


def clone_tcgdex(target: str):
    subprocess.run(["git", "clone", "--filter=blob:none", "-q", TCGDEX_REPO, target], check=True)
    subprocess.run(["git", "-C", target, "checkout", "-q", TCGDEX_REF], check=True)


def korean_sets(base: str):
    result = set()
    for era in os.listdir(base):
        era_path = os.path.join(base, era)
        if not os.path.isdir(era_path):
            continue
        for filename in os.listdir(era_path):
            if not filename.endswith(".ts"):
                continue
            text = Path(era_path, filename).read_text(encoding="utf-8", errors="ignore")
            if re.search(r"\bko\s*:", text) or re.search(r"['\"]ko['\"]\s*:", text):
                result.add((era, filename[:-3]))
    return result


def artist_rows(base: str):
    grouped = defaultdict(list)
    for root, _, files in os.walk(base):
        for filename in files:
            if not filename.endswith(".ts"):
                continue
            path = os.path.join(root, filename)
            text = Path(path).read_text(encoding="utf-8", errors="ignore")
            for artist in ARTISTS:
                if re.search(r"illustrator:\s*['\"]" + re.escape(artist) + r"['\"]", text):
                    relative = os.path.relpath(path, base)
                    parts = relative.split(os.sep)
                    if len(parts) >= 3 and re.fullmatch(r"0*\d+", Path(filename).stem):
                        grouped[artist].append((parts[0], parts[1], int(Path(filename).stem), relative))
    return grouped


def infer_set_from_image(image: str) -> str:
    match = re.search(r"/wmimages/[^/]+/([^/]+)/", image, re.I)
    return match.group(1) if match else ""


def infer_rarity(row: dict, card_number: str) -> str:
    rarity = str(row.get("rarity") or "").strip()
    if rarity:
        return rarity
    match = re.search(r"\s([A-Z]{1,4})$", card_number)
    return match.group(1) if match else ""


def normalize_local_card(row: dict, fallback_set: str, fallback_number: int):
    image = str(row.get("image") or "").strip()
    set_name = str(row.get("set") or "").strip() or infer_set_from_image(image) or fallback_set
    card_number = str(row.get("cardNumber") or "").strip()
    if not card_number:
        raw = str(row.get("code") or "").strip()
        match = re.match(r"^[^_]+_(.+)$", raw)
        card_number = match.group(1) if match else f"{fallback_number:03d}"
    source = str(row.get("source") or "").strip()
    if not source.startswith(OFFICIAL_DETAIL_PREFIX):
        source = OFFICIAL_CARDS_URL
    return {
        "name": str(row.get("name") or "").strip(),
        "owned": False,
        "set": set_name,
        "rarity": infer_rarity(row, card_number),
        "image": image,
        "imageBw": "",
        "source": source,
        "cardNumber": card_number,
    }


def set_sort_key(item):
    era, set_name, number, _ = item
    numbers = tuple(int(x) for x in re.findall(r"\d+", set_name))
    return (ERA_RANK.get(era, 99), tuple(-x for x in numbers), set_name.casefold(), number)


def build():
    local_index = build_local_index()
    with tempfile.TemporaryDirectory() as tempdir:
        repo = os.path.join(tempdir, "tcgdex")
        clone_tcgdex(repo)
        base = os.path.join(repo, "data-asia")
        kr_sets = korean_sets(base)
        grouped = artist_rows(base)
        artists = []
        unresolved = []
        for artist in ARTISTS:
            cards = []
            seen = set()
            for era, set_name, number, relative in sorted(grouped[artist], key=set_sort_key):
                local_rows = local_index.get((set_name.casefold(), number), [])
                if not local_rows and (era, set_name) not in kr_sets:
                    continue
                if local_rows:
                    candidates = [normalize_local_card(row, set_name, number) for row in local_rows]
                else:
                    override = MANUAL_OVERRIDES.get((artist, set_name, number))
                    if not override:
                        unresolved.append((artist, relative))
                        continue
                    candidates = [{**override, "owned": False, "imageBw": ""}]
                for card in candidates:
                    if not card["name"] or not card["image"].startswith(OFFICIAL_IMAGE_PREFIX):
                        continue
                    identity = (card["set"].casefold(), card["cardNumber"], card["name"], normalized_image(card["image"]))
                    if identity in seen:
                        continue
                    seen.add(identity)
                    cards.append(card)
            for order, card in enumerate(cards, start=1):
                card["order"] = order
            artists.append({"name": artist, "cards": cards})
    if unresolved:
        raise RuntimeError("Unresolved Korean artist cards: " + ", ".join(f"{a}:{p}" for a, p in unresolved))
    if [x["name"] for x in artists] != ARTISTS or any(not x["cards"] for x in artists):
        raise RuntimeError("Artist build validation failed")
    return {
        "source": "Pokemon Korea official card data + TCGdex illustrator index",
        "sourceUrl": OFFICIAL_CARDS_URL,
        "illustratorIndex": f"https://github.com/tcgdex/cards-database/tree/{TCGDEX_REF}/data-asia",
        "artistCount": len(artists),
        "cardCount": sum(len(x["cards"]) for x in artists),
        "ownedCount": 0,
        "artists": artists,
    }


def main():
    output = Path(sys.argv[1] if len(sys.argv) > 1 else "data/artists-popular.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = build()
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {payload['artistCount']} artists / {payload['cardCount']} cards to {output}")
    for artist in payload["artists"]:
        print(f"  {artist['name']}: {len(artist['cards'])}")


if __name__ == "__main__":
    main()
