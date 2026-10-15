#!/usr/bin/env python3
"""Collect sourced Korean s7D rainbow rare-card candidates; never alter live catalog."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlsplit
from io import BytesIO
from html.parser import HTMLParser
from PIL import Image, ImageDraw
import json, base64, hashlib, re

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s7d/korean-candidates"
ASSETS=ROOT/"assets/cards/s7d-korean-rare"
OUT.mkdir(parents=True,exist_ok=True);ASSETS.mkdir(parents=True,exist_ok=True)
TARGET={80:"루가루암 VMAX",81:"더스트나 VMAX",82:"두랄루돈 VMAX"}
UA={"User-Agent":"Mozilla/5.0 (compatible; DCB-Korean-Print-Provenance/1.0)"}
MAX_BYTES=5_000_000

def download(url):
    if not url.startswith("https://"):raise ValueError("Only HTTPS source supported")
    with urlopen(Request(url,headers=UA),timeout=15) as resp:
        blob=resp.read(MAX_BYTES+1)
        if len(blob)>MAX_BYTES:raise ValueError("Too many bytes")
        return blob,resp.headers.get("Content-Type","")
def save_img(number,url,blob,label):
    try:
        im=Image.open(BytesIO(blob)).convert("RGB")
        if im.width<220 or im.height<250:raise ValueError("Image too small")
        if im.width/im.height>1.4:raise ValueError("Banner/uncropped listing, skip")
        out=ASSETS/(f"{number}-{label}.webp")
        im.thumbnail((700,950))
        im.save(out,"WEBP",quality=92)
        return {"number":number,"name":TARGET[number],"source":url,"ownedPath":str(out.relative_to(ROOT)),
                "dimensions":[im.width,im.height],"sha256":hashlib.sha256(blob).hexdigest(),
                "status":"candidate_requires_visual_Korean_print_verification"}
    except Exception as e:
        return {"number":number,"source":url,"status":"rejected_source_image","reason":str(e)[:200]}
logs=[];candidates=[]
urls={}
for n in TARGET:
    v=f"S7D_{n:03d}"
    urls[n]=[
       f"https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S7/{v}.png",
       f"https://tcgbox.co.kr/web/product/big/S7D/{v}.jpg",
       f"https://tcgbox.co.kr/web/product/small/S7D/{v}.jpg",
       f"https://tcgbox.co.kr/web/product/big/s7D/{v}.jpg",
       f"https://tcgbox.co.kr/web/product/big/S7D/{v}.png",
    ]
for n in TARGET:
 for i,url in enumerate(urls[n]):
    try:
      blob,ctype=download(url)
      candidate=save_img(n,url,blob,f"direct{i}")
      logs.append({"number":n,"url":url,"http":"200","bytes":len(blob),"contentType":ctype,"result":candidate["status"]})
      if candidate["status"].startswith("candidate"):candidates.append(candidate)
    except Exception as e:logs.append({"number":n,"url":url,"error":str(e)[:220]})

# Only search the retailer's own product links if the listing is accessible.
category="https://tcgbox.co.kr/category/s7d-%EB%A7%88%EC%B2%9C%ED%8D%BC%ED%8E%99%ED%8A%B8/266/?cate_no=266&sort_method=7"
class Anchors(HTMLParser):
 def __init__(self):super().__init__();self.href=None;self.results=[]
 def handle_starttag(self,tag,attrs):
  if tag=="a":self.href=dict(attrs).get("href")
 def handle_endtag(self,tag):
  if tag=="a":self.href=None
 def handle_data(self,data):
  if self.href and re.search(r"s7d\s*0(?:80|81|82)",data,re.I):
   self.results.append((data.strip(),urljoin(category,self.href)))
try:
 listing,_=download(category)
 parser=Anchors();parser.feed(listing.decode("utf-8","replace"))
 matches=list(dict(parser.results).items())
 logs.append({"listing":category,"linkMatches":matches[:20]})
 for text,url in matches[:9]:
  n=int(re.search(r"s7d\s*(08[012])",text,re.I).group(1))
  try:
   body,_=download(url)
   # Product HTML source uses image tags; gather only actual product high-resolution URLs.
   content=body.decode("utf-8","replace")
   imgs=re.findall(r'(?:src|data-src)\s*=\s*["\']([^"\']+\.(?:jpe?g|png|webp)(?:\?[^"\']*)?)["\']',content,re.I)
   good=[urljoin(url,i) for i in imgs if any(k in i.lower() for k in ("product/big","product/extra","product/medium"))]
   for i,imgurl in enumerate(dict.fromkeys(good[:5])):
    try:
     blob,_=download(imgurl);v=save_img(n,imgurl,blob,f"retailer{i}")
     logs.append({"number":n,"retailerProduct":url,"image":imgurl,"result":v["status"]})
     if v["status"].startswith("candidate"):candidates.append(v)
    except Exception as e:logs.append({"number":n,"image":imgurl,"error":str(e)[:180]})
  except Exception as e:logs.append({"number":n,"retailerProduct":url,"error":str(e)[:180]})
except Exception as e:logs.append({"listing":category,"error":str(e)[:200]})

canvas=Image.new("RGB",(3*235,max(1,(len(candidates)+2)//3)*355),(240,240,240))
draw=ImageDraw.Draw(canvas)
for i,entry in enumerate(candidates):
 im=Image.open(ROOT/entry["ownedPath"]);im.thumbnail((215,300))
 x=(i%3)*235;y=(i//3)*355;canvas.paste(im,(x+10,y+18))
 draw.text((x+5,y+3),f"S7D {entry['number']} candidate {i}",fill=(10,10,10))
out=BytesIO();canvas.save(out,"WEBP",quality=85)
(OUT/"contact.webp.b64").write_text(base64.b64encode(out.getvalue()).decode())
(OUT/"candidates.json").write_text(json.dumps({"set":"s7D","held":[80,81,82],"status":"candidate_collection_only_not_korean_verified",
 "candidates":candidates,"probes":logs},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"candidates":len(candidates),"numbers":sorted(set(x["number"] for x in candidates)),
 "successUrls":[x["source"] for x in candidates],"failures":len([x for x in logs if "error" in x])},ensure_ascii=False))
