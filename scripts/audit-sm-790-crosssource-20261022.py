#!/usr/bin/env python3
"""Audit 790 still held Korean SM prints without guessing Japanese substitutions.

This report is an evidence gate. Source URL patterns and working image links do
not prove physical Korean printed identity. Nothing writes to series or theme data.
"""
import json, re, os, hashlib, requests
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit, unquote
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
D=Path("data/audits")
OUT=D/"theme-sm-790-crosssource-card-identity-20261022.json"
assert not OUT.exists()
read=lambda p: json.loads(Path(p).read_text(encoding="utf-8"))
allsets=read("data/series.json")+read("data/series-legacy.json")
master={c["code"].lower():{"set":s["code"],**c} for s in allsets for c in s["cards"]}
prior=read(D/"theme-sm19-797-print-source-recheck-20261022.json")
six=read(D/"theme-sm19-six-restored-korean-image-urls-20261022.json")
seven=read(D/"theme-sm19-sm12-109-korean-image-repair-20261022.json")
probe=read(D/"theme-sm19-13-source-rescue-probe-20261022.json")
assert len(prior["cards"])==797 and six["imageRestorations"]==6
assert seven["repairedCodes"]==["sm12_109/095"] and probe["attemptedCards"]==13
repaired={x["code"].lower() for x in six["cards"]}|set(x.lower() for x in seven["repairedCodes"])
assert len(repaired)==7
records=[]
for item in prior["cards"]:
 code=item["canonicalCode"].lower()
 if code in repaired:continue
 assert code in master, "Master lacks audit card "+code
 x=master[code]
 assert x["name"]==item["name"], "Unexpected name change "+code
 assert x["image"]==item["originalImageReference"],"Unexpected new image reference "+code
 assert item["resolution"] in ("image_source_accessible_but_print_number_unverified",
                               "image_unavailable_or_low_resolution","source_url_missing")
 url=unquote(urlsplit(x.get("image") or "").path)
 numeric=re.search(r'(?i)(?:sm11b|sm12a|sm12|sm2k|smp|sm[A-Z0-9+]+)[-_ ]0*(\d{1,3})',url)
 position=int(code.split("_")[1].split("/")[0])
 matches=bool(numeric and int(numeric.group(1))==position)
 kind="available_number_in_url_only" if item["resolution"]=="image_source_accessible_but_print_number_unverified" else "broken_original"
 record={"code":code,"set":item["set"],"masterName":x["name"],"masterRarity":x.get("rarity",""),
         "printedNumberExpected":code.split("_")[1],"urlHost":urlsplit(x["image"]).hostname,
         "oldImage":x["image"],"referenceSource":x.get("source"),"imageReferenceNote":x.get("imageReferenceNote"),
         "sourceHashStable":bool(item["sha256SameAsFirstPass"]),"imageUrlNumberMatches":matches,
         "imageSourceStatus":kind,"physicalKoreanNumberVerified":False,"candidateOverrideUrl":None}
 records.append(record)
assert len(records)==790, len(records)
broken=[x for x in records if x["imageSourceStatus"]=="broken_original"]
alive=[x for x in records if x["imageSourceStatus"]!="broken_original"]
assert len(broken)==12 and len(alive)==778
assert sum(bool(x["physicalKoreanNumberVerified"]) for x in records)==0
assert not any(x["code"] in repaired for x in records)
class Meta(HTMLParser):
 def __init__(self):
  super().__init__();self.meta=[];self.images=[];self.links=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=="meta" and (a.get("property","").startswith("og:") or a.get("name") in ["description","twitter:image"]):
   self.meta.append({"key":a.get("property") or a.get("name"),"value":a.get("content","")[:300]})
  elif tag=="img" and a.get("src"):self.images.append(a["src"])
  elif tag=="a" and a.get("href"):self.links.append(a["href"])
def site_check(item):
 src=item.get("referenceSource") or ""
 out={"code":item["code"],"source":src,"requested":False,"status":None,"responseHost":None,
      "metadata":[],"rawKoreanNumberInPage":False,"visibleOriginalImageCandidates":[],"error":None}
 if not src.startswith("https://"):return out
 allowed={"www.dogam.app","dogam.app","tcgbox.co.kr","k-tcgpanda.com","pokemoncard.co.kr","www.pokemoncard.co.kr"}
 if urlsplit(src).hostname not in allowed:return out
 try:
  r=requests.get(src,timeout=(6,13),headers={"User-Agent":"Mozilla/5.0 (Korean Card Binder Image Reference Audit)"},
   allow_redirects=True)
  out.update(requested=True,status=r.status_code,responseHost=urlsplit(r.url).hostname)
  if r.ok and len(r.content)<1500000:
   parser=Meta();parser.feed(r.text[:1000000])
   out["metadata"]=parser.meta[:8]
   out["rawKoreanNumberInPage"]=item["printedNumberExpected"] in r.text
   out["visibleOriginalImageCandidates"]=[u for u in parser.images if
      ("sm11b" in u.lower() or "sm12" in u.lower())][:8]
 except Exception as e:out["error"]=str(e)[:160]
 return out
with ThreadPoolExecutor(max_workers=8) as pool:
 lookup=list(pool.map(site_check,broken))
names=Counter(x["urlHost"] or "none" for x in alive)
byset={}
for code in sorted({x["set"].lower() for x in records}):
 rows=[x for x in records if x["set"].lower()==code]
 byset[code]={"held":len(rows),"sourceReachable":sum(x["imageSourceStatus"]!="broken_original" for x in rows),
  "broken":sum(x["imageSourceStatus"]=="broken_original" for x in rows),
  "sourceHashStable":sum(x["sourceHashStable"] for x in rows),
  "urlFilenameNumberMatched":sum(x["imageUrlNumberMatches"] for x in rows),
  "physicalKoreanPrintedNumberVerified":0}
# This is an observed cross-source disagreement, not authority to rewrite data:
# Korean-set listing says SM11b 073/049 is Lana's Fishing Rod. The old
# audit calls 073 '릴리에의 삐삐인형'. Both must be checked against an actual KR print.
conflicts=[]
for code,expected,label in [
 ("sm11b_073/049","수련의 낚싯대","Korean collector listing vs master"),
 ("sm11b_075/049","발전소","Korean collector listing uses alternate localized name"),
]:
 card=master.get(code)
 if card and card["name"]!=expected:
  conflicts.append({"code":code,"masterName":card["name"],"externalKoreanListingName":expected,
   "sourceName":label,
   "sourceURL":"https://collectory.cc/sets/28af28cd-edcb-4234-8291-aabb5bc11593?region=kr",
   "isConfirmedMasterError":False,
   "action":"Hold; inspect actual Korean printed card and distinguish translated product names."})
report={"schemaVersion":1,"date":"2026-10-22",
 "sourceBranch":"main","scope":"790 held Korean SM cards after seven independently footer-verified image recoveries",
 "totalRemainingHeld":790,"downloadableAndNumberUnverified":778,"stillMissing":12,
 "physicalPrintsVerifiedInThisPass":0,"remainingPrintedNumberUnverified":790,
 "sourceHostCounts":dict(names),"setSummaries":byset,
 "possibleNameConflicts":conflicts,
 "twelveMissingInfoSourceChecks":lookup,
 "cards":records,
 "safeguards":["No Japanese card images or name inference substituted for Korean printed-number verification.",
 "Filename number may match but must not be counted as Korean print verified.",
 "Previously repaired seven original image URLs are immutable.",
 "No user-owned Firestore, thematic dex memberships, card IDs, main or releases touched."],
 "next":"Open/verify physical Korean printed-number and name of 12 broken and flagged SM11b 073/049, then import only high-confidence original artwork sources. Audit 778 accessible third-party images in manageable contact-sheet slices for exact print confirmation."}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SM_790_CROSSSOURCE_REPORT",json.dumps({"remaining":790,"available":778,"missing":len(broken),"stableHashes":sum(x["sourceHashStable"] for x in alive),
 "numberInFilenameOnly":sum(x["imageUrlNumberMatches"] for x in alive),
 "perSet":byset,"conflicts":conflicts,
 "sourcePageSummary":[{"code":x["code"],"http":x["status"],"pageNumberPresent":x["rawKoreanNumberInPage"],
 "imageCandidates":len(x["visibleOriginalImageCandidates"])} for x in lookup]},ensure_ascii=False),flush=True)
