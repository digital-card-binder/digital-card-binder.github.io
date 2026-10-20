#!/usr/bin/env python3
"""Evidence-only Korean SM2+ images 031–075, preserving all prior reviews."""
import json, io, base64, hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import requests

START, END = 31,75
OUT=Path("data/audits/theme-sm2plus-031-075-korean-image-preflight-20261020.json")
base=json.loads(Path("data/series.json").read_text(encoding="utf8"))
legacy=json.loads(Path("data/series-legacy.json").read_text(encoding="utf8"))
master=next(x for x in [*base,*legacy] if str(x.get("code","")).lower()=="sm2+")
assert len(master["cards"])==75
themes=json.loads(Path("data/art-themes.json").read_text(encoding="utf8"))
coverage=json.loads(Path("data/audits/theme-series-coverage.json").read_text(encoding="utf8"))
prior=json.loads(Path("data/audits/theme-sm2plus-011-030-korean-art-screen-20261020.json").read_text(encoding="utf8"))
assert prior["cumulativeReviewed"]==30 and prior["themeRowsAfter"]==18061
assert coverage["summary"]["themeCardSlots"]==18061
assert coverage["summary"]["strictCompleteSetCount"]==109
assert next(x for x in coverage["sets"] if x["code"].lower()=="sm2+")["status"]=="partial"
current=[(g["code"],c.get("code")) for g in themes["groups"] for c in g["cards"] if str(c.get("set","")).lower()=="sm2+"]
assert len(current)==50
assert {id for t,id in current}=={"SM2PLUS_"+f"{i:03d}" for i in range(1,31)}
session=requests.Session()
session.headers.update({"User-Agent":"Mozilla/5.0 (Korean print card illustration audit)", "Accept":"image/avif,image/webp,image/png,image/jpeg,*/*"})
rows=[]; images={}
for n in range(START,END+1):
    c=master["cards"][n-1]
    suffix=f"{n:03d}"
    code=f"sm2plus_{suffix}/049"
    url=f"https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM2+/SM2plus_{suffix}.png"
    assert str(c.get("code","")).lower()==code,(n,c.get("code"))
    assert str(c.get("image",""))==url,(n,c.get("image"))
    row={"number":n,"code":c["code"],"name":c["name"],"image":url,
         "decoded":False,"visuallyReviewedByThisAutomatedDownload":False,
         "enlargedKoreanPrintedCardNumberReviewed":False,"themeDecisions":[]}
    try:
        resp=session.get(url,timeout=18);resp.raise_for_status()
        assert len(resp.content)<8_000_000
        im=Image.open(io.BytesIO(resp.content));im.load()
        row.update(decoded=True,httpStatus=resp.status_code,width=im.width,height=im.height,
                   format=im.format,sha256=hashlib.sha256(resp.content).hexdigest())
        images[n]=im.convert("RGB")
    except Exception as exc:
        row["error"]=str(exc)[:240]
    rows.append(row)
report={
  "schemaVersion":1,"recordedAt":"2026-10-20","set":"sm2+",
  "setName":master.get("displayName"),"scope":"031-075",
  "totalInSet":75,"previousArtworkReviewsPreserved":30,
  "nextArtworkSlots":45,"decodedImageCount":len(images),
  "confirmedPrintedKoreanFacesByAutomaticDownload":0,
  "newThemeRows":0,"masterOrOwnershipModified":False,
  "historicThemesModified":False,"cardRadarModified":False,
  "caution":"Successful image download does not prove Korean printed face or caption. Manually inspect contact sheets and enlarge footer where uncertain; do not count special Energy No. labels without seeing the actual print.",
  "cards":rows
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SM2PLUS_031_075_SOURCES",json.dumps({"count":len(rows),"decoded":len(images),"cards":[{"n":x["number"],"name":x["name"],"decoded":x["decoded"]} for x in rows]},ensure_ascii=False))
for page in range(5):
    indices=list(range(31+10*page,min(31+10*(page+1),76)))
    if not any(n in images for n in indices):continue
    W,H,COLS=235,355,5
    sheet=Image.new("RGB",(W*COLS,H*2),"white")
    d=ImageDraw.Draw(sheet)
    for i,n in enumerate(indices):
        if n not in images:continue
        x,y=(i%COLS)*W,(i//COLS)*H
        # Labels are numeric; Korean printed title remains legible on source image.
        d.text((x+7,y+4),f"{n:03d}",fill="black")
        thumb=ImageOps.contain(images[n],(W-7,H-26))
        sheet.paste(thumb,(x+(W-thumb.width)//2,y+22))
    buf=io.BytesIO();sheet.save(buf,"JPEG",quality=58,optimize=True)
    print(f"SM2PLUS_031_075_SHEET_{page+1}_BEGIN")
    print(base64.b64encode(buf.getvalue()).decode("ascii"))
    print(f"SM2PLUS_031_075_SHEET_{page+1}_END")
