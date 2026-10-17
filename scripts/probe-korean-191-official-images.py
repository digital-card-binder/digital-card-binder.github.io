#!/usr/bin/env python3
"""Safely probe *only* inherited Korean TCG image holds at Pokémon Korea official CDN.

Diagnostic only: HTTP success is not Korean print/collector number/rights validation.
No downloaded bytes are preserved. Never touch master sets, user ownership or themes.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
import json
import re
import socket

from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "data/audits/korean-recovery-active-queue-20261017.json"
REPORT = ROOT / "data/audits/korean-recovery-official-191-source-probe-20261017.json"
OFFICIAL = "https://cards.image.pokemonkorea.co.kr/data/wmimages"
ERA_DIR = {"MEGA": "MEGA", "SV": "SV", "S": "S", "other": ""}
MAX_BYTES = 5_000_000
TIMEOUT_SECONDS = 11


def expected_card_number(row: dict) -> tuple[str, str] | None:
    series = str(row.get("series", "")).strip()
    slot = str(row.get("slot", "")).strip()
    # The queue's canonical slot is the only reliable candidate input, never web-scraped JP IDs.
    if slot.count("::") == 2:
        printed = slot.rsplit("::", 1)[1]
    else:
        found = re.fullmatch(r"(?i)([A-Z0-9+_-]+)_0*([0-9]{1,4})(?:/[0-9]{1,4})?", slot)
        printed = found.group(2) if found else ""
    if not re.fullmatch(r"[0-9]{1,4}", printed):
        return None
    if not re.fullmatch(r"[A-Za-z0-9+\-]+", series):
        return None
    return series, printed.zfill(3)


def guess_era_path(row: dict) -> str | None:
    era, code = str(row.get("era", "")), str(row.get("series", ""))
    if era in ("MEGA", "SV", "S"):
        return ERA_DIR[era]
    if code.lower().startswith("sm"):
        return "SM"
    if code.lower().startswith("s"):
        return "S"
    return None


def probe(row: dict) -> dict:
    slot = row["slot"]
    result = {
        "workId": row["workId"], "slot": slot, "set": row["series"],
        "status": "not_probed", "stillStrictHeld": True,
        "koreanPrintVerified": False, "republishPermissionVerified": False,
    }
    identifier, category = expected_card_number(row), guess_era_path(row)
    if identifier is None or category is None:
        result["status"] = "non_numeric_or_uncertain_CDN_path"
        return result
    series, number = identifier
    # Korean releases can diverge from Japanese numbers; URL merely a query hint.
    url = f"{OFFICIAL}/{quote(category)}/{quote(series)}/{quote(series)}_{number}.png"
    result["officialUrlCandidate"] = url
    request = Request(url, headers={
        "Accept": "image/png,image/webp,image/jpeg,*/*",
        "User-Agent": "DigitalCardBinder-KoreanImageAudit/1.0",
    })
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as resp:
            result["httpStatus"] = resp.status
            ctype = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
            result["contentType"] = ctype
            raw = resp.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                result["status"] = "body_too_large_no_import"
                return result
            result["byteCount"] = len(raw)
            if not raw.startswith((b"\x89PNG\r\n\x1a\n", b"RIFF", b"\xff\xd8\xff")):
                result["status"] = "not_valid_image_signature_no_import"
                return result
            try:
                with Image.open(BytesIO(raw)) as im:
                    im.verify()
                with Image.open(BytesIO(raw)) as im:
                    result["dimensions"] = list(im.size)
                    result["format"] = im.format
            except (OSError, ValueError, UnidentifiedImageError):
                result["status"] = "image_decode_failed_no_import"
                return result
            result["sha256"] = sha256(raw).hexdigest()
            result["status"] = "official_image_decodes_identity_and_rights_unchecked"
            # Do not store pixels or mark as approved based merely on a successful URL.
            return result
    except HTTPError as e:
        result["status"] = "official_http_error_not_unreleased"
        result["httpStatus"] = e.code
    except (URLError, TimeoutError, socket.timeout, OSError) as e:
        result["status"] = "official_network_error_not_unreleased"
        result["errorClass"] = type(e).__name__
    return result


def main() -> None:
    q = json.loads(QUEUE.read_text(encoding="utf-8"))
    rows = q["unresolved"]
    if len(rows) != 191 or q["queueCount"] != 191:
        raise RuntimeError("191 inherited hold checkpoint changed; refuse to probe")
    if len({r["slot"] for r in rows}) != len(rows):
        raise RuntimeError("Duplicate inherited identity; refuse to probe")
    # Reuse completed per-slot source probes. Re-examine only records previously
    # skipped due to an unrecognized canonical ID shape; never redo 152 good
    # probes or any completed card audits.
    cached = {}
    if REPORT.exists():
        previous = json.loads(REPORT.read_text(encoding="utf-8"))
        if previous.get("totalHeldChecked") == 191:
            cached = {
                row["slot"]: row for row in previous["rows"]
                if row.get("status") != "non_numeric_or_uncertain_CDN_path"
            }
    fresh = [row for row in rows if row["slot"] not in cached]
    with ThreadPoolExecutor(max_workers=7) as executor:
        fresh_results = {result["slot"]: result for result in executor.map(probe, fresh)}
    results = [cached.get(row["slot"], fresh_results.get(row["slot"])) for row in rows]
    if any(row is None for row in results):
        raise RuntimeError("Source probe results did not cover the inherited queue")
    status = {}
    for row in results:
        status[row["status"]] = status.get(row["status"], 0) + 1
    report = {
        "schemaVersion": 1,
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "scope": "Exactly 191 existing unresolved Korean image/printed-number slots",
        "inputQueue": str(QUEUE.relative_to(ROOT)),
        "firstPartyEndpoint": OFFICIAL,
        "purpose": "GET and verify candidate official image availability only",
        "totalHeldChecked": len(rows),
        "newlyProbed": len(fresh),
        "cachedPreviousProbes": len(cached),
        "counts": status,
        "rows": results,
        "warnings": [
            "HTTP 200 and a decodable image prove only that a URL exists; they do not prove Korean print title, card number, holo variant, or reuse rights.",
            "HTTP 403/404/415/timeouts do not prove Korean unrelease. Keep all previous holds.",
            "Source names and numbers on Japanese card sites are not used for Korean mappings.",
            "No card images were copied, and no card data, art theme, or ownership values were changed.",
            "Potential candidates require actual image visual region/printed-footer inspection and reuse approval before applying.",
        ],
        "strictCompleted": 0,
        "imageReplacements": 0,
        "queueCountPreserved": 191,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(REPORT), "total": len(rows), "counts": status}, ensure_ascii=False))


if __name__ == "__main__":
    main()
