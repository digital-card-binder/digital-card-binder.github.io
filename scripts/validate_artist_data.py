#!/usr/bin/env python3
"""Validate the committed Pokemon Korea official artist-dex dataset."""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

EXPECTED_ARTISTS = [
    "Narumi Sato",
    "OKACHEKE",
    "Shinji Kanda",
    "Asako Ito",
    "Gapao",
    "Yukihiro Tada",
    "Tetsu Kayama",
    "Jerky",
    "Pani kobayashi",
    "Ounishi",
    "Sachiko Adachi",
    "Yuka Morii",
    "Tomokazu Komiya",
    "AKIRA EGAWA",
    "OOYAMA",
    "HYOGONOSUKE",
    "miki kudo",
    "Miki Tanaka",
    "sui",
    "Atsuko Nishida",
    "Aya Kusube",
    "Shibuzoh",
    "Saya Tsuruta",
    "ryoma uratsuka",
    "Tika Matsuno",
    "sowsow",
    "Yukiko Baba",
    "Sekio",
    "Naoyo Kimura",
]

EXPECTED_CARD_COUNT = 2451
OFFICIAL_IMAGE_PREFIX = "https://cards.image.pokemonkorea.co.kr/data/"
OFFICIAL_DETAIL_PREFIX = "https://pokemoncard.co.kr/cards/detail/"

PRESERVED_NUMBER_COLLISIONS = {
    ("sui", "BW6", "008/059 C"): {"치릴리", "소미안"},
    ("Sekio", "S10", "018/067 C"): {"사랑동이", "스완나"},
    ("Shibuzoh", "S7", "055/067 C"): {"노라키", "배우르"},
}


def fail(message: str) -> None:
    raise AssertionError(message)


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/artists.json")
    payload = json.loads(path.read_text(encoding="utf-8"))

    if payload.get("source") != "Pokemon Korea official card search":
        fail(f"Unexpected source: {payload.get('source')!r}")
    if payload.get("sourceUrl") != "https://pokemoncard.co.kr/cards":
        fail(f"Unexpected sourceUrl: {payload.get('sourceUrl')!r}")
    if payload.get("artistCount") != len(EXPECTED_ARTISTS):
        fail(f"Unexpected artistCount: {payload.get('artistCount')!r}")
    if payload.get("cardCount") != EXPECTED_CARD_COUNT:
        fail(f"Unexpected cardCount: {payload.get('cardCount')!r}")
    if payload.get("ownedCount") != 0:
        fail(f"Base artist dataset must start at 0 owned cards: {payload.get('ownedCount')!r}")

    artists = payload.get("artists")
    if not isinstance(artists, list):
        fail("artists must be a list")

    actual_names = [artist.get("name") for artist in artists]
    if actual_names != EXPECTED_ARTISTS:
        fail("Artist list/order does not match the approved 29-artist catalog")
    if "Shibuzoh." in actual_names:
        fail("Shibuzoh must not include a trailing period")

    total = 0
    identities: set[tuple[str, str, str, str]] = set()
    coarse: dict[tuple[str, str, str], set[str]] = defaultdict(set)
    hyogo_special = False

    for artist in artists:
        artist_name = artist["name"]
        cards = artist.get("cards")
        if not isinstance(cards, list):
            fail(f"{artist_name}: cards must be a list")

        expected_order = 1
        for card in cards:
            total += 1
            if card.get("order") != expected_order:
                fail(
                    f"{artist_name}: order must be sequential; expected {expected_order}, "
                    f"got {card.get('order')!r}"
                )
            expected_order += 1

            for field in ("name", "set", "image", "source", "cardNumber"):
                value = card.get(field)
                if not isinstance(value, str) or not value.strip():
                    fail(f"{artist_name}: missing {field} on order {card.get('order')}")

            if card.get("owned") is not False:
                fail(f"{artist_name}: base owned must be false on order {card.get('order')}")
            if not card["image"].startswith(OFFICIAL_IMAGE_PREFIX):
                fail(f"{artist_name}: non-official image URL: {card['image']}")
            if not card["source"].startswith(OFFICIAL_DETAIL_PREFIX):
                fail(f"{artist_name}: non-official detail source: {card['source']}")

            identity = (artist_name, card["set"], card["cardNumber"], card["name"])
            if identity in identities:
                fail(f"Duplicate artist/set/cardNumber/name identity: {identity}")
            identities.add(identity)
            coarse[(artist_name, card["set"], card["cardNumber"])].add(card["name"])

            if (
                artist_name == "HYOGONOSUKE"
                and card["set"] == "S12a"
                and card["cardNumber"] == "173/172 AR"
                and card["name"] == "히스이 찌리리공"
            ):
                hyogo_special = True

    if total != EXPECTED_CARD_COUNT:
        fail(f"Unexpected total cards from groups: {total}")

    for key, expected_names in PRESERVED_NUMBER_COLLISIONS.items():
        actual = coarse.get(key, set())
        if actual != expected_names:
            fail(f"Required number collision was not preserved for {key}: {sorted(actual)}")

    if not hyogo_special:
        fail("Missing repaired HYOGONOSUKE S12a 173/172 AR card")

    print(
        f"Artist dataset OK: {len(artists)} artists, {total} cards, "
        f"{len(identities)} unique artist/set/cardNumber/name identities"
    )


if __name__ == "__main__":
    main()
