#!/usr/bin/env python3
"""Safely close ONLY the final nine 191-queue Korean photo holds after CDN pixel proof.

Uses previously approved exact KR Dogam card-page mapping. Never changes card
numbers, owner collection state, or theme classifications.
"""
import concurrent.futures, collections, io, json, pathlib, time, urllib.request
from PIL import Image, ImageChops, ImageStat
ROOT=pathlib.Path(__file__).resolve().parents[1]
QUEUE=ROOT/"data/audits/korean-recovery-active-queue-20261018.json"
SOURCE=ROOT/"data/audits/final-eleven-korean-app-image-recovery-20261018.json"
REPORT=ROOT/"data/audits/final-nine-korean-cdn-closure-20261018.json"
queue=json.loads(QUEUE.read_text(encoding="utf-8"))
source=json.loads(SOURCE.read_text(encoding="utf-8"))
expected={141,165,166,167,168,169,170,171,172}
rows=[r for r in source["entries"] if r.get("workId") in expected]
assert len(rows)==9 and {r["workId"] for r in rows}==expected, "Expected exactly nine previous image holds"
assert all(r["status"]=="approved_KR_app_source_decoded" and r["sourcePage"].startswith("https://www.dogam.app/sets/") for r in rows)
pending={x["workId"]:x for x in queue["unresolved"]}
if not expected.issubset(pending):
 if not (not expected.intersection(pending) and expected.issubset({x["workId"] for x in queue["completedDoNotReaudit"]})):
  raise RuntimeError("Unexpected partial/stale queue checkpoint; abort")
 print("All nine are already recorded complete; no repeat work")
 raise SystemExit(0)
assert queue["counts"]["initial"]==191 and len(queue["completedDoNotReaudit"])==158 and len(queue["unresolved"])==33
assert len(queue["completedDoNotReaudit"])+len(queue["unresolved"])==191
assert all(pending[r["workId"]]["imageComplete"] is False for r in rows)

def fnv64(url):
 h=0xcbf29ce484222325
 for c in url:
  h=( (h ^ ord(c))*0x100000001b3) & 0xffffffffffffffff
 return f"{h:016x}"

def picture(url):
 last=""
 for attempt in range(6):
  try:
   request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (KoreanPrintImageAudit/1.0)","Cache-Control":"no-cache"})
   raw=urllib.request.urlopen(request,timeout=35).read(9_000_000)
   if len(raw)<5000:raise ValueError("Image too small")
   im=Image.open(io.BytesIO(raw));im.load()
   if im.width<180 or im.height<220:raise ValueError("Not full card image")
   return im.convert("RGB"),len(raw)
  except Exception as e:
   last=str(e)
   if attempt<5:time.sleep(3+attempt*3)
 raise ValueError(last)

def check(row):
 cdn="https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/"+fnv64(row["newImage"])+".webp"
 try:
  orig,sourceBytes=picture(row["newImage"])
  own,ownedBytes=picture(cdn)
  ratio=orig.width/orig.height
  if not 0.58<ratio<0.85:raise ValueError("Source ratio implausible")
  pixels=(128,175)
  a=orig.resize(pixels,Image.Resampling.LANCZOS)
  b=own.resize(pixels,Image.Resampling.LANCZOS)
  difference=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
  if difference>=18:raise ValueError(f"Wrong artwork! pixel mean diff={difference:.2f}")
  return {"workId":row["workId"],"slot":row["slot"],"source":row["newImage"],
          "sourcePage":row["sourcePage"],"ownedCdn":cdn,"pixelDifference":round(difference,2),
          "ownedBytes":ownedBytes,"sourceBytes":sourceBytes,"verified":True}
 except Exception as e:
  return {"workId":row["workId"],"slot":row["slot"],"ownedCdn":cdn,"verified":False,"error":str(e)[:250]}

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as workers:
 results=list(workers.map(check,rows))
fail=[r for r in results if not r["verified"]]
print("FINAL_NINE_KOREAN_CDN",json.dumps({"passed":len(results)-len(fail),"total":9,"results":results},ensure_ascii=False))
if fail:raise SystemExit("Cannot close nine items without exact self-hosted image proof")

# Confirm master card data now points to the verified Korean app card image and provenance.
series=json.loads((ROOT/"data/series.json").read_text(encoding="utf-8"))
cards={}
def walk(obj):
 if isinstance(obj,list):
  for e in obj:walk(e)
 elif isinstance(obj,dict):
  if isinstance(obj.get("code"),str) and isinstance(obj.get("image"),str):
   cards.setdefault(obj["code"].lower(),[]).append(obj)
  for value in obj.values():
   if isinstance(value,(dict,list)):walk(value)
walk(series)
for row in rows:
 variants=cards.get(row["code"].lower(),[])
 if len(variants)!=1 or variants[0]["image"]!=row["newImage"] or variants[0].get("source")!=row["sourcePage"]:
  raise RuntimeError("Canonical image/source changed unexpectedly "+row["code"])

for r in results:
 prior=pending[r["workId"]]
 queue["completedDoNotReaudit"].append({
  "workId":r["workId"],"slot":r["slot"],"series":prior["series"],
  "name":prior.get("cardName"),"status":"Korean_card_app_source_and_selfhosted_pixels_verified",
  "imageComplete":True,"sourceEvidence":r["sourcePage"],"imageSource":r["source"],
  "archiveImageUrl":r["ownedCdn"],"archivePixelsMeanDifference":r["pixelDifference"],
  "verifiedAt":"2026-10-18","auditReport":str(REPORT.relative_to(ROOT))
 })
queue["unresolved"]=[x for x in queue["unresolved"] if x["workId"] not in expected]
counts=queue["counts"]
counts["totalClosed"]=len(queue["completedDoNotReaudit"])
counts["stillUnresolved"]=len(queue["unresolved"])
counts["byEra"]=dict(collections.Counter(x["era"] for x in queue["unresolved"]))
counts["bySeries"]=dict(collections.Counter(x["series"] for x in queue["unresolved"]))
counts["byIssue"]=dict(collections.Counter(x["issue"] for x in queue["unresolved"]))
counts["closedFromKoreanAppSource"]+=9
counts["verifiedAppCardImages"]+=9
counts["appImageSourcesChanged"]+=9
counts["newlyClosedFromFinalNineKoreanCdn"]=9
queue["status"]="24_remaining_167_closed_9_latest_Korean_card_images_verified_own_CDN"
queue["sourceMainCommitAtReconciliation"]="33904250c7da629ad127d29ba332390e9c8a5454"
queue["countingPolicy"]="191 original work items unchanged. 158 previously complete cards untouched. Nine remaining Korean image holds closed ONLY following live exact Korean app/source and own-CDN pixel comparisons. Other image-verified identity holds remain open."
snapshot=queue["imageCompletionSnapshot"]
snapshot["totalImageClosures"]=counts["totalClosed"]
snapshot["remainingNonImageAndImageHolds"]=counts["stillUnresolved"]
snapshot["newlyVerifiedAppImages"]=counts["verifiedAppCardImages"]
snapshot["newImageSourceReplacements"]=counts["appImageSourcesChanged"]
snapshot["stillMissingOrConflictedCardImages"]=2
snapshot["finalNinePublicOwnCdnAudit"]=str(REPORT.relative_to(ROOT))
queue["nextPriority"]=[
 "S6K 094: Korean physical print source says 메아리호른, Korean app 094 says 안개의 수정. Do not silently relabel or overwrite until exact Korean footer settled.",
 "S-P 022: Korean 022/S-P 나옹 VMAX not Japanese 022/S-P 에이스번. App page returned 404; Korean distribution evidence is uncertain; no Japanese replacement.",
 "Classic CLL/CLK/CLF six and SN two basic Energy catalog slots: Korean photo already verified, physical printed number is absent; clarify virtual catalog keys before identity audit closure.",
 "MEGA 14: Korean-language card images already verified on own CDN; unresolved only original release/printed catalog identities (including unnumbered variants)."
]
queue["lastNewlyCompleted"]=results
assert len(queue["completedDoNotReaudit"])==167 and len(queue["unresolved"])==24
assert len({r["workId"] for r in queue["completedDoNotReaudit"]})==167
assert len({r["workId"] for r in queue["unresolved"]})==24
assert not {r["workId"] for r in queue["completedDoNotReaudit"]}.intersection({r["workId"] for r in queue["unresolved"]})
report={"schemaVersion":1,"date":"2026-10-18","type":"exact_KR_9_selfhosted_CDN_pixel_validation",
 "initialWorkItems":191,"previouslyCompleted":158,"newlyClosed":9,
 "nowCompleted":167,"remaining":24,"pendingImageExceptions":2,
 "recheckedPriorCompleted":0,"userCollectionMutations":0,"physicalPrintIdentityDecisions":0,
 "passed":True,"images":results}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
QUEUE.write_text(json.dumps(queue,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("FINAL_NINE_AUDIT_CLOSED",json.dumps({"closedNow":9,"completed":167,"pending":24}))
