#!/usr/bin/env python3
"""Korean SM2+ next-artwork read-only preflight; do not infer printed language by URL."""
from __future__ import annotations
import base64, hashlib, io, json, re
from collections import Counter
from pathlib import Path
import requests
from PIL import Image, ImageOps, ImageDraw

START, END = 11, 30
OUT = Path("data/audits/theme-sm2plus-011-030-image-preflight-20261020.json")
base=json.loads(Path("data/series.json").read_text(encoding="utf-8"))
legacy=json.loads(Path("data/series-legacy.json").read_text(encoding="utf-8"))
allsets={str(g.get("code", "")).lower():g for g in base}
allsets.update({str(g.get("code", "")).lower():g for g in legacy})
group=allsets["sm2+"]
assert len(group["cards"])==75
coverage=json.loads(Path("data/audits/theme-series-coverage.json").read_text(encoding="utf-8"))
assert coverage["summary"]["themeCardSlots"]==18027
assert coverage["summary"]["strictCompleteSetCount"]==109
assert next(z for z in coverage["sets"] if z["code"].lower()=="sm2+")["status"]=="partial"
prior=json.loads(Path("data/audits/theme-sm2plus-001-010-korean-art-screen-20261020.json").read_text(encoding="utf-8"))
assert prior["reviewedArtworkCount"]==10
assert prior["newIndependentThemeRows"]==16
theme=json.loads(Path("data/art-themes.json").read_text(encoding="utf-8"))
assert sum(len(g["cards"]) for g in theme["groups"])==18027
previous={x["code"] for g in theme["groups"] for x in g["cards"] if str(x.get("set","")).lower()=="sm2+"}
assert previous=={"SM2PLUS_"+f"{n:03d}" for n in range(1,11)}
session=requests.Session()
session.headers.update({"User-Agent":"Mozilla/5.0 (compatible; KoreanCardArtEvidence/1.0)", "Accept":"image/webp,image/png,image/jpeg,*/*"})
rows=[]; decoded=[]
for n in range(START,END+1):
    c=group["cards"][n-1]
    suffix=f"{n:03d}"
    assert str(c["code"]).lower()==f"sm2plus_{suffix}/049", ("unexpected card key",c["code"])
    url=str(c["image"])
    assert url==f"https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM2+/SM2plus_{suffix}.png", ("unexpected image",url)
    row={"number":n, "code":c["code"], "name":c.get("name"),
         "image":url, "approvedIndependentThemes":[],
         "imageDecoded":False, "koreanPrintedFooterVisuallyRead":False,
         "koreanPrintedCardFaceVisuallyRead":False}
    try:
        rr=session.get(url,timeout=16); rr.raise_for_status()
        if len(rr.content)>8_000_000: raise ValueError("image too large")
        im=Image.open(io.BytesIO(rr.content)); im.load()
        row.update(imageDecoded=True,sha256=hashlib.sha256(rr.content).hexdigest(),
                   width=im.width,height=im.height,format=im.format,httpStatus=rr.status_code)
        decoded.append((n,c["name"],im.convert("RGB")))
    except Exception as exc:
        row.update(error=str(exc)[:260])
    rows.append(row)
report={
    "schemaVersion":1, "recordedAt":"2026-10-20",
    "set":"sm2+", "setName":group.get("displayName"),
    "range":"011-030", "totalMasterCards":75,
    "previouslyScreenedArtworks":10, "pendingArtworksBeforeThisPass":65,
    "inspectedSourceUrls":len(rows), "imagesDownloadedDecoded":len(decoded),
    "visuallyApprovedNewKoreanPrintsByAutomation":0,
    "newThemeRows":0, "masterCardImagesChanged":0,
    "existingThemeRowsChanged":0,"firestoreAndOwnershipChanged":0,"radarFilesChanged":0,
    "next":"Visually inspect these 20 Korean-language cards, screen all 12 themes; preserve 001-010 and SM2K five holds.",
    "cards":rows
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SM2PLUS_011_030_PREFLIGHT",json.dumps({
    "decoded":len(decoded),"total":len(rows),
    "cards":[{"n":x["number"],"name":x["name"],"decoded":x["imageDecoded"]} for x in rows]
},ensure_ascii=False))
for page in range(2):
    batch=[z for z in decoded if START+10*page<=z[0]<START+10*(page+1)]
    if not batch:continue
    W,H,COLS=250,380,5
    sheet=Image.new("RGB",(W*COLS,H*2),"white")
    d=ImageDraw.Draw(sheet)
    for i,(n,name,im) in enumerate(batch):
        x,y=(i%COLS)*W,(i//COLS)*H
        d.text((x+7,y+5),f"{n:03d} {name}",fill="black")
        thumb=ImageOps.contain(im,(W-8,H-28))
        sheet.paste(thumb,(x+(W-thumb.width)//2,y+24))
    bio=io.BytesIO();sheet.save(bio,"JPEG",quality=65,optimize=True)
    print(f"SM2PLUS_IMAGE_SHEET_{page+1}_BEGIN")
    print(base64.b64encode(bio.getvalue()).decode("ascii"))
    print(f"SM2PLUS_IMAGE_SHEET_{page+1}_END")
