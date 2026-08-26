#!/usr/bin/env python3
"""Validate staging safety for the ranked top 10 Korean artist batch."""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STAGING_PATH = ROOT / "data" / "artists-top10-staging.json"
STABILITY_PATH = ROOT / "data" / "artist-top10-stability.json"
PRODUCTION_PATH = ROOT / "data" / "artists.json"
CDN_PATH = ROOT / "data" / "artist-top10-unresolved-cdn.json"
PREFIX = "https://cards.image.pokemonkorea.co.kr/data/"
TARGETS = [
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
EXPECTED_PRODUCTION_ARTISTS = 39
EXPECTED_PRODUCTION_CARDS = 3382
EXPECTED_STAGING_CARDS = 1243
EXPECTED_FOUND = 52
EXPECTED_MISSING = 6


def norm(value: str) -> str:
    p = urlsplit(str(value or ""))
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path, "", ""))


def check_url(url: str) -> tuple[str, bool, str]:
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-31"})
        with urlopen(req, timeout=15) as response:
            body = response.read(32)
            content_type = str(response.headers.get("Content-Type") or "")
            ok = response.status in (200, 206) and content_type.startswith("image/") and (
                body.startswith(b"\x89PNG") or body.startswith(b"\xff\xd8") or body.startswith(b"RIFF")
            )
            return url, ok, f"{response.status} {content_type}"
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        return url, False, repr(exc)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--network", action="store_true", help="Recheck the 52 newly resolved official CDN images")
    args = parser.parse_args()

    staging = json.loads(STAGING_PATH.read_text(encoding="utf-8"))
    stability = json.loads(STABILITY_PATH.read_text(encoding="utf-8"))
    production = json.loads(PRODUCTION_PATH.read_text(encoding="utf-8"))
    cdn = json.loads(CDN_PATH.read_text(encoding="utf-8"))

    assert staging.get("status") == "staging-only"
    assert staging.get("legacyVerification") == "pending"
    assert staging.get("productionMergeAllowed") is False
    assert staging.get("artistCount") == 10
    assert staging.get("cardCount") == EXPECTED_STAGING_CARDS
    assert staging.get("ownedCount") == 0
    assert [a.get("name") for a in staging.get("artists", [])] == TARGETS

    assert stability.get("status") == "stable-staging"
    assert stability.get("stagingCardCount") == EXPECTED_STAGING_CARDS
    assert stability.get("officialCdnFoundCount") == EXPECTED_FOUND
    assert stability.get("officialCdnMissingCount") == EXPECTED_MISSING
    assert stability.get("legacyVerification", {}).get("status") == "pending"
    assert stability.get("legacyVerification", {}).get("productionMergeAllowed") is False

    # Production must remain untouched until legacy coverage is complete.
    assert production.get("artistCount") == EXPECTED_PRODUCTION_ARTISTS, production.get("artistCount")
    assert production.get("cardCount") == EXPECTED_PRODUCTION_CARDS, production.get("cardCount")
    assert production.get("ownedCount") == 0
    production_names = {a.get("name") for a in production.get("artists", [])}
    leaked = sorted(set(TARGETS) & production_names)
    assert not leaked, f"staging artists leaked into production: {leaked}"

    all_cards = 0
    for artist in staging["artists"]:
        name = artist["name"]
        cards = artist.get("cards") or []
        seen_images = set()
        seen_identity = set()
        for expected_order, card in enumerate(cards, 1):
            all_cards += 1
            assert card.get("order") == expected_order, (name, expected_order, card.get("order"))
            assert card.get("owned") is False, (name, card)
            assert str(card.get("name") or "").strip(), (name, card)
            assert str(card.get("set") or "").strip(), (name, card)
            assert str(card.get("cardNumber") or "").strip(), (name, card)
            image = str(card.get("image") or "")
            assert image.startswith(PREFIX), (name, image)
            image_key = norm(image)
            assert image_key not in seen_images, f"duplicate image in {name}: {image_key}"
            seen_images.add(image_key)
            identity = (
                str(card.get("set") or "").casefold(),
                str(card.get("cardNumber") or "").casefold(),
                str(card.get("name") or "").casefold(),
                image_key,
            )
            assert identity not in seen_identity, f"duplicate card identity in {name}: {identity}"
            seen_identity.add(identity)
    assert all_cards == EXPECTED_STAGING_CARDS

    totals = cdn.get("totals") or {}
    assert totals.get("found") == EXPECTED_FOUND
    assert totals.get("missing") == EXPECTED_MISSING
    found_urls = [
        row["image"]
        for rows in (cdn.get("artists") or {}).values()
        for row in rows
        if row.get("exists")
    ]
    missing_rows = [
        row
        for rows in (cdn.get("artists") or {}).values()
        for row in rows
        if not row.get("exists")
    ]
    assert len(found_urls) == EXPECTED_FOUND
    assert len(missing_rows) == EXPECTED_MISSING
    assert len({norm(u) for u in found_urls}) == EXPECTED_FOUND

    if args.network:
        failures = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            for url, ok, detail in pool.map(check_url, found_urls):
                if not ok:
                    failures.append((url, detail))
        assert not failures, f"official CDN failures: {failures[:10]}"

    print(
        json.dumps(
            {
                "production": {"artists": EXPECTED_PRODUCTION_ARTISTS, "cards": EXPECTED_PRODUCTION_CARDS},
                "staging": {"artists": 10, "cards": EXPECTED_STAGING_CARDS},
                "cdn": {"found": EXPECTED_FOUND, "missing": EXPECTED_MISSING},
                "legacyGate": "pending/blocked",
                "networkChecked": bool(args.network),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
