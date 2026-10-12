#!/usr/bin/env python3
"""Verify every Korean Super Electric Breaker printed title on the self-hosted scan from already-self-hosted SV8 card scans; evidence only."""
from pathlib import Path
from PIL import Image,ImageDraw
from concurrent.futures import ThreadPoolExecutor,as_completed
from urllib.request import Request,urlopen
from io import BytesIO
import json,base64
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-visual-evidence/sv8"
index=json.loads((out/"visual-index.json").read_text())
def download(c):
 n=c["canonicalOrder"]
 url=c["cdnUrl"]
 assert url.startswith("https://dcb-card-images-modern-2026.pages.dev/")
 with urlopen(Request(url,headers={"User-Agent":"DigitalCardBinder-KoreanTitle-Audit/1.0"}),timeout=20) as resp:data=resp.read(3000000)
 im=Image.open(BytesIO(data));im.load()
 image=im.convert("RGB")
 return n,image.crop((0,0,min(420,image.width),min(135,image.height)))
images={}
with ThreadPoolExecutor(max_workers=12) as pool:
 for f in as_completed([pool.submit(download,c) for c in index["cards"]]):
  n,im=f.result();images[n]=im
assert len(images)==138
for start in range(1,139,16):
 sheet=Image.new("RGB",(4*450,4*190),(245,245,245))
 d=ImageDraw.Draw(sheet)
 for slot,n in enumerate(range(start,min(start+16,139))):
  x=(slot%4)*450;y=(slot//4)*190
  d.text((x+4,y+3),str(n).zfill(3),fill=(0,0,0))
  sheet.paste(images[n],(x+10,y+26))
 b=BytesIO();sheet.save(b,format="WEBP",quality=90)
 name=f"sv8-title-{(start-1)//16+1:02d}.webp.b64"
 (out/name).write_text(base64.b64encode(b.getvalue()).decode(),encoding="ascii")
print("Saved six title proof sheets using only first-party card image archive.")
