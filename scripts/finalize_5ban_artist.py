#!/usr/bin/env python3
"""Align artist catalog validators, counts, navigation and regression tests after adding 5ban Graphics."""
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def main() -> None:
    validator = Path("scripts/validate_artist_data.py")
    text = validator.read_text(encoding="utf-8")
    if '    "5ban Graphics",\n' not in text:
        text = text.replace('EXPECTED_ARTISTS = [\n', 'EXPECTED_ARTISTS = [\n    "5ban Graphics",\n', 1)
    if '    "5ban Graphics", "Naoki Saito"' not in text:
        text = text.replace(
            'NEW_ARTISTS = {\n    "Naoki Saito",',
            'NEW_ARTISTS = {\n    "5ban Graphics", "Naoki Saito",',
            1,
        )
    text = text.replace("EXPECTED_CARD_COUNT = 3382", "EXPECTED_CARD_COUNT = 4093")
    text = text.replace("approved 39-artist catalog", "approved 40-artist catalog")
    text = text.replace(
        'elif artist_name in NEW_ARTISTS and card["source"] == OFFICIAL_CARDS_URL:',
        'elif (artist_name in NEW_ARTISTS or card["set"] == "M6") and card["source"] == OFFICIAL_CARDS_URL:',
    )
    validator.write_text(text, encoding="utf-8")

    registry = Path("collector-collection-registry.js")
    text = registry.read_text(encoding="utf-8")
    marker = '''    artist: {\n      number: "03",\n      title: "작가 도감",\n      description: "일러스트레이터별 카드",\n      href: "./artists.html",\n      documentId: "artistDex",\n      unit: "장",\n      catalogCount: 3382,'''
    replacement = marker.replace("catalogCount: 3382", "catalogCount: 4093")
    if marker in text:
        text = text.replace(marker, replacement, 1)
    elif replacement not in text:
        raise RuntimeError("Artist catalog count marker not found")
    registry.write_text(text, encoding="utf-8")

    artists_js = Path("artists.js")
    text = artists_js.read_text(encoding="utf-8")
    text = text.replace(
        'const DATA_URL="./data/artists.json?v=20260826-2";',
        'const DATA_URL="./data/artists.json?v=20260901-1";',
        1,
    )
    artists_js.write_text(text, encoding="utf-8")

    nav = Path("collector-nav.js")
    text = nav.read_text(encoding="utf-8")
    addition = '''\n    const artists = nav.querySelector('[href*="artists.html"]');\n    const artistCount = artists?.querySelector("small");\n    if (artistCount) artistCount.textContent = "40 ARTISTS";\n'''
    anchor = '''    const pokemonCollections = nav.querySelector('[href*="pokemon-collections.html"]');\n    const pokemonCount = pokemonCollections?.querySelector("small");\n    if (pokemonCount) pokemonCount.textContent = "67 POKÉMON";\n'''
    if addition.strip() not in text:
        if anchor not in text:
            raise RuntimeError("Collector navigation marker not found")
        text = text.replace(anchor, anchor + addition, 1)
    nav.write_text(text, encoding="utf-8")

    tests = Path("tests/collector-registry.test.mjs")
    text = tests.read_text(encoding="utf-8")
    text = text.replace("    artist: 3382,", "    artist: 4093,", 1)
    text = text.replace("    artist: 39,", "    artist: 40,", 1)
    tests.write_text(text, encoding="utf-8")

    print("Finalized 5ban Graphics artist catalog metadata and regression expectations")


if __name__ == "__main__":
    main()
