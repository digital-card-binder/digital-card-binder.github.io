#!/usr/bin/env python3
"""Patch held Korean S-era card image URLs from corresponding Dogam app KR card pages.

Uses owner's approved app-record acceptance criterion. Changes no identifiers,
names, rarities, ownership records, theme data or already completed cards.
"""
import concurrent.futures, datetime, html, io, json, pathlib, re, sys, urllib.request
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
QUEUE=ROOT/"data/audits/korean-recovery-active-queue-20261018.json"
CATALOG=ROOT/"data/series.json"
REPORT=ROOT/"data/audits/s-era-69-app-source-image-recovery-20261018.json"
queue=json.loads(QUEUE.read_text(encoding="utf-8"))
raw=CATALOG.read_text(encoding="utf-8")
master=json.loads(raw)
cards={}
def walk(obj):
 if isinstance(obj,list):
  for x in obj:walk(x)
 elif isinstance(obj,dict):
  if isinstance(obj.get("code"),str) and isinstance(obj.get("image"),str):
   cards.setdefault(obj["code"].lower(),[]).append(obj)
  for v in obj.values():
   if isinstance(v,(list,dict)):walk(v)
walk(master)
work=[x for x in queue["unresolved"] if x.get("era")=="S" and not x.get("slot","").upper().startswith("S6K_094")]
if len(work)!=69:raise RuntimeError(f"Unexpected S-era queue size {len(work)}; abort to protect other catalogs")
def read_one(item):
 slot=item["slot"].lower()
 found=[(key,obj) for key,values in cards.items() if (key==slot or key.startswith(slot+"/")) for obj in values]
 if len(found)!=1:raise RuntimeError(f"Expected 1 canonical card for {slot}: {len(found)}")
 code,obj=found[0]
 page=obj.get("source","")
 if not page.startswith("https://www.dogam.app/") or "/cards/" not in page:
  return {"slot":item["slot"],"workId":item["workId"],"status":"held_no_KR_app_card_page","source":page}
 try:
  req=urllib.request.Request(page,headers={"User-Agent":"Mozilla/5.0 (compatible; KoreanCardBinderCardSource/1.0)"})
  response=urllib.request.urlopen(req,timeout=30)
  markup=response.read().decode("utf-8","replace")
  og=re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"',markup,re.I)
  if not og: raise ValueError("No card OG image")
  url=html.unescape(og.group(1))
  if not re.fullmatch(r"https://static\.tcgexchange\.kr/[0-9a-f]{32}\.(png|jpg|webp)",url):
   raise ValueError("Unexpected image origin")
  pic=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=30).read()
  im=Image.open(io.BytesIO(pic));im.verify()
  if len(pic)<6000: raise ValueError("Card image too small")
  return {"slot":item["slot"],"workId":item["workId"],"code":obj["code"],"cardName":obj.get("name"),"status":"approved_KR_app_source_decoded","sourcePage":page,"oldImage":obj["image"],"newImage":url,"bytes":len(pic)}
 except Exception as exc:
  return {"slot":item["slot"],"workId":item["workId"],"code":obj["code"],"status":"held_source_error","sourcePage":page,"error":str(exc)[:300]}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 results=list(pool.map(read_one,work))
success=[x for x in results if x["status"]=="approved_KR_app_source_decoded" and x["newImage"]!=x["oldImage"]]
for row in success:
 code=row["code"]
 original=row["oldImage"]
 marker=re.escape(json.dumps(code,ensure_ascii=False))
 # Restrict the substitution to the image field of exactly one matching card.
 pattern=re.compile(r'("code"\s*:\s*'+marker+r'(?:(?!"code"\s*:).){0,1600}?"image"\s*:\s*)'+re.escape(json.dumps(original,ensure_ascii=False)),re.S)
 matches=list(pattern.finditer(raw))
 if len(matches)!=1:raise RuntimeError(f"Refusing ambiguous image update for {code} matches={len(matches)}")
 raw,count=pattern.subn(lambda m:m.group(1)+json.dumps(row["newImage"],ensure_ascii=False),raw,count=1)
 if count!=1:raise RuntimeError("Failed rewrite "+code)
updated=json.loads(raw)
after={}
def visit(obj):
 if isinstance(obj,list):
  for x in obj:visit(x)
 elif isinstance(obj,dict):
  if isinstance(obj.get("code"),str) and isinstance(obj.get("image"),str):
   after.setdefault(obj["code"].lower(),[]).append(obj)
  for v in obj.values():
   if isinstance(v,(dict,list)):visit(v)
visit(updated)
expected={r["code"].lower():r["newImage"] for r in success}
for code,items in cards.items():
 dest=after.get(code,[])
 if len(dest)!=len(items):raise RuntimeError("Unexpected canonical card change "+code)
 for old,new in zip(items,dest):
  expectedImage=expected.get(code,old["image"])
  if new.get("image")!=expectedImage:raise RuntimeError("Unexpected image change "+code)
  if {k:v for k,v in old.items() if k!="image"}!={k:v for k,v in new.items() if k!="image"}:
   raise RuntimeError("Non-image canonical data changed "+code)
report={"schemaVersion":1,"date":"2026-10-18","operation":"Korean S-era app-card image replacement, canonical series data image fields only",
"origin":"The original series.json card-specific Dogam Korean set card URLs",
"policy":"User explicitly approves Korean app catalog images as correct when set and card record match. Separate redistribution/license assessment not implied.",
"totalHeldSEraBefore":len(work),"successfullyRestoredFromApp":len(success),
"alreadyMatchingApp":sum(x.get("newImage")==x.get("oldImage") for x in results if x["status"]=="approved_KR_app_source_decoded"),
"stillHeld":len(work)-len(success),
"entries":results,
"caveat":"App source imagery and source file decoding verified; a new CDN deploy and public WebP validation are required before moving entries out of the active 191 audit queue.",
"canonicalCardChanges":0,"ownershipChanges":0,"reviewOfPreviouslyCompletedCards":0}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if success:CATALOG.write_text(raw,encoding="utf-8")
print("S_ERA_APP_IMAGE_APPLY_RESULT",json.dumps({"restored":len(success),"held":len(work)-len(success),"total":len(work),"codeSample":[x["code"] for x in success[:10]]},ensure_ascii=False))
for item in results:
 if item["status"]!="approved_KR_app_source_decoded":print("S_ERA_APP_HELD",json.dumps(item,ensure_ascii=False))
