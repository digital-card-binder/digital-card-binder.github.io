#!/usr/bin/env python3
"""Verify Korean SV-P canonical slots against Pokemon Korea card-detail pages."""

from __future__ import annotations

import concurrent.futures
import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError

import build_legacy_series_data as official

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "audits" / "sv-p-official-detail-audit.json"
SET_CODE = "SV-P"
CARD_PREFIX = "SVP"


def norm(value: Any) -> str:
    return str(value or "").strip().casefold()


def merge_groups(base: list[dict[str, Any]], legacy: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged = list(base)
    for group in legacy:
        code = norm(group.get("code"))
        index = next(
            (i for i, current in enumerate(merged) if norm(current.get("code")) == code),
            None,
        )
        if index is None:
            merged.append(group)
        else:
            merged[index] = group
    return merged


def card_number(card: dict[str, Any]) -> int | None:
    raw = str(card.get("code") or card.get("meta") or "").strip()
    match = re.search(r"(?i)^sv-p[_-]0*([0-9]+)(?:/|\\s|$)", raw)
    if not match:
        match = re.search(r"(?i)^svp[_-]?0*([0-9]+)(?:/|\\s|$)", raw)
    if not match:
        return None
    return int(match.group(1))


def main() -> int:
    base = json.loads((ROOT / "data" / "series.json").read_text(encoding="utf-8"))
    legacy = json.loads((ROOT / "data" / "series-legacy.json").read_text(encoding="utf-8"))
    groups = merge_groups(base, legacy)
    group = next((item for item in groups if norm(item.get("code")) == "sv-p"), None)
    if not group:
        raise RuntimeError("SV-P group not found")

    expected: dict[int, dict[str, Any]] = {}
    unparsed: list[dict[str, str]] = []
    for card in group.get("cards") or []:
        number = card_number(card)
        if number is None:
            unparsed.append(
                {
                    "code": str(card.get("code") or ""),
                    "name": str(card.get("name") or card.get("pokemonName") or ""),
                }
            )
            continue
        expected[number] = card

    if len(expected) != 248:
        raise RuntimeError(
            f"SV-P expected canonical count changed: {len(expected)} numeric slots; "
            f"{len(unparsed)} unparsed"
        )

    official.warm_official_session()
    slots: dict[str, dict[str, Any]] = {}
    verified = 0
    pending = 0
    name_mismatches = 0
    network_checks = 0

    def check_one(number: int) -> tuple[int, dict[str, Any], bool]:
        card = expected[number]
        card_num = f"{CARD_PREFIX}{number:09d}"
        source = f"{official.OFFICIAL_BASE}/cards/detail/{card_num}"
        cache = official.cache_path("details", card_num, ".html")
        cached_before = cache.exists() and cache.stat().st_size > 0
        error = ""
        status = None

        try:
            if cached_before:
                payload = cache.read_bytes().decode("utf-8", errors="replace")
            else:
                try:
                    raw = official.request_bytes(source, attempts=1)
                    cache.parent.mkdir(parents=True, exist_ok=True)
                    cache.write_bytes(raw)
                    payload = raw.decode("utf-8", errors="replace")
                    status = 200
                except HTTPError as exc:
                    status = int(exc.code)
                    if status not in (404, 410):
                        raise
                    payload = ""
                finally:
                    time.sleep(0.25)

            detail = official.parse_detail(payload) if payload else {}
            is_verified = (
                detail.get("number") == f"{number:03d}"
                and str(detail.get("denominator") or "").upper() == SET_CODE
            )
        except Exception as exc:
            detail = {}
            is_verified = False
            error = str(exc)

        expected_name = str(
            card.get("name") or card.get("pokemonName") or card.get("actualName") or ""
        ).strip()
        official_name = str(detail.get("name") or "").strip()
        name_match = not expected_name or not official_name or expected_name == official_name
        key = f"sv-p::sv-p::{number}"
        row = {
            "setCode": SET_CODE,
            "actualSetCode": SET_CODE,
            "printedNumber": str(number),
            "cardNum": card_num,
            "verified": is_verified,
            "officialConfirmed": is_verified,
            "evidenceTier": "first-party" if is_verified else "unresolved",
            "evidence": "pokemon-korea-card-detail" if is_verified else "official-detail-unresolved",
            "source": source,
            "expectedName": expected_name,
            "officialName": official_name,
            "nameMatch": name_match,
            **({"rarity": detail.get("rarity", "")} if detail.get("rarity") else {}),
            **({"httpStatus": status} if status is not None else {}),
            **({"error": error} if error else {}),
        }
        return number, {key: row}, not cached_before

    numbers = sorted(expected)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(check_one, number) for number in numbers]
        for index, future in enumerate(
            concurrent.futures.as_completed(futures),
            start=1,
        ):
            number, row, did_network = future.result()
            key, value = next(iter(row.items()))
            slots[key] = value
            network_checks += int(did_network)
            if value["verified"]:
                verified += 1
                if not value["nameMatch"]:
                    name_mismatches += 1
            else:
                pending += 1

            if index % 25 == 0 or index == len(numbers):
                print(
                    f"SV-P official detail audit: {index}/{len(numbers)} checked; "
                    f"{verified} verified; {pending} pending",
                    flush=True,
                )

    slots = dict(
        sorted(
            slots.items(),
            key=lambda item: int(item[1]["printedNumber"]),
        )
    )

    output = {
        "schemaVersion": 1,
        "scope": {
            "era": "SV",
            "setCode": SET_CODE,
            "market": "KR",
            "koreanReleaseOnly": True,
        },
        "sourcePolicy": (
            "Direct Pokemon Korea card-detail URLs using the official SVP CardNum "
            "identifier. Japanese evidence is not used."
        ),
        "summary": {
            "expectedSlotCount": len(expected),
            "verifiedSlotCount": verified,
            "pendingOfficialEvidenceCount": pending,
            "nameMismatchCount": name_mismatches,
            "networkChecks": network_checks,
            "unparsedExpectedCardCount": len(unparsed),
        },
        "slots": slots,
        "unparsedExpectedCards": unparsed,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"SV-P official detail audit complete: {verified}/{len(expected)} verified; "
        f"{pending} pending official details.",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
