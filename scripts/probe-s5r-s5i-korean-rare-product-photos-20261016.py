#!/usr/bin/env python3
"""Candidate-only audit of Korean retailer card listing photos and possible official prints.
Never mutate card sources, card IDs, ownership, or themes; only archive forensic evidence.
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import Request,urlopen
from collections import Counter
from PIL import Image,ImageDraw,ImageOps
from bs4 import BeautifulSoup
import json,base64,re,time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s5r-s5i-korean-rare-candidates-20261016"
OUT.mkdir(parents=True,exist_ok=True)
HOLDS=json.loads((ROOT/"data/audits/theme-s5r-s5i-082-091-Japanese-image-holds-20261016.json").read_text(encoding="utf8"))
assert HOLDS["status"]=="pending_Korean_image_provenance"
HEADERS={"User-Agent":"Mozilla/5.0 (compatible; DCB/1.0; historical Korean card source verification)"}
ALLOW={"tcgbox.co.kr","m.tcgbox.co.kr","www.tcgbox.co.kr",
       "img.echosting.cafe24.com","ecimg.cafe24img.com",
       "cards.image.pokemonkorea.co.kr","pokemoncard.co.kr"}

def get(url,maxbytes=6_000_000):
 s=urlsplit(url)
 if s.scheme!="https" or s.hostname not in ALLOW:
  raise ValueError("Unapproved source host: "+str(s.hostname))
 with urlopen(Request(url,headers=HEADERS),timeout=25) as q:
  b=q.read(maxbytes+1)
  if not 100<=len(b)<=maxbytes:raise ValueError("Content size outside allowed range")
  return b,q.headers.get("Content-Type",""),q.geturl()

def candidate_urls(html,page):
 soup=BeautifulSoup(html,"html.parser")
 urls=[]
 def add(path,tag):
  if not path:return
  url=urljoin(page,str(path).strip())
  if urlsplit(url).hostname in ALLOW and urlsplit(url).scheme=="https":
   if url not in [x[0] for x in urls]:urls.append((url,tag))
 for meta in soup.find_all("meta"):
  if meta.get("property") in ("og:image","twitter:image"):
   add(meta.get("content"),"meta")
 for img in soup.find_all("img"):
  ident=((img.get("id") or "")+" "+(img.get("class") and " ".join(img.get("class")) or "")).lower()
  parent=img.parent
  context=((parent.get("class") and " ".join(parent.get("class")) or "") if parent else "").lower()
  srcs=[img.get(a) for a in ("data-original","data-src","data-image","src")]
  for src in srcs:
   if not src:continue
   if any(x in src.lower() for x in ("/web/product/big/","/web/product/medium/","/web/product/tiny/","/web/product/small/")) or any(x in ident+" "+context for x in ("bigimage","keyimg","thumbnail","prdimg")):
    add(src,"product_img")
 return urls[:40]

def fetch_one(info):
 setcode,n=info
 base=12764 if setcode=="s5r" else 12673
 product_no=base+n-82
 page=f"https://tcgbox.co.kr/product/detail.html?product_no={product_no}"
 report={"set":setcode,"number":n,"productNoGuess":product_no,"url":page,"status":"pending","candidateImages":[]}
 photos=[]
 try:
  raw,ct,final=get(page)
  if "html" not in ct.lower() and b"<html" not in raw[:2000]:
   raise ValueError("Not a product page")
  html=raw.decode("utf-8","replace")
  soup=BeautifulSoup(html,"html.parser")
  t=soup.title.get_text(" ",strip=True) if soup.title else ""
  report["pageTitle"]=t[:250]
  report["titleHasExpectedNumber"]=str(n) in t
  report["titleHasCorrectSet"]=setcode[2:] in t.lower() and "s5" in t.lower()
  report["pageUrlResolved"]=final
  cands=candidate_urls(html,page)
  report["candidateImageUrlCount"]=len(cands)
  for url,kind in cands[:15]:
   c={"url":url,"selector":kind,"status":"pending"}
   try:
    data,mime,_=get(url)
    im=Image.open(BytesIO(data))
    im.load()
    c.update(status="decoded",format=im.format,dimensions=[im.width,im.height],
             hash=sha256(data).hexdigest(),mime=mime)
    # Avoid tiny badge/logo and non-card aspect ratio
    ratio=im.width/im.height
    if im.width>=180 and im.height>=240 and .48<=ratio<=.95:
     c["cardLike"]=True
     photo=ImageOps.exif_transpose(im).convert("RGB")
     photo.thumbnail((207,290))
     photos.append((photo,url,im.width*im.height))
    else:c["cardLike"]=False
   except Exception as e:c.update(status="unavailable",reason=str(e)[:140])
   report["candidateImages"].append(c)
  if photos:
   photos.sort(key=lambda q:q[2],reverse=True)
   report.update(status="candidate_photo_decoded",selectedImage=photos[0][1])
  else:report["status"]="product_found_no_valid_card_photo"
 except Exception as e:
  report.update(status="page_unavailable",error=str(e)[:250])
 return report,photos[0][0] if photos else None

def official_check(setcode,n):
 # strict only Pokemon Korea first party, no assumptions about source existence
 path=f"/data/wmimages/S/S5/{setcode.upper()}_{n:03d}"
 out=[]
 for ext in (".png",".jpg"):
  url="https://cards.image.pokemonkorea.co.kr"+path+ext
  item={"url":url,"status":"missing"}
  try:
   b,ct,_=get(url,6_000_000)
   im=Image.open(BytesIO(b));im.load()
   if im.width>=150 and im.height>=200:
    item.update(status="decoded",dimensions=[im.width,im.height],sha256=sha256(b).hexdigest())
  except Exception as e:item["reason"]=str(e)[:120]
  out.append(item)
 return out

keys=[(s,n) for s in ("s5r","s5i") for n in range(82,92)]
assert len(keys)==20
for s,n in keys:
 assert HOLDS["foreignSourceHolds"][s]["cards"][n-82]["canonicalOrder"]==n
with ThreadPoolExecutor(max_workers=5) as pool:
 found=list(pool.map(fetch_one,keys))
with ThreadPoolExecutor(max_workers=8) as pool:
 official=list(pool.map(lambda x:official_check(*x),keys))
canvas=Image.new("RGB",(5*252,4*363),(248,248,248))
draw=ImageDraw.Draw(canvas)
records=[]
for i,((s,n),(rec,photo),office) in enumerate(zip(keys,found,official)):
 x,y=(i%5)*252,(i//5)*363
 rec["officialPokemonKoreaDirectCandidateChecks"]=office
 if photo is not None:
  canvas.paste(photo,(x+(252-photo.width)//2,y+2))
 else:
  draw.text((x+10,y+130),"NO CARD PHOTO",fill=(120,20,20))
 draw.rectangle((x+2,y+2,x+247,y+358),outline=(105,105,105),width=2)
 draw.text((x+7,y+295),f"{s.upper()} {n:03d}  {rec['status'][:19]}",fill=(20,20,20))
 draw.text((x+7,y+320),str(rec.get("productNoGuess")),fill=(20,20,20))
 draw.text((x+7,y+339),"LANGUAGE UNVERIFIED",fill=(155,20,20))
 records.append(rec)
out=BytesIO();canvas.save(out,format="WEBP",quality=82)
(OUT/"tcgbox-20-candidate-contact-sheet.webp.b64").write_text(base64.b64encode(out.getvalue()).decode("ascii"),encoding="ascii")
report={"schemaVersion":1,"recordedAt":"2026-10-16","purpose":"Find candidate Korean retail photographs for 20 S5R/S5I 082-091 Japanese source holds",
 "method":"Retail product card numbers and high resolution card-like image candidates; no Korean print authenticity assumed from listing title or source CDN.",
 "source":"tcgbox.co.kr","cardCount":20,"cardLikeCandidateCount":sum(x["status"]=="candidate_photo_decoded" for x in records),
 "officialDirectDecodedCount":sum(any(t["status"]=="decoded" for t in x["officialPokemonKoreaDirectCandidateChecks"]) for x in records),
 "contactSheet":"tcgbox-20-candidate-contact-sheet.webp.b64",
 "originalJapaneseHoldsUnchanged":True,"koreanArtworkVerifiedCount":0,"masterOrThemeFilesChanged":False,"cards":records}
(OUT/"retailer-candidate-audit.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({k:v for k,v in report.items() if k!="cards"},ensure_ascii=False))
