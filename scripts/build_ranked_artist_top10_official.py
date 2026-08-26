#!/usr/bin/env python3
"""Add ranked artist-dex positions 1-10 using Pokemon Korea official search only.

For each artist this script:
1. searches Pokemon Korea's own card-search AJAX endpoint,
2. opens every returned Korean card detail page,
3. accepts the row only when the detail page illustrator exactly matches,
4. deduplicates mirror/Monster Ball variants using the official internal id rule,
5. merges only those Korean cards into data/artists.json with owned=False.

Japanese/English-only cards can never enter this build because every accepted row must
exist in Pokemon Korea's official Korean card database and expose an official Korean image.
"""
from __future__ import annotations

import html as html_lib
import json
import re
import time
import urllib.parse
import urllib.request
import http.cookiejar
from collections import defaultdict
from pathlib import Path

BASE = "https://pokemoncard.co.kr"
SEARCH_URL = f"{BASE}/v2/ajax2_dev2"
CARDS_URL = f"{BASE}/cards"
DETAIL_PREFIX = f"{BASE}/cards/detail/"
IMAGE_PREFIX = "https://cards.image.pokemonkorea.co.kr/data/"

ARTISTS = [
    "nagimiso",
    "Ken Sugimori",
    "Kouki Saitou",
    "Akira Komayama",
    "Masakazu Fukuda",
    "Megumi Mizutani",
    "Anesaki Dynamic",
    "Hideki Ishikawa",
    "Shin Nagasawa",
    "takuyoa",
]

DATA_PATH = Path("data/artists.json")
PRIORITY_PATH = Path("data/artist-priority.json")
VALIDATOR_PATH = Path("scripts/validate_artist_data.py")
AUDIT_PATH = Path("data/artist-top10-official-audit.json")


def normalize_artist(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().casefold()


def canonical_internal(card_id: str) -> str:
    value = card_id.strip()
    m = re.match(r"^(.*\d)m$", value, re.I)
    return m.group(1) if m else value


def set_code(feature_image: str) -> str:
    path = feature_image.split("?", 1)[0].strip("/")
    parts = path.split("/")
    if len(parts) >= 2:
        return parts[-2]
    filename = parts[-1] if parts else path
    return filename.split("_", 1)[0] if "_" in filename else ""


def to_lines(raw_html: str) -> list[str]:
    s = re.sub(r"<script\b[\s\S]*?</script>", " ", raw_html, flags=re.I)
    s = re.sub(r"<style\b[\s\S]*?</style>", " ", s, flags=re.I)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(
        r"</(?:div|p|li|dt|dd|h1|h2|h3|h4|h5|span|strong|a|td|tr|section|article)>",
        "\n",
        s,
        flags=re.I,
    )
    s = re.sub(r"<[^>]+>", " ", s)
    s = html_lib.unescape(s)
    return [re.sub(r"\s+", " ", line).strip() for line in s.splitlines() if re.sub(r"\s+", " ", line).strip()]


def parse_detail(raw_html: str, internal_id: str, feature_image: str) -> dict[str, str]:
    lines = to_lines(raw_html)
    illustrator = ""
    artist_index = -1
    for i, line in enumerate(lines):
        if re.fullmatch(r"일러스트\s*", line):
            for j in range(i + 1, min(len(lines), i + 6)):
                if lines[j]:
                    illustrator = lines[j].strip()
                    artist_index = j
                    break
            if illustrator:
                break

    name = ""
    if artist_index >= 0:
        for line in lines[artist_index + 1 : artist_index + 13]:
            candidate = line.strip()
            if not candidate:
                continue
            if re.match(r"^HP\s*\d+", candidate):
                continue
            if re.match(r"^카드 종류\s*:", candidate):
                continue
            if re.match(r"^Image(?:Image)*", candidate):
                continue
            if re.match(r"^\d{1,3}/", candidate):
                continue
            if candidate in {"관련카드", "특성", "약점", "저항력", "후퇴"}:
                continue
            name = candidate
            break

    printed = ""
    rarity = ""
    number_re = re.compile(r"(?<!\d)(\d{1,3}/(?:\d{1,3}|[A-Za-z][A-Za-z0-9-]*))(?:\s+([A-Z][A-Z0-9]*))?")
    for line in lines:
        m = number_re.search(line)
        if m:
            printed = m.group(1)
            rarity = m.group(2) or ""
            break

    image = feature_image if feature_image.startswith("http") else IMAGE_PREFIX + feature_image.lstrip("/")
    return {
        "internalCardNum": internal_id.strip(),
        "canonicalInternal": canonical_internal(internal_id),
        "illustrator": illustrator,
        "name": name,
        "set": set_code(feature_image),
        "rarity": rarity,
        "printedNumber": printed,
        "cardNumber": f"{printed} {rarity}".strip(),
        "image": image,
        "source": DETAIL_PREFIX + internal_id.strip(),
    }


class OfficialClient:
    def __init__(self) -> None:
        jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
            "Accept-Language": "ko-KR,ko;q=0.9",
        }
        self.get(CARDS_URL)

    def get(self, url: str) -> str:
        last: Exception | None = None
        for attempt in range(1, 5):
            try:
                req = urllib.request.Request(url, headers=self.headers)
                with self.opener.open(req, timeout=45) as response:
                    return response.read().decode("utf-8", "ignore")
            except Exception as exc:  # noqa: BLE001
                last = exc
                time.sleep(0.25 * attempt)
        assert last is not None
        raise last

    def multipart_post(self, fields: dict[str, str]) -> str:
        boundary = "----ChatGPTPokemonKoreaBoundary7MA4YWxkTrZu0gW"
        chunks: list[bytes] = []
        for key, value in fields.items():
            chunks.append(f"--{boundary}\r\n".encode())
            chunks.append(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode())
            chunks.append(str(value).encode("utf-8"))
            chunks.append(b"\r\n")
        chunks.append(f"--{boundary}--\r\n".encode())
        body = b"".join(chunks)
        headers = dict(self.headers)
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        headers["X-Requested-With"] = "XMLHttpRequest"
        req = urllib.request.Request(SEARCH_URL, data=body, headers=headers, method="POST")
        last: Exception | None = None
        for attempt in range(1, 5):
            try:
                with self.opener.open(req, timeout=45) as response:
                    return response.read().decode("utf-8", "ignore")
            except Exception as exc:  # noqa: BLE001
                last = exc
                time.sleep(0.25 * attempt)
        assert last is not None
        raise last

    def search_artist(self, artist: str) -> list[dict[str, str]]:
        rows: list[dict[str, str]] = []
        limit = 0
        seen: set[int] = set()
        while True:
            if limit in seen:
                raise RuntimeError(f"Pagination loop for {artist} at {limit}")
            seen.add(limit)
            raw = self.multipart_post(
                {
                    "action": "search_text_cards",
                    "search_text": artist,
                    "search_params": "all",
                    "limit": str(limit),
                }
            )
            start = raw.find("{")
            if start < 0:
                raise RuntimeError(f"No JSON returned for {artist}: {raw[:300]}")
            obj = json.loads(raw[start:])
            count = int(obj.get("count") or 0)
            if count <= 0:
                break
            result = obj.get("result") or {}
            values = result.values() if isinstance(result, dict) else result
            for value in values:
                rows.append(
                    {
                        "artist": artist,
                        "internalCardNum": str(value.get("CardNum") or "").strip(),
                        "featureImage": str(value.get("feature_image") or "").strip(),
                    }
                )
            next_limit = int(obj.get("limit") or 0)
            if next_limit == limit:
                raise RuntimeError(f"Pagination did not advance for {artist} at {limit}")
            limit = next_limit
        return rows


def update_validator(artist_names: list[str], card_count: int) -> None:
    text = VALIDATOR_PATH.read_text(encoding="utf-8")
    rendered = "EXPECTED_ARTISTS = [\n" + "".join(f'    {json.dumps(name, ensure_ascii=False)},\n' for name in artist_names) + "]"
    text, n1 = re.subn(r"EXPECTED_ARTISTS = \[.*?\n\]", rendered, text, count=1, flags=re.S)
    text, n2 = re.subn(r"EXPECTED_CARD_COUNT = \d+", f"EXPECTED_CARD_COUNT = {card_count}", text, count=1)
    text = text.replace("approved 39-artist catalog", "approved artist catalog")
    if n1 != 1 or n2 != 1:
        raise RuntimeError("Could not update artist validator constants")
    VALIDATOR_PATH.write_text(text, encoding="utf-8")


def update_priority(verified_counts: dict[str, int]) -> None:
    payload = json.loads(PRIORITY_PATH.read_text(encoding="utf-8"))
    for section in ("individualRanking", "studioRanking"):
        for row in payload.get(section, []):
            name = row.get("name")
            if name in verified_counts:
                row["status"] = "completed"
                row["verifiedKoreanCardCount"] = verified_counts[name]
                row["verificationSource"] = "Pokemon Korea official card search + exact detail illustrator match"
    PRIORITY_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    existing = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    current_groups = existing.get("artists") or []
    current_names = {group.get("name") for group in current_groups}
    already = sorted(set(ARTISTS) & current_names)
    if already:
        raise RuntimeError(f"Top-10 artists already present; refusing duplicate merge: {already}")

    client = OfficialClient()
    all_groups: list[dict] = []
    audit_artists: list[dict] = []
    verified_counts: dict[str, int] = {}

    for artist in ARTISTS:
        candidates = client.search_artist(artist)
        if not candidates:
            raise RuntimeError(f"Pokemon Korea returned zero search results for {artist}")

        exact: list[dict[str, str]] = []
        partial: list[dict[str, str]] = []
        unprocessed: list[dict[str, str]] = []
        detail_cache: dict[str, dict[str, str]] = {}

        for idx, candidate in enumerate(candidates, start=1):
            card_id = candidate["internalCardNum"]
            try:
                if card_id in detail_cache:
                    detail = detail_cache[card_id]
                else:
                    raw_html = client.get(DETAIL_PREFIX + card_id)
                    detail = parse_detail(raw_html, card_id, candidate["featureImage"])
                    detail_cache[card_id] = detail
                if not detail["illustrator"] or not detail["name"] or not detail["printedNumber"] or not detail["set"]:
                    unprocessed.append({"id": card_id, "reason": "detail_parse_incomplete", **detail})
                elif normalize_artist(detail["illustrator"]) == normalize_artist(artist):
                    exact.append(detail)
                else:
                    partial.append(
                        {
                            "id": card_id,
                            "actualIllustrator": detail["illustrator"],
                            "name": detail["name"],
                            "cardNumber": detail["cardNumber"],
                        }
                    )
            except Exception as exc:  # noqa: BLE001
                unprocessed.append({"id": card_id, "reason": str(exc)})
            if idx % 100 == 0:
                print(f"{artist}: verified {idx}/{len(candidates)}")

        if unprocessed:
            sample = unprocessed[:5]
            raise RuntimeError(f"{artist}: {len(unprocessed)} official rows could not be fully verified; sample={sample}")
        if not exact:
            raise RuntimeError(f"{artist}: no exact official illustrator matches")

        seen_canonical: set[str] = set()
        final_rows: list[dict[str, str]] = []
        duplicate_count = 0
        for detail in exact:
            key = detail["canonicalInternal"].casefold()
            if key in seen_canonical:
                duplicate_count += 1
                continue
            seen_canonical.add(key)
            final_rows.append(detail)

        cards: list[dict] = []
        for order, row in enumerate(final_rows, start=1):
            if not row["image"].startswith(IMAGE_PREFIX):
                raise RuntimeError(f"{artist}: non-official Korean image {row['image']}")
            cards.append(
                {
                    "order": order,
                    "name": row["name"],
                    "status": "미보유",
                    "owned": False,
                    "set": row["set"],
                    "rarity": row["rarity"],
                    "image": row["image"],
                    "imageBw": "",
                    "source": row["source"],
                    "cardNumber": row["cardNumber"],
                }
            )
        verified_counts[artist] = len(cards)
        all_groups.append({"name": artist, "cards": cards})
        audit_artists.append(
            {
                "name": artist,
                "searchResults": len(candidates),
                "exactIllustratorMatches": len(exact),
                "partialMatchesExcluded": len(partial),
                "mirrorDuplicateRowsRemoved": duplicate_count,
                "finalKoreanCardCount": len(cards),
                "unprocessed": 0,
                "partialSamples": partial[:10],
            }
        )
        print(f"{artist}: search={len(candidates)} exact={len(exact)} partial={len(partial)} final={len(cards)}")

    merged = current_groups + all_groups
    merged.sort(key=lambda group: normalize_artist(str(group.get("name") or "")))
    for group in merged:
        for order, card in enumerate(group.get("cards") or [], start=1):
            card["order"] = order
            card["owned"] = False
            card["status"] = "미보유"

    total_cards = sum(len(group.get("cards") or []) for group in merged)
    existing["source"] = "Pokemon Korea official card search"
    existing["sourceUrl"] = CARDS_URL
    existing["artistCount"] = len(merged)
    existing["cardCount"] = total_cards
    existing["ownedCount"] = 0
    existing["artists"] = merged
    DATA_PATH.write_text(json.dumps(existing, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    update_validator([group["name"] for group in merged], total_cards)
    update_priority(verified_counts)

    audit = {
        "snapshotDate": "2026-08-26",
        "scope": "Korean cards returned by Pokemon Korea official card search only",
        "verification": "Every accepted row requires exact illustrator match on the Pokemon Korea detail page",
        "japaneseEnglishOnlyExcluded": True,
        "artistsAdded": ARTISTS,
        "previousArtistCount": len(current_groups),
        "newArtistCount": len(merged),
        "previousCardCount": sum(len(group.get("cards") or []) for group in current_groups),
        "newCardCount": total_cards,
        "addedCardCount": sum(verified_counts.values()),
        "artistResults": audit_artists,
    }
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
