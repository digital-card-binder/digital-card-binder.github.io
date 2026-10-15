#!/usr/bin/env python3
"""Rehost only five visually approved S6H Korean printed rare images.
Originals are 286x400 TCGBOX watermarked scans; keep watermark and record quality debt.
"""
from pathlib import Path
from PIL import Image,ImageOps
from io import BytesIO
import base64,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"data/audits/theme-visual-evidence/s6H/korean-rare-candidates"
APPROVAL=ROOT/"data/audits/theme-s6H-084-095-five-Korean-prints-review-20261015.json"
ASSETS=ROOT/"assets/cards/s6h-korean-rare"
ASSETS.mkdir(parents=True,exist_ok=True)
index=json.loads((SRC/"index.json").read_text(encoding="utf-8"))
approved=json.loads(APPROVAL.read_text(encoding="utf-8"))
nums=[84,86,87,94,95]
assert approved["verifiedNumbers"]==nums
assert index["set"]=="s6H" and index["candidateCount"]>=5
assert approved["status"]=="five_Korean_printed_cards_visually_verified_low_resolution_watermarked"
saved=[]
for n in nums:
    code=f"s6h_{n:03d}/070"
    review=next(x for x in approved["cards"] if x["number"]==n)
    candidate=next(x for x in index["cards"] if x["number"]==n)
    assert review["code"]==code and candidate["code"]==code
    assert review["name"]==candidate["expectedName"] and review["visibleKoreanName"]
    assert review["koreanPrintedFooterVisible"] and review["printedNumber"]==f"{n:03d}/070"
    assert review["sourceUrl"]==candidate["candidateUrl"]
    assert candidate["status"]=="retrieved_requires_visible_Korean_print_and_number_review"
    assert candidate["dimensions"]==[286,400]
    assert candidate["originalSha256"] and len(candidate["originalSha256"])==64
    f=SRC/candidate["evidenceFile"]
    data=base64.b64decode(f.read_text(encoding="ascii"))
    image=Image.open(BytesIO(data));image.load()
    assert image.size==tuple(candidate["dimensions"])
    output=ImageOps.exif_transpose(image.convert("RGB")).resize((420,586),Image.Resampling.LANCZOS)
    path=ASSETS/f"{n:03d}-korean.webp"
    output.save(path,"WEBP",quality=94,method=6)
    buf=path.read_bytes()
    assert len(buf)>12000 and buf[:4]==b"RIFF" and buf[8:12]==b"WEBP"
    saved.append({"number":n,"code":code,"ownedPath":str(path.relative_to(ROOT)),
      "source":review["sourceUrl"],"sourceSha256":candidate["originalSha256"],
      "stagedSha256":hashlib.sha256(buf).hexdigest(),
      "size":[420,586],"watermark":"TCGBOX","originalSize":[286,400],
      "reviewedKoreanTitle":review["name"],"reviewedKoreanNumber":review["printedNumber"]})
path=SRC/"staged-five-korean.json"
path.write_text(json.dumps({"schemaVersion":1,"set":"s6H","status":"five_verified_Korean_prints_staged_low_res_watermark",
"cards":saved,"unresolvedNumbers":[85,88,89,90,91,92,93]},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"staged":[x["number"] for x in saved],"pending":[85,88,89,90,91,92,93]},ensure_ascii=False))
