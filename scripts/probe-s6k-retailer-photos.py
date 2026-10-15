#!/usr/bin/env python3
"""Read-only Korean S6K high-rarity retailer catalogue photographic preflight.
Seller product titles and Japanese substitutions never count as Korean printed verification.
"""
from pathlib import Path
from io import BytesIO
from urllib.request import Request,urlopen
from urllib.parse import urljoin,urlparse
from PIL import Image,ImageDraw,ImageOps
from bs4 import BeautifulSoup
import base64,html,json,re,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s6K/korean-candidates/retailer"
OUT.mkdir(parents=True,exist_ok=True)
CAT="https://tcgbox.co.kr/category/s6k%EC%B9%A0%ED%9D%91%EC%9D%98-%EA%B0%80%EC%9D%B4%EC%8A%A4%ED%8A%B8/252"
DETAIL88="https://tcgbox.co.kr/product/%EA%B5%AD%ED%99%94hr-s6k-088/13091"
NUMBERS=list(range(88,96))
results={"schemaVersion":1,"set":"s6K","type":"retailer_photo_source_preflight","status":"not_identity_verified","catalog":CAT,"cards":[]}
def get(url,limit=2500000):
    request=Request(url,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36","Accept-Language":"ko-KR,ko;q=0.9,en;q=0.7"})
    with urlopen(request,timeout=22) as res:
        data=res.read(limit+1)
        if len(data)>limit:raise ValueError("oversize resource")
        return data
def load_html(url):
    data=get(url)
    return BeautifulSoup(data.decode("utf-8",errors="replace"),"html.parser")
try:
    page=load_html(CAT)
    results["catalogRead"]="decoded"
    catalog=[]
    for a in page.find_all("a",href=True):
        label=a.get_text(" ",strip=True)
        href=urljoin(CAT,a["href"])
        if "/product/" in href and re.search(r"s6[kK]\s*0(?:8[8-9]|9[0-5])",label):
            catalog.append((label,href))
    results["catalogListings"]=catalog[:70]
except Exception as e:
    results["catalogError"]=str(e)[:260]
    catalog=[]
canvas=Image.new("RGB",(4*318,2*445),(245,245,245))
draw=ImageDraw.Draw(canvas)
for i,n in enumerate(NUMBERS):
    row={"number":n,"code":f"s6k_{n:03d}/070","listing":"","status":"no_retailer_card_image_verified","attempts":[]}
    x=(i%4)*318;y=(i//4)*445
    draw.text((x+6,y+4),f"S6K {n} RETAILER CANDIDATE",fill=(15,15,15))
    matches=[(label,url) for label,url in catalog if re.search(rf"s6[kK]\s*0?{n}\b",label)]
    if n==88 and not matches:matches=[("국화HR (s6K 088)",DETAIL88)]
    for title,detail in matches[:2]:
        attempt={"listing":detail,"title":title}
        try:
            soup=load_html(detail)
            imgs=[]
            for m in soup.select('meta[property="og:image"],meta[name="twitter:image"]'):
                url=m.get("content")
                if url:imgs.append(url)
            for img in soup.select(".keyImg img, .thumbnail img, #prdDetail img, .xans-product-detail img"):
                u=img.get("data-src") or img.get("src") or img.get("data-original")
                if u:imgs.append(u)
            urls=[];seen=set()
            for u in imgs:
                u=html.unescape(u).replace("\\/","/")
                u=urljoin(detail,u)
                domain=urlparse(u).hostname or ""
                if not u.startswith("https://") or not (domain=="tcgbox.co.kr" or domain.endswith(".cafe24.com") or domain.endswith(".cafe24cdn.com")):continue
                if u not in seen:seen.add(u);urls.append(u)
            attempt["photoCandidates"]=urls[:8]
            for u in urls[:6]:
                try:
                    data=get(u,limit=4500000)
                    im=Image.open(BytesIO(data));im.load()
                    if im.width<200 or im.height<270:continue
                    rgb=ImageOps.exif_transpose(im.convert("RGB"))
                    preview=rgb.copy();preview.thumbnail((310,375))
                    canvas.paste(preview,(x+(318-preview.width)//2,y+28))
                    buff=BytesIO();rgb.save(buff,"WEBP",quality=86,method=6)
                    f=f"{n:03d}-retailer-source.webp.b64"
                    (OUT/f).write_text(base64.b64encode(buff.getvalue()).decode("ascii"),encoding="ascii")
                    row.update(status="retailer_photo_archived_await_print_language_review",
                               retailerImageUrl=u,listing=detail,title=title,evidenceFile=f,
                               sourceSize=[im.width,im.height],sha256=hashlib.sha256(data).hexdigest())
                    break
                except Exception as e:attempt.setdefault("photoErrors",[]).append(str(e)[:100])
            row["attempts"].append(attempt)
        except Exception as e:attempt["error"]=str(e)[:220];row["attempts"].append(attempt)
        if row.get("evidenceFile"):break
    if not row.get("evidenceFile"):draw.text((x+10,y+193),"NO CONFIRMED PHOTO",fill=(20,20,20))
    results["cards"].append(row)
buf=BytesIO();canvas.save(buf,"WEBP",quality=81)
(OUT/"retailer-contact.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode("ascii"),encoding="ascii")
(OUT/"retailer-index.json").write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"catalog":results.get("catalogRead","error"),"catalogItems":len(catalog),"photos":[c["number"] for c in results["cards"] if c.get("evidenceFile")],"errors":results.get("catalogError","")},ensure_ascii=False))
