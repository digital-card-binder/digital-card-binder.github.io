#!/usr/bin/env python3
"""Own-CDN-only photographic print-number pixel audit: Korean SV-P 204-211 energy.
Read-only; no third-party image sources and no source/master/theme changes."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlsplit
from io import BytesIO
from PIL import Image,ImageDraw,ImageFont
import json,base64
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-svp-energy-print-identity-20261013"
out.mkdir(parents=True,exist_ok=True)
report=json.loads((root/"data/audits/theme-nine-sets-owned-image-20261013/SV-P/visual-index.json").read_text(encoding="utf-8"))
cards=[c for c in report["cards"] if c["masterCode"].split("_")[1].split("/")[0] in {str(n) for n in range(204,212)}]
assert len(cards)==8
full=Image.new("RGB",(4*450,2*660),(248,248,248))
bottom=Image.new("RGB",(2*1040,4*340),(248,248,248))
d=ImageDraw.Draw(full);b=ImageDraw.Draw(bottom)
proof=[]
for i,c in enumerate(cards):
 host=urlsplit(c["ownedCdnUrl"]).hostname
 assert host in ("dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev")
 with urlopen(Request(c["ownedCdnUrl"],headers={"User-Agent":"DCB-Korean-Energy-PrintID-Audit/1.0"}),timeout=15) as resp:
  payload=resp.read(2500000);status=resp.status
 im=Image.open(BytesIO(payload));im.load()
 assert im.width>=390 and im.height>=550,(im.width,im.height)
 im=im.convert("RGB")
 x=(i%4)*450;y=(i//4)*660
 full.paste(im,(x+15,y+35))
 d.text((x+15,y+12),str(c["masterCode"])+"  "+str(c["koreanMasterName"]),fill=(0,0,0))
 # enlarge exact lower print/number region, not whole image, and preserve image authenticity.
 crop=im.crop((0,im.height-160,im.width,im.height))
 enlarged=crop.resize((1008,320),Image.Resampling.LANCZOS)
 x=(i%2)*1040;y=(i//2)*340
 bottom.paste(enlarged,(x+16,y+16))
 b.text((x+18,y+2),str(c["masterCode"]),fill=(0,0,0))
 proof.append({"masterCode":c["masterCode"],"name":c["koreanMasterName"],
  "ownedCDN":c["ownedCdnUrl"],"http":status,"pixelSize":list(im.size),
  "sourceImageDownloaded":False,"printedNumberStatus":"visual_check_required"})
for name,im in [("full-korean-energy-art.webp.b64",full),("korean-energy-number-crops.webp.b64",bottom)]:
 mem=BytesIO();im.save(mem,format="WEBP",quality=93)
 (out/name).write_text(base64.b64encode(mem.getvalue()).decode("ascii"),encoding="ascii")
(out/"index.json").write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-13","set":"SV-P","cards":proof,
 "binaryDecoded":len(proof),"thirdPartyRequests":0,
 "printIdentityNotAutomaticallyEstablished":True,
 "pixelProofFiles":["full-korean-energy-art.webp.b64","korean-energy-number-crops.webp.b64"],
 "note":"Printed/card number identity must be inspected manually and confirmed; do not automatically clear eight printed identity holds."},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"cards":len(proof),"cdnBinaries":len(proof),"thirdPartyRequests":0}))
