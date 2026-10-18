#!/usr/bin/env python3
"""Read-only compare each of 14 Korean-printed Mega public CDN pixels against catalog source."""
import io,json,math,statistics,time,urllib.request
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
series=json.loads(Path("data/series.json").read_text("utf-8"))
queue=json.loads(Path("data/audits/korean-recovery-active-queue-20261018.json").read_text("utf-8"))
cards={}
def walk(node):
 if isinstance(node,list):
  for x in node:walk(x)
 elif isinstance(node,dict):
  if "image" in node and isinstance(node.get("code"),str):cards[node["code"].lower()]=node
  for v in node.values():
   if isinstance(v,(list,dict)):walk(v)
walk(series)
def fnv(text):
 h=0xcbf29ce484222325
 for ch in text:
  h ^= ord(ch)
  h=(h*0x100000001b3)&0xffffffffffffffff
 return format(h,"016x")
def download(url):
 last=""
 for attempt in range(3):
  try:
   res=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=35)
   if res.status !=200: raise RuntimeError("HTTP "+str(res.status))
   raw=res.read()
   img=Image.open(io.BytesIO(raw));img.load()
   return img.convert("RGB"),len(raw)
  except Exception as e:
   last=str(e)
   time.sleep(1+attempt*2)
 raise RuntimeError(url+": "+last)
results=[]
for row in queue["unresolved"]:
 if row.get("era")!="MEGA":continue
 prefix,_,suffix=row["slot"].split("::")
 code=prefix+"_"+(suffix.zfill(3)+"/m-p" if prefix=="m-p" else suffix.zfill(3)+"/742" if prefix=="mc" else suffix)
 item=cards[code.lower()]
 source=item["image"]
 path="external/static.tcgexchange.kr/"+fnv(source)+".webp"
 cdn="https://dcb-card-images-legacy-2026.pages.dev/"+path
 try:
  native,nsize=download(source)
  archived,asize=download(cdn)
  sample=(115,160)
  n=native.resize(sample,Image.Resampling.LANCZOS)
  a=archived.resize(sample,Image.Resampling.LANCZOS)
  metric=ImageStat.Stat(ImageChops.difference(n,a)).mean
  ma=sum(metric)/len(metric)
  record={"id":row["workId"],"code":code,"name":item["name"],"cdn":cdn,"http":"200","src":list(native.size),"cdnPx":list(archived.size),"originalBytes":nsize,"ownedBytes":asize,"meanAbsPixelDifference":round(ma,2),"contentNearMatch":ma<18}
 except Exception as exc:
  record={"id":row["workId"],"code":code,"cdn":cdn,"error":str(exc),"contentNearMatch":False}
 results.append(record)
 print("MEGA_LIVE",json.dumps(record,ensure_ascii=False))
print("MEGA_CDN_VISUAL_SUMMARY",json.dumps({"total":len(results),"matches":sum(x["contentNearMatch"] for x in results),"mismatch":[x["code"] for x in results if not x["contentNearMatch"]]}))
if len(results)!=14 or any(not r["contentNearMatch"] for r in results):raise SystemExit(1)
