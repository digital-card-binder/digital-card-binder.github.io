#!/usr/bin/env python3
"""Evidence-only SM2+ Korean-art audit preflight. Never approves artwork by URL alone."""
from __future__ import annotations
import base64, hashlib, io, json, re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
import requests
from PIL import Image, ImageDraw, ImageOps

MASTER = Path("data/series.json")
LEGACY = Path("data/series-legacy.json")
THEMES = Path("data/art-themes.json")
COVERAGE = Path("data/audits/theme-series-coverage.json")
OUTPUT = Path("data/audits/theme-sm2plus-001-010-readonly-preflight-20261020.json")
FOR_REVIEW = 10

base = json.loads(MASTER.read_text(encoding="utf-8"))
legacy = json.loads(LEGACY.read_text(encoding="utf-8"))
merged = {str(x.get("code", "")).lower(): x for x in base}
merged.update({str(x.get("code", "")).lower(): x for x in legacy})
group = merged.get("sm2+")
assert group is not None and len(group.get("cards", [])) == 75, "Master SM2+ count changed"
themes = json.loads(THEMES.read_text(encoding="utf-8"))
coverage = json.loads(COVERAGE.read_text(encoding="utf-8"))
assert len(themes.get("groups", [])) == 12
assert coverage["summary"]["strictCompleteSetCount"] == 109
assert coverage["summary"]["themeCardSlots"] == 18011
assert next(x for x in coverage["sets"] if x["code"].lower() == "sm2+")["status"] == "pending"
existing = [
    {"theme": g["code"], "code": card.get("code")}
    for g in themes["groups"] for card in g.get("cards", [])
    if str(card.get("set", "")).lower() == "sm2+"
]
assert len(existing) == 0, "SM2+ themed cards appeared; do not overwrite completed work"

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; CardBinderKoreanSM2PlusEvidence/1.0)",
                        "Accept": "image/avif,image/webp,image/apng,image/png,image/jpeg,*/*;q=0.8"})
rows, thumbs = [], []
for index, card in enumerate(group["cards"], start=1):
    code = str(card.get("code", ""))
    suffix = f"{index:03d}"
    image = str(card.get("image") or "")
    canonical = bool(re.search(r"sm2(?:%2b|\+|plus|%20|\s)*[_/ ]?0*" + str(index) + r"(?=\D|$)", image, re.I))
    # Source image paths are not proof of actual printed-card language or number.
    row = {"index": index, "code": code, "name": card.get("name") or card.get("label") or "",
           "image": image, "imageHost": urlparse(image).hostname or "",
           "imageUrlMentionsPrintedIndex": canonical,
           "masterRarity": card.get("rarity") or "",
           "actualKoreanPrintedFaceVisuallyRead": False,
           "exactKoreanPrintedNumberVisuallyRead": False,
           "approvedThemes": [],
           "imageReplaced": False}
    if index <= FOR_REVIEW and image.startswith("https://"):
        try:
            resp = session.get(image, timeout=17)
            resp.raise_for_status()
            if len(resp.content) > 8_000_000:
                raise ValueError("image exceeds 8MB")
            img = Image.open(io.BytesIO(resp.content))
            img.load()
            row.update(imageHttpStatus=resp.status_code, decoded=True,
                       width=img.width, height=img.height, imageFormat=img.format,
                       imageSha256=hashlib.sha256(resp.content).hexdigest())
            thumbs.append((index, str(row["name"]), img.convert("RGB")))
        except Exception as exc:
            row.update(decoded=False, imageError=str(exc)[:240])
    rows.append(row)

report = {
    "schemaVersion": 1, "recordedAt": "2026-10-20",
    "series": group.get("code"), "setName": group.get("displayName") or group.get("name"),
    "mode": "continuation_preflight_only_not_full_12_theme_approval",
    "totalMasterCards": len(rows), "existingThemeRowsPreserved": len(existing),
    "firstTenDownloadedAndDecoded": len(thumbs),
    "firstTenPendingKoreanPixelReview": FOR_REVIEW,
    "fullSetKoreanPrintedVisualApprovalsFromThisAutomatedPass": 0,
    "nextRange": "SM2+ 001-010 exact Korean card-face and 12-theme visual evaluation, then 011-030",
    "sources": [
      "https://setory.site/sets/sm-new-trials-kr",
      "https://collectory.cc/sets/56ce43c3-d8de-4bbd-87a7-c4249dc3d007",
      "https://tcgbox.co.kr/category/sm2%EC%83%88%EB%A1%9C%EC%9A%B4-%EC%8B%9C%EB%A0%A8/112/"
    ],
    "discrepancyNote": "Master currently holds 75 entries; Korean base print has 49 numbered regular slots plus additional rarities. Independently verify number/printing for extras before approval.",
    "imageHosts": dict(Counter(x["imageHost"] for x in rows)),
    "cards": rows,
    "preservation": {"canonicalMasterModified": 0, "themeDataModified": 0,
                     "ownershipModified": 0, "firestoreModified": 0,
                     "priorReviewsRepeated": 0, "radarFilesModified": 0}
}
OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("SM2PLUS_FIRST10_PREFLIGHT",
      json.dumps({"total": len(rows), "decoded": len(thumbs),
                  "imageHosts": report["imageHosts"],
                  "cards": [{"index": x["index"], "code": x["code"],
                             "name": x["name"], "image": x["image"],
                             "decoded": x.get("decoded")} for x in rows[:10]]},
                 ensure_ascii=False))
if thumbs:
    w, h, cols = 250, 385, 5
    sheet = Image.new("RGB", (w * cols, h * 2), "white")
    draw = ImageDraw.Draw(sheet)
    for pos, (index, name, img) in enumerate(thumbs[:10]):
        cx, cy = (pos % cols) * w, (pos // cols) * h
        draw.text((cx + 8, cy + 5), f"{index:03d} {name}", fill="black")
        thumbnail = ImageOps.contain(img, (w - 8, h - 29))
        sheet.paste(thumbnail, (cx + (w - thumbnail.width)//2, cy + 24))
    bio = io.BytesIO()
    sheet.save(bio, format="JPEG", quality=65, optimize=True)
    print("SM2PLUS_FIRST10_CONTACT_SHEET_BEGIN")
    print(base64.b64encode(bio.getvalue()).decode("ascii"))
    print("SM2PLUS_FIRST10_CONTACT_SHEET_END")
