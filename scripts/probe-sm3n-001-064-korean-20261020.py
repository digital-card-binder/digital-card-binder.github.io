#!/usr/bin/env python3
"""Korean SM3N complete source/printed-art inspection preflight.
Read-only: don't approve theme tags or overwrite any identity from URLs alone.
"""
import base64,hashlib,io,json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import requests

ROOT=Path("data/audits")
OUT=ROOT/"theme-sm3n-001-064-korean-image-preflight-20261020.json"
groups=[*json.loads(Path("data/series.json").read_text(encoding="utf8")),
        *json.loads(Path("data/series-legacy.json").read_text(encoding="utf8"))]
group=next(g for g in groups if str(g.get("code","")).lower()=="sm3n")
assert len(group["cards"])==64,"SM3N master size changed"
th=json.loads(Path("data/art-themes.json").read_text(encoding="utf8"))
cv=json.loads((ROOT/"theme-series-coverage.json").read_text(encoding="utf8"))
assert cv["summary"]["themeCardSlots"]==18205
assert cv["summary"]["strictCompleteSetCount"]==109
assert len(th["groups"])==12
assert sum(len(g["cards"]) for g in th["groups"])==18205
assert next(x for x in cv["sets"] if x["code"].lower()=="sm3n")["status"]=="pending"
assert not [c for g in th["groups"] for c in g["cards"] if str(c.get("set","")).lower()=="sm3n"]
def one(item):
 n,c=item
 url=str(c.get("image") or "")
 row={"n":n,"code":c.get("code"),"name":c.get("name"),"image":url,"imageDecoded":False,
      "KoreanPrintedNameFaceInspected":False,"footerPrintedCardNumberRead":False,
      "approvedThemes":[]}
 if not url.startswith("https://"):
  row["error"]="missing_https";return row,None
 try:
  res=requests.get(url,timeout=22,headers={"User-Agent":"Mozilla/5.0 (CardBinder SM3N Korean audit)","Accept":"image/avif,image/webp,image/png,image/jpeg,*/*"})
  res.raise_for_status()
  if len(res.content)>8000000:raise ValueError("image too large")
  im=Image.open(io.BytesIO(res.content));im.load()
  row.update(imageDecoded=True,httpStatus=res.status_code,sha256=hashlib.sha256(res.content).hexdigest(),
             imageWidth=im.width,imageHeight=im.height,imageFormat=im.format)
  return row,im.convert("RGB")
 except Exception as e:
  row["error"]=str(e)[:250];return row,None

with ThreadPoolExecutor(max_workers=8) as pool:
 fetched=list(pool.map(one,enumerate(group["cards"],1)))
rows=[a for a,b in fetched];pics={a["n"]:b for a,b in fetched if b is not None}
print("SM3N_KOREAN_SOURCE_AUDIT",json.dumps({
 "set":group.get("displayName"),"masterCards":len(rows),"decoded":len(pics),
 "cards":[{"n":a["n"],"code":a["code"],"name":a["name"],"ok":a["imageDecoded"],"error":a.get("error")} for a in rows]
},ensure_ascii=False))
report={"schemaVersion":1,"recordedAt":"2026-10-20","set":"sm3N","setName":group.get("displayName"),
 "totalMasterCards":len(rows),"imagesSuccessfullyDecoded":len(pics),
 "imagesKoreanLanguageVisuallyVerifiedByThisAutomatedPass":0,
 "themePlacementsMade":0,"sourceLanguageCaveat":"URLs and successful decodes alone do not verify real printed Korean card face.",
 "strictCompleteSetsProtected":109,"existingThemeRowsProtected":18205,
 "masterCardsChanged":0,"ownershipOrFirestoreChanged":0,"cardRadarChanged":0,
 "cards":rows}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
for page in range(7):
 nums=range(page*10+1,min(page*10+11,65))
 if not any(n in pics for n in nums):continue
 w,h,cols=250,375,5
 sheet=Image.new("RGB",(w*cols,h*2),"white")
 draw=ImageDraw.Draw(sheet)
 for i,n in enumerate(nums):
  if n not in pics:continue
  x=(i%cols)*w;y=(i//cols)*h
  draw.text((x+8,y+4),f"{n:03d}",fill="black")
  tile=ImageOps.contain(pics[n],(w-8,h-28))
  sheet.paste(tile,(x+(w-tile.width)//2,y+23))
 bio=io.BytesIO();sheet.save(bio,"JPEG",quality=62,optimize=True)
 print(f"SM3N_CONTACT_SHEET_{page+1}_BEGIN")
 print(base64.b64encode(bio.getvalue()).decode("ascii"))
 print(f"SM3N_CONTACT_SHEET_{page+1}_END")
