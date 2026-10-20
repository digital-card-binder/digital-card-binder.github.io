#!/usr/bin/env python3
"""Inspect Korean SM3H canonical images without touching earlier reviewed sets."""
import base64, hashlib, io, json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import requests

root=Path("data/audits")
OUT=root/"theme-sm3h-001-064-korean-image-preflight-20261020.json"
master=[*json.loads(Path("data/series.json").read_text(encoding="utf8")),
        *json.loads(Path("data/series-legacy.json").read_text(encoding="utf8"))]
group=next(x for x in master if str(x.get("code","")).lower()=="sm3h")
assert len(group["cards"])==64, "SM3H master card count drift"
themes=json.loads(Path("data/art-themes.json").read_text(encoding="utf8"))
coverage=json.loads((root/"theme-series-coverage.json").read_text(encoding="utf8"))
assert coverage["summary"]["strictCompleteSetCount"]==109
assert coverage["summary"]["themeCardSlots"]==18109
assert next(x for x in coverage["sets"] if x["code"].lower()=="sm3h")["status"]=="pending"
assert not [c for g in themes["groups"] for c in g["cards"] if str(c.get("set","")).lower()=="sm3h"]
assert sum(len(g["cards"]) for g in themes["groups"])==18109
DATA=group["cards"]
def fetch(item):
    n,c=item
    url=str(c.get("image") or "")
    row={"n":n,"code":c.get("code"),"name":c.get("name"),"image":url,
         "imageDecoded":False,"officialKoreanTextVisuallyInspected":False,
         "printedFooterNumberIndependentlyRead":False,"approvedThemes":[]}
    if not url.startswith("https://"):
        row["failure"]="non_https_or_missing_image";return row,None
    try:
        z=requests.get(url,timeout=20,headers={"User-Agent":"Mozilla/5.0 (card artwork provenance audit)","Accept":"image/webp,image/png,image/jpeg,*/*"})
        z.raise_for_status()
        if len(z.content)>8_000_000:raise ValueError("image over 8MB")
        im=Image.open(io.BytesIO(z.content));im.load()
        row.update(imageDecoded=True,httpStatus=z.status_code,sha256=hashlib.sha256(z.content).hexdigest(),
                   imageFormat=im.format,pixelWidth=im.width,pixelHeight=im.height)
        return row,im.convert("RGB")
    except Exception as e:
        row["failure"]=str(e)[:240]
        return row,None

with ThreadPoolExecutor(max_workers=8) as pool:
    items=list(pool.map(fetch, enumerate(DATA,start=1)))
rows=[x for x,y in items]
images={x["n"]:y for x,y in items if y is not None}
name="Korean SM3H - "+str(group.get("displayName") or group.get("name"))
report={"schemaVersion":1,"recordedAt":"2026-10-20","set":"sm3h","setName":group.get("displayName"),
 "scope":"001-064 source artwork preflight","totalMasterCards":len(DATA),
 "imagesDownloadedDecoded":len(images),"KoreanPrintedFacesApprovedByAutomatedProbe":0,
 "prior109CompleteSetsPreserved":True,"priorSM2Plus66ArtworksPreserved":True,
 "previousThemeRowsModified":0,"masterDataChanged":0,"ownershipOrFirestoreChanged":0,
 "cardRadarChanged":0,
 "note":"Official source filename and successful decode do NOT prove Korean printed number; inspect Korean text and image scene for each card before adding theme placements.",
 "cards":rows}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SM3H_PREFLIGHT",json.dumps({"setName":name,"masterSlots":len(DATA),"decoded":len(images),
"first30":[{"n":x["n"],"code":x["code"],"name":x["name"],"decoded":x["imageDecoded"],"url":x["image"]} for x in rows[:30]],
"failures":[{"n":x["n"],"why":x.get("failure")} for x in rows if not x["imageDecoded"]]},ensure_ascii=False))
for page in range(7):
    nums=list(range(page*10+1,min((page+1)*10+1,65)))
    if not any(n in images for n in nums):continue
    W,H,COLS=250,375,5
    sheet=Image.new("RGB",(W*COLS,H*2),"white");draw=ImageDraw.Draw(sheet)
    for i,n in enumerate(nums):
        if n not in images:continue
        x,y=i%COLS*W,i//COLS*H
        draw.text((x+7,y+5),str(n).zfill(3),fill="black")
        tile=ImageOps.contain(images[n],(W-8,H-28))
        sheet.paste(tile,(x+(W-tile.width)//2,y+23))
    b=io.BytesIO();sheet.save(b,"JPEG",quality=65,optimize=True)
    print(f"SM3H_SHEET_{page+1}_BEGIN")
    print(base64.b64encode(b.getvalue()).decode("ascii"))
    print(f"SM3H_SHEET_{page+1}_END")
