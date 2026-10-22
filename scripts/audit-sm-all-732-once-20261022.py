#!/usr/bin/env python3
"""One-pass full remaining 732 SM artwork print evidence audit.

Does not claim automatic matching proves Korean physical printing.
Never repeat earlier validated 58, never remap card identities.
All remaining cards are evaluated in ONE bounded run and checkpointed.
"""
from pathlib import Path
from collections import Counter,defaultdict
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json,requests,hashlib,re
from PIL import Image,ImageDraw,ImageOps
D=Path("data/audits")
load=lambda f:json.loads(Path(f).read_text(encoding="utf-8"))
allCards=load(D/"theme-sm-790-crosssource-card-identity-20261022.json")["cards"]
first=load(D/"theme-sm-790-first18-verified-korean-print-footers-20261022.json")["reviewedCardImages"]
next18=load(D/"theme-sm-790-next18-verified-korean-print-footers-20261022.json")["reviewedSources"]
next22=load(D/"theme-sm-790-starter-numbered-58-verified-20261022.json")["verifiedCards"]
complete={x["code"].lower() for x in first+next18+next22}
assert len(complete)==58
todo=[x for x in allCards if x["code"].lower() not in complete]
assert len(todo)==732
assert len({x["code"].lower() for x in todo})==732
OUT=D/"theme-sm-732-entire-remainder-artwork-source-20261022.json"
assert not OUT.exists()
SHEETS=D/"theme-sm-732-all-contact-sheets-20261022"
SHEETS.mkdir(parents=True,exist_ok=True)
# Numbered cards can be grouped into manageable 16-card sheets without
# masking/footer transformations. One thumbnail plus enlarged low-left/right crop.
def fetch(x):
 ans={"code":x["code"],"set":x["set"],"name":x["masterName"],
      "expectedNumber":x["printedNumberExpected"],"source":x["oldImage"],
      "sourceHost":x["urlHost"],"status":None,"decoded":False,
      "sha256":None,"priorSourceHashStable":x["sourceHashStable"],
      "physicalKoreanPrintVerified":False,"reason":None,"width":None,"height":None}
 try:
  r=requests.get(x["oldImage"],timeout=(6,18),headers={"User-Agent":"Mozilla/5.0 (Korean Card Print Visual Audit/2.0)","Accept":"image/jpeg,image/png,image/webp,*/*"})
  ans["status"]=r.status_code
  r.raise_for_status()
  if len(r.content)>9_000_000: raise ValueError("source exceeds 9MB")
  im=Image.open(BytesIO(r.content));im.load()
  if im.width<180 or im.height<260: raise ValueError("artwork too small to inspect card print")
  ans.update(decoded=True,sha256=hashlib.sha256(r.content).hexdigest(),width=im.width,height=im.height)
  ans["reason"]="downloaded; physical Korean printed name/number requires manual image review"
  return ans,im.convert("RGB")
 except Exception as e:
  ans["reason"]=str(e)[:180];return ans,None
with ThreadPoolExecutor(max_workers=24) as pool: results=list(pool.map(fetch,todo))
assert len(results)==732
bySet=defaultdict(list)
for rec,img in results:bySet[rec["set"].lower()].append((rec,img))
sheetRefs=[]
for setcode,entries in sorted(bySet.items()):
 for offset in range(0,len(entries),16):
  group=entries[offset:offset+16]
  W,H=310,515
  canvas=Image.new("RGB",(W*4,H*4),"white")
  draw=ImageDraw.Draw(canvas)
  for i,(rec,pic) in enumerate(group):
   x=i%4*W;y=i//4*H
   draw.text((x+5,y+5),rec["code"][:24],fill="black")
   draw.text((x+5,y+22),rec["name"][:19],fill="black")
   if pic:
    main=ImageOps.contain(pic,(195,350))
    canvas.paste(main,(x+(195-main.width)//2+4,y+46))
    width,height=pic.size
    foot=pic.crop((0,int(height*.82),width,height))
    enlarged=ImageOps.contain(foot,(110,210))
    canvas.paste(enlarged,(x+199,y+300))
   else:
    draw.text((x+10,y+80),"MISSING SOURCE",fill="red")
  name=f'{setcode}-{offset//16+1:03d}.jpg'
  canvas.save(SHEETS/name,"JPEG",quality=81,optimize=True)
  sheetRefs.append({"set":setcode,"firstCode":group[0][0]["code"],"lastCode":group[-1][0]["code"],
   "filename":name,"images":len(group)})
rows=[a for a,b in results]
missing=[a["code"] for a in rows if not a["decoded"]]
same=sum(a["sha256"] is not None and a["priorSourceHashStable"] for a in rows)
report={"schemaVersion":1,"recordedAt":"2026-10-22","scope":"All 732 previously held Korean SM print image slots, excluding exactly 58 already visually verified",
 "previouslyVerifiedSkipped":58,"auditedNew":732,"downloaded":sum(a["decoded"] for a in rows),
 "missing":len(missing),"missingCodes":missing,"shaStableHistoricalSourceCount":same,
 "originalImageDuplicatesCount":sum(n-1 for n in Counter(a["sha256"] for a in rows if a["sha256"]).values() if n>1),
 "manualPrintsVerifiedByThisAutomatedSourcePass":0,
 "physicalPrintVerificationStillRequired":732,
 "perSet":{k:{"inspected":len(v),"downloaded":sum(a["decoded"] for a,p in v),"broken":sum(not a["decoded"] for a,p in v)} for k,v in bySet.items()},
 "sheets":sheetRefs,"sourceImages":rows,
 "status":"All 732 audited for source condition. Not claiming 732 physical-print verifications or theme classification from URL/hash only.",
 "nextSteps":["Use grouped numbered sheets for human physical Korean footer + name checks in one continuous review, recording explicit approvals.",
 "For missing images, research alternate publicly reachable Korean-print sources; do not replace with JP print or fabricate a location.",
 "Never repeat 58 already printed-number verified records; preserve 22,032 standalone theme rows."] }
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("SM_732_ALL_SOURCE_AUDIT",json.dumps({k:report[k] for k in ["previouslyVerifiedSkipped","auditedNew","downloaded","missing","shaStableHistoricalSourceCount","originalImageDuplicatesCount","manualPrintsVerifiedByThisAutomatedSourcePass","perSet"]},ensure_ascii=False),flush=True)
