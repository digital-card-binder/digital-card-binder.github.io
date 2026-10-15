#!/usr/bin/env python3
"""Collect catalogued Korean S6K 088-095 retailer card images; do NOT mark Korean-print verified."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urljoin,urlparse
from io import BytesIO
from PIL import Image,ImageOps,ImageDraw
import re,json,base64,hashlib,html
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s6K/tcgbox-088-095"
OUT.mkdir(parents=True,exist_ok=True)
NUMBERS={88:"국화",89:"니아",90:"즈미",91:"카틀레야",92:"붐볼",93:"안개의 수정",94:"메아리호른",95:"기본 초 에너지"}
CATEGORY="https://tcgbox.co.kr/category/s6k%EC%B9%A0%ED%9D%91%EC%9D%98-%EA%B0%80%EC%9D%B4%EC%8A%A4%ED%8A%B8/252"
def fetch(url,maxsize=5500000):
  req=Request(url,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36","Accept-Language":"ko-KR,ko;q=0.9"})
  with urlopen(req,timeout=24) as resp:
    content=resp.read(maxsize+1)
    if len(content)>maxsize:raise ValueError("large response")
    return content
def clean(v):return html.unescape(v).replace("&amp;","&").replace("\\/","/")
def imageurls(page):
  page=clean(page)
  urls=[]
  for tag in re.findall(r"<(?:meta|img|a)\b[^>]+>",page,re.I):
    if not re.search(r'og:image|twitter:image|keyImg|prdImg|big_img|product_detail|data-src|zoom|product_image|thumbnail',tag,re.I):continue
    for match in re.findall(r'(?:content|src|data-src|href)=["\x27]([^"\x27]+)',tag,re.I):
      u=urljoin("https://tcgbox.co.kr",clean(match))
      if u.startswith("https://") and urlparse(u).hostname not in ("img.echosting.cafe24.com",):urls.append(u)
  for u in re.findall(r'(?:https?:)?//(?:[^"<> ]+?)(?:[.]jpg|[.]jpeg|[.]png|[.]webp)',page,re.I):
    urls.append(urljoin("https:",clean(u)))
  dedup=[];seen=set()
  for u in urls:
    u=u.split("?")[0]
    if u in seen:continue
    seen.add(u);dedup.append(u)
  return dedup[:20]
page=fetch(CATEGORY).decode("utf-8","replace")
rows=[];canvas=Image.new("RGB",(4*290,2*490),(246,246,246));pen=ImageDraw.Draw(canvas)
for idx,(num,name) in enumerate(NUMBERS.items()):
  x=(idx%4)*290;y=(idx//4)*490
  pen.text((x+5,y+5),f"S6K {num:03d} {name}",fill=(20,20,20))
  m=re.search(r'<a[^>]+href=["\x27]([^"\x27]+)["\x27][^>]*>[^<]*[^<]*(?:<[^>]+>)*[^<]*'+re.escape(name),page,re.I)
  links=re.findall(r'href=["\x27]([^"\x27]+(?:/product/[^"\x27]+|/product/detail[.]html[^"\x27]+))["\x27]',page,re.I)
  pageurls=[]
  for link in links:
    url=urljoin(CATEGORY,clean(link))
    if f"s6k-{num}" in url.lower() or f"s6k%20{num}" in url.lower():pageurls.append(url)
  # TCGBOX catalog identifiers 13091..13098 correspond exactly to s6K 088..095.
  pageurls.insert(0,"https://tcgbox.co.kr/product/detail.html?product_no="+str(num+13003))
  result={"number":num,"name":name,"code":f"s6k_{num:03d}/070","candidateStatus":"not_collected","productPages":list(dict.fromkeys(pageurls)),"attempts":[]}
  for product in result["productPages"][:3]:
    try:
      document=fetch(product).decode("utf-8","replace")
      info={"page":product,"imageUrls":imageurls(document)[:14]}
      for url in info["imageUrls"]:
        try:
          blob=fetch(url)
          im=Image.open(BytesIO(blob));im.load()
          if im.width<180 or im.height<250 or im.width/im.height>1.5:continue
          info.update(candidate=url,dimensions=[im.width,im.height],sha256=hashlib.sha256(blob).hexdigest())
          thumb=ImageOps.exif_transpose(im).convert("RGB");thumb.thumbnail((274,425))
          canvas.paste(thumb,(x+(290-thumb.width)//2,y+31))
          result.update(candidateStatus="retailer_image_collected_requires_Korean_number_visual_review",candidateUrl=url,sourcePage=product,dimensions=[im.width,im.height])
          binary=BytesIO();ImageOps.exif_transpose(im).save(binary,"WEBP",quality=88)
          (OUT/f"{num:03d}-candidate.webp.b64").write_text(base64.b64encode(binary.getvalue()).decode("ascii"))
          break
        except Exception as ex:info.setdefault("errors",[]).append(str(ex)[:120])
      result["attempts"].append(info)
      if result.get("candidateUrl"):break
    except Exception as ex:result["attempts"].append({"page":product,"error":str(ex)[:240]})
  if not result.get("candidateUrl"):pen.text((x+20,y+200),"NO VALID IMAGE YET",fill=(10,10,10))
  rows.append(result)
output=BytesIO();canvas.save(output,"WEBP",quality=84)
(OUT/"contact.webp.b64").write_text(base64.b64encode(output.getvalue()).decode("ascii"))
(OUT/"index.json").write_text(json.dumps({"set":"s6K","range":"088-095","status":"image_candidates_only_NO_completion","cards":rows},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"found":[r["number"] for r in rows if r.get("candidateUrl")],"missing":[r["number"] for r in rows if not r.get("candidateUrl")]},ensure_ascii=False))
