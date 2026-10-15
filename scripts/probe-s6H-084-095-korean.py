#!/usr/bin/env python3
"""Read-only probe of 12 Korean S6H high-rarity print candidates at a Korean retailer.
Catalogues URLs and decodes images, never marks a printed edition confirmed.
Retain Japanese placeholder holds until Korean title, rarity, and exact footer reviewed.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlsplit
from concurrent.futures import ThreadPoolExecutor,as_completed
from io import BytesIO
from PIL import Image,ImageOps,ImageDraw
import json,base64,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s6H/korean-rare-candidates"
OUT.mkdir(parents=True,exist_ok=True)
NAMES={
84:"백마 버드렉스 VMAX",85:"백마 버드렉스 VMAX",86:"사다이사 VMAX",87:"토네로스 VMAX",
88:"멜론",89:"민지",90:"의사",91:"피오니",92:"동탁군",93:"마중초롱",
94:"우락부락멧",95:"기본 물 에너지"
}
SOURCE="https://tcgbox.co.kr/category/s6h%EB%B0%B1%EC%9D%80%EC%9D%98-%EB%9E%9C%EC%8A%A4/251"
def fetch(n):
    code=f"S6H_{n:03d}"
    u=f"https://tcgbox.co.kr/web/product/big/s6h/{code}.jpg"
    p={"number":n,"code":f"s6h_{n:03d}/070","expectedName":NAMES[n],
       "retailerCategory":SOURCE,"candidateUrl":u,"status":"not_found"}
    try:
        assert urlsplit(u).hostname=="tcgbox.co.kr"
        req=Request(u,headers={"User-Agent":"Mozilla/5.0","Accept":"image/*"})
        with urlopen(req,timeout=15) as r:
            blob=r.read(4000001)
            p["http"]=r.status
            p["contentType"]=r.headers.get("content-type","")
        if len(blob)>4000000:raise RuntimeError("Image too large")
        image=Image.open(BytesIO(blob));image.load()
        if image.width<240 or image.height<330 or image.height<=image.width:raise RuntimeError("Not a portrait card")
        preview=ImageOps.exif_transpose(image).convert("RGB")
        output=BytesIO();preview.save(output,"WEBP",quality=90,method=6)
        file=f"{n:03d}-retailer-photo.webp.b64"
        (OUT/file).write_text(base64.b64encode(output.getvalue()).decode("ascii"),encoding="ascii")
        p.update(status="retrieved_requires_visible_Korean_print_and_number_review",
            dimensions=[image.width,image.height],evidenceFile=file,
            originalSha256=hashlib.sha256(blob).hexdigest(),retailerWatermarkLikely=True)
        return p,preview
    except Exception as err:
        p["error"]=str(err)[:170]
        return p,None
data={}
with ThreadPoolExecutor(max_workers=8) as pool:
    results=[pool.submit(fetch,n) for n in NAMES]
    for future in as_completed(results):
        p,image=future.result();data[p["number"]]=(p,image)
contact=Image.new("RGB",(4*300,3*455),(248,248,248))
draw=ImageDraw.Draw(contact)
for idx,n in enumerate(NAMES):
    p,im=data[n]
    x,y=(idx%4)*300,(idx//4)*455
    draw.text((x+6,y+4),f"S6H {n:03d} {NAMES[n]} - UNVERIFIED",fill=(14,14,14))
    if im:
        im.thumbnail((282,405))
        contact.paste(im,(x+(300-im.width)//2,y+25))
    else:
        draw.text((x+22,y+185),"NO KOREAN IMAGE RETRIEVED",fill=(12,12,12))
buf=BytesIO();contact.save(buf,"WEBP",quality=86)
(OUT/"contact.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode("ascii"),encoding="ascii")
rows=[data[n][0] for n in NAMES]
(OUT/"index.json").write_text(json.dumps({
 "schemaVersion":1,"set":"s6H","range":"084-095","status":"unverified_retailer_candidates_only",
 "changedMasterCardCount":0,"koreanPrintVerifiedCount":0,
 "requireKoreanPrintedFooterBeforeReplacement":True,
 "candidateCount":sum(r["status"].startswith("retrieved") for r in rows),
 "cards":rows},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"collected":[r["number"] for r in rows if r["status"].startswith("retrieved")],
  "missing":[r["number"] for r in rows if not r["status"].startswith("retrieved")]},ensure_ascii=False))
