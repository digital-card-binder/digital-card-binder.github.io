#!/usr/bin/env python3
"""SHA256-verified pixels for the 217 provisionally screened Korean art sources."""
from pathlib import Path
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import colorsys
import hashlib
import io
import json
import requests
from PIL import Image
ROOT=Path("data/audits")
AUDIT=ROOT/"theme-sm7b-sm8-sm8a-image-evidence-20261022.json"
VISUAL=ROOT/"theme-sm7b-sm8-sm8a-visual-decisions-20261022.json"
OUT=ROOT/"theme-sm7b-sm8-sm8a-color-palette-20261022.json"
report=json.loads(AUDIT.read_text(encoding="utf8"))
review=json.loads(VISUAL.read_text(encoding="utf8"))
assert report["canonicalSlots"]==239 and report["decodedImages"]==236
assert review["reviewedContactSheets"]==18 and review["heldCount"]==22
assert not OUT.exists(), "Do not overwrite reviewed evidence"
held={(r["set"],r["number"]) for r in review["held"]}
assert len(held)==22
todo=[]
for r in report["cards"]:
    key=(r["set"].lower(),r["index"])
    if key in held:
        continue
    assert r["decoded"] and not r["imageSourceError"]
    assert r["imageHost"]=="cards.image.pokemonkorea.co.kr"
    assert len(r["actualSha256"])==64
    assert not r["duplicateArtworkSource"]
    todo.append(r)
assert len(todo)==217
def color_bin(rgb):
    h,s,v=colorsys.rgb_to_hsv(*(c/255 for c in rgb))
    if s<.17:
        return "검정" if v<.28 else "흰색" if v>.85 else "회색"
    if v<.15:return "검정"
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
def inspect(r):
    res=requests.get(r["originalImageReference"],timeout=(12,30),headers={
        "User-Agent":"Mozilla/5.0 (KoreanCardArtAudit/1.0)"})
    res.raise_for_status()
    if len(res.content)>8_000_000:
        raise ValueError("Picture unexpectedly exceeds 8MB")
    sha=hashlib.sha256(res.content).hexdigest()
    if sha!=r["actualSha256"]:
        raise ValueError("Original source artwork changed for "+r["canonicalCode"])
    pic=Image.open(io.BytesIO(res.content)).convert("RGB")
    w,h=pic.size
    crop=pic.crop((int(w*.09),int(h*.135),int(w*.91),int(h*.40)))
    crop.thumbnail((66,34))
    main=Counter(color_bin(rgb) for rgb in crop.getdata()).most_common()
    first=main[0][0]
    second=next((name for name,count in main[1:] if name!=first),
                "회색" if first!="회색" else "흰색")
    return {"set":r["set"].lower(),"number":r["index"],
            "canonicalCode":r["canonicalCode"],"name":r["koreanNameInMaster"],
            "sourceSha256":sha,"observedArtColor":first+"·"+second,
            "printedKoreanFooterVerified":False}
with ThreadPoolExecutor(max_workers=12) as pool:
    results=list(pool.map(inspect,todo))
assert len(results)==217
OUT.write_text(json.dumps({
    "schemaVersion":1,"recordedAt":"2026-10-22",
    "method":"Original source image SHA256 exact match, top two HSV bins in artwork crop",
    "source":str(AUDIT),"visual":str(VISUAL),
    "screenedCount":217,"heldCount":22,
    "previousArtworkMembersModified":0,
    "rows":results
},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("VISUALLY_SCREENED_SM7_BATCH_PALETTE",json.dumps({
    "verifiedOriginalHashes":len(results),
    "bySet":dict(Counter(r["set"] for r in results)),
    "uniqueColorTags":len(set(r["observedArtColor"] for r in results))
},ensure_ascii=False),flush=True)
