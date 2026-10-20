#!/usr/bin/env python3
"""Recheck original Korean image bytes before assigning only art-grounded color tags."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import colorsys, hashlib, io, json, requests
from PIL import Image

INPUT=Path("data/audits/theme-sm5plus-sm6-sm6a-korean-image-preflight-20261020.json")
OUTPUT=Path("data/audits/theme-sm5plus-sm6-sm6a-artwork-palette-evidence-20261020.json")
doc=json.loads(INPUT.read_text(encoding="utf8"))
assert doc["totalMasterCards"]==257 and doc["previousThemeRowsPreserved"]==19035
sets={x["code"].lower():x for x in doc["sets"]}
expected={"sm5+":("sm5plus",50,72,72),"sm6":("sm6",94,110,106),
          "sm6a":("sm6a",53,75,75)}
assert set(sets)==set(expected)
for code,(prefix,base,count,decoded) in expected.items():
    assert (sets[code]["masterCards"],sets[code]["imagesDownloadedAndDecoded"])==(count,decoded)
def held_reason(code,r):
    n=r["index"]
    if code=="sm6" and 105<=n<=108:return "broken Korean card image: HTTP 404"
    if code=="sm6a" and 60<=n<=68:return "basic energy has unconfirmed distinct printed footer number"
    if not r["imageDecoded"]:return "missing image source"
    prefix,base,_,_=expected[code]
    wanted=prefix+"_"+str(n).zfill(3)+"/"+str(base).zfill(3)
    if str(r["code"]).lower()!=wanted:return "unexpected master card identity (do not change ownership ID)"
    return None

todo=[]
holds=[]
for code,block in sets.items():
    for row in block["sourceRows"]:
        reason=held_reason(code,row)
        if reason:holds.append({"set":code,"index":row["index"],"code":row["code"],"reason":reason})
        else:todo.append((code,row))
assert len(todo)+len(holds)==257
assert len(holds)>=13
assert len(todo)<=244 and len(todo)>200

def color_bin(rgb):
    r,g,b=(x/255 for x in rgb)
    h,s,v=colorsys.rgb_to_hsv(r,g,b)
    if s<.17:
        if v<.28:return "검정"
        if v>.85:return "흰색"
        return "회색"
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

def inspect(item):
    code,row=item
    assert row["imageDecoded"] and len(row["sha256"])==64
    res=requests.get(row["image"],timeout=25,headers={
        "User-Agent":"Mozilla/5.0 (KoreanPokemonCardArtAudit/1.0)",
        "Accept":"image/avif,image/webp,image/png,image/jpeg,*/*"})
    res.raise_for_status()
    if len(res.content)>8_000_000:raise ValueError("Too large")
    digest=hashlib.sha256(res.content).hexdigest()
    if digest!=row["sha256"]:
        raise ValueError("Canonical source image changed; decline incorrect categorization "+code+" "+str(row["index"]))
    im=Image.open(io.BytesIO(res.content)).convert("RGB")
    w,h=im.size
    art=im.crop((int(w*.09),int(h*.135),int(w*.91),int(h*.40)))
    art.thumbnail((66,34))
    bins=Counter(color_bin(p) for p in art.getdata())
    common=bins.most_common()
    main=common[0][0]
    second=next((c for c,n in common[1:] if c!=main),main)
    if main==second:second="회색" if main!="회색" else "흰색"
    return {
        "set":code,"number":row["index"],"code":row["code"],"KoreanName":row["name"],
        "originalSha256":digest,"pixelArtColorTag":main+"·"+second,
        "artPixelBins":dict(common),"printedFooterEnlargedByTool":False
    }

with ThreadPoolExecutor(max_workers=12) as pool:
    rows=list(pool.map(inspect,todo))
assert len(rows)==len(todo)
OUTPUT.write_text(json.dumps({
    "schemaVersion":1,"recordedAt":"2026-10-20",
    "sourceEvidence":str(INPUT),"screenedCanonicalSourceCount":len(rows),
    "heldWithoutPalette":len(holds),"held":holds,
    "method":"Top two dominant HSV color bins in original card-art crop after strict image SHA256 recheck",
    "methodCaveat":"Color pixels only; scenery manually screened in separate 18 contact-sheet decisions; footer number requires distinct later verification.",
    "previousThemeRowsModified":0,"originalKoreanImagesChanged":0,
    "pixelEvidenceRows":rows
},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("NEXT_SM_THREE_SETS_PALETTE",json.dumps({
    "screens":len(rows),"held":holds,"bySet":{c:sum(x["set"]==c for x in rows) for c in expected}
},ensure_ascii=False))
