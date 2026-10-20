#!/usr/bin/env python3
"""Ground color-theme palette decisions in the actual Korean source-card pixels.
No previous user data or theme files are touched by this evidence generator.
"""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import colorsys, hashlib, io, json, requests
from PIL import Image

EVIDENCE=Path("data/audits/theme-sm4plus-sm5s-sm5m-korean-image-preflight-20261020.json")
OUT=Path("data/audits/theme-sm4plus-sm5s-sm5m-artwork-palette-evidence-20261020.json")
doc=json.loads(EVIDENCE.read_text(encoding="utf8"))
assert doc["totalMasterCards"]==281
sets={s["code"].lower():s for s in doc["sets"]}
assert {k:(v["masterCards"],v["imagesDownloadedAndDecoded"]) for k,v in sets.items()}=={
  "sm4+":(125,125),"sm5s":(78,78),"sm5m":(78,76)}
def held(code,n):
    return (code=="sm4+" and n>=121) or (code=="sm5m" and n in (73,74))
todo=[(code,row) for code,block in sets.items() for row in block["sourceRows"]
      if not held(code,row["index"])]
assert len(todo)==274

def bin_color(rgb):
    r,g,b=(z/255 for z in rgb)
    h,s,v=colorsys.rgb_to_hsv(r,g,b)
    if s<0.17:
        if v<0.28:return "검정"
        if v>0.85:return "흰색"
        return "회색"
    if v<0.15:return "검정"
    if h<0.035 or h>=0.965:return "빨강"
    if h<0.095:return "주황"
    if h<0.175:return "노랑"
    if h<0.275:return "연두"
    if h<0.425:return "초록"
    if h<0.525:return "청록"
    if h<0.69:return "파랑"
    if h<0.79:return "보라"
    if h<0.89:return "분홍"
    return "자주"

def inspect(record):
    code,row=record
    assert row["imageDecoded"] and len(row["sha256"])==64
    url=row["image"]
    res=requests.get(url,timeout=25,headers={
        "User-Agent":"Mozilla/5.0 (Pokemon Korean art image palette evidence)",
        "Accept":"image/webp,image/png,image/jpeg,*/*"})
    res.raise_for_status()
    if len(res.content)>8_000_000:raise ValueError("Image over 8MB "+code+str(row["index"]))
    digest=hashlib.sha256(res.content).hexdigest()
    if digest!=row["sha256"]:
        raise ValueError("Canonical image changed; refuse to misclassify "+code+"/"+str(row["index"]))
    im=Image.open(io.BytesIO(res.content)).convert("RGB")
    w,h=im.size
    art=im.crop((int(w*.09),int(h*.135),int(w*.91),int(h*.40)))
    art.thumbnail((66,34))
    pixel_groups=Counter(bin_color(p) for p in art.getdata())
    common=pixel_groups.most_common()
    assert len(common)>=1
    first=common[0][0]
    second=next((c for c,num in common[1:] if c!=first),first)
    if second==first:second="회색" if first!="회색" else "흰색"
    return {"set":code,"number":row["index"],"code":row["code"],
            "KoreanName":row["name"],"originalSha256":digest,
            "pixelArtColorTag":first+"·"+second,
            "artPixelBins":dict(common),
            "artCropFraction":[.09,.135,.91,.40],
            "printedFooterEnlargedByTool":False}

with ThreadPoolExecutor(max_workers=12) as pool:
    rows=list(pool.map(inspect,todo))
assert len(rows)==274
report={"schemaVersion":1,"recordedAt":"2026-10-20",
 "sourceEvidence":str(EVIDENCE),"method":"Top two observed pixel color bins in original artwork crop, SHA256-matched to first Korean source probe",
 "methodCaveat":"Palette bins are objective color cues only. All non-color thematic memberships require a separate direct visual decision.",
 "screenedCanonicalSourceCount":274,"heldWithoutPalette":7,
 "previousThemeRowsModified":0,"originalKoreanImagesChanged":0,
 "pixelEvidenceRows":rows}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SM_3SETS_PIXEL_PALETTE",json.dumps({
    "screened":len(rows),"perSet":{c:sum(r["set"]==c for r in rows) for c in sets},
    "sample":rows[:10],
    "record":str(OUT)},ensure_ascii=False))
