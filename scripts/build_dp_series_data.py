#!/usr/bin/env python3
"""Build the Korean Diamond & Pearl catalog from official Pokemon Korea data.

Set membership/counts follow the Korean-language set catalog reference at
https://www.dogam.app/sets. Card names, printed numbers, product membership,
detail URLs, and image URLs come from Pokemon Korea's official card search.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
from pathlib import Path
import re
import sys
from typing import Any

# Reuse the battle-tested Pokemon Korea search/detail client.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_legacy_series_data as legacy  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
LEGACY_PATH = ROOT / "data" / "series-legacy.json"
DOGAM_SOURCE = "https://www.dogam.app/sets"

SETS: list[dict[str, Any]] = [
    {"code": "BS1", "title": "모험의 시작", "count": 60, "aliases": ["모험의 시작"]},
    {"code": "BS2", "title": "불꽃 튀는 대결", "count": 40, "aliases": ["불꽃 튀는 대결"]},
    {"code": "BS3", "title": "시공의 격돌", "count": 60, "aliases": ["시공의 격돌"]},
    {"code": "BS4", "title": "또 다른 세계", "count": 40, "aliases": ["또 다른 세계"]},
    {"code": "BS5", "title": "7개의 신비", "count": 40, "aliases": ["7개의 신비"]},
    {"code": "BS6", "title": "암흑의 초승달", "count": 60, "aliases": ["암흑의 초승달"]},
    {"code": "BS7", "title": "보이지 않는 힘", "count": 40, "aliases": ["보이지 않는 힘"]},
    {"code": "BS8", "title": "화려한 전설", "count": 40, "aliases": ["화려한 전설"]},
    {"code": "BS9", "title": "호수의 기적", "count": 40, "aliases": ["호수의 기적"]},
    {"code": "BS10", "title": "고대의 수호자", "count": 40, "aliases": ["고대의 수호자"]},
    {"code": "CSD", "title": "크레세리아 덱", "count": 14, "aliases": ["크레세리아 덱", "크레세리아덱"]},
    {"code": "DGD", "title": "디아루가 덱", "count": 15, "aliases": ["디아루가 덱", "디아루가덱"]},
    {"code": "DRD", "title": "다크라이 덱", "count": 13, "aliases": ["다크라이 덱", "다크라이덱"]},
    {"code": "PKD", "title": "펄기아 덱", "count": 15, "aliases": ["펄기아 덱", "펄기아덱"]},
    {"code": "ST1", "title": "DP 랜덤 구축덱", "count": 59, "aliases": ["DP 랜덤 구축덱", "랜덤 구축덱", "랜덤구축덱"]},
    {"code": "DPP", "title": "DP 프로모 카드", "count": 22, "aliases": ["DP 프로모 카드", "DP프로모카드"]},
]

ENERGY_ORDER = {
    "기본 풀 에너지": 1,
    "기본 불꽃 에너지": 2,
    "기본 물 에너지": 3,
    "기본 번개 에너지": 4,
    "기본 초 에너지": 5,
    "기본 격투 에너지": 6,
    "기본 악 에너지": 7,
    "기본 강철 에너지": 8,
}
ENERGY_TOKEN = {
    "기본 풀 에너지": "ENERGY-GRASS",
    "기본 불꽃 에너지": "ENERGY-FIRE",
    "기본 물 에너지": "ENERGY-WATER",
    "기본 번개 에너지": "ENERGY-LIGHTNING",
    "기본 초 에너지": "ENERGY-PSYCHIC",
    "기본 격투 에너지": "ENERGY-FIGHTING",
    "기본 악 에너지": "ENERGY-DARKNESS",
    "기본 강철 에너지": "ENERGY-METAL",
}


def resolve_product(meta: dict[str, Any], values: dict[str, str]) -> str:
    options = list(values.values())
    scored: list[tuple[int, int, str]] = []
    for option in options:
        compact_option = legacy.compact(option)
        for alias in meta["aliases"]:
            compact_alias = legacy.compact(alias)
            if compact_alias and compact_alias in compact_option:
                exact = int(compact_option == compact_alias)
                scored.append((-exact, len(compact_option), option))
                break
    if not scored:
        nearby = [
            option for option in options
            if meta["code"].casefold() in option.casefold()
            or any(token in legacy.compact(option) for token in meta["aliases"])
        ]
        raise RuntimeError(
            f"{meta['code']} {meta['title']}: official product option missing"
            + (f" candidates={nearby[:8]}" if nearby else "")
        )
    scored.sort()
    return scored[0][2]


def product_inventory(meta: dict[str, Any], product: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for card_type in (1, 2, 3):
        page = 0
        while True:
            page_records = legacy.ajax_page(product, card_type, page)
            records.extend(page_records)
            if len(page_records) < 30:
                break
            page += 1
    # The official endpoint can surface the same card through more than one
    # type bucket on old data. CardNum is the stable official detail identity.
    unique: dict[str, dict[str, str]] = {}
    for record in records:
        card_num = str(record.get("CardNum") or "").strip()
        if card_num:
            unique.setdefault(card_num, record)
    legacy.log(f"DP 공식 목록 · {meta['code']} {meta['title']}: {len(unique)}건")
    return list(unique.values())


def detail_record(record: dict[str, str]) -> dict[str, Any]:
    card_num = str(record.get("CardNum") or "").strip()
    if not card_num:
        raise RuntimeError(f"official CardNum missing: {record}")
    detail = legacy.parse_detail(legacy.detail_payload(card_num))
    name = str(detail.get("name") or "").strip()
    if not name:
        # Some old energy detail templates expose the card name in the AJAX row.
        for key in ("CardName", "card_name", "name", "title"):
            candidate = str(record.get(key) or "").strip()
            if candidate:
                name = candidate
                break
    if not name:
        raise RuntimeError(f"{card_num}: Korean card name missing")

    image_path = str(record.get("feature_image") or "").strip()
    image = legacy.feature_image_url(image_path) if image_path else ""

    number = str(detail.get("number") or "").strip()
    denominator = str(detail.get("denominator") or "").strip()
    return {
        "CardNum": card_num,
        "name": name,
        "number": number,
        "denominator": denominator,
        "rarity": str(detail.get("rarity") or "").strip(),
        "image": image,
        "source": f"{legacy.OFFICIAL_BASE}/cards/detail/{card_num}",
    }


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def card_identity(card: dict[str, Any]) -> tuple[str, str]:
    if card["number"]:
        return ("number", str(int(card["number"])))
    return ("name", normalize_name(card["name"]).casefold())


def representative_score(card: dict[str, Any]) -> tuple[int, int, str]:
    filename = card["image"].rsplit("/", 1)[-1].casefold()
    variant = bool(re.search(r"(?:mirror|reverse|foil|holo|parallel)", filename))
    return (int(variant), len(filename), card["CardNum"])


def build_group(meta: dict[str, Any], records: list[dict[str, str]], workers: int) -> dict[str, Any]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        cards = list(pool.map(detail_record, records))

    deduped: dict[tuple[str, str], dict[str, Any]] = {}
    for card in cards:
        key = card_identity(card)
        current = deduped.get(key)
        if current is None or representative_score(card) < representative_score(current):
            deduped[key] = card
    cards = list(deduped.values())

    numbered = [card for card in cards if card["number"]]
    numberless = [card for card in cards if not card["number"]]
    numbered.sort(key=lambda card: int(card["number"]))
    numberless.sort(key=lambda card: (ENERGY_ORDER.get(card["name"], 999), card["name"]))
    cards = [*numbered, *numberless]

    if len(cards) != meta["count"]:
        summary = [
            (card["number"], card["denominator"], card["name"], card["CardNum"])
            for card in cards
        ]
        raise RuntimeError(
            f"{meta['code']} {meta['title']}: expected {meta['count']} cards, "
            f"official catalog produced {len(cards)} after dedupe\n{summary}"
        )

    finalized: list[dict[str, Any]] = []
    for order, card in enumerate(cards, start=1):
        if card["number"]:
            number = str(int(card["number"])).zfill(3)
            denominator = card["denominator"]
            denominator = denominator.zfill(3) if denominator.isdigit() else denominator
            suffix = f"{number}/{denominator or str(meta['count']).zfill(3)}"
        else:
            token = ENERGY_TOKEN.get(card["name"])
            if not token:
                token = re.sub(r"[^0-9A-Za-z가-힣]+", "-", card["name"]).strip("-").upper()
            suffix = token
        finalized.append(
            {
                "code": f"{meta['code'].lower()}_{suffix}",
                "image": card["image"],
                "owned": False,
                "status": "구함",
                "name": card["name"],
                "order": order,
                "source": card["source"],
            }
        )

    return {
        "code": meta["code"],
        "title": f"{meta['title']} ({len(finalized)}장)",
        "displayName": meta["title"],
        "era": "DP",
        "release": "",
        "sourceProducts": [meta["officialProduct"]],
        "referenceImageRegion": "KR",
        "referenceNote": f"한글판 {len(finalized)}장 기준 · 포켓몬코리아 공식 이미지",
        "referenceSource": DOGAM_SOURCE,
        "cards": finalized,
    }


def run(workers: int) -> None:
    official_values = legacy.official_product_values()
    for meta in SETS:
        meta["officialProduct"] = resolve_product(meta, official_values)
        legacy.log(f"상품 연결 · {meta['code']} -> {meta['officialProduct']}")

    inventories: dict[str, list[dict[str, str]]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers, 12)) as pool:
        futures = {
            pool.submit(product_inventory, meta, meta["officialProduct"]): meta
            for meta in SETS
        }
        for future in concurrent.futures.as_completed(futures):
            meta = futures[future]
            inventories[meta["code"]] = future.result()

    groups: list[dict[str, Any]] = []
    for meta in SETS:
        group = build_group(meta, inventories[meta["code"]], workers)
        groups.append(group)
        legacy.log(
            f"완료 · {group['code']} {group['displayName']}: {len(group['cards'])}장"
        )

    existing = json.loads(LEGACY_PATH.read_text(encoding="utf-8"))
    dp_codes = {meta["code"].casefold() for meta in SETS}
    preserved = [
        group for group in existing
        if str(group.get("code") or "").casefold() not in dp_codes
        and str(group.get("era") or "").upper() != "DP"
    ]

    output = [*preserved, *groups]
    LEGACY_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    total = sum(len(group["cards"]) for group in groups)
    if total != 598:
        raise RuntimeError(f"DP total mismatch: expected 598, got {total}")
    legacy.log(f"DP 저장 완료 · {len(groups)}세트 / {total}장")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=16)
    args = parser.parse_args()
    if not 1 <= args.workers <= 24:
        parser.error("--workers must be between 1 and 24")
    try:
        run(args.workers)
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"오류: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
