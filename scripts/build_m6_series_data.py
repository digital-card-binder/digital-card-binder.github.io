#!/usr/bin/env python3
"""Fetch Korean M6 Storm Emeralda cards from Pokemon Korea and add them to series.json."""

from __future__ import annotations

from html.parser import HTMLParser
import html
import json
from pathlib import Path
import re
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SERIES_PATH = ROOT / "data" / "series.json"
OFFICIAL_BASE = "https://pokemoncard.co.kr"
OFFICIAL_CARD_IMAGE_BASE = "https://cards.image.pokemonkorea.co.kr/data/"
USER_AGENT = (
    "Mozilla/5.0 (compatible; DigitalCardBinderDataBuilder/1.0; "
    "+https://digital-card-binder.github.io/)"
)
TARGET_CODE = "m6"
TARGET_TITLE = "스톰에메랄다"
TARGET_PRODUCT_FRAGMENT = "스톰에메랄다"


def request_bytes(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None) -> bytes:
    request_headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        **(headers or {}),
    }
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            req = Request(url, data=data, headers=request_headers)
            with urlopen(req, timeout=75) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"request failed: {url}") from last_error


class GoodsOptionsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_goods_select = False
        self.options: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "select" and attributes.get("name") == "GoodsName":
            self.in_goods_select = True
        elif tag == "option" and self.in_goods_select:
            value = attributes.get("value")
            if value:
                self.options.append(html.unescape(value))

    def handle_endtag(self, tag: str) -> None:
        if tag == "select":
            self.in_goods_select = False


def official_product_value() -> str:
    payload = request_bytes(f"{OFFICIAL_BASE}/cards").decode("utf-8", errors="replace")
    parser = GoodsOptionsParser()
    parser.feed(payload)
    matches = [value for value in parser.options if TARGET_PRODUCT_FRAGMENT in value]
    if not matches:
        raise RuntimeError(f"Pokemon Korea product option not found: {TARGET_PRODUCT_FRAGMENT}")
    matches.sort(key=len)
    product = matches[0]
    print(f"official product: {product}")
    return product


def parse_json_response(payload: bytes) -> dict[str, Any]:
    text = payload.decode("utf-8", errors="replace")
    start = text.find('{"status"')
    if start < 0:
        start = text.find("{")
    if start < 0:
        raise ValueError(f"official response did not contain JSON: {text[:160]!r}")
    return json.loads(text[start:])


def ajax_page(product: str, card_type: int, page: int) -> list[dict[str, Any]]:
    form: dict[str, str] = {
        "action": "get_more_cards",
        "limit": str(page),
        "GoodsName": product,
        "CardTypeNum": str(card_type),
        "CardType": "all",
        "order": "ASC",
        "orderby": "CardNum",
    }
    if card_type == 1:
        form.update(
            {
                "CardMonType": "all",
                "Weakness": "all",
                "Resistance": "all",
                "TechErg": "all",
                "ability_label1": "all",
                "hp": "0,500",
                "retreat": "0,5",
            }
        )
    body = urlencode(form).encode("utf-8")
    payload = request_bytes(
        f"{OFFICIAL_BASE}/v2/ajax2_dev2",
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": f"{OFFICIAL_BASE}/cards",
            "X-Requested-With": "XMLHttpRequest",
        },
    )
    response = parse_json_response(payload)
    result = response.get("result") or []
    if isinstance(result, dict):
        return list(result.values())
    return list(result)


def product_inventory(product: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for card_type in (1, 2, 3):
        page = 0
        while True:
            batch = ajax_page(product, card_type, page)
            records.extend(batch)
            print(f"type={card_type} page={page} count={len(batch)}")
            if len(batch) < 30:
                break
            page += 1
    deduped: dict[str, dict[str, Any]] = {}
    for record in records:
        card_num = str(record.get("CardNum") or "").strip()
        if card_num:
            deduped[card_num] = record
    return list(deduped.values())


def image_url(value: str) -> str:
    value = str(value or "").strip()
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        return value.replace("http://", "https://", 1)
    return f"{OFFICIAL_CARD_IMAGE_BASE}{value.split('?', 1)[0].lstrip('/')}"


def parse_detail(card_num: str) -> dict[str, str]:
    payload = request_bytes(f"{OFFICIAL_BASE}/cards/detail/{card_num}").decode("utf-8", errors="replace")
    name_match = re.search(
        r'<span class="card-hp title">\s*(.*?)\s*</span>',
        payload,
        re.DOTALL | re.IGNORECASE,
    )
    number_match = re.search(
        r'<span class="p_num">\s*([0-9]+)\s*/\s*([A-Za-z0-9+_-]+)'
        r'\s*<span[^>]*>\s*([^<]*)',
        payload,
        re.DOTALL | re.IGNORECASE,
    )
    result: dict[str, str] = {}
    if name_match:
        result["name"] = html.unescape(re.sub(r"<[^>]+>", "", name_match.group(1))).strip()
    if number_match:
        result["number"] = number_match.group(1).zfill(3)
        denominator = number_match.group(2)
        result["denominator"] = denominator.zfill(3) if denominator.isdigit() else denominator
        rarity = html.unescape(number_match.group(3)).strip()
        if rarity:
            result["rarity"] = rarity
    return result


def fallback_number(record: dict[str, Any]) -> str:
    feature = str(record.get("feature_image") or "")
    filename = feature.split("?", 1)[0].rsplit("/", 1)[-1]
    match = re.search(r"_([0-9]{1,3})(?:_|\.|$)", filename)
    if match:
        return match.group(1).zfill(3)
    return ""


def build_cards(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for index, record in enumerate(records, start=1):
        card_num = str(record.get("CardNum") or "").strip()
        detail = parse_detail(card_num)
        number = detail.get("number") or fallback_number(record)
        name = detail.get("name") or str(record.get("CardName") or record.get("name") or "").strip()
        if not number or not name:
            raise RuntimeError(f"card detail incomplete: CardNum={card_num} number={number!r} name={name!r}")
        code = f"{TARGET_CODE}_{number}"
        cards.append(
            {
                "code": code,
                "meta": code,
                "name": name,
                "rarity": detail.get("rarity", ""),
                "image": image_url(str(record.get("feature_image") or "")),
                "owned": False,
                "sourceCardNum": card_num,
            }
        )
        if index % 20 == 0 or index == len(records):
            print(f"details: {index}/{len(records)}")

    cards.sort(key=lambda card: int(re.search(r"_([0-9]+)$", card["code"]).group(1)))
    seen_codes: set[str] = set()
    unique_cards: list[dict[str, Any]] = []
    for card in cards:
        if card["code"] in seen_codes:
            raise RuntimeError(f"duplicate M6 collection number: {card['code']}")
        seen_codes.add(card["code"])
        unique_cards.append(card)
    return unique_cards


def update_series(cards: list[dict[str, Any]], product: str) -> None:
    groups = json.loads(SERIES_PATH.read_text(encoding="utf-8"))
    if not isinstance(groups, list):
        raise RuntimeError("series.json root is not a list")

    group = {
        "code": TARGET_CODE,
        "title": TARGET_TITLE,
        "displayName": TARGET_TITLE,
        "era": "M",
        "product": product,
        "total": len(cards),
        "owned": 0,
        "cards": cards,
    }

    existing_index = next((i for i, item in enumerate(groups) if str(item.get("code", "")).lower() == TARGET_CODE), None)
    if existing_index is not None:
        groups[existing_index] = group
    else:
        last_m = max((i for i, item in enumerate(groups) if str(item.get("era", "")).upper() == "M"), default=len(groups) - 1)
        groups.insert(last_m + 1, group)

    SERIES_PATH.write_text(json.dumps(groups, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    product = official_product_value()
    records = product_inventory(product)
    print(f"official unique records: {len(records)}")
    if len(records) < 100:
        raise RuntimeError(f"M6 official inventory unexpectedly small: {len(records)}")
    cards = build_cards(records)
    if len(cards) != len(records):
        raise RuntimeError(f"M6 card count mismatch: records={len(records)} cards={len(cards)}")
    update_series(cards, product)
    print(f"M6 written: {len(cards)} cards")


if __name__ == "__main__":
    main()
