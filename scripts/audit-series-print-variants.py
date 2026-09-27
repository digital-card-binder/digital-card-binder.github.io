#!/usr/bin/env python3
"""Audit Korean series print variants without creating extra catalog cards.

The current series catalog intentionally keeps one canonical card per printed
set/card-number slot. This audit revisits Pokemon Korea's official card-search
results and preserves evidence that was previously discarded when duplicate
records were collapsed to one representative image.

The output is read-only audit data. It does not edit data/series.json,
ownership keys, Firebase data, or card counts.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
from pathlib import Path
import re
import sys
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_legacy_series_data as legacy  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

VARIANT_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("mirror", re.compile(r"(?:mirror|reverse|master[-_ ]?ball|poke[-_ ]?ball|pokeball|ball)", re.I)),
    ("holo", re.compile(r"(?:holo|foil)", re.I)),
)


def clean(value: Any) -> str:
    return str(value or "").strip()


def group_products(era: str) -> list[dict[str, Any]]:
    era = era.upper()
    groups: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for item in legacy.PRODUCTS:
        if clean(item.get("era")).upper() != era:
            continue
        key = legacy.compact(item["code"])
        if key not in groups:
            groups[key] = {
                "era": clean(item["era"]).upper(),
                "code": clean(item["code"]),
                "title": clean(item["title"]),
                "products": [],
            }
            order.append(key)
        product = clean(item["product"])
        if product and product not in groups[key]["products"]:
            groups[key]["products"].append(product)
    return [groups[key] for key in order]


def resolve_product(product: str, official_values: dict[str, str]) -> str | None:
    return official_values.get(legacy.compact(product))


def classify_filename(value: str) -> str:
    filename = clean(value).split("?", 1)[0].rsplit("/", 1)[-1]
    for variant, pattern in VARIANT_PATTERNS:
        if pattern.search(filename):
            return variant
    return "normal"


def fetch_product_records(product: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for card_type in (1, 2, 3):
        page = 0
        while True:
            page_records = legacy.ajax_page(product, card_type, page)
            for record in page_records:
                records.append({**record, "_cardType": str(card_type)})
            if len(page_records) < 30:
                break
            page += 1
    return records


def audit_group(group: dict[str, Any], official_values: dict[str, str]) -> dict[str, Any]:
    resolved_products: list[str] = []
    missing_products: list[str] = []
    all_records: list[dict[str, str]] = []

    for requested in group["products"]:
        resolved = resolve_product(requested, official_values)
        if not resolved:
            missing_products.append(requested)
            continue
        resolved_products.append(resolved)
        records = fetch_product_records(resolved)
        for record in records:
            all_records.append({**record, "_product": resolved})

    slots: dict[tuple[str, str], list[dict[str, str]]] = {}
    unresolved_records = 0
    for record in all_records:
        image = clean(record.get("feature_image"))
        identity = legacy.image_identity(image)
        if not identity:
            unresolved_records += 1
            continue
        actual_code, printed_number = identity
        key = (actual_code.casefold(), printed_number.casefold())
        slots.setdefault(key, []).append(record)

    variant_slots: list[dict[str, Any]] = []
    duplicate_slot_count = 0
    for (actual_code_key, printed_number), records in sorted(slots.items()):
        unique_by_image: dict[str, dict[str, str]] = {}
        for record in records:
            image = clean(record.get("feature_image")).split("?", 1)[0]
            if image:
                unique_by_image.setdefault(image.casefold(), record)

        distinct = list(unique_by_image.values())
        if len(distinct) < 2:
            continue
        duplicate_slot_count += 1

        evidence: list[dict[str, str]] = []
        detected = set()
        for record in distinct:
            image = clean(record.get("feature_image"))
            kind = classify_filename(image)
            detected.add(kind)
            evidence.append(
                {
                    "product": clean(record.get("_product")),
                    "cardNum": clean(record.get("CardNum")),
                    "cardType": clean(record.get("_cardType")),
                    "imageFile": image.split("?", 1)[0].rsplit("/", 1)[-1],
                    "classification": kind,
                }
            )

        extras = sorted(kind for kind in detected if kind != "normal")
        if not extras:
            extras = ["other"]

        representative_identity = legacy.image_identity(clean(distinct[0].get("feature_image")))
        actual_code = representative_identity[0] if representative_identity else actual_code_key
        variant_slots.append(
            {
                "groupCode": group["code"],
                "actualSetCode": actual_code,
                "printedNumber": printed_number,
                "availablePrintVariants": ["normal", *extras],
                "distinctImageCount": len(distinct),
                "evidence": sorted(
                    evidence,
                    key=lambda item: (
                        item["classification"],
                        item["product"],
                        item["imageFile"],
                        item["cardNum"],
                    ),
                ),
            }
        )

    return {
        "era": group["era"],
        "code": group["code"],
        "title": group["title"],
        "requestedProducts": group["products"],
        "resolvedProducts": resolved_products,
        "missingProducts": missing_products,
        "rawRecordCount": len(all_records),
        "parsedSlotCount": len(slots),
        "duplicateSlotCount": duplicate_slot_count,
        "unresolvedRecordCount": unresolved_records,
        "variantSlots": variant_slots,
    }


def build_audit(era: str, workers: int) -> dict[str, Any]:
    groups = group_products(era)
    if not groups:
        raise RuntimeError(f"No configured products for era {era}")

    official_values = legacy.official_product_values()
    results: dict[str, dict[str, Any]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(audit_group, group, official_values): group["code"]
            for group in groups
        }
        for future in concurrent.futures.as_completed(futures):
            code = futures[future]
            result = future.result()
            results[legacy.compact(code)] = result
            legacy.log(
                "변형 감사 · "
                f"{result['code']} {result['title']}: "
                f"{result['rawRecordCount']} records / "
                f"{len(result['variantSlots'])} variant slots"
            )

    ordered = [results[legacy.compact(group["code"])] for group in groups]
    variant_counts = {"holo": 0, "mirror": 0, "other": 0}
    variant_slots = 0
    for group in ordered:
        for slot in group["variantSlots"]:
            variant_slots += 1
            for variant in slot["availablePrintVariants"]:
                if variant in variant_counts:
                    variant_counts[variant] += 1

    return {
        "schemaVersion": 1,
        "purpose": "One canonical series card per slot; preserve verified alternate print forms as metadata only.",
        "source": "https://pokemoncard.co.kr/cards",
        "sourcePolicy": "Pokemon Korea official card-search records only for this audit batch.",
        "era": era.upper(),
        "classification": {
            "normal": "canonical/base entry",
            "holo": "official duplicate image filename contains holo/foil",
            "mirror": "official duplicate image filename contains mirror/reverse/ball",
            "other": "multiple distinct official images share the same set/card-number slot but no known variant token is present",
        },
        "summary": {
            "configuredSetCount": len(ordered),
            "resolvedProductCount": sum(len(group["resolvedProducts"]) for group in ordered),
            "missingProductCount": sum(len(group["missingProducts"]) for group in ordered),
            "rawRecordCount": sum(group["rawRecordCount"] for group in ordered),
            "parsedSlotCount": sum(group["parsedSlotCount"] for group in ordered),
            "duplicateSlotCount": sum(group["duplicateSlotCount"] for group in ordered),
            "variantSlotCount": variant_slots,
            "variantCounts": variant_counts,
        },
        "sets": ordered,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--era", choices=("S", "SM"), default="S")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument(
        "--output",
        default="series-print-variant-audit.json",
        help="Output path relative to repository root unless absolute.",
    )
    args = parser.parse_args()
    if not 1 <= args.workers <= 8:
        parser.error("--workers must be between 1 and 8")

    output = Path(args.output)
    if not output.is_absolute():
        output = ROOT / output

    try:
        audit = build_audit(args.era, args.workers)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(audit, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        summary = audit["summary"]
        legacy.log(
            "완료 · "
            f"{audit['era']} {summary['configuredSetCount']}세트 / "
            f"변형 슬롯 {summary['variantSlotCount']}개 / "
            f"홀로 {summary['variantCounts']['holo']} / "
            f"미러 {summary['variantCounts']['mirror']} / "
            f"기타 {summary['variantCounts']['other']}"
        )
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"오류: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
