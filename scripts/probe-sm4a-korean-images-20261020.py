#!/usr/bin/env python3
"""Evidence-only SM4A Korean art source inspection; preserve existing sleeping tags."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import requests, base64, hashlib, io, json

OUT=Path("data/audits/theme-sm4a-001-062-korean-image-preflight-20261020.json")
sets=[*json.loads(Path("data/series.json").read_text(encoding="utf8")),
      *json.loads(Path("data/series-legacy.json").read_text(encoding="utf8"))]
s=next(x for x in sets if str(x.get("code","")).lower()=="sm4a")
assert len(s["cards"])==62, "SM4A master count changed"
th=json.loads(Path("data/art-themes.json").read_text(encoding="utf8"))
cv=json.loads(Path("data/audits/theme-series-coverage.json").read_text(encoding="utf8"))
assert cv["summary"]["themeCardSlots"]==18515
assert cv["summary"]["strictCompleteSetCount"]==109
assert next(x for x in cv["sets"] if x["code"].lower()=="sm4a")["status"]=="pending"
existing=[{"theme":g["code"],"code":c.get("code"),"name":c.get("name"),
           "image":c.get("image"),"cardNumber":c.get("cardNumber")}
          for g in th["groups"] for c in g["cards"]
          if str(c.get("set","")).lower()=="sm4a"]
assert len(existing)==2 and all(x["theme"]=="sleeping" for x in existing),existing
assert sum(len(g["cards"]) for g in th["groups"])==18515

def fetch(pair):
 n,c=pair;url=str(c.get("image") or "")
 row={"index":n,"code":c.get("code"),"name":c.get("name"),
      "image":url,"imageDecoded":False,"KoreanCardFaceVisuallyInspected":False,
      "printedCardFooterNumberEnlarged":False,"approvedNewThemes":[]}
 if not url.startswith("https://"):
  row["error"]="invalid-or-missing-HTTPS-source";return row,None
 try:
  resp=requests.get(url,timeout=25,headers={"User-Agent":"Mozilla/5.0 (Pokemon Korean illustration reference audit)","Accept":"image/webp,image/png,image/jpeg,*/*"})
  resp.raise_for_status()
  if len(resp.content)>8_000_000: raise ValueError("image too large")
  im=Image.open(io.BytesIO(resp.content));im.load()
  row.update(imageDecoded=True,httpStatus=resp.status_code,
             sha256=hashlib.sha256(resp.content).hexdigest(),
             pixelWidth=im.width,pixelHeight=im.height,imageFormat=im.format)
  return row,im.convert("RGB")
 except Exception as e:
  row["error"]=str(e)[:260];return row,None
with ThreadPoolExecutor(max_workers=8) as pool:
 results=list(pool.map(fetch,enumerate(s["cards"],start=1)))
rows=[x for x,_ in results];pics={x["index"]:im for x,im in results if im is not None}
report={"schemaVersion":1,"recordedAt":"2026-10-20","set":s["code"],
  "setName":s.get("displayName"),"masterCards":62,
  "sourceImagesDecoded":len(pics),"KoreanArtworkThemeApprovalsByAutomatedProbe":0,
  "alreadyRegisteredIndependentThemes":existing,
  "existingSleepingMembershipsPreserved":2,
  "previous109CompleteSetsPreserved":True,
  "previousThemeRowsPreserved":18515,
  "canonicalMasterModified":0,"ownershipOrFirestoreModified":0,
  "CardRadarFilesModified":0,
  "warning":"A successful HTTPS decode is not verification of Korean printed number/name or illustration-theme membership; manually inspect images and printed footer.",
  "cards":rows}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SM4A_KOREAN_IMAGE_PREFLIGHT",json.dumps({"total":len(rows),"decoded":len(pics),
 "preexistingThemes":existing,
 "cards":[{"n":x["index"],"code":x["code"],"name":x["name"],
           "decoded":x["imageDecoded"],"error":x.get("error")} for x in rows]},ensure_ascii=False))
for page in range(7):
 nums=range(page*10+1,min((page+1)*10+1,63))
 if not any(n in pics for n in nums):continue
 W,H,COLS=255,382,5
 sheet=Image.new("RGB",(W*COLS,H*2),"white");draw=ImageDraw.Draw(sheet)
 for i,n in enumerate(nums):
  if n not in pics:continue
  x,y=(i%COLS)*W,(i//COLS)*H
  draw.text((x+8,y+5),str(n).zfill(3),fill="black")
  t=ImageOps.contain(pics[n],(W-9,H-28))
  sheet.paste(t,(x+(W-t.width)//2,y+23))
 bio=io.BytesIO();sheet.save(bio,"JPEG",quality=62,optimize=True)
 print(f"SM4A_CONTACT_SHEET_{page+1}_BEGIN")
 print(base64.b64encode(bio.getvalue()).decode("ascii"))
 print(f"SM4A_CONTACT_SHEET_{page+1}_END")
