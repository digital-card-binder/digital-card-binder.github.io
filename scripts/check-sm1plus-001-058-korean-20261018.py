#!/usr/bin/env python3
"""READ ONLY - resume Korean SM1+ 001-058 printed-ID verification, no artwork retesting.
Compare each Korean Dogam numbered card page, Korean artwork, and DCB published
archive. Preserve previous 58 artwork/theme results and the resolved 059-077.
"""
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from urllib.request import Request, urlopen
from io import BytesIO
from PIL import Image, ImageChops, ImageStat
from bs4 import BeautifulSoup
import hashlib, html, json, re, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
SET="https://www.dogam.app/sets/01KW0QNGGZKR1GPQ1DQ55B39MN"
CARD_SET="SM1+"
LIMIT=58
def get(url):
 req=Request(url,headers={"User-Agent":"Mozilla/5.0 (DCB exact Korean print-number audit)","Cache-Control":"no-cache"})
 with urlopen(req,timeout=32) as r: return r.read(6_000_000)
def scan_image(raw):
 p=Image.open(BytesIO(raw));p.load()
 if p.width<250 or p.height<330 or not .65<p.width/p.height<.77:raise ValueError("Bad card pixels "+str(p.size))
 return p.convert("RGB")
def mean_diff(a,b):
 a=a.resize((160,225),Image.Resampling.LANCZOS)
 b=b.resize((160,225),Image.Resampling.LANCZOS)
 return round(sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3,3)
groups=json.loads((ROOT/"data/series.json").read_text(encoding="utf8"))
g=[x for x in groups if str(x.get("code","")).lower()=="sm1+"]
assert len(g)==1 and len(g[0]["cards"])==77
cards=g[0]["cards"]
assert len(set(c["code"] for c in cards))==77
prior1=json.loads((ROOT/"data/audits/theme-sm1plus-001-030-Korean-art-12theme-review-20261017.json").read_text(encoding="utf8"))
prior2=json.loads((ROOT/"data/audits/theme-sm1plus-031-058-Korean-art-12theme-review-20261017.json").read_text(encoding="utf8"))
assert prior1["artworksVisuallyReviewed"]==30 and prior2["artworksVisuallyReviewed"]==28
assert prior1["numberOnIndividualCardVerifiedCount"]==0 and prior2["collectionNumberHighResolutionVerifiedCount"]==0
document=BeautifulSoup(get(SET).decode("utf8","replace"),"html.parser")
links={}
for a in document.select("a[href]"):
 href=a.get("href",""); label=a.get_text(" ",strip=True)
 m=re.search(r"(?<!\d)(\d{3})$",label)
 if not m or not href.startswith("/sets/01KW0QNGGZKR1GPQ1DQ55B39MN/cards/"):continue
 n=int(m.group(1))
 if 1<=n<=LIMIT: links.setdefault(n,[]).append({"label":label,"page":"https://www.dogam.app"+href})
assert len(links)==58 and all(len(links[n])==1 for n in range(1,59))
def norm(s):
 s=re.sub(r"\bNo\.?\s*","",s,flags=re.I)
 return re.sub(r"\s+","",s).lower()
def inspect(n):
 c=cards[n-1];code=f"sm1plus_{n:03d}/051"
 if c["code"].lower()!=code:raise RuntimeError("Master code mismatch: "+code)
 item=links[n][0]
 appName=re.sub(r"\s+\d{3}$","",item["label"]).strip()
 row={"number":n,"code":code,"masterName":c["name"],"appName":appName,"appPage":item["page"],
      "existingImage":c["image"],"existingSource":c.get("source","")}
 if norm(appName)!=norm(c["name"]):
  row.update(status="held_identity_name_mismatch",error="Master vs Korean app card name mismatch")
  return row
 try:
  page=BeautifulSoup(get(item["page"]).decode("utf8","replace"),"html.parser")
  title=page.select_one('meta[property="og:title"]')
  title=html.unescape(title.get("content","")) if title else ""
  og=page.select_one('meta[property="og:image"]')
  imageurl=html.unescape(og.get("content","")) if og else ""
  row["title"]=title;row["appImage"]=imageurl
  if "한글판" not in title or f"{n:03d}" not in title:
   raise ValueError("No numbered Korean app card title")
  if not re.fullmatch(r"https://static\.tcgexchange\.kr/[a-f0-9]{32}\.(?:png|jpg|webp)",imageurl):
   raise ValueError("Unexpected image origin")
  img=scan_image(get(imageurl))
  ownurl="https://dcb-card-images-legacy-2026.pages.dev/data/wmimages/SM/SM1+/SM1plus_"+f"{n:03d}"+".webp"
  own=scan_image(get(ownurl))
  row["ownedUrl"]=ownurl
  row["appImageSize"]=[img.width,img.height]
  row["ownedImageSize"]=[own.width,own.height]
  row["pixelDifference"]=mean_diff(img,own)
  row["artworkNearMatch"]=row["pixelDifference"]<20
  row["status"]="exact_Korean_app_catalog_identity_plus_owned_pixels" if row["artworkNearMatch"] else "held_pixels_differ_review_needed"
 except Exception as exc:
  row.update(status="held_image_or_page_error",error=str(exc)[:200])
 return row
with ThreadPoolExecutor(max_workers=8) as pool:
 rows=list(pool.map(inspect,range(1,59)))
for x in rows:print("SM1PLUS_BASE_CARD",json.dumps(x,ensure_ascii=False),flush=True)
cnt=Counter(x["status"] for x in rows)
print("SM1PLUS_001_058_SUMMARY",json.dumps({"checked":len(rows),"status":dict(cnt),
 "identityAndNearMatch":cnt.get("exact_Korean_app_catalog_identity_plus_owned_pixels",0),
 "held":[{"number":x["number"],"name":x["masterName"],"status":x["status"],"error":x.get("error"),"difference":x.get("pixelDifference")} for x in rows if x["status"]!="exact_Korean_app_catalog_identity_plus_owned_pixels"],
 "policy":"Read-only candidate matching; no claims of physical footer number visibility from app catalog text alone."},ensure_ascii=False),flush=True)
