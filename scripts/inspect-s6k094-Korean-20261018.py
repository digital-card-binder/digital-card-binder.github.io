#!/usr/bin/env python3
"""Read-only S6K 094 Korean print photo lead inspection, no catalog writes."""
import base64,io,json,re,urllib.parse,urllib.request
from bs4 import BeautifulSoup
from PIL import Image,ImageOps,ImageDraw
PAGES=[
 ("TCGBOX_KR_094","https://tcgbox.co.kr/product/detail.html?product_no=13097"),
 ("PANDA_KR_094","https://k-tcgpanda.com/cardpage.php?cardblock=s6K&cardname=%EB%A9%94%EC%95%84%EB%A6%AC%ED%98%B8%EB%A5%B8&cardnum=094")
]
out=[]
images=[]
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0","Referer":url})
 return urllib.request.urlopen(req,timeout=35).read()
for id,url in PAGES:
 try:
  html=get(url).decode("utf-8","replace")
  soup=BeautifulSoup(html,"html.parser")
  h=[x for x in soup.find_all("img") if x.get("src")]
  candidates=[]
  for img in h:
   src=urllib.parse.urljoin(url,img.get("data-src") or img.get("src"))
   alt=img.get("alt","")
   meta=img.get("id","")+" "+(" ".join(img.get("class",[])))+" "+alt
   score=sum(w in src.lower()+" "+meta.lower() for w in ["094","13097","big","detail","zoom","main","item","product","image","goods","card"])
   if src.startswith("https://") and (score>1 or "094" in src or "13097" in src):
    candidates.append((score,src,meta[:70]))
  candidates=sorted(set(candidates),reverse=True)
  print("S6K094_PAGE",json.dumps({"id":id,"status":"ok","bytes":len(html),"title":soup.title.get_text(" ",strip=True) if soup.title else "",
    "firstImgCandidates":candidates[:20]},ensure_ascii=False))
  for score,imgUrl,meta in candidates[:8]:
   try:
    blob=get(imgUrl); im=Image.open(io.BytesIO(blob));im.load()
    if im.width<200 or im.height<250 or len(blob)<5000:continue
    record={"site":id,"url":imgUrl,"bytes":len(blob),"size":im.size,"score":score,"alt":meta}
    out.append(record);images.append((record,im.convert("RGB")))
   except Exception as e:print("IMAGE_FAIL",id,imgUrl,str(e)[:80])
 except Exception as e:print("PAGE_FAIL",id,str(e)[:210])
# Very small contact sheet in workflow logs for visual confirmation, no automatic approval.
if images:
 w,h=360,540
 sheet=Image.new("RGB",(w*min(3,len(images)),h*((len(images)+2)//3)),"white")
 d=ImageDraw.Draw(sheet)
 for i,(record,im) in enumerate(images):
  im.thumbnail((330,475))
  x=(i%3)*w;y=(i//3)*h
  sheet.paste(im,(x+(w-im.width)//2,y+45))
  d.text((x+4,y+4),record["site"]+" "+str(i),fill="black")
  d.text((x+4,y+20),record["url"][-38:],fill="black")
 buf=io.BytesIO();sheet.save(buf,format="JPEG",quality=65,optimize=True)
 print("S6K094_CANDIDATE_SHEET_BASE64="+base64.b64encode(buf.getvalue()).decode("ascii"))
print("S6K094_INSPECTION",json.dumps({"count":len(out),"records":out},ensure_ascii=False))
