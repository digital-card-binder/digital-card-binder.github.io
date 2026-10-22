#!/usr/bin/env python3
"""Full image-integrity and visually inspectable footer contact sheets for 3 SM sets.

Manual QR/footer identity must be checked after this run. The program does NOT mark
a print verified simply because its HTTP hash matches earlier source evidence.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from collections import Counter,defaultdict
from io import BytesIO
import json, requests, hashlib
from PIL import Image,ImageDraw,ImageOps
D=Path("data/audits")
src=json.loads((D/"theme-sm-790-crosssource-card-identity-20261022.json").read_text())
out=D/"theme-sm-790-three-starter-image-recheck-20261022.json"
assert not out.exists()
selected={"sm60a":27,"sm60b":23,"sm30a":89}
target=[x for x in src["cards"] if x["set"].lower() in selected]
assert len(target)==139
for k,n in selected.items():assert sum(x["set"].lower()==k for x in target)==n
def probe(x):
 rec={k:x[k] for k in ["code","set","masterName","printedNumberExpected","oldImage","sourceHashStable"]}
 rec.update(status=None,liveSha256=None,imageWidth=None,imageHeight=None,decode=False,
  printedNameIndependentlyChecked=False,printedNumberIndependentlyChecked=False,error=None)
 try:
  r=requests.get(x["oldImage"],timeout=(8,18),headers={"User-Agent":"Mozilla/5.0 (Korean Card Artwork Audit)","Accept":"image/jpeg,image/png,image/webp,*/*"})
  rec["status"]=r.status_code;r.raise_for_status()
  if len(r.content)>9000000:raise ValueError("Image over 9 MB")
  im=Image.open(BytesIO(r.content));im.load()
  rec.update(decode=True,liveSha256=hashlib.sha256(r.content).hexdigest(),imageWidth=im.width,imageHeight=im.height)
  return rec,im.convert("RGB")
 except Exception as e:
  rec["error"]=str(e)[:175];return rec,None
with ThreadPoolExecutor(max_workers=16) as pool: results=list(pool.map(probe,target))
sheets=[]
F=D/"theme-sm-790-three-starter-footer-contact-20261022"
F.mkdir(parents=True,exist_ok=True)
# 6 Korean art images per page, with a 2x enlarged bottom footer under each card.
for code in selected:
 items=[v for v in results if v[0]["set"].lower()==code]
 for j in range(0,len(items),6):
  batch=items[j:j+6]
  W,H,cols=470,730,3
  image=Image.new("RGB",(W*cols,H*2),"white")
  pen=ImageDraw.Draw(image)
  for n,(r,im) in enumerate(batch):
   x=(n%3)*W; y=(n//3)*H
   pen.text((x+12,y+8),r["code"]+" "+r["masterName"][:20],fill="black")
   if im:
    main=ImageOps.contain(im,(270,570))
    image.paste(main,(x+5,y+45))
    fw,fh=im.size
    footer=im.crop((0,int(fh*.83),fw,fh))
    footer=ImageOps.contain(footer,(184,200))
    image.paste(footer,(x+282,y+470))
    pen.text((x+280,y+445),"PRINT FOOTER",fill="black")
   else:pen.text((x+15,y+70),"SOURCE MISSING",fill="red")
  name=f"{code}-footer-review-{j//6+1:02d}.jpg"
  image.save(F/name,"JPEG",quality=83,optimize=True)
  sheets.append({"series":code,"first":j+1,"last":j+len(batch),"filename":name})
good=[r for r,p in results if r["decode"]]
byset={code:{"cards":selected[code],
             "downloadable":sum(r["decode"] for r,p in results if r["set"].lower()==code),
             "unavailable":sum(not r["decode"] for r,p in results if r["set"].lower()==code)}
       for code in selected}
sha_groups=defaultdict(list)
for r,p in results:
 if r["liveSha256"]:sha_groups[r["liveSha256"]].append(r["code"])
dups=[v for v in sha_groups.values() if len(v)>1]
report={"schemaVersion":1,"recordedAt":"2026-10-22",
 "scope":"Three Korean SM starter and random-30-card sets; 139 of 778 accessible third-party images",
 "sets":["sm60A","sm60B","sm30A"],
 "requested":139,"decoded":len(good),"missing":139-len(good),
 "sourceImageDuplicateGroups":dups,
 "perSet":byset,"imageReviewSheetCount":len(sheets),"sheets":sheets,
 "physicalKoreanPrintedNameCount":0,"physicalKoreanPrintedNumberVerifiedCount":0,
 "notes":["Source image integrity is rechecked; human inspection of card name and printed number remains required.",
 "Never copy Japanese or other card variants across sets to fill a missing image.",
 "All 139 previously held cards remain held pending sheet/footer confirmation; no changes to original card database or user owned statuses."],
 "cards":[r for r,p in results]}
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("SM_THREE_STARTER_PRINT_SHEETS",json.dumps({"sets":byset,"sheets":len(sheets),"decoded":len(good),"duplicates":len(dups),"manualPrintVerified":0},ensure_ascii=False),flush=True)
