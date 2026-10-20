#!/usr/bin/env python3
"""Korean SM4S 62-card image and identity source audit; read-only."""
import base64,hashlib,io,json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import requests

AUD=Path("data/audits")
OUT=AUD/"theme-sm4s-001-062-korean-image-preflight-20261020.json"
master=[*json.loads(Path("data/series.json").read_text(encoding="utf8")),
        *json.loads(Path("data/series-legacy.json").read_text(encoding="utf8"))]
setdata=next(x for x in master if str(x.get("code","")).lower()=="sm4s")
assert len(setdata["cards"])==62,"SM4S cardinality changed"
themes=json.loads(Path("data/art-themes.json").read_text(encoding="utf8"))
coverage=json.loads((AUD/"theme-series-coverage.json").read_text(encoding="utf8"))
assert coverage["summary"]["strictCompleteSetCount"]==109
assert coverage["summary"]["themeCardSlots"]==18422
assert next(x for x in coverage["sets"] if x["code"].lower()=="sm4s")["status"]=="pending"
assert len(themes["groups"])==12
assert sum(len(g["cards"]) for g in themes["groups"])==18422
assert not [c for g in themes["groups"] for c in g["cards"] if str(c.get("set","")).lower()=="sm4s"]
def check(nc):
 n,c=nc
 url=str(c.get("image") or "")
 row={"index":n,"code":c.get("code"),"name":c.get("name"),"image":url,
      "imageDecoded":False,"koreanPrintedFaceVisuallyRead":False,
      "koreanPrintedFooterNumberRead":False,"themeApprovals":[]}
 if not url.startswith("https://"):
  row["error"]="missing or non-https URL"
  return row,None
 try:
  response=requests.get(url,timeout=23,headers={"User-Agent":"Mozilla/5.0 (Korean SM4S card provenance audit)","Accept":"image/avif,image/webp,image/png,image/jpeg,*/*"})
  response.raise_for_status()
  if len(response.content)>8_000_000:raise ValueError("size over 8MB")
  im=Image.open(io.BytesIO(response.content));im.load()
  row.update(imageDecoded=True,httpStatus=response.status_code,
             sha256=hashlib.sha256(response.content).hexdigest(),
             pixelWidth=im.width,pixelHeight=im.height,imageFormat=im.format)
  return row,im.convert("RGB")
 except Exception as exc:
  row["error"]=str(exc)[:240]
  return row,None
with ThreadPoolExecutor(max_workers=9) as workers:
 outcomes=list(workers.map(check,enumerate(setdata["cards"],start=1)))
rows=[x for x,y in outcomes]
pics={x["index"]:y for x,y in outcomes if y is not None}
report={"schemaVersion":1,"recordedAt":"2026-10-20","set":setdata["code"],
 "setName":setdata.get("displayName"),"totalMasterCards":62,
 "imagesDownloadedDecoded":len(pics),
 "KoreanPrintArtworkApprovedByImageProbe":0,"approvedThemePlacements":0,
 "prior109StrictCompleteSetsPreserved":True,
 "priorIndependentThemeRowsPreserved":18422,
 "canonicalMasterModified":0,"ownershipOrFirestoreModified":0,"radarModified":0,
 "caveat":"Decoded source files alone cannot establish Korean printed card identity; actual name, scene and footer require visual examination before classification.",
 "cards":rows}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SM4S_KOREAN_SOURCE_EVIDENCE",json.dumps({"total":len(rows),"decoded":len(pics),
 "cards":[{"n":x["index"],"code":x["code"],"name":x["name"],"ok":x["imageDecoded"],"error":x.get("error")} for x in rows]},ensure_ascii=False))
for batch in range(7):
 nums=list(range(batch*10+1,min((batch+1)*10+1,63)))
 if not any(n in pics for n in nums):continue
 W,H,COLS=250,375,5
 sheet=Image.new("RGB",(W*COLS,H*2),"white")
 draw=ImageDraw.Draw(sheet)
 for i,n in enumerate(nums):
  if n not in pics:continue
  x,y=(i%COLS)*W,(i//COLS)*H
  draw.text((x+6,y+5),f"{n:03d}",fill="black")
  thumb=ImageOps.contain(pics[n],(W-8,H-28))
  sheet.paste(thumb,(x+(W-thumb.width)//2,y+23))
 bio=io.BytesIO();sheet.save(bio,"JPEG",quality=64,optimize=True)
 print(f"SM4S_CONTACT_SHEET_{batch+1}_BEGIN")
 print(base64.b64encode(bio.getvalue()).decode("ascii"))
 print(f"SM4S_CONTACT_SHEET_{batch+1}_END")
