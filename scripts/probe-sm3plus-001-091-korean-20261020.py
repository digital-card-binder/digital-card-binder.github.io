#!/usr/bin/env python3
"""SM3+ Korean artwork source and identity evidence; no inferred theme approvals.
Creates per-card HTTP/SHA evidence and ten contact sheets in Actions logs.
"""
import base64,hashlib,io,json,re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import requests

ROOT=Path("data/audits")
OUT=ROOT/"theme-sm3plus-001-091-korean-image-preflight-20261020.json"
allsets=[*json.loads(Path("data/series.json").read_text(encoding="utf8")),
         *json.loads(Path("data/series-legacy.json").read_text(encoding="utf8"))]
setdata=next(g for g in allsets if str(g.get("code","")).lower()=="sm3+")
assert len(setdata["cards"])==91,"master changed; no false approvals"
themes=json.loads(Path("data/art-themes.json").read_text(encoding="utf8"))
cov=json.loads((ROOT/"theme-series-coverage.json").read_text(encoding="utf8"))
assert cov["summary"]["themeCardSlots"]==18298
assert cov["summary"]["strictCompleteSetCount"]==109
assert next(x for x in cov["sets"] if x["code"].lower()=="sm3+")["status"]=="pending"
assert not [x for g in themes["groups"] for x in g["cards"] if str(x.get("set","")).lower()=="sm3+"]
assert len(themes["groups"])==12
assert sum(len(g["cards"]) for g in themes["groups"])==18298

def check(record):
    n,card=record
    url=str(card.get("image") or "")
    code=str(card.get("code") or "")
    row={"slotIndex":n,"code":code,"name":card.get("name"),"image":url,
         "imageDecoded":False,"actualKoreanFaceVisuallyRead":False,
         "printedNumberIndependentlyRead":False,"approvedThemes":[]}
    try:
        assert url.startswith("https://"),"missing https original"
        rs=requests.get(url,timeout=24,headers={
            "User-Agent":"Mozilla/5.0 (compatible; KoreanCardBinderEvidence/1.0)",
            "Accept":"image/avif,image/webp,image/png,image/jpeg,*/*"})
        rs.raise_for_status()
        assert len(rs.content)<8_000_000,"source exceeds 8 MB"
        im=Image.open(io.BytesIO(rs.content));im.load()
        row.update(imageDecoded=True,httpStatus=rs.status_code,
                   sha256=hashlib.sha256(rs.content).hexdigest(),
                   pixelWidth=im.width,pixelHeight=im.height,imageFormat=im.format)
        return row,im.convert("RGB")
    except Exception as ex:
        row["error"]=str(ex)[:260]
        return row,None

with ThreadPoolExecutor(max_workers=9) as pool:
    result=list(pool.map(check,enumerate(setdata["cards"],start=1)))
rows=[v for v,_ in result]
images={v["slotIndex"]:im for v,im in result if im is not None}
report={
    "schemaVersion":1,"recordedAt":"2026-10-20","set":setdata["code"],
    "setName":setdata.get("displayName"),"currentMasterCardCount":len(rows),
    "originalImagesDownloadedAndDecoded":len(images),
    "KoreanArtworkThemeDecisionsApprovedByThisPreflight":0,
    "previousCompletedSetsPreserved":109,"previousThemeRowsPreserved":18298,
    "SM3HAndSM3NHeldImagesPreserved":True,"masterDataChanged":0,
    "ownershipOrFirestoreChanged":0,"radarFilesChanged":0,
    "identityWarning":"Korean language / printed footer card identity is not proven by URL or successful image decoding; all records require actual visual confirmation, including variants.",
    "cards":rows
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SM3PLUS_IMAGE_PROBE",json.dumps({"set":setdata["code"],
"setName":setdata.get("displayName"),"masterCount":len(rows),"decoded":len(images),
"cards":[{"n":x["slotIndex"],"name":x["name"],"code":x["code"],"ok":x["imageDecoded"],
          "error":x.get("error")} for x in rows]},ensure_ascii=False))
for batch in range(10):
    nums=list(range(batch*10+1,min((batch+1)*10+1,92)))
    if not any(n in images for n in nums):continue
    W,H,COLS=240,367,5
    sheet=Image.new("RGB",(W*COLS,H*2),"white")
    draw=ImageDraw.Draw(sheet)
    for i,n in enumerate(nums):
        if n not in images:continue
        x,y=(i%COLS)*W,(i//COLS)*H
        draw.text((x+7,y+5),f"{n:03d}",fill="black")
        tile=ImageOps.contain(images[n],(W-9,H-29))
        sheet.paste(tile,(x+(W-tile.width)//2,y+23))
    bio=io.BytesIO();sheet.save(bio,"JPEG",quality=61,optimize=True)
    print(f"SM3PLUS_CONTACT_SHEET_{batch+1}_BEGIN")
    print(base64.b64encode(bio.getvalue()).decode("ascii"))
    print(f"SM3PLUS_CONTACT_SHEET_{batch+1}_END")
