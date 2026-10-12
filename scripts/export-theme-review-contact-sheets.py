#!/usr/bin/env python3
"""Read-only visual evidence sheets from existing self-hosted CDN URLs.
DOES NOT mutate catalog or claim Korean identity from picture without manual check.
"""
import base64, io, json, os, time, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
audit=json.loads((ROOT/"data/audits/theme-next-batches-master-inventory.json").read_text(encoding="utf8"))
outdir=ROOT/"data/audits/theme-visual-evidence"
outdir.mkdir(parents=True,exist_ok=True)
report={"date":"2026-10-13","source":"Existing user-owned CDN route only","sets":{}}
MAX_SIDE=(220,310) # preserve readable card-number region; COLUMNS=5; PER_PAGE=15
for set_code, entry in audit["sets"].items():
    collected=[]
    for card in entry["cards"]:
        url=card.get("existingCdnUrl") or ""
        record={"order":card["canonicalOrder"],"code":card["code"],"name":card["name"],"url":url,"source":"user-owned self-host CDN","status":"missing"}
        frame=None
        if url:
            try:
                req=urllib.request.Request(url,headers={"User-Agent":"Digital-Card-Binder-theme-evidence/1.0"})
                with urllib.request.urlopen(req,timeout=12) as resp:
                    data=resp.read(3000000)
                    record["httpStatus"]=resp.status
                frame=Image.open(io.BytesIO(data)); frame.load()
                record.update({"status":"decoded","format":frame.format,"dimensions":list(frame.size),"bytes":len(data)})
                frame=frame.convert("RGB")
                frame.thumbnail(MAX_SIDE)
            except Exception as error:
                record["error"]=str(error)[:170]
        collected.append((record,frame))
    report["sets"][set_code]={"total":len(collected),"decoded":sum(1 for rec,frame in collected if frame is not None),"cards":[rec for rec,frame in collected]}
    for page_index,start in enumerate(range(0,len(collected),PER_PAGE),start=1):
        selection=collected[start:start+PER_PAGE]
        sheet=Image.new("RGB",(COLUMNS*244,3*368),(244,244,244))
        draw=ImageDraw.Draw(sheet)
        for i,(rec,frame) in enumerate(selection):
            x=(i%COLUMNS)*244;y=(i//COLUMNS)*368
            draw.rectangle((x+2,y+2,x+240,y+364),outline=(180,180,180),width=2)
            if frame:
                dx=x+(244-frame.width)//2; dy=y+8
                sheet.paste(frame,(dx,dy))
            else:
                draw.text((x+25,y+90),"NO CDN IMAGE",fill=(40,40,40))
            draw.text((x+8,y+318),str(rec["order"])+" | "+rec["code"][:22],fill=(20,20,20))
            draw.text((x+8,y+337),rec["status"],fill=(20,20,20))
        buff=io.BytesIO();sheet.save(buff,format="WEBP",quality=75,method=4)
        encoded=base64.b64encode(buff.getvalue()).decode("ascii")
        (outdir/f"{set_code}-{page_index:02d}.webp.b64").write_text(encoded,encoding="ascii")
        report["sets"][set_code].setdefault("sheets",[]).append({"file":f"{set_code}-{page_index:02d}.webp.b64","sizeBytes":len(buff.getvalue()),"cards":[r["code"] for r,f in selection]})
(outdir/"image-check-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({code:{"total":v["total"],"decoded":v["decoded"],"pages":len(v.get("sheets",[]))} for code,v in report["sets"].items()},ensure_ascii=False))
