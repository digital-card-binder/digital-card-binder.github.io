#!/usr/bin/env python3
"""Probe TCGBOX direct Korean physical card photos for s6K 089,090,092,093,094.
Only archive image candidates. Verify printed identifiers manually before master edits.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from PIL import Image,ImageDraw
from io import BytesIO
import base64,json,hashlib
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-visual-evidence/s6K/korean-candidates/direct"
out.mkdir(parents=True,exist_ok=True)
nums=[89,90,92,93,94]
result={"set":"s6K","status":"read_only_image_probe_not_approved","cards":[]}
board=Image.new("RGB",(5*350,565),(242,242,242));draw=ImageDraw.Draw(board)
for i,n in enumerate(nums):
    id=f"{n:03d}"
    addr=f"https://tcgbox.co.kr/web/product/big/s6k/S6K_{id}.jpg"
    row={"number":n,"url":addr,"status":"missing"}
    x=i*350;draw.text((x+6,5),f"S6K {id} retailer direct source",fill=(8,8,8))
    try:
        with urlopen(Request(addr,headers={"User-Agent":"Mozilla/5.0","Accept":"image/*"}),timeout=20) as r:
            data=r.read(5000001);row["http"]=r.status
        if len(data)>5000000:raise ValueError("too large")
        im=Image.open(BytesIO(data));im.load()
        if im.width<180 or im.height<265:raise ValueError("too small")
        img=im.convert("RGB");pre=img.copy();pre.thumbnail((330,490))
        board.paste(pre,(x+(350-pre.width)//2,32))
        buff=BytesIO();img.save(buff,"WEBP",quality=88,method=6)
        f=f"{id}-retailer.webp.b64"
        (out/f).write_text(base64.b64encode(buff.getvalue()).decode("ascii"))
        row.update(status="decoded_unverified_language_and_number",file=f,sourceSize=[im.width,im.height],sha256=hashlib.sha256(data).hexdigest())
    except Exception as e:
        row["error"]=str(e)[:150];draw.text((x+20,250),"NO IMAGE FROM DIRECT URL",fill=(8,8,8))
    result["cards"].append(row)
buf=BytesIO();board.save(buf,"WEBP",quality=81)
(out/"contact.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode("ascii"))
(out/"index.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({x["number"]:x["status"] for x in result["cards"]}))
