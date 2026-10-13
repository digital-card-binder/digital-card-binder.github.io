#!/usr/bin/env python3
"""Check Korean printed numbers by enlarging ONLY Digital Card Binder-owned CDN archives."""
from pathlib import Path
from urllib.request import Request,urlopen
from io import BytesIO
from PIL import Image,ImageDraw,ImageEnhance
import base64,json
root=Path(__file__).resolve().parents[1]
def read(p):return json.loads((root/p).read_text(encoding="utf8"))
pairs=[("SGI",6),("SGI",23),("SGG",2),("SGG",20),("SJ",16),("SJ",29),("SJ",17),("SJ",30)]
sheet=Image.new("RGB",(3600,1120),(239,239,239));d=ImageDraw.Draw(sheet)
for i,(code,n) in enumerate(pairs):
 index=read(f"data/audits/theme-visual-evidence/{code}/visual-index.json")
 c=index["cards"][n-1];u=c["cdnUrl"]
 assert u.startswith(("https://dcb-card-images-legacy-2026.pages.dev/","https://dcb-card-images-modern-2026.pages.dev/")),u
 with urlopen(Request(u,headers={"User-Agent":"DCB-OwnArchive-PrintNumberEvidence/1.0"}),timeout=25) as f:
  data=f.read(3000000)
 img=Image.open(BytesIO(data));img.load()
 w,h=img.size
 # Preserve raw image geometry and crop bottom area containing physical print number and card rarity.
 bottom=img.crop((0,int(h*.72),w,h)).convert("RGB")
 bottom=ImageEnhance.Contrast(bottom).enhance(1.3)
 bottom.thumbnail((860,470),Image.Resampling.LANCZOS)
 enlarged=bottom.resize((min(860,bottom.width*2),min(470,bottom.height*2)),Image.Resampling.LANCZOS)
 x=(i%4)*900;y=(i//4)*560
 sheet.paste(enlarged,(x+12,y+30))
 d.text((x+10,y+6),f"{code} canonical {n:03} | {c['masterCode']} | own-CDN {w}x{h}",fill=(0,0,0))
 d.rectangle((x+3,y+3,x+893,y+554),outline=(120,120,120),width=3)
out=BytesIO();sheet.save(out,format="WEBP",quality=94,method=4)
dest=root/"data/audits/theme-visual-evidence/printed-number-comparisons-20261014.webp.b64"
dest.write_text(base64.b64encode(out.getvalue()).decode("ascii"),encoding="ascii")
print(json.dumps({"checked":[f"{code}_{n:03}" for code,n in pairs],"ownCDNOnly":True,"proofFile":str(dest),"encodedBytes":len(out.getvalue())}))
