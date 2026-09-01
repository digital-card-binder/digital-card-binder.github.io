#!/usr/bin/env python3
"""Reconcile Korean BW/XY-era 5ban Graphics cards from Pokemon Korea.

The Pokemon Korea card search is the source of truth. This script enumerates
legacy Korean products through the official GoodsName selector, retrieves every
card through the site's AJAX endpoint, checks the illustrator on each official
detail page, de-duplicates repackage hits by official image identity, and
updates the committed artist catalog without touching ownership state.
"""
from __future__ import annotations

import concurrent.futures
import html
import json
from pathlib import Path
import re
import sys
from typing import Any

import build_legacy_series_data as official

ROOT = Path(__file__).resolve().parents[1]
ARTISTS_PATH = ROOT / "data" / "artists.json"
AUDIT_PATH = ROOT / "data" / "5ban-legacy-audit.json"
ARTIST = "5ban Graphics"


def is_legacy_product(value: str) -> bool:
    text = value.strip()
    if not text or "전체" in text:
        return False
    upper = text.upper()
    if "BW" in upper or "XY" in upper:
        return True
    # Korean League / event promos from the XY release window do not always
    # carry XY in the product name.
    if "프로모" in text and re.search(r"201[4-6]", text):
        return True
    return False


def fetch_product_records(product: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for card_type in (1, 2, 3):
        page = 0
        while True:
            batch = official.ajax_page(product, card_type, page)
            rows.extend({**row, "officialProduct": product} for row in batch)
            if len(batch) < 30:
                break
            page += 1
    return rows


def plain_lines(payload: str) -> list[str]:
    text = html.unescape(re.sub(r"<[^>]+>", "\n", payload))
    return [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]


def illustrator(payload: str) -> str:
    lines = plain_lines(payload)
    for index, line in enumerate(lines):
        if line == "일러스트":
            for candidate in lines[index + 1 : index + 5]:
                if candidate:
                    return candidate
    return ""


def normalized_image(value: str) -> str:
    return value.split("?", 1)[0].replace("http://", "https://").casefold()


def legacy_set_code(feature_image: str, product: str) -> str:
    path = feature_image.split("?", 1)[0]
    match = re.search(r"wmimages/(BW|XY)/([^/]+)/([^/]+)$", path, re.I)
    if match:
        _, folder, raw_filename = match.groups()
        if folder:
            return folder.upper()
        filename = raw_filename.rsplit(".", 1)[0]
    else:
        filename = path.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    prefix = re.sub(r"[_-]?\d{1,4}(?:[_-].*)?$", "", filename).strip("_-")
    return prefix.upper() if prefix else "BW/XY"


def build_card(record: dict[str, str], detail_html: str) -> dict[str, Any]:
    detail = official.parse_detail(detail_html)
    name = detail.get("name") or str(record.get("CardName") or record.get("card_name") or "").strip()
    number = detail.get("number") or ""
    denominator = detail.get("denominator") or ""
    rarity = detail.get("rarity") or ""
    image = official.feature_image_url(str(record.get("feature_image") or ""))
    card_num = str(record.get("CardNum") or "").strip()
    printed = number
    if denominator:
        printed = f"{number}/{denominator}" if number else denominator
    if rarity:
        printed = f"{printed} {rarity}".strip()
    if not printed:
        filename = image.split("?", 1)[0].rsplit("/", 1)[-1].rsplit(".", 1)[0]
        number_match = re.search(r"[_-]0*(\d{1,4})(?:[_-]|$)", filename)
        printed = str(int(number_match.group(1))).zfill(3) if number_match else filename
    if not printed:
        printed = card_num
    return {
        "order": 0,
        "name": name,
        "owned": False,
        "set": legacy_set_code(str(record.get("feature_image") or ""), str(record.get("officialProduct") or "")),
        "rarity": rarity,
        "image": image,
        "imageBw": "",
        "source": f"https://pokemoncard.co.kr/cards/detail/{card_num}",
        "cardNumber": printed,
    }


def main() -> None:
    products = sorted({value for value in official.official_product_values().values() if is_legacy_product(value)})
    if not products:
        raise RuntimeError("No BW/XY Pokemon Korea products discovered")
    print(f"Legacy products discovered: {len(products)}")
    for product in products:
        print(f"  - {product}")

    records: list[dict[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_product_records, product): product for product in products}
        for future in concurrent.futures.as_completed(futures):
            product = futures[future]
            batch = future.result()
            records.extend(batch)
            print(f"Inventory {product}: {len(batch)}")

    by_card_num: dict[str, dict[str, str]] = {}
    for record in records:
        card_num = str(record.get("CardNum") or "").strip()
        feature = str(record.get("feature_image") or "").strip()
        if card_num and feature:
            by_card_num.setdefault(card_num, record)
    print(f"Unique legacy detail pages: {len(by_card_num)}")

    matched: list[tuple[dict[str, str], str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        futures = {pool.submit(official.detail_payload, card_num): (card_num, record) for card_num, record in by_card_num.items()}
        done = 0
        for future in concurrent.futures.as_completed(futures):
            card_num, record = futures[future]
            payload = future.result()
            if illustrator(payload).casefold() == ARTIST.casefold():
                matched.append((record, payload))
            done += 1
            if done % 100 == 0 or done == len(futures):
                print(f"Details {done}/{len(futures)}; 5ban={len(matched)}")

    # Repackage/product duplicates collapse to the same official image slot.
    unique: dict[str, tuple[dict[str, str], str]] = {}
    for record, payload in matched:
        image = official.feature_image_url(str(record.get("feature_image") or ""))
        unique.setdefault(normalized_image(image), (record, payload))

    legacy_cards = [build_card(record, payload) for record, payload in unique.values()]
    legacy_cards.sort(key=lambda card: (str(card["set"]).casefold(), str(card["cardNumber"]), str(card["name"])))

    payload = json.loads(ARTISTS_PATH.read_text(encoding="utf-8"))
    group = next((artist for artist in payload.get("artists", []) if artist.get("name") == ARTIST), None)
    if not group:
        raise RuntimeError(f"Missing artist group: {ARTIST}")

    existing_cards = list(group.get("cards") or [])
    existing_images = {normalized_image(str(card.get("image") or "")) for card in existing_cards}
    additions = [card for card in legacy_cards if normalized_image(str(card.get("image") or "")) not in existing_images]

    group["cards"] = existing_cards + additions
    for order, card in enumerate(group["cards"], start=1):
        card["order"] = order
        # Never seed ownership from a rebuild.
        card["owned"] = bool(card.get("owned", False)) if card in existing_cards else False

    payload["artistCount"] = len(payload.get("artists", []))
    payload["cardCount"] = sum(len(artist.get("cards") or []) for artist in payload.get("artists", []))
    payload["ownedCount"] = 0
    ARTISTS_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    audit = {
        "artist": ARTIST,
        "source": "https://pokemoncard.co.kr/cards",
        "scope": "Korean BW/XY products and 2014-2016 Korean promo products exposed by Pokemon Korea",
        "productsScanned": products,
        "inventoryRows": len(records),
        "uniqueDetailPages": len(by_card_num),
        "official5banMatches": len(matched),
        "uniqueLegacyImages": len(legacy_cards),
        "addedToExistingCatalog": len(additions),
        "fivebanTotal": len(group["cards"]),
        "artistCatalogTotal": payload["cardCount"],
    }
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.exit(main())
