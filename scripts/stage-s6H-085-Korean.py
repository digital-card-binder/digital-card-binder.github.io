#!/usr/bin/env python3
"""Stage Korean s6H 085 from the human-reviewed Kakao Shopping card photo.
Do not mutate catalog data unless the card crop and proof pass strict checks.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from io import BytesIO
from PIL import Image, ImageOps
import json, hashlib

ROOT = Path(__file__).resolve().parents[1]
PROOF = ROOT / "data/audits/theme-s6H-085-Korean-print-review-20261016.json"
STAGE = ROOT / "data/audits/theme-visual-evidence/s6H/korean-rare-candidates/staged-085-korean.json"
TARGET = ROOT / "assets/cards/s6h-korean-rare/085-korean.webp"
record = json.loads(PROOF.read_text(encoding="utf8"))
assert record["status"] == "Korean_print_visually_confirmed_085"
assert record["code"] == "s6h_085/070" and record["printedNumber"] == "085/070"
assert record["sourcePrintVerified"] and record["all12ThemesReviewed"]
assert record["matchedThemes"] == ["color", "season"]
assert record["remainingHolds"] == [88, 89, 90, 91, 92, 93]
source = record["sourceUrl"]
assert source.startswith("https://shop4.daumcdn.net/thumb/R500x500/?fname=")
req = Request(source, headers={
    "User-Agent": "Mozilla/5.0 (compatible; DigitalCardBinderKoreanPrintAudit/1.0)",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
})
with urlopen(req, timeout=35) as response:
    body = response.read(3000001)
    assert response.status == 200
assert 15000 < len(body) <= 3000000, "Kakao photo missing or invalid"
photo = Image.open(BytesIO(body))
photo.load()
photo = ImageOps.exif_transpose(photo).convert("RGB")
W, H = photo.size
assert 390 <= W <= 2400 and 390 <= H <= 2400, "Unexpected downloaded source dimensions"
if 0.90 <= W / H <= 1.10:
    # Kakao Shopping search shows one portrait card centered against a white square.
    # Find a full-height dark object rather than crop at a guessed coordinate.
    px = photo.load()
    step = max(1, W // 500)
    xhits = []
    yhits = []
    for x in range(0, W, step):
        count = sum(1 for y in range(0, H, step)
                    if max(px[x, y]) < 220 and sum(px[x, y]) < 620)
        if count >= int((H / step) * 0.23):
            xhits.append(x)
    for y in range(0, H, step):
        count = sum(1 for x in range(0, W, step)
                    if max(px[x, y]) < 220 and sum(px[x, y]) < 620)
        if count >= int((W / step) * 0.16):
            yhits.append(y)
    assert xhits and yhits, "Unable to isolate card from square photo"
    left, right = min(xhits), max(xhits) + step
    top, bottom = min(yhits), max(yhits) + step
    assert W * 0.52 < right - left < W * 0.82
    assert H * 0.77 < bottom - top <= H
    photo = photo.crop((max(0, left-2), max(0, top-2),
                        min(W, right+2), min(H, bottom+2)))
else:
    assert 0.63 < W / H < 0.81, "Photo is neither a card nor expected square photo"
w, h = photo.size
assert 0.62 <= w / h <= 0.81, "Cropped image is not a portrait Pokemon card"
output = ImageOps.fit(photo, (420, 586), method=Image.Resampling.LANCZOS,
                      centering=(0.5, 0.5))
TARGET.parent.mkdir(parents=True, exist_ok=True)
output.save(TARGET, "WEBP", quality=92, method=6)
blob = TARGET.read_bytes()
assert len(blob) >= 18000 and blob[:4] == b"RIFF" and blob[8:12] == b"WEBP"
STAGE.parent.mkdir(parents=True, exist_ok=True)
result = {
    "schemaVersion": 1, "set": "s6H", "number": 85,
    "code": "s6h_085/070", "status": "Korean_print_visually_approved_rehosted",
    "source": source, "sourceSize": [W, H], "cropSize": [w, h],
    "ownedPath": str(TARGET.relative_to(ROOT)),
    "sourceSha256": hashlib.sha256(body).hexdigest(),
    "stagedSha256": hashlib.sha256(blob).hexdigest(),
    "imageWidth": 420, "imageHeight": 586,
    "visualApproval": str(PROOF.relative_to(ROOT)),
    "heldUnresolvedNumbers": [88, 89, 90, 91, 92, 93],
}
STAGE.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
print(json.dumps(result, ensure_ascii=False))
