#!/usr/bin/env python3
"""Verify source SHA256 and classify coarse artwork colors for Korean SM9b/SM10/SM10a."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import colorsys
import hashlib
import io
import json
import requests
from PIL import Image
BASE=Path("data/audits")
source=json.loads((BASE/"theme-sm9b-sm10-sm10a-image-evidence-20261022.json").read_text())
review=json.loads((BASE/"theme-sm9b-sm10-sm10a-visual-decisions-20261022.json").read_text())
out=BASE/"theme-sm9b-sm10-sm10a-color-palette-20261022.json"
assert source["canonicalSlots"]==254 and source["decodedImages"]==244
assert review["reviewedContactSheets"]==18 and review["heldCount"]==23
assert not out.exists()
held={(x["set"].lower(),x["number"]) for x in review["held"]}
assert len(held)==23
pending=[x for x in source["cards"] if (x["set"].lower(),x["index"]) not in held]
assert len(pending)==231
for x in pending:
    assert x["decoded"] and not x["imageSourceError"] and not x["duplicateArtworkSource"]
    assert x["imageHost"]=="cards.image.pokemonkorea.co.kr"
    assert len(x["actualSha256"])==64
def color(rgb):
    h,s,v=colorsys.rgb_to_hsv(*(a/255 for a in rgb))
    if s<.17: return "검정" if v<.28 else "흰색" if v>.85 else "회색"
    if v<.15: return "검정"
    if h<.035 or h>=.965:return "빨강"
    if h<.095:return "주황"
    if h<.175:return "노랑"
    if h<.275:return "연두"
    if h<.425:return "초록"
    if h<.525:return "청록"
    if h<.69:return "파랑"
    if h<.79:return "보라"
    if h<.89:return "분홍"
    return "자주"
def check(x):
    r=requests.get(x["originalImageReference"],timeout=(12,30),headers={"User-Agent":"Mozilla/5.0 (KoreanCardArtAudit/1.0)"})
    r.raise_for_status()
    assert len(r.content)<8_000_000
    sha=hashlib.sha256(r.content).hexdigest()
    assert sha==x["actualSha256"],x["canonicalCode"]
    im=Image.open(io.BytesIO(r.content)).convert("RGB")
    w,h=im.size
    crop=im.crop((int(w*.09),int(h*.135),int(w*.91),int(h*.4)))
    crop.thumbnail((66,34))
    counts=Counter(color(t) for t in crop.getdata()).most_common()
    one=counts[0][0]
    two=next((name for name,_ in counts[1:] if name!=one),"흰색" if one!="흰색" else "회색")
    return {"set":x["set"].lower(),"number":x["index"],"canonicalCode":x["canonicalCode"],
      "name":x["koreanNameInMaster"],"sourceSha256":sha,
      "observedArtColor":one+"·"+two,"printedKoreanFooterVerified":False}
with ThreadPoolExecutor(max_workers=12) as executor:
    rows=list(executor.map(check,pending))
assert len(rows)==231
out.write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-22",
 "method":"Original Pokemon Korea source image SHA256 matched, top two artwork pixel HSV bins",
 "screenedCount":231,"heldCount":23,"rows":rows},ensure_ascii=False,indent=2)+"\n")
print("SM9B_SM10_SM10A_COLOR_PROOF",json.dumps({"accepted":len(rows),"held":23}))
