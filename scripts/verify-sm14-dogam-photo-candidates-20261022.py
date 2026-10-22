#!/usr/bin/env python3
"""Find actual Korean card photos for 14 source-blocked SM cards, not JP previews.

Set pages identify a Korean card SKU, but NEVER certify art language/printed number;
candidate photos are verified using a full-frame original contact sheet before patch.
"""
from pathlib import Path
from io import BytesIO
from urllib.parse import urljoin,urlsplit
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
import hashlib,json,re,requests
from bs4 import BeautifulSoup
from PIL import Image,ImageDraw,ImageOps
BASE="https://www.dogam.app"
AUD=Path("data/audits")
out=AUD/"theme-sm14-dogam-korean-image-candidate-probe-20261022.json"
assert not out.exists()
status=json.loads((AUD/"theme-sm122-current-status-after-nonnumeric-classification-20261022.json").read_text())
rows=status["unresolvedCards"]
assert len(rows)==14 and len({x["code"].lower() for x in rows})==14
ses=requests.Session()
ses.headers.update({"User-Agent":"Mozilla/5.0 (compatible; Korean Card Binder Print Verification/2026)",
                     "Accept":"text/html,image/webp,image/png,image/jpeg,*/*"})
sets={"sm11b":"https://www.dogam.app/sets/01KW0QMH4X2QNAZKD608VN2GKM",
      "sm12a":"https://www.dogam.app/sets/01KW0QMFJK5M82YHNFWTTABTTX"}
listing=ses.get("https://www.dogam.app/sets",timeout=25)
listing.raise_for_status()
doc=BeautifulSoup(listing.text,"html.parser")
for setcode,word in [("sm12","얼터제네시스"),("sm2k","알로라의 햇빛")]:
 matches=[urljoin(BASE,a["href"]) for a in doc.find_all("a",href=True)
          if "/sets/" in a["href"] and word in a.get_text(" ",strip=True)]
 matches=list(dict.fromkeys(matches))
 if len(matches)!=1:raise RuntimeError(f"cannot resolve KR set {setcode}, candidates={matches[:5]}")
 sets[setcode]=matches[0].split("?")[0]
print("DOGAM_SET_URLS",json.dumps(sets,ensure_ascii=False),flush=True)
setmap={}
for code,url in sets.items():
 r=ses.get(url,timeout=25);r.raise_for_status()
 doc=BeautifulSoup(r.text,"html.parser")
 links=[]
 for a in doc.find_all("a",href=True):
  href=a["href"]
  if "/cards/" not in href:continue
  label=a.get_text(" ",strip=True)
  links.append({"text":label,"href":urljoin(BASE,href)})
 setmap[code]=links
 print("DOGAM_SET_CARD_LINKS",code,len(links),links[-3:],flush=True)
def run(card):
    code=card["code"].lower()
    group=card["set"].lower()
    suffix=code.split("_")[1]
    n=int(suffix.split("/")[0])
    suffix3=f"{n:03d}"
    candidates=[]
    for a in setmap[group]:
      m=re.search(r'(?<![0-9])0*([0-9]{1,3})(?![0-9])\s*$',a["text"])
      if m and int(m.group(1))==n:candidates.append(a)
    result={**card,"expectedNumeric":n,"setLandingPage":sets[group],
       "matchingKoreanCardLinks":candidates,"decoded":False,"imageUrl":None,
       "detailPage":None,"sha256":None,"imageSize":None,"file":None,
       "languageVisualVerified":False,"printedFooterVisualVerified":False,"error":None}
    if len(candidates)!=1:
     result["error"]=f"Ambiguous card-page matching: {len(candidates)}";return result,None
    detail=candidates[0]["href"]
    result["detailPage"]=detail
    try:
      rr=ses.get(detail,timeout=25);rr.raise_for_status()
      page=BeautifulSoup(rr.text,"html.parser")
      title=page.get_text(" ",strip=True)
      expect=suffix
      if "한글판" not in title or suffix not in title:
        raise ValueError(f"Korean detail or printed number missing: {code}")
      pics=[]
      for img in page.find_all("img"):
        src=img.get("src") or img.get("data-src")
        if not src:continue
        raw=urljoin(detail,src)
        if urlsplit(raw).hostname=="static.tcgexchange.kr":
            pics.append({"alt":img.get("alt",""),"src":raw})
      for a in page.find_all("a",href=True):
        h=urljoin(detail,a["href"])
        if urlsplit(h).hostname=="static.tcgexchange.kr":
            pics.append({"alt":a.get_text(" ",strip=True),"src":h})
      pics=list({x["src"]:x for x in pics}.values())
      best=[p for p in pics if card["name"].replace(" ","").split("-")[0].lower() in p["alt"].replace(" ","").lower()]
      if not best:best=pics
      if not best:raise ValueError("No host-approved Korean thumbnail image")
      src=best[0]["src"]
      if ".w480.webp" in src: alt=src.replace(".w480.webp",".png")
      else:alt=src
      for imageurl in [alt,src]:
        try:
            imgr=ses.get(imageurl,timeout=22)
            imgr.raise_for_status()
            if len(imgr.content)>10000000:raise ValueError("Image over 10MB")
            img=Image.open(BytesIO(imgr.content));img.load()
            if img.width<300 or img.height<440:raise ValueError("Image too small")
            result.update(decoded=True,imageUrl=imageurl,imageSize=[img.width,img.height],
               sha256=hashlib.sha256(imgr.content).hexdigest(),metadataKoreanRegionClaim=True,
               candidateImageAlt=best[0]["alt"])
            return result,img.convert("RGB")
        except Exception as e: result["error"]=str(e)[:155]
    except Exception as e: result["error"]=str(e)[:155]
    return result,None
with ThreadPoolExecutor(max_workers=10) as pool:
 responses=list(pool.map(run,rows))
P=AUD/"theme-sm14-dogam-korean-photo-evidence-20261022"
P.mkdir(exist_ok=True)
for r,im in responses:
 if im is None:continue
 stem=r["code"].replace("/","-")
 im.save(P/(stem+".jpg"),quality=96)
 footer=im.crop((0,int(im.height*.8),int(im.width*.95),im.height))
 footer.resize((footer.width*3,footer.height*3)).save(P/(stem+"-footer.png"),"PNG")
 r["file"]=stem+".jpg";r["footerFile"]=stem+"-footer.png"
 pages=[]
for start in range(0,len(responses),6):
 batch=responses[start:start+6]
 W,H=500,810
 sheet=Image.new("RGB",(W*3,H*2),"white");d=ImageDraw.Draw(sheet)
 for i,(r,im) in enumerate(batch):
  x=(i%3)*W;y=(i//3)*H
  d.text((x+8,y+9),r["code"]+" "+r["name"][:16],fill="black")
  d.text((x+8,y+31),"KR catalog metadata only; verify Korean footer visually",fill="black")
  if im:
   main=ImageOps.contain(im,(340,605))
   sheet.paste(main,(x+5,y+57))
   left=im.crop((0,int(im.height*.79),int(im.width*.65),im.height))
   foot=ImageOps.contain(left,(150,220))
   sheet.paste(foot,(x+345,y+495))
  else:d.text((x+20,y+120),"NO DOWNLOADABLE KR CARD ART",fill="red")
 name=f"sm14-verified-footer-candidates-{start//6+1:02d}.jpg"
 sheet.save(P/name,quality=90)
 pages.append(name)
answers=[x for x,img in responses]
report={"schemaVersion":1,"date":"2026-10-22",
 "scope":14,"sourceSetPages":sets,
 "artDownloadSuccess":sum(x["decoded"] for x in answers),
 "stillMissing":sum(not x["decoded"] for x in answers),
 "numberedRealPrintManuallyConfirmed":0,
 "candidateOnly":True,
 "requires":"Directly inspect Korean language and exact physical footer on full-size candidate original before replacing 14 cards.",
 "cardRows":answers,
 "pages":pages}
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("SM14_DOGAM_ART_DISCOVERY",json.dumps({"downloaded":report["artDownloadSuccess"],
 "missing":report["stillMissing"],"codes":[{"code":x["code"],"ok":x["decoded"],"page":x["detailPage"],
 "image":x["imageUrl"],"error":x["error"]} for x in answers]},ensure_ascii=False),flush=True)
