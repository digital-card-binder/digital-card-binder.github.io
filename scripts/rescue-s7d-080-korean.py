#!/usr/bin/env python3
"""Prepare S7D 080 Korean-print photo evidence; no catalog mutation."""
import hashlib,json,base64
from pathlib import Path
from io import BytesIO
from urllib.request import Request,urlopen
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s7d/korean-rescued-sources"
ASSETS=ROOT/"assets/cards/s7d-korean-rare"
OUT.mkdir(parents=True,exist_ok=True);ASSETS.mkdir(parents=True,exist_ok=True)
BASE="https://media.bunjang.co.kr/product/431740834_1_1789395515"
URLS=[BASE+"_w1200.jpg",BASE+"_w750.jpg",BASE+".jpg",BASE+"_w360.jpg"]
attempts=[];valid=[]
for url in URLS:
 try:
  with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=12) as f:
   b=f.read(6000001)
  if len(b)>6000000:raise ValueError("file too large")
  pic=Image.open(BytesIO(b)).convert("RGB")
  if pic.width<300 or pic.height<300:raise ValueError("undersized")
  valid.append((pic,b,url))
  attempts.append({"url":url,"status":"loaded","dimensions":[pic.width,pic.height]})
 except Exception as e: attempts.append({"url":url,"status":"unavailable","error":str(e)[:150]})
if not valid:raise RuntimeError("No verified source images available")
img,raw,source=max(valid,key=lambda v:v[0].width*v[0].height)
w,h=img.size
# Source 360x360 product photo has a sleeved card bounded by x~55-299 and y~0-339.
box=(round(w*55/360),0,round(w*301/360),round(h*342/360))
card=img.crop(box).resize((420,586),Image.Resampling.LANCZOS)
candidate=ASSETS/"080-korean-candidate.webp"
card.save(candidate,"WEBP",quality=94,method=6)
c=Image.new("RGB",(900,650),(244,244,244))
large=img.copy();large.thumbnail((420,600));c.paste(large,(15,30))
c.paste(card,(470,30))
d=ImageDraw.Draw(c)
d.text((15,8),"Source photograph - Korean S7D 080",fill=(0,0,0))
d.text((470,8),"Rectified card crop - pending check",fill=(0,0,0))
b=BytesIO();c.save(b,"WEBP",quality=84)
(OUT/"080-contact.webp.b64").write_text(base64.b64encode(b.getvalue()).decode())
result={"set":"s7D","number":80,"name":"루가루암 VMAX","code":"s7d_080/067",
 "sourceProductPage":"https://m.bunjang.co.kr/products/431740834",
 "sourceImage":source,"sourceSha256":hashlib.sha256(raw).hexdigest(),
 "cropBox":list(box),"sourceDimensions":[w,h],"ownedCandidate":str(candidate.relative_to(ROOT)),
 "candidateDimensions":[420,586],"status":"pending_direct_visual_verification",
 "note":"Korean print photo sourced from a seller listing and archived to own repo. Not yet connected to catalog.",
 "attempts":attempts}
(OUT/"080-source.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(result,ensure_ascii=False))
