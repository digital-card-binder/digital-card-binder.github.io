#!/usr/bin/env python3
"""Korean official S5a 061-070 preflight only; preserve 071-096 rare holds."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request,urlopen
from io import BytesIO
from PIL import Image,ImageDraw
import json,base64,hashlib

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s5a/061-070"
OUT.mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads((ROOT/p).read_text(encoding="utf8"))
modern=read("data/series.json")
legacy=read("data/series-legacy.json")
status=read("data/audits/theme-series-review-status.json")
hosting=read("data/audits/theme-image-selfhost-audit.json")
assert status["execution"]["nextStart"]==hosting["nextStart"]=="s6K Korean print source pending: 089,090,092,094"
matches=[s for s in modern+legacy if str(s.get("code","")).lower()=="s5a"]
assert len(matches)==1 and len(matches[0]["cards"])==96
rows=[]
for n in range(61,71):
 c=matches[0]["cards"][n-1]
 num=f"{n:03d}"
 assert c["code"].lower()==f"s5a_{num}/070" and c.get("name")
 raw=str(c.get("sourceImage") or c.get("image") or "")
 assert raw.startswith(f"https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5a/S5a_{num}.")
 url=f"https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S5a/S5a_{num}.webp"
 rows.append({"canonicalOrder":n,"code":c["code"],"name":c["name"],"printedNumber":f"{num}/070",
 "rawSource":raw,"ownedUrl":url,"koreanPrintManualReview":False})
def fetch(c):
 d={"status":"unavailable","url":c["ownedUrl"]}
 thumb=None
 try:
  with urlopen(Request(c["ownedUrl"],headers={"User-Agent":"DigitalCardBinder-Korean-S5a-Audit/1.0"}),timeout=28) as resp:
   buf=resp.read(3000001)
   d["http"]=resp.status
  assert 1500<len(buf)<3000000
  photo=Image.open(BytesIO(buf));photo.load()
  assert 300<=photo.width<=3000 and 420<=photo.height<=4000
  d.update(status="decoded",dimensions=[photo.width,photo.height],format=photo.format,
           sha256=hashlib.sha256(buf).hexdigest(),byteCount=len(buf))
  thumb=photo.convert("RGB")
  thumb.thumbnail((220,310))
 except Exception as ex:
  d["error"]=str(ex)[:200]
 return c["canonicalOrder"],d,thumb
with ThreadPoolExecutor(max_workers=8) as pool:
 found={n:(proof,pic) for n,proof,pic in pool.map(fetch,rows)}
canvas=Image.new("RGB",(1220,760),(244,244,244))
draw=ImageDraw.Draw(canvas)
for i,row in enumerate(rows):
 n=row["canonicalOrder"]
 proof,pic=found[n]
 x=(i%5)*244;y=(i//5)*380
 draw.rectangle((x+2,y+2,x+241,y+377),outline=(160,160,160),width=2)
 if pic:canvas.paste(pic,(x+(244-pic.width)//2,y+5))
 else:draw.text((x+8,y+148),"OWN CDN MISSING",fill=(10,10,10))
 draw.text((x+10,y+321),f"{n:03d} "+row["name"][:14],fill=(20,20,20))
 draw.text((x+10,y+348),row["code"]+" "+proof["status"],fill=(20,20,20))
out=BytesIO()
canvas.save(out,"WEBP",quality=80,method=5)
(OUT/"s5a-061-070-01.webp.b64").write_text(base64.b64encode(out.getvalue()).decode("ascii"),encoding="ascii")
cards=[{**c,"imageCheck":found[c["canonicalOrder"]][0]} for c in rows]
ok=sum(c["imageCheck"]["status"]=="decoded" for c in cards)
result={"schemaVersion":1,"recordedAt":"2026-10-16","set":"s5a","name":"쌍벽의 파이터","range":"061-070",
        "canonicalSetCardCount":96,"checkedCardCount":10,"ownedImageDecodedCount":ok,
        "ownedImageUnavailableCount":10-ok,"humanKoreanPrintVerificationCount":0,
        "artworkThemeReviewComplete":False,"setComplete":False,
        "existingS5a061SeasonThemePreserve":True,
        "foreignSourceRareCardsReviewHeldRange":"071-096",
        "globalCheckpointPreserved":"s6K Korean print source pending: 089,090,092,094",
        "contactSheets":["s5a-061-070-01.webp.b64"],"cards":cards}
(OUT/"visual-index.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({k:result[k] for k in ["set","range","checkedCardCount","ownedImageDecodedCount","ownedImageUnavailableCount"]},ensure_ascii=False))
