#!/usr/bin/env python3
"""Build a staging-only catalog for the ranked top 10 artists.

This intentionally does NOT touch data/artists.json.  The production merge stays
blocked until legacy DP/BW/XY verification is explicitly marked complete.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "data" / "artists-top10-local-official.json"
CDN_PATH = ROOT / "data" / "artist-top10-unresolved-cdn.json"
OUT_PATH = ROOT / "data" / "artists-top10-staging.json"
STABILITY_PATH = ROOT / "data" / "artist-top10-stability.json"

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
EXPECTED_BASE = 1191
EXPECTED_UNRESOLVED = 58
EXPECTED_FOUND = 52
EXPECTED_MISSING = 6
EXPECTED_STAGING = 1243
EXPECTED_MISSING_KEYS = {
    ("Ken Sugimori", "SM6", 104),
    ("Ken Sugimori", "SM6", 105),
    ("Masakazu Fukuda", "S10D", 2),
    ("Hideki Ishikawa", "S8", 121),
    ("Hideki Ishikawa", "S8", 112),
    ("Hideki Ishikawa", "SM6", 103),
}
SET_DENOMINATORS = {
    "SV4A": "190",
    "CP1": "034",
    "CP2": "027",
    "S8": "100",
    "S9": "100",
    "S9A": "067",
    "S10A": "071",
}


def normalized_url(value: str) -> str:
    p = urlsplit(str(value or ""))
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path, "", ""))


def number_from_card(card: dict) -> int:
    value = str(card.get("cardNumber") or "")
    match = re.search(r"(\d+)", value)
    return int(match.group(1)) if match else 99999


def set_sort_key(set_name: str) -> tuple:
    s = str(set_name or "")
    u = s.upper()
    if u.startswith("M") and not u.startswith("SM"):
        era = 0
    elif u.startswith("SV"):
        era = 1
    elif u.startswith("S") and not u.startswith("SM"):
        era = 2
    elif u.startswith("SM"):
        era = 3
    elif u.startswith("XY") or u.startswith("CP"):
        era = 4
    elif u.startswith("BW"):
        era = 5
    elif u.startswith("DP"):
        era = 6
    else:
        era = 7
    nums = tuple(int(x) for x in re.findall(r"\d+", u))
    return (era, tuple(-x for x in nums), u.casefold())


def card_sort_key(card: dict) -> tuple:
    return (*set_sort_key(str(card.get("set") or "")), number_from_card(card), normalized_url(card.get("image", "")))


def card_number(set_name: str, number: int, rarity: str) -> str:
    denominator = SET_DENOMINATORS.get(set_name.upper())
    base = f"{number:03d}/{denominator}" if denominator else f"{number:03d}"
    rarity = str(rarity or "").strip()
    return f"{base} {rarity}".strip()


def main() -> None:
    base = json.loads(BASE_PATH.read_text(encoding="utf-8"))
    cdn = json.loads(CDN_PATH.read_text(encoding="utf-8"))

    assert base.get("artistCount") == 10
    assert base.get("cardCount") == EXPECTED_BASE
    assert base.get("ownedCount") == 0
    assert [a.get("name") for a in base.get("artists", [])] == TARGETS

    totals = cdn.get("totals") or {}
    assert totals.get("input") == EXPECTED_UNRESOLVED
    assert totals.get("found") == EXPECTED_FOUND
    assert totals.get("missing") == EXPECTED_MISSING

    missing_keys = {
        (row.get("artist"), str(row.get("set") or ""), int(row.get("number") or 0))
        for rows in (cdn.get("artists") or {}).values()
        for row in rows
        if not row.get("exists")
    }
    assert missing_keys == EXPECTED_MISSING_KEYS, (missing_keys, EXPECTED_MISSING_KEYS)

    base_by_artist = {a["name"]: deepcopy(a["cards"]) for a in base["artists"]}
    found_rows = []
    for artist in TARGETS:
        for row in (cdn.get("artists") or {}).get(artist, []):
            if not row.get("exists"):
                continue
            assert row.get("name"), row
            assert row.get("image"), row
            found_rows.append(row)
            base_by_artist[artist].append(
                {
                    "name": row["name"],
                    "owned": False,
                    "set": row["set"],
                    "rarity": str(row.get("rarity") or ""),
                    "image": row["image"],
                    "imageBw": "",
                    "source": "https://pokemoncard.co.kr/cards",
                    "cardNumber": card_number(str(row["set"]), int(row["number"]), str(row.get("rarity") or "")),
                    "order": 0,
                }
            )

    assert len(found_rows) == EXPECTED_FOUND

    staged_artists = []
    duplicate_images = []
    for artist in TARGETS:
        cards = base_by_artist[artist]
        seen = {}
        unique = []
        for card in cards:
            image_key = normalized_url(card.get("image", ""))
            if not image_key:
                raise AssertionError(f"missing image: {artist}: {card}")
            if image_key in seen:
                duplicate_images.append((artist, image_key, seen[image_key].get("name"), card.get("name")))
                continue
            seen[image_key] = card
            unique.append(card)
        unique.sort(key=card_sort_key)
        for idx, card in enumerate(unique, 1):
            card["order"] = idx
            card["owned"] = False
        staged_artists.append({"name": artist, "cards": unique})

    if duplicate_images:
        raise AssertionError(f"duplicate official images in staging: {duplicate_images[:10]}")

    staging_count = sum(len(a["cards"]) for a in staged_artists)
    assert staging_count == EXPECTED_STAGING, staging_count

    payload = {
        "source": "Pokemon Korea official-image staging; production merge blocked pending legacy verification",
        "status": "staging-only",
        "legacyVerification": "pending",
        "productionMergeAllowed": False,
        "artistCount": len(staged_artists),
        "cardCount": staging_count,
        "ownedCount": 0,
        "artists": staged_artists,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    stability = {
        "status": "stable-staging",
        "scope": "ranked top 10 Korean cards only",
        "baseCardCount": EXPECTED_BASE,
        "unresolvedCandidateCount": EXPECTED_UNRESOLVED,
        "officialCdnFoundCount": EXPECTED_FOUND,
        "officialCdnMissingCount": EXPECTED_MISSING,
        "stagingCardCount": staging_count,
        "excludedCandidates": [
            {"artist": a, "set": s, "number": n}
            for a, s, n in sorted(EXPECTED_MISSING_KEYS, key=lambda x: (x[0].casefold(), x[1].casefold(), x[2]))
        ],
        "legacyVerification": {
            "status": "pending",
            "eras": ["DP", "BW", "XY"],
            "productionMergeAllowed": False,
            "reason": "Legacy Korean releases require a final official cross-check before data/artists.json may be changed.",
        },
        "safetyGates": [
            "data/artists.json remains unchanged at 39 artists / 3382 cards",
            "all staged base ownership values are false",
            "all staged images use the Pokemon Korea official image CDN",
            "the 6 Korean-image-missing candidates are excluded",
            "duplicate normalized image URLs are forbidden within each artist",
            "production merge stays blocked until legacyVerification is complete",
        ],
    }
    STABILITY_PATH.write_text(json.dumps(stability, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"artists": 10, "base": EXPECTED_BASE, "found": EXPECTED_FOUND, "missing": EXPECTED_MISSING, "staging": staging_count}, ensure_ascii=False))


if __name__ == "__main__":
    main()
