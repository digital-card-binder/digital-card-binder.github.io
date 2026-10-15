#!/usr/bin/env python3
"""Capture 081 and 082 Korean-print listing photographs as candidates; do not modify catalog."""
from pathlib import Path
from io import BytesIO
from urllib.request import Request,urlopen
from PIL import Image,ImageDraw,ImageOps
import json,base64,hashlib
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/"assets/cards/s7d-korean-rare"
OUT=ROOT/"data/audits/theme-visual-evidence/s7d/korean-rescued-sources"
ASSETS.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
SOURCES={
 81:{"name":"더스트나 VMAX","product":"https://www.ebay.com/itm/205864026381","imageBase":"https://i.ebayimg.com/images/g/BzgAAeSwjlJpIH2e","crop":(.07,.045,.85,.965)},
 82:{"name":"두랄루돈 VMAX","product":"https://www.ebay.com/itm/124909648557","imageBase":"https://i.ebayimg.com/images/g/9Q0AAOSwjUBhR2yV","crop":(.09,.07,.83,.94)}
}
results=[];c=Image.new("RGB",(950,2*610),(245,245,245));d=ImageDraw.Draw(c)
for idx,(n,v) in enumerate(SOURCES.items()):
 candidates=[];probes=[]
 for filename in ("s-l1600.jpg","s-l1200.jpg","s-l800.webp","s-l500.jpg","s-l140.webp"):
  url=v["imageBase"]+"/"+filename
  try:
   with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; card-audit/1.0)"}),timeout=18) as resp:
    raw=resp.read(6000001)
   if len(raw)>6000000:raise ValueError("file too large")
   pic=Image.open(BytesIO(raw)).convert("RGB")
   probes.append({"url":url,"dimensions":[pic.width,pic.height],"status":"decoded"})
   if min(pic.size)>=130:candidates.append((pic,raw,url))
  except Exception as e:probes.append({"url":url,"error":str(e)[:160]})
 if not candidates:
  results.append({"number":n,"name":v["name"],"status":"source_unavailable","probes":probes})
  continue
 im,raw,url=max(candidates,key=lambda x:x[0].width*x[0].height)
 w,h=im.size
 x1,y1,x2,y2=v["crop"];box=(round(w*x1),round(h*y1),round(w*x2),round(h*y2))
 crop=im.crop(box).resize((420,586),Image.Resampling.LANCZOS)
 path=ASSETS/f"{n:03d}-korean-candidate.webp"
 crop.save(path,"WEBP",quality=94,method=6)
 top=idx*610
 rawPreview=im.copy();rawPreview.thumbnail((420,555))
 c.paste(rawPreview,(10,top+25))
 c.paste(crop,(490,top+24))
 d.text((10,top+3),f"#{n:03d} eBay original Korean listing",fill=(12,12,12))
 d.text((490,top+3),f"#{n:03d} crop for visual print review",fill=(12,12,12))
 results.append({"number":n,"name":v["name"],"code":f"s7d_{n:03d}/067",
 "sourceProductPage":v["product"],"sourceImage":url,
 "sourceSha256":hashlib.sha256(raw).hexdigest(),"ownedCandidate":str(path.relative_to(ROOT)),
 "dimensions":[w,h],"cropBox":list(box),"status":"pending_visual_Korean_card_validation",
 "probes":probes})
b=BytesIO();c.save(b,"WEBP",quality=88)
(OUT/"081-082-contact.webp.b64").write_text(base64.b64encode(b.getvalue()).decode())
(OUT/"081-082-sources.json").write_text(json.dumps({"set":"s7D","cards":results},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"cards":[{"number":x["number"],"status":x["status"],"source":x.get("sourceImage"),"size":x.get("dimensions")}for x in results]},ensure_ascii=False))
