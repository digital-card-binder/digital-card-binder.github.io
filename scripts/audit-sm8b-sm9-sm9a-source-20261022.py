#!/usr/bin/env python3
"""Source-only evidence for 438 Korean SM8b/SM9/SM9a theme-dex cards.

No guessed language, thematic membership or ownership changes.  Contact sheets
must be reviewed separately; a downloaded picture cannot prove a Korean print.
"""
from __future__ import annotations
import hashlib
import io
import json
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageOps

ROOT = Path("data/audits")
SOURCE = ROOT / "theme-sm8b-sm9-sm9a-master-preflight-20261022.json"
TARGET = ROOT / "theme-sm8b-sm9-sm9a-image-evidence-20261022.json"
SHEETDIR = ROOT / "theme-sm8b-sm9-sm9a-contact-sheets-20261022"
EXPECTED = {"sm8b": 250, "sm9": 118, "sm9a": 70}
data = json.loads(SOURCE.read_text(encoding="utf-8"))
assert data["totalCanonicalSlots"] == 438 and data["priorThemeSlotsPreserved"] == 19717
assert data["previousStrictCompleteSetsPreserved"] == 109
assert data["sourceHttpChecks"] == 0 and data["newlyWrittenThemeRows"] == 0
assert not TARGET.exists(), "Existing evidence must not be overwritten."
cards = data["cardQueue"]
assert len(cards) == 438 and all(c["thematicEligibility"] == "not_yet_reviewed" for c in cards)
for code, length in EXPECTED.items():
    slot = [c for c in cards if c["set"].lower() == code]
    assert len(slot) == length
    assert [c["index"] for c in slot] == list(range(1, length + 1))

def load_card(c):
    entry = dict(c)
    entry.update(httpStatus=None, decoded=False, actualSha256=None,
                 imageWidth=None, imageHeight=None, imageFormat=None,
                 duplicateArtworkSource=False, verifiedKoreanPrintedFooter=False,
                 approvedThemeMemberships=[], imageSourceError=None)
    try:
        if not entry["originalImageReference"].startswith("https://"):
            raise ValueError("Non-HTTPS source")
        resp = requests.get(entry["originalImageReference"],
                            timeout=(12, 30), headers={
                            "User-Agent": "Mozilla/5.0 (KoreanCardArtAudit/1.0)",
                            "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*"},
                            allow_redirects=True)
        entry["httpStatus"] = resp.status_code
        resp.raise_for_status()
        if len(resp.content) > 8_000_000:
            raise ValueError("Image payload over 8 MB")
        pic = Image.open(io.BytesIO(resp.content))
        pic.load()
        entry.update(decoded=True, actualSha256=hashlib.sha256(resp.content).hexdigest(),
                     imageWidth=pic.width, imageHeight=pic.height, imageFormat=pic.format)
        if pic.width < 180 or pic.height < 260:
            entry["imageSourceError"] = "Decoded but image too small for identity review"
        return entry, pic.convert("RGB")
    except Exception as e:
        entry["imageSourceError"] = str(e)[:320]
        return entry, None

with ThreadPoolExecutor(max_workers=12) as pool:
    results = list(pool.map(load_card, cards))
records = [row for row, _ in results]
pics = {(row["set"].lower(), row["index"]): pic for row, pic in results
        if pic is not None}
hash_groups = defaultdict(list)
for row in records:
    if row["decoded"]:
        hash_groups[row["actualSha256"]].append(row)
duplicates = []
for sha, group in hash_groups.items():
    if len(group) > 1:
        duplicates.append({"sha256": sha, "slots": [
            {"set": r["set"], "index": r["index"], "code": r["canonicalCode"]}
            for r in group]})
        for row in group:
            row["duplicateArtworkSource"] = True

SHEETDIR.mkdir(parents=True, exist_ok=True)
sheets = []
for setcode in EXPECTED:
    sequence = [row for row in records if row["set"].lower() == setcode]
    for idx, start in enumerate(range(0, len(sequence), 15), 1):
        segment = sequence[start:start + 15]
        width, height, cols = 238, 350, 5
        sheet = Image.new("RGB", (width * cols, height * 3), "white")
        draw = ImageDraw.Draw(sheet)
        for offset, row in enumerate(segment):
            x, y = (offset % cols) * width, (offset // cols) * height
            header = f'{setcode.upper()} {row["index"]:03d}'
            draw.text((x + 5, y + 4), header, fill="black")
            pic = pics.get((setcode, row["index"]))
            if pic is not None:
                thumb = ImageOps.contain(pic, (width - 10, height - 29))
                sheet.paste(thumb, (x + (width - thumb.width) // 2, y + 23))
            else:
                draw.text((x + 10, y + 42), "IMAGE NOT AVAILABLE", fill="red")
        output = SHEETDIR / f"{setcode}-sheet-{idx:02d}.jpg"
        sheet.save(output, "JPEG", quality=63, optimize=True)
        sheets.append({"set": setcode, "page": idx, "filename": output.name,
                       "cardNumbers": [r["index"] for r in segment]})
        print("CONTACT_SHEET_READY", str(output), flush=True)

summaries = []
for setcode, length in EXPECTED.items():
    chunk = [r for r in records if r["set"].lower() == setcode]
    summary = {
        "set": setcode, "masterCount": length,
        "decodedCount": sum(r["decoded"] for r in chunk),
        "failedCount": sum(not r["decoded"] for r in chunk),
        "thirdPartyDecodedCount": sum(r["decoded"] and r["referenceKind"] == "third_party_image_url" for r in chunk),
        "thirdPartyUncheckedKoreanPrintCount": sum(r["referenceKind"] == "third_party_image_url" for r in chunk),
        "sourceErrors": [{"number": r["index"], "code": r["canonicalCode"],
                          "reason": r["imageSourceError"]} for r in chunk if r["imageSourceError"]],
        "duplicateSourceNumbers": [r["index"] for r in chunk if r["duplicateArtworkSource"]],
        "visuallyConfirmedKoreanPrintedCards": 0,
        "newThemeMemberships": 0
    }
    summaries.append(summary)
    print("AUDIT_SET_RESULT", json.dumps(summary, ensure_ascii=False), flush=True)

report = {
    "schemaVersion": 1, "recordedAt": "2026-10-22",
    "source": str(SOURCE), "stage": "real-source-HTTP-decode-SHA256-and-manual-review-sheet-prep",
    "canonicalSlots": len(records), "sourceRequestsAttempted": len(records),
    "decodedImages": sum(r["decoded"] for r in records),
    "unavailableImages": sum(not r["decoded"] for r in records),
    "duplicateSourceHashGroups": duplicates,
    "thirdPartyReferencesRequiringKoreanPrintReview": sum(r["referenceKind"] == "third_party_image_url" for r in records),
    "visualReviewNotYetDone": True, "verifiedPrintedKoreanFooterCount": 0,
    "newThemeRowsWritten": 0, "previousThemeRowsPreserved": 20021,
    "previousStrictCompleteSetsPreserved": 109, "masterDatabaseModified": False,
    "userCollectionsModified": False, "firestoreModified": False, "cardRadarModified": False,
    "warning": "HTTP 200/decoded image/filename matching is NOT evidence of actual Korean-language print or visible theme. Contact sheets must be inspected before classification.",
    "sets": summaries, "contactSheets": sheets, "cards": records
}
TARGET.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("SM_NEXT_SOURCE_EVIDENCE", json.dumps({
    "attempted": len(records), "decoded": report["decodedImages"],
    "unavailable": report["unavailableImages"],
    "duplicateGroups": len(duplicates), "sheets": len(sheets),
    "output": str(TARGET)
}, ensure_ascii=False), flush=True)
