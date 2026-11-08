#!/usr/bin/env python3
"""Research aid only: identify artwork matches between overseas reference prints and Korean master candidate images.
Never auto-publish a card on similarity alone. Produces reproducible numeric evidence and review queue.
"""
import concurrent.futures
import io
import json
import os
import threading
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import cv2
import numpy as np
import requests
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parent.parent
CAND=json.loads((ROOT/"data/audits/crying-theme-all-candidate-index-20261108.json").read_text("utf-8"))
OUT=ROOT/"data/audits/crying-theme-image-similarity-20261108.json"
SETS={
  "Paldea Evolved":"sv2","Scarlet & Violet Base":"sv1",
  "Crown Zenith":"swsh12pt5gg","Lost Origin":"swsh11",
  "SWSH Black Star Promos":"swshp","Cosmic Eclipse":"sm12",
  "Sandstorm":"ex2","Aquapolis":"ecard2","Gym Challenge":"gym2",
  "Silver Tempest":"swsh12","Darkness Ablaze":"swsh3",
  "Sword & Shield Base":"swsh1","Forbidden Light":"sm6",
  "BREAKpoint":"xy9","BREAKthrough":"xy8","Legendary Treasures":"bw11",
  "Diamond & Pearl Base":"dp1","Dragon Frontiers":"ex15",
  "Legend Maker":"ex12","Delta Species":"ex11",
  "FireRed & LeafGreen":"ex6","Expedition Base Set":"ecard1",
  "Neo Destiny":"neo4","Jungle":"base2","Fossil":"base3"
}
CONTROLS={
  "Sandygast|Paldea Evolved":"SV2D_075",
  "Drowzee|Scarlet & Violet Base":"SV1V_086",
  "Mabosstiff|Scarlet & Violet Base":"SV1V_088",
  "Hisuian Goodra|Crown Zenith":"S12A_196",
  "Hisuian Goodra|Lost Origin":"S10A_055",
  "Hisuian Goodra V|Lost Origin":"S10A_056",
  "Hisuian Goodra VSTAR|Lost Origin":"S10A_057"
}
UA={"User-Agent":"Mozilla/5.0 (compatible; CardCatalogResearch/1.0)"}
session=requests.Session()
cache={}
cache_lock=threading.Lock()
def foreign_url(entry):
  setcode=SETS.get(entry["englishSet"])
  if not setcode: return None
  number=entry["englishNumber"].split("/")[0]
  return f"https://images.pokemontcg.io/{setcode}/{number}.png"

def url_fallbacks(url):
  result=[url]
  p=urlparse(url)
  marker="/data/wmimages/"
  if marker in p.path:
    rel=p.path.lstrip("/")
    for root in ("https://dcb-card-images-modern-2026.pages.dev/",
                 "https://dcb-card-images-legacy-2026.pages.dev/"):
      result.append(root+rel.rsplit(".",1)[0]+".webp")
  return result

def grab(url):
  if not url: return None
  with cache_lock:
    if url in cache: return cache[url]
  result=None
  for address in url_fallbacks(url):
    try:
      r=session.get(address,headers=UA,timeout=10)
      if r.status_code!=200 or len(r.content)<2500: continue
      raw=Image.open(io.BytesIO(r.content))
      raw=ImageOps.exif_transpose(raw).convert("RGB")
      if min(raw.size)<180: continue
      arr=cv2.cvtColor(np.asarray(raw),cv2.COLOR_RGB2BGR)
      result=cv2.resize(arr,(480,670),interpolation=cv2.INTER_AREA)
      break
    except Exception:
      continue
  with cache_lock:
    cache[url]=result
  return result

def crop_gray(img, mode):
  if mode=="art":
    a=img[94:360,48:432]     # Main art section: conventional card print
  else:
    a=img[40:610,34:446]     # Full illustration / textured holo
  a=cv2.cvtColor(a,cv2.COLOR_BGR2GRAY)
  return cv2.GaussianBlur(a,(3,3),0)

def score_pair(src,dst,sift):
  values=[]
  for mode in ("art","full"):
    a=crop_gray(src,mode)
    b=crop_gray(dst,mode)
    cor=float(cv2.matchTemplate(a,b,cv2.TM_CCOEFF_NORMED)[0][0])
    ea,eb=cv2.Canny(a,60,130),cv2.Canny(b,60,130)
    edge=float(cv2.matchTemplate(ea,eb,cv2.TM_CCOEFF_NORMED)[0][0])
    kp1,ds1=sift.detectAndCompute(a,None)
    kp2,ds2=sift.detectAndCompute(b,None)
    inliers=0
    fraction=0.0
    good=[]
    if ds1 is not None and ds2 is not None and len(ds1)>3 and len(ds2)>3:
      matcher=cv2.BFMatcher(cv2.NORM_L2)
      for pair in matcher.knnMatch(ds1,ds2,k=2):
        if len(pair)==2 and pair[0].distance < 0.75*pair[1].distance:
          good.append(pair[0])
      if len(good)>=6:
        p1=np.float32([kp1[m.queryIdx].pt for m in good])
        p2=np.float32([kp2[m.trainIdx].pt for m in good])
        try:
          _,mask=cv2.estimateAffinePartial2D(p1,p2,method=cv2.RANSAC,
                                             ransacReprojThreshold=4.5,
                                             maxIters=1800,confidence=0.985)
          if mask is not None:
            inliers=int(mask.sum())
            fraction=round(inliers/max(1,len(good)),3)
        except cv2.error:
          pass
    values.append({
      "mode":mode,"correlation":round(cor,4),"edge":round(edge,4),
      "keypointInliers":inliers,"keypointInlierFraction":fraction,
      "keypointGoodMatches":len(good)
    })
  best=max(values,key=lambda v:
       (max(v["correlation"],0)*25+
        max(v["edge"],0)*10+
        min(v["keypointInliers"],100)*v["keypointInlierFraction"]))
  return {
    "score":round(max(best["correlation"],0)*25+
                  max(best["edge"],0)*10+
                  min(best["keypointInliers"],100)*best["keypointInlierFraction"],2),
    "best":best,
    "scoreArtCorrelation":values[0]["correlation"],
    "scoreFullCorrelation":values[1]["correlation"],
    "maxInliers":max(v["keypointInliers"] for v in values)
  }

foreign={}
for entry in CAND["primary"]:
  source=foreign_url(entry)
  if source: foreign[source]=None
korean={}
for entry in CAND["primary"]:
  if not foreign_url(entry):continue
  for c in entry["candidates"]:
    if c["image"]:korean[c["image"]]=None
todo=list(foreign)+list(korean)
print("Artwork test: foreign urls",len(foreign),"Korean candidate urls",len(korean),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
  for i,(url,img) in enumerate(zip(todo,pool.map(grab,todo)),start=1):
    if i%80==0:print("Downloaded",i,"of",len(todo),flush=True)
sift=cv2.SIFT_create(nfeatures=500,contrastThreshold=0.025)
entries=[]
for entry in CAND["primary"]:
  eng_url=foreign_url(entry)
  eng_img=grab(eng_url) if eng_url else None
  item={k:entry[k] for k in ("index","english","englishSet","englishNumber","koreanName","numberOfKoreanNameCandidates")}
  item["englishImageUrl"]=eng_url
  item["englishImageDownloaded"]=eng_img is not None
  item["comparisonStatus"]="source_unavailable" if eng_img is None else "artwork_scores_not_final_approval"
  results=[]
  if eng_img is not None:
    for candidate in entry["candidates"]:
      kimg=grab(candidate["image"])
      if kimg is None: continue
      score=score_pair(eng_img,kimg,sift)
      results.append({
        "key":candidate["key"],"name":candidate["name"],
        "set":candidate["set"],"setName":candidate["setName"],
        "image":candidate["image"],**score
      })
    results.sort(key=lambda x:x["score"],reverse=True)
  item["koreanCandidateImagesScored"]=len(results)
  item["top"]=results[:7]
  key=entry["english"]+"|"+entry["englishSet"]
  if key in CONTROLS:
    correct=CONTROLS[key]
    item["controlKnownKoreanKey"]=correct
    item["controlKnownRank"]=next((i+1 for i,r in enumerate(results) if r["key"]==correct),None)
    item["controlKnownScore"]=next((r["score"] for r in results if r["key"]==correct),None)
  entries.append(item)
  if item["top"]:
    print("Top",item["index"],item["english"],item["englishSet"],
          item["top"][0]["key"],item["top"][0]["score"],
          "control",item.get("controlKnownRank"),flush=True)
  else: print("No images",item["index"],item["english"],flush=True)
report={
 "schemaVersion":1,"createdAt":str(date.today()),
 "method":"SIFT keypoint geometric inliers + normalized image/art correlations; all output is tentative and requires identity review",
 "network":{"requestedForeign":len(foreign),"downloadedForeign":sum(grab(u) is not None for u in foreign),
            "requestedKorean":len(korean),"downloadedKorean":sum(grab(u) is not None for u in korean)},
 "referenceCount":len(entries),
 "knownControlKeys":CONTROLS,
 "items":entries
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n","utf-8")
print("Wrote",OUT,"bytes",OUT.stat().st_size,flush=True)
