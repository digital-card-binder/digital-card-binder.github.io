#!/usr/bin/env python3
"""Compare all 95 publicly classified melancholy card artworks against Korean physical print master.

Cards are only accepted as same-artwork candidates with multiple independent
image features. This audit never modifies the live theme or user ownership.
"""
import concurrent.futures, io, json, os, re, threading, time
from pathlib import Path
from urllib.parse import urlparse
import cv2, numpy as np, requests
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parent.parent
data=json.loads((ROOT/"data/audits/crying-illudex-full-feel-data-20261108.json").read_text("utf-8"))
source=data["allAbove40"]
master=json.loads((ROOT/"data/series.json").read_text("utf-8"))+json.loads((ROOT/"data/series-legacy.json").read_text("utf-8"))
existing=json.loads((ROOT/"data/art-themes-crying.json").read_text("utf-8"))["group"]["cards"]
known={c["code"] for c in existing}
ko={
"Alolan Marowak":"알로라 텅구리","Alolan Muk":"알로라 질뻐기","Aron":"가보리","Beldum":"메탕",
"Blitzle":"줄뮤마","Bonsly":"꼬지지","Cacnea":"선인왕","Cacturne":"밤선인","Chandelure":"샹델라",
"Cherrim":"체리꼬","Chimecho":"치렁","Clobbopus":"때때무노","Cottonee":"소미안",
"Cubchoo":"코고미","Cubone":"탕구리","Donphan":"코리갑","Drifblim":"둥실라이드",
"Drowzee":"슬리프","Duskull":"해골몽","Feebas":"빈티나","Flabébé":"플라베베",
"Frillish":"탱그릴","Froslass":"눈여아","Galarian Corsola":"가라르 코산호",
"Galarian Cursola":"가라르 산호르곤","Gloom":"냄새꼬","Hisuian Goodra":"히스이 미끄래곤",
"Houndstone":"묘두기","Kangaskhan":"캥카","Litten":"냐오불","Litwick":"불켜미",
"Lombre":"로토스","Lotad":"연꽃몬","Marowak":"텅구리","Meowth":"나옹",
"Mimikyu":"따라큐","Mismagius":"무우마직","Phanpy":"코코리","Phantump":"나목령",
"Pikachu":"피카츄","Prinplup":"팽태자","Psyduck":"고라파덕","Quilava":"마그케인",
"Rockruff":"암멍이","Shedinja":"껍질몬","Shroomish":"버섯꼬","Slowbro":"야도란",
"Snorunt":"눈꼬마","Snubbull":"블루","Sobble":"울머기","Sunkern":"해너츠",
"Teddiursa":"깜지곰","Tinkatink":"어리짱","Trubbish":"깨봉이","Tympole":"동챙이",
"Wellspring Mask Ogerpon ex":"우물의 가면 오거폰 ex","Whismur":"소곤룡","Wishiwashi":"약어리",
"Yamask":"데스마스"
}
names=set(r["name"] for r in source)
if names-set(ko):raise Exception("Missing Korean mappings: "+str(sorted(names-set(ko))))
def compact(x):return re.sub(r"\s+","",str(x)).casefold()
by_name={}
for group in master:
 for card in group.get("cards",[]):
  code=str(card.get("code",""))
  match=re.match(r"^[^_]+_(\d{1,3})",code)
  if not match:continue
  name=str(card.get("name","")).strip()
  if not name:continue
  key=str(group["code"]).upper()+"_"+match.group(1).zfill(3)
  row={"key":key,"name":name,"set":group["code"],"no":match.group(1).zfill(3),
       "image":str(card.get("image","")),"source":str(card.get("source",""))}
  by_name.setdefault(compact(name),[]).append(row)
session=requests.Session()
headers={"User-Agent":"Mozilla/5.0 (compatible; digital-card-binder artwork-research/1.0)"}
cache={}
lock=threading.Lock()
size=(400,560)
def alternatives(url):
 if not url:return []
 out=[url]
 p=urlparse(url)
 if "/data/wmimages/" in p.path:
  rel=p.path.lstrip("/")
  for host in ("https://dcb-card-images-modern-2026.pages.dev/",
               "https://dcb-card-images-legacy-2026.pages.dev/"):
   out.append(host+rel.rsplit(".",1)[0]+".webp")
 return out
def retrieve(url):
 if not url:return None
 with lock:
  if url in cache:return cache[url]
 result=None
 for link in alternatives(url):
  try:
   resp=session.get(link,headers=headers,timeout=12)
   if resp.status_code!=200 or len(resp.content)<1500: continue
   im=ImageOps.exif_transpose(Image.open(io.BytesIO(resp.content))).convert("RGB")
   if min(im.size)<130:continue
   bgr=cv2.cvtColor(np.asarray(im),cv2.COLOR_RGB2BGR)
   result=cv2.resize(bgr,size,interpolation=cv2.INTER_AREA)
   break
  except Exception:continue
 with lock: cache[url]=result
 return result
def crops(image):
 return [cv2.GaussianBlur(cv2.cvtColor(image[78:315,39:361],cv2.COLOR_BGR2GRAY),(3,3),0),
         cv2.GaussianBlur(cv2.cvtColor(image[30:520,28:372],cv2.COLOR_BGR2GRAY),(3,3),0)]
def features(img):
 if img is None:return None
 sift=cv2.SIFT_create(nfeatures=450,contrastThreshold=.018)
 results=[]
 for gray in crops(img):
  k,desc=sift.detectAndCompute(gray,None)
  results.append((gray,k,desc))
 return results
def compare(src,dst):
 result=[]
 for (a,ak,ad),(b,bk,bd) in zip(src,dst):
  cor=float(cv2.matchTemplate(a,b,cv2.TM_CCOEFF_NORMED)[0][0])
  good=[]
  inliers=0
  if ad is not None and bd is not None and len(ad)>3 and len(bd)>3:
   matcher=cv2.BFMatcher(cv2.NORM_L2)
   for pair in matcher.knnMatch(ad,bd,k=2):
    if len(pair)==2 and pair[0].distance<.75*pair[1].distance:
     good.append(pair[0])
   if len(good)>=6:
    pointsA=np.float32([ak[m.queryIdx].pt for m in good])
    pointsB=np.float32([bk[m.trainIdx].pt for m in good])
    try:
     _,mask=cv2.estimateAffinePartial2D(pointsA,pointsB,method=cv2.RANSAC,ransacReprojThreshold=4.5,maxIters=1400)
     if mask is not None:inliers=int(mask.sum())
    except cv2.error:pass
  result.append({"corr":round(cor,3),"inliers":inliers,"good":len(good)})
 best=max(result,key=lambda e:(max(0,e["corr"])*25+min(e["inliers"],160)))
 return best
def isphysical(r):
 # A*, B* are Pokémon TCG Pocket-exclusive digital sets, not physical Korean card prints.
 return re.match(r"^[AB][0-9]",r["id"],re.I) is None
rows=[]
for item in source:
 label=item["name"]
 candidates=by_name.get(compact(ko[label]),[])
 # Include regional spelling variation without mixing a base form with regional print.
 if not candidates and label.startswith("Galarian "):
  candidates=by_name.get(compact("가라르"+ko[label].replace("가라르 ","")),[])
 if not candidates and label=="Wellspring Mask Ogerpon ex":
  candidates=[row for k,rr in by_name.items() if "오거폰" in k and "우물" in k for row in rr]
 candidates=[c for c in candidates if c["image"]]
 rows.append({**item,"ko":ko[label],"physical":isphysical(item),
 "referenceUrl":"https://www.illudex.com/card/"+item["id"],
 "referenceImage":"https://img.illudex.com/"+item["id"]+"/low.webp",
 "candidates":candidates,"candidateCount":len(candidates)})
allurls={c["image"] for row in rows if row["physical"] for c in row["candidates"]}
allurls.update(row["referenceImage"] for row in rows if row["physical"])
print("Melancholy sources",len(rows),"physical",sum(r["physical"] for r in rows),
      "pocket",sum(not r["physical"] for r in rows),"Korean candidate URLs",len(allurls),flush=True)
urls=sorted(allurls)
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
 for i,_ in enumerate(pool.map(retrieve,urls),start=1):
  if i%100==0:print("Image downloads",i,"/",len(urls),flush=True)
feature_cache={}
for url in urls:
 feature_cache[url]=features(cache.get(url))
results=[]
for ri,row in enumerate(rows):
 out={k:v for k,v in row.items() if k!="candidates"}
 out["referenceImageAvailable"]=feature_cache.get(row["referenceImage"]) is not None
 matched=[]
 if row["physical"] and out["referenceImageAvailable"]:
  sfeat=feature_cache[row["referenceImage"]]
  for candidate in row["candidates"]:
   f=feature_cache.get(candidate["image"])
   if f is None:continue
   match=compare(sfeat,f)
   strong=(match["inliers"]>=32 and match["corr"]>=.63)
   # High-confidence cases tolerate full-art texture / foil changes but
   # still require numerous geometrically consistent identical art points.
   strong=strong or (match["inliers"]>=60 and match["corr"]>=.45)
   matched.append({**candidate,**match,"strong":strong,
                   "registered":candidate["key"] in known})
  matched.sort(key=lambda x:(x["strong"],x["inliers"],x["corr"]),reverse=True)
 out["scoredCandidates"]=len(matched)
 out["top"]=matched[:12]
 out["strongMatches"]=[{k:m[k] for k in ("key","name","set","no","image","corr","inliers","registered")}
                       for m in matched if m["strong"]]
 out["status"]="digital_only" if not row["physical"] else \
               "no_korean_name_match" if not row["candidates"] else \
               "reference_art_unavailable" if not out["referenceImageAvailable"] else \
               "matched_same_art" if out["strongMatches"] else "no_matching_art_detected"
 results.append(out)
 if ri%10==0:print("Scored sources",ri+1,"of",len(rows),flush=True)
print("SOURCE_STATUSES",json.dumps({x:sum(r["status"]==x for r in results) for x in sorted(set(r["status"] for r in results))}),flush=True)
print("NEW_STRONG",json.dumps([{"id":r["id"],"n":r["name"],"s":r["score"],"hits":[{"key":h["key"],"inliers":h["inliers"],"corr":h["corr"]} for h in r["strongMatches"] if not h["registered"]]}
 for r in results if any(not m["registered"] for m in r["strongMatches"])],ensure_ascii=False),flush=True)
output={"checkedAt":"2026-11-08","sourceRevision":data["source"]["revision"],
 "algorithm":"SIFT affine RANSAC geometric inliers and art-region correlation at 400x560; high confidence is not subjective emotion validation",
 "scope":"95 Illudex melancholy cards; pocket digital-only excluded from Korean physical master",
 "summary":{"sourceCards":len(results),"physicalCandidates":sum(r["physical"] for r in results),
            "digitalPocket":sum(not r["physical"] for r in results),
            "referenceImagesDownloaded":sum(r["referenceImageAvailable"] for r in results if r["physical"]),
            "koreanArtworkImagesDownloaded":sum(cache.get(x) is not None for x in allurls),
            "sourceWithStrongArtwork":sum(bool(r["strongMatches"]) for r in results),
            "preliminaryNewKoreanImageCandidates":len({h["key"] for r in results for h in r["strongMatches"] if not h["registered"]}),
            "newKoreanPhysicalPrints":len({h["key"] for r in results for h in r["strongMatches"] if not h["registered"] and h["inliers"]>=60 and h["corr"]>=0.60})},
 "statuses":{x:sum(r["status"]==x for r in results) for x in set(r["status"] for r in results)},
 "results":results}
outpath=ROOT/"data/audits/crying-illudex-all95-image-audit-20261108.json"
outpath.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n","utf-8")
print("AUDIT_WRITTEN",outpath,outpath.stat().st_size,flush=True)
