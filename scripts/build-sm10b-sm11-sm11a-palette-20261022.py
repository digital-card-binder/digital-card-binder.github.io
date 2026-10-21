#!/usr/bin/env python3
"""Validate original Korean artwork SHA256 and extract top two artwork colors for 241 cards."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import hashlib, io, json, colorsys, requests
from PIL import Image
BASE=Path("data/audits")
source=json.loads((BASE/"theme-sm10b-sm11-sm11a-image-evidence-20261022.json").read_text())
review=json.loads((BASE/"theme-sm10b-sm11-sm11a-visual-decisions-20261022.json").read_text())
OUT=BASE/"theme-sm10b-sm11-sm11a-color-palette-20261022.json"
assert source["canonicalSlots"]==264 and source["decodedImages"]==257
assert review["reviewedContactSheets"]==19 and review["heldCount"]==23
assert not OUT.exists()
held={(x["set"],x["number"]) for x in review["held"]}
assert len(held)==23
pending=[x for x in source["cards"] if (x["set"],x["index"]) not in held]
assert len(pending)==241
for c in pending:
    assert c["decoded"] and not c["imageSourceError"] and not c["duplicateArtworkSource"]
    assert c["imageHost"]=="cards.image.pokemonkorea.co.kr"
    assert len(c["actualSha256"])==64
def hue(rgb):
    h,s,v=colorsys.rgb_to_hsv(*(c/255 for c in rgb))
    if v<.15:return "검정"
    if s<.17:return "흰색" if v>.85 else "회색"
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
def check(c):
    r=requests.get(c["originalImageReference"],timeout=(12,30),
       headers={"User-Agent":"Mozilla/5.0 (KoreanOriginalArtAudit/1.0)"})
    r.raise_for_status()
    assert len(r.content)<8_000_000
    sha=hashlib.sha256(r.content).hexdigest()
    assert sha==c["actualSha256"],c["canonicalCode"]
    im=Image.open(io.BytesIO(r.content)).convert("RGB")
    w,h=im.size
    im=im.crop((int(w*.09),int(h*.135),int(w*.91),int(h*.4)))
    im.thumbnail((66,34))
    counts=Counter(hue(t) for t in im.getdata()).most_common()
    first=counts[0][0]
    second=next((n for n,_ in counts[1:] if n!=first),"흰색" if first!="흰색" else "회색")
    return {"set":c["set"],"number":c["index"],"canonicalCode":c["canonicalCode"],
      "sourceSha256":sha,"observedArtColor":first+"·"+second,"printedKoreanFooterVerified":False}
with ThreadPoolExecutor(max_workers=12) as workers:
    rows=list(workers.map(check,pending))
assert len(rows)==241
OUT.write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-22",
    "method":"Korean Pokemon image source byte SHA256 recheck and HSV art crop, not printed-number verification",
    "screenedCount":241,"heldCount":23,"rows":rows},ensure_ascii=False,indent=2)+"\n")
print("SM10B_SM11_SM11A_SOURCE_SHA_COLOR",json.dumps({"screened":len(rows),"held":23}))
