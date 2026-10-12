#!/usr/bin/env python3
"""Evidence-only inspection for six old SVLS canonical holds, using stored CDN."""
import base64,io,json,urllib.request
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
series=json.loads((root/"data/series.json").read_text(encoding="utf8"))
s=next(x for x in series if x["code"].upper()=="SVLS")
assert len(s["cards"])==25
numbers=[17,18,19,23,24,25] # existing art holds, no new Korean print inferred
def fnv64(x):
 h=0xcbf29ce484222325
 for letter in x:
  h^=ord(letter)
  h=(h*0x100000001b3)&((1<<64)-1)
 return format(h,"016x")
cards=[]
canvas=Image.new("RGB",(1050,1000),(242,242,242))
draw=ImageDraw.Draw(canvas)
for idx,n in enumerate(numbers):
 c=s["cards"][n-1];url=str(c.get("sourceImage") or c.get("image") or "")
 assert url.startswith("https://static.tcgexchange.kr/") and url.endswith(".png"),(n,url)
 canonical=url.split("?")[0]
 remote="https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/"+fnv64(canonical)+".webp"
 req=urllib.request.Request(remote,headers={"User-Agent":"Digital-Card-Binder-KR-theme-evidence/1.0"})
 with urllib.request.urlopen(req,timeout=18) as resp:
  data=resp.read(3000000)
 original=Image.open(io.BytesIO(data));original.load();dims=list(original.size)
 picture=original.convert("RGB");picture.thumbnail((320,425))
 x=(idx%3)*350;y=(idx//3)*500
 canvas.paste(picture,(x+(350-picture.width)//2,y+4))
 draw.text((x+12,y+437),str(n)+" "+str(c.get("code","")),fill=(20,20,20))
 draw.text((x+12,y+458),"Korean original image decoded",fill=(20,20,20))
 cards.append({"canonicalOrder":n,"canonicalMasterCode":c["code"],"koreanName":c["name"],"cdnUrl":remote,
 "imageSource":canonical,"dimensions":dims,"decoded":True,"printedNumber":str(c["code"]).split("_")[1] if n<=22 else "",
 "printNumberNeedsCheck":n>22,"sourceRegion":"KR","rehostedNewImage":False})
out=root/"data/audits/theme-visual-evidence"
out.mkdir(parents=True,exist_ok=True)
b=io.BytesIO();canvas.save(b,format="WEBP",quality=82)
(out/"SVLS-held.webp.b64").write_text(base64.b64encode(b.getvalue()).decode(),encoding="ascii")
(out/"SVLS-held.json").write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-13","set":"SVLS","masterCanonicalCount":25,"heldNumbers":numbers,"cardCount":len(cards),"newSelfHostedImages":0,"status":"existing_selfhost_binary_decoded","cards":cards},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("Verified",len(cards),"existing user-owned Korean-print card images")
