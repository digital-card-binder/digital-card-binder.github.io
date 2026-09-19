#!/usr/bin/env python3
"""Upgrade ORIGIN/ADV legacy catalogue images to verified Korean scans where available.

Korean scan sources are the Korean set pages on Dogam. The three ADV starter
decks are deliberately left on Japanese reference images because the Korean
card scans are not currently available from the checked public catalogues.
"""

from __future__ import annotations

import concurrent.futures
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
LEGACY_PATH = ROOT / "data" / "series-legacy.json"
DOGAM_BASE = "https://www.dogam.app"
DOGAM_SOURCE = f"{DOGAM_BASE}/sets"
USER_AGENT = "Mozilla/5.0 (compatible; DigitalCardBinder/1.0)"

KOREAN_IMAGE_SETS = {
    "BASE": {
        "href": "/sets/01KW0T5RVDKBB4K1DEZJJ10J80",
        "count": 102,
        "note": "한글판 102장 기준 · Dogam 한글판 실물 이미지",
    },
    "ADV1": {
        "href": "/sets/01KW0T4DR139PHGAETY4KAVK0Z",
        "count": 63,
        "note": "한글판 63장 기준 · Dogam 한글판 실물 이미지",
    },
    "ADVP": {
        "href": "/sets/01M10F45J59EZ270K6C0XV3TRV",
        "count": 1,
        "note": "한글판 1장 기준 · Dogam 한글판 실물 이미지",
    },
}

JP_EXCEPTION_SETS = {"ADV1-K", "ADV1-A", "ADV1-M"}
JP_EXCEPTION_NOTE = "한글판 19장 기준 · 한글판 카드 이미지 미확인 · JP 참고 이미지"


class AnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.current_href: str | None = None
        self.current_text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.current_href = href
            self.current_text = []

    def handle_data(self, data: str) -> None:
        if self.current_href is not None:
            self.current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.current_href is not None:
            label = re.sub(r"\s+", " ", "".join(self.current_text)).strip()
            self.links.append((self.current_href, label))
            self.current_href = None
            self.current_text = []


def fetch_text(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
        },
    )
    with urlopen(request, timeout=45) as response:
        return response.read().decode("utf-8", errors="replace")


def item_number(label: str) -> int:
    match = re.search(r"(?:No[.]\s*)?([0-9]{1,3})\s*$", label, re.I)
    return int(match.group(1)) if match else 9999


def set_manifest(set_href: str, expected: int) -> list[dict[str, str]]:
    parser = AnchorParser()
    parser.feed(fetch_text(DOGAM_BASE + set_href))
    prefix = set_href.rstrip("/") + "/cards/"
    seen: set[str] = set()
    items: list[dict[str, str]] = []
    for href, label in parser.links:
        if not href.startswith(prefix) or href in seen:
            continue
        seen.add(href)
        items.append({"href": href, "label": label})
    items.sort(key=lambda item: (item_number(item["label"]), item["label"]))
    if len(items) != expected:
        raise RuntimeError(
            f"{set_href}: expected {expected} Dogam cards, found {len(items)}"
        )
    return items


def card_image(item: dict[str, str]) -> dict[str, str]:
    page_url = DOGAM_BASE + item["href"]
    html = fetch_text(page_url)
    match = re.search(
        r"https://static[.]tcgexchange[.]kr/[A-Za-z0-9._/-]+[.](?:png|jpe?g|webp)",
        html,
        re.I,
    )
    if not match:
        raise RuntimeError(f"{page_url}: Korean reference image missing")
    return {
        **item,
        "image": match.group(0),
        "source": page_url,
    }


def fetch_set_cards(code: str, meta: dict[str, object]) -> list[dict[str, str]]:
    items = set_manifest(str(meta["href"]), int(meta["count"]))
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
        cards = list(pool.map(card_image, items))
    print(f"{code}: Dogam Korean images {len(cards)}")
    return cards


def run() -> None:
    data = json.loads(LEGACY_PATH.read_text(encoding="utf-8"))
    by_code = {str(group.get("code") or ""): group for group in data}

    fetched: dict[str, list[dict[str, str]]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = {
            pool.submit(fetch_set_cards, code, meta): code
            for code, meta in KOREAN_IMAGE_SETS.items()
        }
        for future in concurrent.futures.as_completed(futures):
            code = futures[future]
            fetched[code] = future.result()

    replaced = 0
    for code, meta in KOREAN_IMAGE_SETS.items():
        group = by_code.get(code)
        if group is None:
            raise RuntimeError(f"{code}: legacy group missing")
        cards = group.get("cards", [])
        refs = fetched[code]
        if len(cards) != int(meta["count"]) or len(cards) != len(refs):
            raise RuntimeError(f"{code}: card count mismatch")

        for card, ref in zip(cards, refs):
            card["image"] = ref["image"]
            card["source"] = ref["source"]
            card["imageSource"] = ref["source"]
            card["imageReferenceNote"] = "Dogam 한글판 실물 이미지"
            replaced += 1

        group["referenceImageRegion"] = "KR"
        group["referenceNote"] = str(meta["note"])
        group["referenceSource"] = DOGAM_SOURCE

    exception_cards = 0
    for code in JP_EXCEPTION_SETS:
        group = by_code.get(code)
        if group is None:
            raise RuntimeError(f"{code}: legacy group missing")
        if len(group.get("cards", [])) != 19:
            raise RuntimeError(f"{code}: expected 19 cards")
        group["referenceImageRegion"] = "JP"
        group["referenceNote"] = JP_EXCEPTION_NOTE
        group["referenceSource"] = DOGAM_SOURCE
        for card in group["cards"]:
            card["imageReferenceNote"] = "한글판 카드 이미지 미확인 · JP 참고 이미지"
            exception_cards += 1

    if replaced != 166:
        raise RuntimeError(f"Korean replacement mismatch: expected 166, got {replaced}")
    if exception_cards != 57:
        raise RuntimeError(f"JP exception mismatch: expected 57, got {exception_cards}")

    # Guardrails: no English/JP placeholder host may remain in verified Korean groups.
    for code in KOREAN_IMAGE_SETS:
        group = by_code[code]
        for card in group["cards"]:
            image = str(card.get("image") or "")
            if not image.startswith("https://static.tcgexchange.kr/"):
                raise RuntimeError(f"{card.get('code')}: unexpected Korean image host {image}")

    LEGACY_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        "ORIGIN/ADV image upgrade complete: "
        f"{replaced} Korean scans, {exception_cards} JP-only exceptions"
    )


if __name__ == "__main__":
    run()
