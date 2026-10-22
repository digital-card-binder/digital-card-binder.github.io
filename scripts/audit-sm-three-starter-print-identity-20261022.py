#!/usr/bin/env python3
"""SM starter/deck three-set visual Korean printing identity review evidence.
Contact sheets show ORIGINAL card + magnified card footer, but no automatic
identity approvals are made from just image URL or SHA256.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import io, json, hashlib, requests
from PIL import Image, ImageDraw, ImageOps, ImageFont

ROOT=Path("data/audits")
SRC=ROOT/"theme-sm19-797-print-source-recheck-20261022.json"
OUT=ROOT/"theme-sm-3starter-original-print-art-review-20261022.json"
P=ROOT/"theme-sm-3starter-footer-evidence-20261022"
P.mkdir(parents=True,exist_ok=True)
assert not OUT.exists()
s=json.loads(SRC.read_text(encoding="utf-8"))
SETS=("sm60a","sm60b","sme")
cards=[r for r in s["cards"] if r["set"].lower() in SETS]
expected={"sm60a":27,"sm60b":23,"sme":22}
assert len(cards)==72
assert Counter(r["set"].lower() for r in cards)==Counter(expected)
assert len({(r["set"].lower(),r["index"]) for r in cards})==72

def get(r):
    answer={"set":r["set"],"index":r["index"],"canonicalCode":r["canonicalCode"],
      "koreanName":r["name"],"imageSource":r["originalImageReference"],
      "priorSha256":r["liveSha256"],"status":None,"decoded":False,"imageSha256":None,
      "sameBytesAsPreviouslyChecked":False,"dimensions":None,
      "sourceLooksKoreanPrinted":None,"printedCardNumberReadable":None,
      "printIdentityVerdict":"pending_manual_full_image_and_footer_review",
      "reason":None}
    try:
      resp=requests.get(r["originalImageReference"],timeout=(8,20),
        headers={"User-Agent":"Mozilla/5.0 (DigitalCardBinder Print Verification/1.0)",
        "Accept":"image/avif,image/png,image/jpeg,image/webp,*/*"})
      answer["status"]=resp.status_code
      resp.raise_for_status()
      if len(resp.content)>9_000_000:raise ValueError("Oversized source")
      im=Image.open(io.BytesIO(resp.content));im.load()
      answer["decoded"]=True
      answer["imageSha256"]=hashlib.sha256(resp.content).hexdigest()
      answer["sameBytesAsPreviouslyChecked"]=answer["imageSha256"]==answer["priorSha256"]
      answer["dimensions"]=[im.width,im.height]
      if im.width<180 or im.height<240:answer["reason"]="Resolution too low for image footer"
      return answer,im.convert("RGB")
    except Exception as e:
      answer["reason"]=str(e)[:170]
      return answer,None
with ThreadPoolExecutor(max_workers=14) as pool:
    checked=list(pool.map(get,cards))
allr=[x for x,im in checked]
pictures={(x["set"].lower(),x["index"]):im for x,im in checked}
sheets=[]
for scode in SETS:
  subset=[x for x in allr if x["set"].lower()==scode]
  for start in range(0,len(subset),6):
    page=subset[start:start+6]
    WIDTH,HEIGHT=620,550
    collage=Image.new("RGB",(WIDTH*3,HEIGHT*2),"white")
    draw=ImageDraw.Draw(collage)
    for i,x in enumerate(page):
      left=(i%3)*WIDTH;top=(i//3)*HEIGHT
      draw.text((left+7,top+7),f'{x["canonicalCode"]} #{x["index"]:03d}',fill="black")
      draw.text((left+7,top+26),str(x["koreanName"])[:34],fill="black")
      im=pictures.get((x["set"].lower(),x["index"]))
      if im is None:
        draw.text((left+8,top+90),"IMAGE UNAVAILABLE",fill="#cc0000")
        continue
      thumb=ImageOps.contain(im,(305,467))
      collage.paste(thumb,(left+6,top+53))
      w,h=im.size
      footer=im.crop((0,int(h*.79),w,h))
      footer=ImageOps.contain(footer,(302,220))
      footer=footer.resize((min(302,footer.width),min(290,footer.height)),Image.Resampling.LANCZOS)
      collage.paste(footer,(left+315,top+55))
      draw.text((left+319,top+300),f'SHA256 matched: {x["sameBytesAsPreviouslyChecked"]}',fill="black")
      draw.text((left+319,top+319),f'Source: {x["imageSource"].split("/")[2]}',fill="black")
      draw.rectangle((left+314,top+54,left+617,top+296),outline="#999999",width=2)
    name=f'{scode}-source-print-review-{start//6+1:02d}.jpg'
    collage.save(P/name,"JPEG",quality=83,optimize=True)
    sheets.append({"set":scode,"sheet":name,"startIndex":start+1,"count":len(page)})
summary={"schemaVersion":1,"recordedAt":"2026-10-22","reviewScope":"Three previously source-checked Korean SM starter sets",
 "sets":[{"set":code,"total":expected[code],"decoded":sum(r["decoded"] for r in allr if r["set"].lower()==code),
 "sameHash":sum(r["sameBytesAsPreviouslyChecked"] for r in allr if r["set"].lower()==code)} for code in SETS],
 "canonicalSlotsChecked":72,"totalDecoded":sum(x["decoded"] for x in allr),
 "sameBytesAsPreviouslyChecked":sum(x["sameBytesAsPreviouslyChecked"] for x in allr),
 "imageContactSheets":sheets,"printedKoreanFooterIdentityConfirmedCount":0,
 "note":"Candidate visuals and footer crops produced for direct inspection. Source image hashes do not themselves authenticate printed Korean card numbers. Do not alter master images or mark strict series complete on this automated pass.",
 "cards":allr}
OUT.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SM_THREE_STARTER_ORIGINAL_FOOTER_AUDIT",json.dumps({k:summary[k] for k in ["sets","canonicalSlotsChecked","totalDecoded","sameBytesAsPreviouslyChecked","printedKoreanFooterIdentityConfirmedCount"]},ensure_ascii=False),flush=True)
