#!/usr/bin/env python3
"""Read-only nine pending M/SV set image audit. Network allowlist: owned DCB Cloudflare hosts only.
This measures archive existence, NOT Korean regional/card identity. Existing data untouched."""
from pathlib import Path
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from PIL import Image,ImageDraw
import base64,json,os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-nine-sets-owned-image-20261013"
OUT.mkdir(parents=True,exist_ok=True)
CODES={"M-P":68,"CLL":34,"CLK":34,"CLF":34,"SV-P":248,"SVAM":25,"SVEL":21,"SVEM":21,"SVG":55}
ALLOWED={"dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"}
def read(p):return json.loads((ROOT/p).read_text(encoding="utf-8"))
def fnv64(s):
 h=0xcbf29ce484222325
 for char in s:
  h^=ord(char);h=h*0x100000001b3&0xffffffffffffffff
 return f"{h:016x}"
def to_own_cdn(src):
 if not src:return ""
 u=urlsplit(src)
 if u.scheme!="https" or not u.hostname:return ""
 if u.hostname in ALLOWED:return f"https://{u.hostname}{u.path}"
 base=f"{u.scheme}://{u.netloc}{u.path}"
 if u.hostname=="cards.image.pokemonkorea.co.kr":
  p=u.path.lstrip("/")
  root=p.split("/")[2].upper() if p.startswith("data/wmimages/") else ""
  host="modern" if root in {"MEGA","S","SV"} else "legacy"
  return f"https://dcb-card-images-{host}-2026.pages.dev/{p.rsplit('.',1)[0]}.webp"
 return f"https://dcb-card-images-legacy-2026.pages.dev/external/{u.hostname}/{fnv64(base)}.webp"
masters=read("data/series.json")+read("data/series-legacy.json")
themes=read("data/art-themes.json")
existing={}
for group in themes.get("groups",[]):
 for card in group.get("cards",[]):
  setcode=str(card.get("set") or "").upper()
  key=str(card.get("code") or "").upper()
  if setcode in CODES or any(key.startswith(c+"_") for c in CODES):
   existing.setdefault(key,[]).append(group.get("code"))
to_check=[]
for sc,expected in CODES.items():
 sets=[s for s in masters if str(s.get("code","")).upper()==sc]
 assert len(sets)==1 and len(sets[0].get("cards",[]))==expected,(sc,len(sets),len(sets[0].get("cards",[])) if sets else 0)
 s=sets[0]
 for n,c in enumerate(s["cards"],1):
  raw=c.get("sourceImage") or c.get("image") or ""
  path=to_own_cdn(raw)
  sourceHost=urlsplit(raw).hostname or ""
  to_check.append({"set":sc,"canonicalOrder":n,"masterCode":c.get("code",""),
   "koreanMasterName":c.get("name") or "","sourceHost":sourceHost,
   "archivedSourceProvenance":raw,"ownedCdnUrl":path,
   "previousThemes":sorted(set(existing.get(str(c.get("code","")).split("/")[0].split(" ")[0].upper(),[])))})
assert len(to_check)==540,len(to_check)
def check(c):
 u=c["ownedCdnUrl"];im=None
 status={"status":"pending","http":None}
 try:
  parts=urlsplit(u)
  assert parts.scheme=="https" and parts.hostname in ALLOWED, "not own CDN"
  with urlopen(Request(u,headers={"User-Agent":"DCB-Owned-Cdn-ArchiveIntegrity/1.0"}),timeout=17) as response:
   data=response.read(2_500_000)
   status["http"]=response.status
  im=Image.open(BytesIO(data));im.load()
  status.update({"status":"decoded","bytes":len(data),"format":im.format,
   "dimensions":[im.width,im.height]})
  im=im.convert("RGB");im.thumbnail((217,300))
 except Exception as err:status.update({"status":"missing_or_invalid","reason":str(err)[:170]})
 return c["set"],c["canonicalOrder"],status,im
returned={}
with ThreadPoolExecutor(max_workers=18) as pool:
 for future in as_completed([pool.submit(check,c) for c in to_check]):
  s,n,checkResult,im=future.result()
  returned[(s,n)]=(checkResult,im)
summary={"schemaVersion":1,"recordedAt":"2026-10-13",
 "title":"Nine previously incomplete Korean M/SV sets: self-hosted card image binary audit",
 "policy":{"allowedDownloadHosts":sorted(ALLOWED),"thirdPartyOriginImageRequests":0,
 "archiveDecodeIsNotKoreanPrintIdentityProof":True,
 "noMasterThemeOwnershipFilesChanged":True,
 "noCompletedCardReviewInvalidated":True,
 "imageOnlyRead":"All card images fetched exclusively from DCB-owned CDN"},
 "totalExpectedCards":540,"totalDecoded":0,"totalMissing":0,"sets":{}}
for sc,expected in CODES.items():
 subset=[x for x in to_check if x["set"]==sc]
 decoded=sum(returned[(sc,i)] [0]["status"]=="decoded" for i in range(1,expected+1))
 sheets=[]
 d=OUT/sc;d.mkdir(exist_ok=True)
 for start in range(0,expected,15):
  sheet=Image.new("RGB",(1220,1104),(241,241,241));draw=ImageDraw.Draw(sheet)
  for j,c in enumerate(subset[start:start+15]):
   checkResult,im=returned[(sc,c["canonicalOrder"])]
   x=j%5*244;y=j//5*368
   draw.rectangle((x+2,y+2,x+240,y+365),outline=(185,185,185),width=2)
   if im:sheet.paste(im,(x+(244-im.width)//2,y+6))
   else:draw.text((x+7,y+150),"OWN CDN NOT AVAILABLE",fill=(30,30,30))
   draw.text((x+7,y+317),f'{c["canonicalOrder"]}: {c["koreanMasterName"][:17]}',fill=(10,10,10))
   draw.text((x+7,y+340),str(c["masterCode"])[:24]+" "+checkResult["status"],fill=(10,10,10))
  out=BytesIO();sheet.save(out,format="WEBP",quality=75)
  file=f"{sc}-{start//15+1:02d}.webp.b64"
  (d/file).write_text(base64.b64encode(out.getvalue()).decode("ascii"),encoding="ascii")
  sheets.append({"file":file,"canonicalStart":start+1,"canonicalEnd":min(expected,start+15)})
 records=[{**c,"imageCheck":returned[(sc,c["canonicalOrder"])][0]} for c in subset]
 report={"schemaVersion":1,"recordedAt":"2026-10-13","set":sc,
  "expectedCanonicalCards":expected,"ownedCdnBinaryDecoded":decoded,
  "ownedCdnBinaryUnavailable":expected-decoded,"missingKoreanMasterNames":sum(not c["koreanMasterName"] for c in subset),
  "sourceHosts":dict(Counter(c["sourceHost"] for c in subset)),
  "note":"Binary decode alone does NOT verify Korean language/print. Region, authenticity and 12-theme artwork classification remain separate checks.",
  "cards":records,"sheets":sheets}
 (d/"visual-index.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 summary["sets"][sc]={"expected":expected,"decoded":decoded,"missing":expected-decoded,
  "missingNames":report["missingKoreanMasterNames"],"sourceHosts":report["sourceHosts"],
  "evidenceIndex":f"data/audits/theme-nine-sets-owned-image-20261013/{sc}/visual-index.json",
  "sheets":len(sheets)}
 summary["totalDecoded"]+=decoded
 summary["totalMissing"]+=expected-decoded
(OUT/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps(summary,ensure_ascii=False))
