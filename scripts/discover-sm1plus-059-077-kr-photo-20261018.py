#!/usr/bin/env python3
"""READ ONLY. Find Korean SM1+ Dogam 059-077 card details, verify source photos.
Do not infer exact Korean card identity from official filenames SM1plus_059..077;
those are known to display different normal-card artworks.
"""
import base64,concurrent.futures,html,io,json,re,urllib.request
from bs4 import BeautifulSoup
from PIL import Image,ImageDraw
url="https://www.dogam.app/sets"
def get(u):
 req=urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0 (DCB-CardIdentityAudit; KoreanCardPreview)"})
 return urllib.request.urlopen(req,timeout=30).read()
home=get(url).decode("utf8","replace")
soup=BeautifulSoup(home,"html.parser")
matches=[(a.get_text(" ",strip=True),a.get("href")) for a in soup.select("a[href]")
 if "SM1+" in a.get_text(" ",strip=True) and "/sets/" in str(a.get("href"))]
print("SM1PLUS_SET_MATCHES",json.dumps(matches[:12],ensure_ascii=False),flush=True)
if len(matches)!=1:raise RuntimeError("Exactly one Korean SM1+ set page required")
seturl="https://www.dogam.app"+matches[0][1]
sethtml=get(seturl).decode("utf8","replace")
doc=BeautifulSoup(sethtml,"html.parser")
entries=[]
for a in doc.select("a[href]"):
 href=a.get("href","")
 if href.startswith(matches[0][1]+"/cards/"):
  label=a.get_text(" ",strip=True)
  entries.append({"url":"https://www.dogam.app"+href,"label":label})
print("SM1PLUS_SET",json.dumps({"url":seturl,"bytes":len(sethtml),"totalLinks":len(entries),"first":entries[:4],"last":entries[-6:]},ensure_ascii=False),flush=True)
lookup={}
for row in entries:
 match=re.search(r"(?<!\d)(\d{3})$",row["label"])
 if match:
  k=int(match.group(1));lookup.setdefault(k,[]).append(row)
print("SM1PLUS_LINK_NUMBERS",json.dumps({str(n):v for n,v in lookup.items() if 59<=n<=77},ensure_ascii=False),flush=True)
if not all(len(lookup.get(n,[]))==1 for n in range(59,78)):
 print("SM1PLUS_STOP_REASON","Not all 19 exact Korean app page hrefs resolved; do not update canonical imagery.")
 raise SystemExit(0)
def scan(n):
 row=lookup[n][0];url=row["url"]
 try:
  h=get(url).decode("utf8","replace")
  doc=BeautifulSoup(h,"html.parser")
  image=doc.select_one('meta[property="og:image"]')
  imageurl=html.unescape(image.get("content","")) if image else ""
  ttl=doc.select_one('meta[property="og:title"]')
  title=html.unescape(ttl.get("content","")) if ttl else (doc.title.get_text(" ",strip=True) if doc.title else "")
  if not re.match(r"^https://static\.tcgexchange\.kr/[0-9a-f]{32}\.(?:png|jpg|webp)$",imageurl):
   raise ValueError("unexpected OG image origin "+imageurl[:200])
  pic=get(imageurl)
  im=Image.open(io.BytesIO(pic)); im.load()
  if not 300<=im.width<=2500 or not 440<=im.height<=3500 or len(pic)<9000:
   raise ValueError("unusable full card photograph")
  if n<=68 and f"{n:03d}/051" not in h:
   raise ValueError("printed identifier not verified in Korean card detail")
  if n>=69 and ("No." not in title or f"{n:03d}" not in title):
   raise ValueError("unnumbered energy catalog ordinal not reflected in Korean app card")
  if "한글판" not in h: raise ValueError("not clearly Korean app record")
  return {"number":n,"status":"KR_app_exact_page_image_verified","label":row["label"],
    "page":url,"title":title,"image":imageurl,"bytes":len(pic),
    "width":im.width,"height":im.height,"printedNumberEvidence": "printed_exact" if n<=68 else "catalog_only_unnumbered_energy"},im.convert("RGB")
 except Exception as ex:
  return {"number":n,"status":"held","page":url,"error":str(ex)[:230]},None
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 results=list(pool.map(scan,range(59,78)))
records=[r for r,_ in results]
for r in records:print("SM1PLUS_CARD",json.dumps(r,ensure_ascii=False),flush=True)
print("SM1PLUS_DISCOVERY_SUMMARY",json.dumps({"matched":sum(x["status"].startswith("KR_app") for x in records),
 "held":sum(x["status"]=="held" for x in records),
 "set":seturl,"allUrls":{str(x["number"]):x.get("page") for x in records}},ensure_ascii=False),flush=True)
# Low-resolution visual index only for manual proof; no modifications to cards.
images=[(n,p) for (r,p),n in zip(results,range(59,78)) if p is not None]
if images:
 W,H=248,370
 canvas=Image.new("RGB",(5*W,4*H),"white");d=ImageDraw.Draw(canvas)
 for i,(n,im) in enumerate(images):
  im.thumbnail((W-13,319))
  x=(i%5)*W;y=(i//5)*H
  canvas.paste(im,(x+(W-im.width)//2,y+6))
  d.text((x+5,y+330),f"SM1+ {n:03d}/051",fill="black")
  d.text((x+5,y+349),records[n-59].get("title","")[:34],fill="black")
 buf=io.BytesIO();canvas.save(buf,"JPEG",quality=78,optimize=True)
 print("SM1PLUS_KOREAN_APP_CONTACT_SHEET_BASE64="+base64.b64encode(buf.getvalue()).decode("ascii"),flush=True)
