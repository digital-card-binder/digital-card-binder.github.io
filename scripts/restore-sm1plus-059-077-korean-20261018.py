#!/usr/bin/env python3
"""Repair exactly nineteen misattached SM1+ Korean cards using exact Korean Dogam app pages.
Save genuine KR images as owned WebP files, preserve 77 source card identities/ownership,
and track No. 069-077 as catalog-only basic-energy ordinal, NOT printed card serial.
All prior completed series are untouched. Requires site tests before commit.
"""
import concurrent.futures,hashlib,html,io,json,pathlib,re,urllib.request
from bs4 import BeautifulSoup
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
CATALOG=ROOT/"data/series.json"
REPORT=ROOT/"data/audits/sm1plus-059-077-Korean-source-image-recovery-20261018.json"
DEST=ROOT/"assets/cards/sm1plus-korean"
SETURL="https://www.dogam.app/sets/01KW0QNGGZKR1GPQ1DQ55B39MN"
numbers=list(range(59,78))
def download(url):
 request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (DigitalCardBinder KoreanCardIdentityReview)"})
 return urllib.request.urlopen(request,timeout=38).read(7000000)
raw=CATALOG.read_text(encoding="utf8")
master=json.loads(raw)
matches=[g for g in master if str(g.get("code","")).lower()=="sm1+"]
if len(matches)!=1 or len(matches[0].get("cards",[]))!=77:
 raise RuntimeError("Unexpected Korean SM1+ canonical 77-card checkpoint")
group=matches[0]
original=[json.loads(json.dumps(x,ensure_ascii=False)) for x in group["cards"]]
targets=[]
for n in numbers:
 cand=[c for c in group["cards"] if c.get("code","").lower()==f"sm1plus_{n:03d}/051"]
 if len(cand)!=1:raise RuntimeError(f"SM1+ code not unique at {n}")
 targets.append(cand[0])
doc=BeautifulSoup(download(SETURL).decode("utf8","replace"),"html.parser")
links={}
for anchor in doc.select("a[href]"):
 href=anchor.get("href","")
 if not href.startswith("/sets/01KW0QNGGZKR1GPQ1DQ55B39MN/cards/"):continue
 label=anchor.get_text(" ",strip=True)
 m=re.search(r"(?<!\d)(\d{3})$",label)
 if not m:continue
 n=int(m.group(1))
 if n in numbers:links.setdefault(n,[]).append(("https://www.dogam.app"+href,label))
if len(links)!=19 or any(len(links[n])!=1 for n in numbers):
 raise RuntimeError("Korean app indexed card pages not exact 19")
def normalize(s):
 return re.sub(r"\s+","",re.sub(r"No\.?","",str(s),flags=re.I)).strip().lower()
def check(pair):
 n,card=pair
 url,label=links[n][0]
 expectedName=normalize(card.get("name",""))
 sourceName=normalize(re.sub(r"\s*(?:No\.\s*)?\d{3}$","",label))
 if expectedName!=sourceName:
  raise ValueError(f"SM1+ card {n} Korean title conflict: master={card.get('name')} app={label}")
 page=download(url).decode("utf8","replace")
 site=BeautifulSoup(page,"html.parser")
 title=site.select_one('meta[property="og:title"]')
 title=html.unescape(title.get("content","")) if title else ""
 image=site.select_one('meta[property="og:image"]')
 source=html.unescape(image.get("content","")) if image else ""
 if (not source.startswith("https://static.tcgexchange.kr/") or
     not re.fullmatch(r"https://static\.tcgexchange\.kr/[a-f0-9]{32}\.(?:png|jpg|webp)",source)):
  raise ValueError("Unexpected Korean image source "+str(source))
 if "한글판" not in title or f"{n:03d}" not in title or normalize(label.split(" 0")[0]) not in normalize(title):
  # The label check above already binds exact set+printed/catalog id; verify title identity directly.
  if "한글판" not in title or f"{n:03d}" not in title or normalize(card["name"]) not in normalize(title):
   raise ValueError("Korean app title/catalog id mismatch "+str(n))
 if n<=68 and f"{n:03d}/051" not in page:
  raise ValueError("Korean printed number identity 059-068 not shown "+str(n))
 if n>=69 and "No." not in title:
  raise ValueError("unnumbered energy catalog ordinal not shown "+str(n))
 blob=download(source)
 if len(blob)<8000:raise ValueError("photo source invalid")
 pic=Image.open(io.BytesIO(blob));pic.load()
 if pic.width<300 or pic.height<430 or not .66<pic.width/pic.height<.77:
  raise ValueError(f"card image shape invalid {pic.size}")
 output=io.BytesIO()
 pic.convert("RGB").save(output,format="WEBP",quality=92,method=5)
 webp=output.getvalue()
 if len(webp)<9000 or webp[:4]!=b"RIFF" or webp[8:12]!=b"WEBP":
  raise ValueError("owned webp invalid")
 return {
  "number":n,"code":card["code"],"name":card["name"],
  "originalImage":card.get("image",""),"originalSourcePage":card.get("source",""),
  "appPage":url,"imageSource":source,"sourceBytes":len(blob),
  "sourceSHA256":hashlib.sha256(blob).hexdigest(),
  "ownedPath":f"assets/cards/sm1plus-korean/{n:03d}.webp",
  "ownedUrl":f"https://digital-card-binder.github.io/assets/cards/sm1plus-korean/{n:03d}.webp",
  "ownedBytes":len(webp),"ownedSHA256":hashlib.sha256(webp).hexdigest(),
  "imageDimensions":[pic.width,pic.height],
  "printedNumberEvidence":"korean_card_footer_3digit_over_051" if n<=68 else "korean_basic_energy_virtual_catalog_ordinal_not_printed",
  "status":"Korean_Dogam_exact_app_page_and_full_card_verified"
 },webp
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 results=list(pool.map(check,zip(numbers,targets)))
# No mutation before all 19 Korean sources are fetched, exact-named, checked and decoded.
if len(results)!=19:raise RuntimeError("Not all 19 assets passed identity gate")
rows=[r for r,_ in results]
for (row,image),card in zip(results,targets):
 assert row["code"]==card["code"]
 assert row["name"]==card["name"]
 card["image"]=row["ownedUrl"]
 card["source"]=row["appPage"]
destMap={row["code"]:(row["ownedUrl"],row["appPage"]) for row in rows}
for old,new in zip(original,group["cards"]):
 newFields={k:v for k,v in new.items() if k not in ("image","source")}
 oldFields={k:v for k,v in old.items() if k not in ("image","source")}
 if newFields!=oldFields:raise RuntimeError("Master identity or user property changed "+old.get("code",""))
 if old.get("code") not in destMap and new!=old:
  raise RuntimeError("Non-target card changed "+old.get("code",""))
# Retain all other era groups and other sets exactly unchanged.
newRaw=json.dumps(master,ensure_ascii=False,indent=2)+"\n"
assert len(json.loads(newRaw))==len(master)
DEST.mkdir(parents=True,exist_ok=True)
for row,payload in results:(ROOT/row["ownedPath"]).write_bytes(payload)
CATALOG.write_text(newRaw,encoding="utf8")
report={
 "schemaVersion":1,"date":"2026-10-18","set":"SM1+","range":"059-077",
 "sourceSet":SETURL,"approvedKoreanAppCardImages":19,
 "koreanPrintedSerialMatches059to068":10,
 "unnumberedKoreanBasicEnergiesCatalogOrdinals069to077":9,
 "allAppSourcesDecoded":True,"selfHostedInRepository":True,
 "originalCanonicalCodesUnchanged":True,"ownerStatusesMutated":False,
 "artThemeAssignmentsMutated":False,"otherSetsChanged":False,
 "priorCompletedCardReviewsUntouched":True,
 "cardSources":rows,
 "publicationCaveat":"Github Pages deploy/public image check must succeed before declaring all 19 live.",
 "previousConflictAudit":"data/audits/theme-sm1plus-059-077-master-vs-hosted-Korean-art-conflict-20261017.json"
}
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SM1PLUS_19_KOREAN_APP_IMAGES_SELFHOSTED",json.dumps({"total":19,"fullPrintId":10,
 "catalogOnlyNoNumber":9,"bytes":sum(x["ownedBytes"] for x in rows),
 "names":[x["name"] for x in rows]},ensure_ascii=False),flush=True)
