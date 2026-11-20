#!/usr/bin/env python3
"""Validate the committed Pokemon Korea official artist-dex dataset."""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

# 작가 목록·순서는 data/artist-roster.json 이 기준이다(새 작가는 목록에 추가하면 자동 동기화로 채워진다).
ROSTER_PATH = Path(__file__).resolve().parents[1] / "data" / "artist-roster.json"
EXPECTED_ARTISTS = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))["artists"]
MINIMUM_CARD_COUNT = 7331
OFFICIAL_CARDS_URL = "https://pokemoncard.co.kr/cards"
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
    if payload.get("sourceUrl") != OFFICIAL_CARDS_URL:
        fail(f"Unexpected sourceUrl: {payload.get('sourceUrl')!r}")
    if payload.get("artistCount") != len(payload.get("artists") or []) or payload.get("artistCount", 0) > len(EXPECTED_ARTISTS):
        fail(f"Unexpected artistCount: {payload.get('artistCount')!r}")
    if not isinstance(payload.get("cardCount"), int) or payload["cardCount"] < MINIMUM_CARD_COUNT:
        fail(f"Unexpected cardCount: {payload.get('cardCount')!r}")
    if payload.get("ownedCount") != 0:
        fail(f"Base artist dataset must start at 0 owned cards: {payload.get('ownedCount')!r}")

    artists = payload.get("artists")
    if not isinstance(artists, list):
        fail("artists must be a list")

    actual_names = [artist.get("name") for artist in artists]
    # 카드가 아직 확인되지 않은 작가는 도감에 나오지 않는다(목록 순서는 유지).
    expected_visible = [name for name in EXPECTED_ARTISTS if name in set(actual_names)]
    if actual_names != expected_visible or len(set(actual_names)) != len(actual_names):
        fail("Artist list/order does not match data/artist-roster.json")
    for artist in artists:
        if not artist.get("cards"):
            fail(f"Artist without cards must not be listed: {artist.get('name')}")
    if "Shibuzoh." in actual_names:
        fail("Shibuzoh must not include a trailing period")

    total = 0
    identities: set[tuple[str, str, str, str, str]] = set()
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
            # 공식 이미지가 없으면 시리즈 도감과 같은 한국 카드 이미지를 쓴다(자체 CDN으로 제공).
            if not card["image"].startswith(("https://", "http://")):
                fail(f"{artist_name}: invalid image URL: {card['image']}")
            if not card["image"].startswith(OFFICIAL_IMAGE_PREFIX) and card["source"] != OFFICIAL_CARDS_URL:
                fail(f"{artist_name}: catalog image without official card search source: {card['image']}")
            display_order = card.get("displayOrder")
            if display_order is not None and (not isinstance(display_order, int) or display_order < 1):
                fail(f"{artist_name}: invalid displayOrder on order {card.get('order')}")

            is_hyogo_special = (
                artist_name == "HYOGONOSUKE"
                and card["set"] == "S12a"
                and card["cardNumber"] == "173/172 AR"
                and card["name"] == "히스이 찌리리공"
            )
            if is_hyogo_special:
                if card["source"] != OFFICIAL_CARDS_URL:
                    fail(f"Unexpected source for HYOGONOSUKE special row: {card['source']}")
                hyogo_special = True
            elif card["source"].startswith(OFFICIAL_DETAIL_PREFIX):
                pass
            elif card["source"] == OFFICIAL_CARDS_URL:
                # Some committed Korean catalog rows have an official image/name but
                # no retained detail id. Keep Pokemon Korea's official card search
                # page as source rather than fabricating a detail URL.
                pass
            else:
                fail(f"{artist_name}: non-official detail source: {card['source']}")

            identity = (artist_name, card["set"], card["cardNumber"], card["name"], card["image"])
            if identity in identities:
                fail(f"Duplicate artist/set/cardNumber/name/image identity: {identity}")
            identities.add(identity)
            coarse[(artist_name, card["set"], card["cardNumber"])].add(card["name"])

    if total != payload.get("cardCount"):
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
