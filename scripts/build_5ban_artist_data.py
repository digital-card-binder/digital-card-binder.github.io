#!/usr/bin/env python3
"""Add the verified Korean 5ban Graphics catalog to the committed artist dex."""
from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from pathlib import Path

import build_popular_artist_data as common

ARTIST = "5ban Graphics"
ALLOWED_ERAS = {"SM", "S", "SV", "M"}
EXPECTED_MATCHED_BASE = 685
EXPECTED_5BAN_TOTAL = 1443
EXPECTED_FINAL_TOTAL = 4838
OFFICIAL_CARDS_URL = common.OFFICIAL_CARDS_URL
OFFICIAL_IMAGE_PREFIX = common.OFFICIAL_IMAGE_PREFIX

# M6 is served by mega-latest.js rather than data/series.json, so these verified
# 5ban Graphics credits are added explicitly.
M6_5BAN = [
    (9, "메가갑주무사 ex", "RR"),
    (15, "히트로토무 ex", "RR"),
    (21, "약어리 ex", "RR"),
    (33, "메가골루그 ex", "RR"),
    (48, "메가칼라마네로 ex", "RR"),
    (62, "파이어로 ex", "RR"),
    (89, "메가갑주무사 ex", "SR"),
    (90, "히트로토무 ex", "SR"),
    (91, "약어리 ex", "SR"),
    (93, "메가골루그 ex", "SR"),
    (94, "메가칼라마네로 ex", "SR"),
    (95, "메가레쿠쟈 ex", "SR"),
    (96, "파이어로 ex", "SR"),
]

# These were previously supplied at runtime. Commit them into artists.json so
# the artist page, dashboard, public projections and counts all share one base.
M6_EXISTING_ARTISTS = [
    ("Jerky", 8, "꼬시레", "C"),
    ("kodama", 17, "만타인", "C"),
    ("Yukihiro Tada", 27, "찌리비", "C"),
    ("OKACHEKE", 28, "찌리비크", "U"),
    ("Shinji Kanda", 46, "깜까미", "C"),
    ("kawayoo", 47, "오케이징", "C"),
    ("AKIRA EGAWA", 49, "크리만", "U"),
    ("Mitsuhiro Arita", 52, "짜랑고우거", "R"),
    ("Saboteri", 53, "모토마", "C"),
    ("Tetsu Kayama", 82, "찌르성게", "AR"),
    ("Narumi Sato", 86, "루리리", "AR"),
    ("kodama", 87, "파비코리", "AR"),
    ("Tomokazu Komiya", 88, "켈리몬", "AR"),
]


def m6_card(number: int, name: str, rarity: str) -> dict:
    token = f"{number:03d}"
    return {
        "order": 0,
        "name": name,
        "owned": False,
        "set": "M6",
        "rarity": rarity,
        "image": f"https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6/M6_{token}.png?w=400",
        "imageBw": "",
        "source": OFFICIAL_CARDS_URL,
        "cardNumber": f"{token}/076 {rarity}",
    }


def illustrator_rows(base: str):
    rows = []
    for root, _, files in os.walk(base):
        for filename in files:
            if not filename.endswith(".ts") or not re.fullmatch(r"0*\d+\.ts", filename):
                continue
            path = os.path.join(root, filename)
            relative = os.path.relpath(path, base)
            parts = relative.split(os.sep)
            if len(parts) < 3 or parts[0] not in ALLOWED_ERAS:
                continue
            text = Path(path).read_text(encoding="utf-8", errors="ignore")
            match = re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]", text)
            if not match or match.group(1).strip().casefold() != ARTIST.casefold():
                continue
            rows.append((parts[0], parts[1], int(Path(filename).stem), relative))
    return rows


def build_5ban_group(existing_cards: list[dict] | None = None) -> dict:
    local_index = common.build_local_index()
    with tempfile.TemporaryDirectory() as tempdir:
        repo = os.path.join(tempdir, "tcgdex")
        common.clone_tcgdex(repo)
        base = os.path.join(repo, "data-asia")
        matches = sorted(illustrator_rows(base), key=common.set_sort_key)

        cards = []
        seen_images = set()
        for era, set_name, number, _ in matches:
            if set_name.casefold() == "m6":
                continue
            local_rows = local_index.get((set_name.casefold(), number), [])
            preferred = sorted(
                local_rows,
                key=lambda row: (
                    bool(str(row.get("name") or "").strip()),
                    bool(common.row_name(row)),
                ),
                reverse=True,
            )
            for row in preferred:
                card = common.normalize_local_card(row, set_name, number)
                image = str(card.get("image") or "")
                image_id = common.normalized_image(image)
                if not card.get("name") or not image.startswith(OFFICIAL_IMAGE_PREFIX):
                    continue
                if image_id in seen_images:
                    continue
                seen_images.add(image_id)
                cards.append(card)

    if len(cards) != EXPECTED_MATCHED_BASE:
        raise RuntimeError(
            f"5ban Graphics matched base changed: expected {EXPECTED_MATCHED_BASE}, got {len(cards)}"
        )

    m6 = [m6_card(number, name, rarity) for number, name, rarity in M6_5BAN]
    cards = m6 + cards

    # Preserve officially reconciled Korean legacy rows that are outside the
    # modern TCGdex/local-image build floor. This prevents a routine rebuild
    # from deleting the BW/XY catalog added by reconcile_5ban_legacy.py.
    seen_images = {common.normalized_image(str(card.get("image") or "")) for card in cards}
    for existing in existing_cards or []:
        image = str(existing.get("image") or "")
        image_id = common.normalized_image(image)
        if not image.startswith(OFFICIAL_IMAGE_PREFIX) or image_id in seen_images:
            continue
        preserved = dict(existing)
        preserved["owned"] = False
        cards.append(preserved)
        seen_images.add(image_id)

    for order, card in enumerate(cards, start=1):
        card["order"] = order

    if len(cards) != EXPECTED_5BAN_TOTAL:
        raise RuntimeError(
            f"5ban Graphics total changed: expected {EXPECTED_5BAN_TOTAL}, got {len(cards)}"
        )
    return {"name": ARTIST, "cards": cards}


def prepend_missing_m6(artist: dict, rows: list[tuple[int, str, str]]) -> None:
    cards = artist.get("cards") or []
    existing = {
        int(match.group(1))
        for card in cards
        if str(card.get("set") or "").casefold() == "m6"
        for match in [re.match(r"^(\d+)", str(card.get("cardNumber") or ""))]
        if match
    }
    extras = [m6_card(number, name, rarity) for number, name, rarity in rows if number not in existing]
    if extras:
        cards[:] = extras + cards
    for order, card in enumerate(cards, start=1):
        card["order"] = order


def main() -> None:
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "data/artists.json")
    payload = json.loads(target.read_text(encoding="utf-8"))
    existing_fiveban = next(
        (artist for artist in payload.get("artists", []) if artist.get("name") == ARTIST),
        {"cards": []},
    )
    artists = [artist for artist in payload.get("artists", []) if artist.get("name") != ARTIST]

    by_name = {artist.get("name"): artist for artist in artists}
    grouped = {}
    for artist_name, number, name, rarity in M6_EXISTING_ARTISTS:
        grouped.setdefault(artist_name, []).append((number, name, rarity))
    for artist_name, rows in grouped.items():
        artist = by_name.get(artist_name)
        if not artist:
            raise RuntimeError(f"Missing existing artist for M6 backfill: {artist_name}")
        prepend_missing_m6(artist, rows)

    fiveban = build_5ban_group(list(existing_fiveban.get("cards") or []))
    artists.append(fiveban)
    artists.sort(key=lambda artist: str(artist.get("name") or "").casefold())

    payload["artists"] = artists
    payload["artistCount"] = len(artists)
    payload["cardCount"] = sum(len(artist.get("cards") or []) for artist in artists)
    payload["ownedCount"] = 0

    if payload["artistCount"] != 40:
        raise RuntimeError(f"Expected 40 artists, got {payload['artistCount']}")
    if payload["cardCount"] != EXPECTED_FINAL_TOTAL:
        raise RuntimeError(
            f"Expected {EXPECTED_FINAL_TOTAL} artist cards, got {payload['cardCount']}"
        )

    target.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Updated {target}: {payload['artistCount']} artists / {payload['cardCount']} cards")
    print(f"  {ARTIST}: {len(fiveban['cards'])} cards")


if __name__ == "__main__":
    main()
