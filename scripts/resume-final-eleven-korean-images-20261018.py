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
REPORT=ROOT/"data/audits/final-eleven-korean-app-image-recovery-20261018.json"
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
work=[x for x in queue["unresolved"] if x.get("imageComplete") is False]
if len(work)!=11 or len(queue.get("completedDoNotReaudit",[]))!=158:raise RuntimeError("191 queue checkpoint changed; preserve 158 already completed cards")

# Exact matching Korean app cards independently checked on 2026-10-18.
exactPages={
 "sm1m_067":"https://www.dogam.app/sets/01KW0QNJ2ZXVSQJ7D8ED81SN3B/cards/01KW1C67P80X0V5PETRJZ890EX",
 "sm1m_069":"https://www.dogam.app/sets/01KW0QNJ2ZXVSQJ7D8ED81SN3B/cards/01KW1C67P8GBP3XJEJ3NMCXQXG",
 "sm1m_071":"https://www.dogam.app/sets/01KW0QNJ2ZXVSQJ7D8ED81SN3B/cards/01KW1C67P9HNMJ1J8RNXYW2AVF",
 "sm1m_073":"https://www.dogam.app/sets/01KW0QNJ2ZXVSQJ7D8ED81SN3B/cards/01KW1C67P9RY61SCSYZ9G8DT4N",
 "sm1s_070":"https://www.dogam.app/sets/01KW0QNJW0GT90NCK2075KBWN4/cards/01KW1C683V3YVYJSWX7CKVVYHF",
 "sm1s_071":"https://www.dogam.app/sets/01KW0QNJW0GT90NCK2075KBWN4/cards/01KW1C683VXKH9G9V3SKZ6N5H2",
 "sm1s_072":"https://www.dogam.app/sets/01KW0QNJW0GT90NCK2075KBWN4/cards/01KW1C683VDC4HJ5X751F0Y86K",
 "sm1s_073":"https://www.dogam.app/sets/01KW0QNJW0GT90NCK2075KBWN4/cards/01KW1C683VMF2XVVV59VAYJXSJ",
 "s6k_094":"https://www.dogam.app/sets/01KW0QFGBXF892GC515FMJWY30/cards/01KW1C623QH7F713BF7KXMRRNR",
}
expectedNames={"sm1m_067":"라란티스 GX","sm1m_069":"블래키 GX","sm1m_071":"네스트볼","sm1m_073":"초 에너지",
"sm1s_070":"형사구스 GX","sm1s_071":"로토무도감","sm1s_072":"하이퍼볼","sm1s_073":"강철 에너지",
"s6k_094":"안개의 수정","s4a_138":"자마젠타"}

def discover_s4a_page():
 from bs4 import BeautifulSoup
 url="https://www.dogam.app/sets/01KW0QM63F9JMW2BKMK9DWEHAG"
 try:
  doc=BeautifulSoup(urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=25).read(),"html.parser")
  matches=[]
  for a in doc.select("a[href]"):
   href=a.get("href","")
   txt=a.get_text(" ",strip=True)
   if re.fullmatch(r"/sets/01KW0QM63F9JMW2BKMK9DWEHAG/cards/[A-Z0-9]+",href) and "자마젠타" in txt and re.search(r"(?<!\d)138(?!\d)",txt):
    matches.append("https://www.dogam.app"+href)
  if len(set(matches))==1:exactPages["s4a_138"]=matches[0]
  else:print("S4A_138_SOURCE_DISCOVERY_HELD",repr(matches[:6]))
 except Exception as e:print("S4A_138_SOURCE_DISCOVERY_ERROR",repr(e))

discover_s4a_page()
def read_one(item):
 slot=item["slot"].lower()
 found=[(key,obj) for key,values in cards.items() if (key==slot or key.startswith(slot+"/")) for obj in values]
 if len(found)!=1:raise RuntimeError(f"Expected 1 canonical card for {slot}: {len(found)}")
 code,obj=found[0]
 page=exactPages.get(slot.split("/")[0],obj.get("source",""))
 if slot.startswith("s6k_094"):
  # Korean printed-card evidence contradicts this app's Japanese-order metadata:
  # KOR 093=안개의 수정, KOR 094=메아리호른.
  return {"slot":item["slot"],"workId":item["workId"],"code":obj["code"],
          "status":"held_Korean_094_print_number_conflict","sourcePage":page,
          "reason":"App 094 displays 안개의 수정, but checked Korean real-print 094 is 메아리호른"}
 if not page.startswith("https://www.dogam.app/") or "/cards/" not in page:
  return {"slot":item["slot"],"workId":item["workId"],"status":"held_no_KR_app_card_page","source":page}
 try:
  req=urllib.request.Request(page,headers={"User-Agent":"Mozilla/5.0 (compatible; KoreanCardBinderCardSource/1.0)"})
  response=urllib.request.urlopen(req,timeout=30)
  markup=response.read().decode("utf-8","replace")
  printed = {"s4a_138":"138/190","s6k_094":"094/070",
   "sm1m_067":"067/060","sm1m_069":"069/060","sm1m_071":"071/060","sm1m_073":"073/060",
   "sm1s_070":"070/060","sm1s_071":"071/060","sm1s_072":"072/060","sm1s_073":"073/060"}.get(slot)
  if printed and (printed not in markup or "한글판" not in markup or expectedNames[slot].replace(" ","") not in markup.replace(" ","")):
   raise ValueError("Exact Korean app card title or printed number mismatch")
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
# Reverse only the mistaken S6K_094 app image applied in the prior batch.
# Do not alter any canonical numbers, names, owned states or theme entries.
wrong="https://static.tcgexchange.kr/ef029559a1d9428e4e35cffe972a2b58.png"
restore="https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/6e36bef8417c34a9.webp"
reversePattern=re.compile(r'("code"\s*:\s*"s6k_094/070"(?:(?!"code"\s*:).){0,1600}?"image"\s*:\s*)'+re.escape(json.dumps(wrong)),re.S)
raw,correctiveReverts=reversePattern.subn(lambda m:m.group(1)+json.dumps(restore),raw)
if correctiveReverts not in (0,1):raise RuntimeError("Unexpected repeated S6K_094 conflict")
if correctiveReverts:print("KOREAN_S6K_094_APP_IDENTITY_CONFLICT_REVERTED")
report={"schemaVersion":1,"date":"2026-10-18","operation":"Resume last 11 image holds (not 158 completed entries), canonical series image fields only",
"origin":"The original series.json card-specific Dogam Korean set card URLs",
"policy":"User explicitly approves Korean app catalog images as correct when set and card record match. Separate redistribution/license assessment not implied.",
"totalHeldElevenBefore":len(work),"successfullyRestoredFromApp":len(success),
"alreadyMatchingApp":sum(x.get("newImage")==x.get("oldImage") for x in results if x["status"]=="approved_KR_app_source_decoded"),
"stillHeldAtSourceStage":len(work)-len(success),
"entries":results,
"caveat":"CDN deployment and verification required before closing the active 191 audit queue. S6K 094 display name requires reconciliation separately.",
"canonicalCardChanges":0,"correctiveS6K094Revert":correctiveReverts,"ownershipChanges":0,"reviewOfPreviouslyCompletedCards":0}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if success or correctiveReverts:CATALOG.write_text(raw,encoding="utf-8")
print("FINAL_11_APP_IMAGE_SOURCE_RESULT",json.dumps({"restored":len(success),"held":len(work)-len(success),"total":len(work),"codeSample":[x["code"] for x in success[:10]]},ensure_ascii=False))
for item in results:
 if item["status"]!="approved_KR_app_source_decoded":print("FINAL_11_HELD",json.dumps(item,ensure_ascii=False))
