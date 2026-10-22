#!/usr/bin/env python3
"""One-pass real HTTP source and visual-contact audit of all 1,320 pending Korean SM cards."""
from concurrent.futures import ThreadPoolExecutor
from collections import Counter, defaultdict
from pathlib import Path
import io, json, hashlib, colorsys, requests
from PIL import Image,ImageDraw,ImageOps
DIR=Path("data/audits")
QUEUE=DIR/"theme-sm-remaining19-master-preflight-20261022.json"
OUT=DIR/"theme-sm-remaining19-source-evidence-20261022.json"
SHEETS=DIR/"theme-sm-remaining19-contact-sheets-20261022"
q=json.loads(QUEUE.read_text())
assert q["totalSets"]==19 and q["totalCanonicalSlots"]==1320 and q["priorThemeSlotsPreserved"]==21299
assert not OUT.exists()
cards=q["cardQueue"]
assert len(cards)==1320
def color(rgb):
 h,s,v=colorsys.rgb_to_hsv(*(ch/255 for ch in rgb))
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
def read_one(c):
 out=dict(c)
 out.update(httpStatus=None,decoded=False,actualSha256=None,
   imageWidth=None,imageHeight=None,imageFormat=None,duplicateArtworkSource=False,
   imageSourceError=None,observedArtColor=None,printedFooterVerified=False)
 try:
  url=out["originalImageReference"]
  if not url.startswith("https://"):raise ValueError("not an HTTPS image source")
  response=requests.get(url,timeout=(7,16),headers={"User-Agent":"Mozilla/5.0 (Korean Card Artwork Audit/1.0)",
         "Accept":"image/avif,image/webp,image/png,image/jpeg,*/*"},allow_redirects=True)
  out["httpStatus"]=response.status_code;response.raise_for_status()
  if len(response.content)>8_000_000:raise ValueError("over 8MB")
  pic=Image.open(io.BytesIO(response.content));pic.load()
  out.update(decoded=True,actualSha256=hashlib.sha256(response.content).hexdigest(),
    imageWidth=pic.width,imageHeight=pic.height,imageFormat=pic.format)
  if pic.width<180 or pic.height<260:out["imageSourceError"]="image too small for footer identity inspection"
  if out["imageHost"]=="cards.image.pokemonkorea.co.kr" and not out["imageSourceError"]:
   rgb=pic.convert("RGB")
   w,h=rgb.size;rgb=rgb.crop((int(w*.09),int(h*.135),int(w*.91),int(h*.4)))
   rgb.thumbnail((66,34))
   counts=Counter(color(px) for px in rgb.getdata()).most_common()
   a=counts[0][0];b=next((v for v,_ in counts[1:] if v!=a),'회색' if a!='회색' else '흰색')
   out["observedArtColor"]=a+"·"+b
  return out,pic.convert("RGB")
 except Exception as e:
  out["imageSourceError"]=str(e)[:280]
  return out,None
with ThreadPoolExecutor(max_workers=28) as executor:
 results=list(executor.map(read_one,cards))
records=[x for x,_ in results]
picture={(x["set"].lower(),x["index"]):pic for x,pic in results if pic is not None}
hashes=defaultdict(list)
for r in records:
 if r["decoded"]:hashes[r["actualSha256"]].append(r)
duplicates=[]
for sha,g in hashes.items():
 if len(g)>1:
  duplicates.append({"sha256":sha,"slots":[{"set":v["set"],"index":v["index"],"code":v["canonicalCode"]} for v in g]})
  for r in g:r["duplicateArtworkSource"]=True
SHEETS.mkdir(parents=True,exist_ok=True)
sheets=[]
for summary in q["summaries"]:
 code=summary["set"];rows=[r for r in records if r["set"]==code]
 for page,start in enumerate(range(0,len(rows),20),1):
  segment=rows[start:start+20]
  W,H,COLS=206,300,5
  panel=Image.new("RGB",(W*COLS,H*4),"white");draw=ImageDraw.Draw(panel)
  for off,row in enumerate(segment):
   x=(off%5)*W;y=(off//5)*H
   draw.text((x+5,y+4),f'{code.upper()} #{row["index"]:03d}',fill="black")
   pic=picture.get((code.lower(),row["index"]))
   if pic:
    thumb=ImageOps.contain(pic,(W-8,H-25))
    panel.paste(thumb,(x+(W-thumb.width)//2,y+23))
   else:draw.text((x+8,y+40),"UNAVAILABLE",fill="red")
  path=SHEETS/f'{code.lower().replace("+","plus")}-sheet-{page:02d}.jpg'
  panel.save(path,"JPEG",quality=64,optimize=True)
  sheets.append({"set":code,"page":page,"filename":path.name,"indexStart":start+1,
     "indexEnd":start+len(segment)})
 print("SOURCE_SET",json.dumps({"set":code,"total":len(rows),"decoded":sum(r["decoded"] for r in rows),
  "officialGood":sum(r["observedArtColor"] is not None and not r["duplicateArtworkSource"] for r in rows),
  "outside":sum(r["referenceKind"]!="pokemonkorea_card_image_url" for r in rows),
  "badOrFailed":sum(bool(r["imageSourceError"]) for r in rows),
  "duplicate":sum(bool(r["duplicateArtworkSource"]) for r in rows)},ensure_ascii=False),flush=True)
report={"schemaVersion":1,"recordedAt":"2026-10-22","canonicalSlots":1320,
 "totalSets":19,"sourceRequestsAttempted":len(records),"decodedImages":sum(r["decoded"] for r in records),
 "unavailableImages":sum(not r["decoded"] for r in records),
 "duplicates":duplicates,"visualReviewNotYetDone":True,
 "paletteIsMachineDerivedNotHumanApproved":True,"printedKoreanFooterVerifiedCount":0,
 "newThemeRowsWritten":0,"priorThemeRowsPreserved":21299,
 "contactSheets":sheets,"cards":records}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("SM19_SOURCE_SUMMARY",json.dumps({"sets":19,"cards":len(records),
 "decoded":report["decodedImages"],"sheets":len(sheets),
 "officialColorEligibleBeforeManualReview":sum(r["observedArtColor"] is not None and not r["duplicateArtworkSource"] for r in records),
 "duplicateHashGroups":len(duplicates)},ensure_ascii=False),flush=True)
