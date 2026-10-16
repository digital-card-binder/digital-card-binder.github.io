#!/usr/bin/env python3
"""Read-only Korean S5a 071-096 rare-source triage; never auto-approve non-Korean prints."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import base64
import json

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/audits/theme-visual-evidence/s5a/071-096"
OUT.mkdir(parents=True, exist_ok=True)

def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))

progress = read("data/audits/theme-s5a-061-070-progress-20261016.json")
assert progress["set"] == "s5a"
assert progress["totalMasterCards"] == 96 and progress["artworkReviewed"] == 70
assert progress["heldRareCardNumbers"] == list(range(71, 97))
assert progress["status"] == "in_progress" and progress["complete"] is False
assert progress["globalCheckpointPreserved"] == "s6K Korean print source pending: 089,090,092,094"
sets = [s for s in read("data/series.json") + read("data/series-legacy.json")
        if str(s.get("code", "")).lower() == "s5a"]
assert len(sets) == 1 and len(sets[0]["cards"]) == 96
cards = sets[0]["cards"]
def own_cdn_destination(url):
    split = urlsplit(url)
    if split.scheme not in ("https", "http") or not split.hostname:
        return ""
    source = f"{split.scheme}://{split.netloc}{split.path}"
    if split.hostname == "cards.image.pokemonkorea.co.kr":
        path = split.path.lstrip("/")
        if not path.startswith("data/wmimages/") or "." not in path:
            return ""
        root = path.split("/")[2].upper()
        project = "modern" if root in {"MEGA", "S", "SV"} else "legacy"
        return f"https://dcb-card-images-{project}-2026.pages.dev/{path.rsplit('.', 1)[0]}.webp"
    h = 0xcbf29ce484222325
    for ch in source:
        h ^= ord(ch)
        h = h * 0x100000001b3 & 0xffffffffffffffff
    return (f"https://dcb-card-images-legacy-2026.pages.dev/"
            f"external/{split.hostname}/{h:016x}.webp")

rows = []
for n in range(71, 97):
    card = cards[n - 1]
    num = f"{n:03d}"
    code = f"s5a_{num}/070"
    assert str(card.get("code", "")).lower() == code, (n, card.get("code"))
    assert str(card.get("name", "")).strip(), num
    image = str(card.get("image") or "")
    original = str(card.get("sourceImage") or "")
    candidate = original or image
    host = urlsplit(candidate).hostname or ""
    official_path = f"/data/wmimages/S/S5a/S5a_{num}."
    official_shape = (host == "cards.image.pokemonkorea.co.kr"
                      and official_path in urlsplit(candidate).path)
    rows.append({
        "canonicalOrder": n,
        "code": card["code"],
        "name": card["name"],
        "cardNumber": str(card.get("cardNumber") or f"{num}/070"),
        "rarity": str(card.get("rarity") or ""),
        "sourceImage": original,
        "displayImage": image,
        "candidateUrl": candidate,
        "candidateHost": host,
        "officialKoreanImageUrlShapeOnly": official_shape,
        "koreanPrintVisuallyVerified": False,
        "themeClassificationApplied": False,
        "holdReason": "Printed Korean rare image identity not independently visually verified"
    })

for row in rows:
    row["ownedCandidateUrl"] = own_cdn_destination(row["candidateUrl"])

def inspect_owned(row):
    url = row["ownedCandidateUrl"]
    check = {"status": "not_available", "http": None}
    photo = None
    if urlsplit(url).hostname not in {"dcb-card-images-modern-2026.pages.dev",
                                        "dcb-card-images-legacy-2026.pages.dev"}:
        check["status"] = "no_owned_destination"
        return row["canonicalOrder"], check, photo
    try:
        with urlopen(Request(url, headers={"User-Agent": "DCB-Owned-Rare-Audit/1.0"}),
                     timeout=18) as response:
            check["http"] = response.status
            body = response.read(6_000_001)
        if not 1000 < len(body) <= 6_000_000:
            raise ValueError("Owned image size outside limits")
        loaded = Image.open(BytesIO(body))
        loaded.load()
        if loaded.format != "WEBP" or loaded.width < 150 or loaded.height < 200:
            raise ValueError("Owned image not valid WebP card asset")
        check.update(status="decoded_owned_archive", format=loaded.format,
                     dimensions=[loaded.width, loaded.height],
                     sha256=sha256(body).hexdigest(), byteCount=len(body))
        photo = loaded.convert("RGB")
        photo.thumbnail((205, 280))
    except Exception as exc:
        check["status"] = "owned_archive_missing"
        check["error"] = f"{type(exc).__name__}: {str(exc)}"[:200]
    return row["canonicalOrder"], check, photo

def inspect(row):
    check = {"status": "not_checked", "http": None}
    photo = None
    url = row["candidateUrl"]
    if urlsplit(url).scheme not in ("https", "http"):
        check["status"] = "no_direct_image_url"
        return row["canonicalOrder"], check, photo
    try:
        request = Request(url, headers={"User-Agent": "Mozilla/5.0 DCB-Audit/1.0"})
        with urlopen(request, timeout=18) as response:
            check["http"] = response.status
            body = response.read(6_000_001)
        if not 1000 < len(body) <= 6_000_000:
            raise ValueError("Candidate image size outside inspection range")
        candidate = Image.open(BytesIO(body))
        candidate.load()
        if not 150 <= candidate.width <= 4000 or not 200 <= candidate.height <= 5000:
            raise ValueError("Candidate image dimensions outside inspection range")
        check.update(
            status="decoded_unverified_region",
            dimensions=[candidate.width, candidate.height],
            format=candidate.format,
            sha256=sha256(body).hexdigest(),
            byteCount=len(body)
        )
        photo = candidate.convert("RGB")
        photo.thumbnail((205, 280))
    except Exception as exc:
        check["status"] = "candidate_unavailable"
        check["error"] = f"{type(exc).__name__}: {str(exc)}"[:200]
    return row["canonicalOrder"], check, photo

with ThreadPoolExecutor(max_workers=5) as workers:
    found = {n: (detail, photo) for n, detail, photo in workers.map(inspect, rows)}

canvas = Image.new("RGB", (5 * 240, 6 * 345), (247, 247, 247))
draw = ImageDraw.Draw(canvas)
for i, row in enumerate(rows):
    n = row["canonicalOrder"]
    check, photo = found[n]
    x, y = (i % 5) * 240, (i // 5) * 345
    draw.rectangle((x + 2, y + 2, x + 237, y + 342), outline=(130, 130, 130), width=2)
    if photo is not None:
        canvas.paste(photo, (x + (240 - photo.width) // 2, y + 5))
    else:
        draw.text((x + 12, y + 130), "SOURCE MISSING", fill=(30, 30, 30))
    draw.text((x + 8, y + 284), f"{n:03d} {row['code']}", fill=(20, 20, 20))
    draw.text((x + 8, y + 306), (row["candidateHost"] or "unknown")[:30], fill=(30, 30, 30))
    draw.text((x + 8, y + 325), "UNVERIFIED KOREAN PRINT", fill=(130, 10, 10))
sheet = BytesIO()
canvas.save(sheet, format="WEBP", quality=77, method=4)
(OUT / "s5a-071-096-candidate-sheet.webp.b64").write_text(
    base64.b64encode(sheet.getvalue()).decode("ascii"), encoding="ascii")

for row in rows:
    row["candidateImageInspection"] = found[row["canonicalOrder"]][0]
with ThreadPoolExecutor(max_workers=5) as workers:
    owned = {n: (detail, photo) for n, detail, photo in workers.map(inspect_owned, rows)}
own_sheet = Image.new("RGB", (5 * 240, 6 * 345), (247, 247, 247))
own_draw = ImageDraw.Draw(own_sheet)
for i, row in enumerate(rows):
    n = row["canonicalOrder"]
    check, photo = owned[n]
    x, y = (i % 5) * 240, (i // 5) * 345
    own_draw.rectangle((x + 2, y + 2, x + 237, y + 342),
                       outline=(130, 130, 130), width=2)
    if photo is not None:
        own_sheet.paste(photo, (x + (240 - photo.width) // 2, y + 5))
    else:
        own_draw.text((x + 12, y + 130), "OWN CDN MISSING", fill=(30, 30, 30))
    own_draw.text((x + 8, y + 284), f"{n:03d} {row['code']}", fill=(20, 20, 20))
    own_draw.text((x + 8, y + 306), check["status"][:30], fill=(30, 30, 30))
    own_draw.text((x + 8, y + 325), "REGION STILL NEEDS PROOF", fill=(130, 10, 10))
own_sheet_buf = BytesIO()
own_sheet.save(own_sheet_buf, format="WEBP", quality=77, method=4)
(OUT / "s5a-071-096-owned-archive-sheet.webp.b64").write_text(
    base64.b64encode(own_sheet_buf.getvalue()).decode("ascii"), encoding="ascii")

for row in rows:
    row["ownedImageInspection"] = owned[row["canonicalOrder"]][0]

decoded = sum(r["candidateImageInspection"]["status"] == "decoded_unverified_region"
              for r in rows)
owned_decoded = sum(r["ownedImageInspection"]["status"] == "decoded_owned_archive"
                    for r in rows)
record = {
    "schemaVersion": 1,
    "recordedAt": "2026-10-16",
    "set": "s5a",
    "name": "쌍벽의 파이터",
    "range": "071-096",
    "purpose": "Candidate-only source provenance and image decoding for Korean rare-print triage",
    "canonicalSetCardCount": 96,
    "checkedCardCount": len(rows),
    "decodedCandidateCount": decoded,
    "unavailableCandidateCount": 26 - decoded,
    "ownedArchiveDecodedCount": owned_decoded,
    "ownedArchiveMissingCount": 26 - owned_decoded,
    "candidateHostCounts": dict(sorted(Counter(r["candidateHost"] for r in rows).items())),
    "officialKoreanUrlShapeCount": sum(r["officialKoreanImageUrlShapeOnly"] for r in rows),
    "visuallyVerifiedKoreanPrintCount": 0,
    "artworkThemeReviewComplete": False,
    "setComplete": False,
    "heldCardNumbers": list(range(71, 97)),
    "existingArtworkReviewedCountUnchanged": 70,
    "existingNewThemeMembershipsUnchanged": 115,
    "globalCheckpointPreserved": progress["globalCheckpointPreserved"],
    "nextStart": progress["nextStart"],
    "contactSheets": ["s5a-071-096-candidate-sheet.webp.b64",
                      "s5a-071-096-owned-archive-sheet.webp.b64"],
    "cards": rows,
    "safety": "This audit never changes series/card IDs, user ownership, theme memberships, or Korean approval state. A decoded candidate or Korean-looking host is NOT Korean print verification."
}
assert len(rows) == 26 and record["heldCardNumbers"] == progress["heldRareCardNumbers"]
(OUT / "rare-source-triage.json").write_text(
    json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "set": "s5a", "range": "071-096", "checked": 26,
    "decodedCandidatesUnverified": decoded,
    "decodedSelfHostedArchive": owned_decoded,
    "sourceHosts": record["candidateHostCounts"],
    "heldKoreanRares": 26,
    "themeCardsUnchanged": True,
}, ensure_ascii=False))
