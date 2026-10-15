#!/usr/bin/env python3
"""Archive only sourced Korean S6a high-rarity seller photos for visual review.
No catalog/status changes. Never infer Korean printing from a listing title.
"""
from PIL import Image, ImageDraw, ImageOps
from urllib.request import Request,urlopen
from io import BytesIO
from pathlib import Path
import json,hashlib,base64
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-visual-evidence/s6a/korean-candidates"
assets=root/"assets/cards/s6a-korean-rare"
out.mkdir(parents=True,exist_ok=True);assets.mkdir(parents=True,exist_ok=True)
rows=[
 (88,"리피아 VMAX","https://www.ebay.com/itm/306964628184","IPgAAeSwWz1qFjoI"),
 (92,"님피아 VMAX","https://www.ebay.com/itm/277800194451","xH0AAeSw0v1ptBWB"),
 (96,"마쿠와","https://www.ebay.com/itm/406846014955","4fQAAeSwRZlp2Fsr"),
 (97,"아로마 아가씨","https://www.ebay.com/itm/304629782209","XhkAAOSwxqZjIuTP"),
 (99,"부쩍부쩍 셰이크","https://www.ebay.com/itm/388464824181","MMIAAeSwOxJoMka1"),
 (100,"터프스타디움","https://www.ebay.com/itm/800239509169","saAAAOSwPg9oDAO~"),
 (101,"기본 악 에너지","https://www.ebay.com/itm/146857669052","JyAAAOSw0n5k~~x-"),
]
results=[]
canvas=Image.new("RGB",(4*320,2*525),(246,246,246))
draw=ImageDraw.Draw(canvas)
for i,(number,name,product,imgid) in enumerate(rows):
  attempts=[];success=None
  for size in ["s-l1600.jpg","s-l1200.jpg","s-l800.webp","s-l500.jpg"]:
    url=f"https://i.ebayimg.com/images/g/{imgid}/{size}"
    try:
      with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0","Accept":"image/*"}),timeout=18) as res:
        data=res.read(6000001)
      if len(data)>6000000:raise ValueError("source too large")
      im=Image.open(BytesIO(data)).convert("RGB")
      attempts.append({"url":url,"status":"decoded","size":list(im.size)})
      if max(im.size)>=350:success=(data,im,url)
      if success:break
    except Exception as e:attempts.append({"url":url,"error":str(e)[:160]})
  r={"number":number,"name":name,"code":f"s6a_{number:03d}/069",
     "productPage":product,"sourceAttempts":attempts,"status":"candidate_unverified"}
  x=(i%4)*320;y=(i//4)*525
  draw.text((x+7,y+8),f"S6a {number:03d} source (unverified)",fill=(12,12,12))
  if success:
    blob,im,url=success
    preview=im.copy();preview.thumbnail((305,465))
    canvas.paste(preview,(x+(320-preview.width)//2,y+35))
    path=assets/f"{number:03d}-seller-source.webp"
    ImageOps.exif_transpose(im).save(path,"WEBP",quality=90,method=6)
    r.update(source=url,sha256=hashlib.sha256(blob).hexdigest(),
       sourceSize=list(im.size),ownedSource=str(path.relative_to(root)),
       status="photo_archived_pending_card_border_and_Korean_print_review")
  results.append(r)
buf=BytesIO();canvas.save(buf,"WEBP",quality=85)
(out/"candidate-contact.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode())
(out/"sources.json").write_text(json.dumps({"set":"s6a","expected":7,
  "sourceCount":sum("ownedSource" in x for x in results),
  "cards":results,"status":"candidate_collection_only"},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"fetched":[r["number"] for r in results if "ownedSource" in r],
 "missing":[r["number"] for r in results if "ownedSource" not in r]},ensure_ascii=False))
