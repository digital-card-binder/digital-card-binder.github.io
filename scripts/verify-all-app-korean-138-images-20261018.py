#!/usr/bin/env python3
"""Read-only verify all app-approved Korean Classic and S self-hosted WebP assets.

The comparison verifies file availability and that displayed CDN art matches
the exact Korean card-page image selected by the user. Does not modify data.
"""
import concurrent.futures,io,json,pathlib,time,urllib.request
from PIL import Image, ImageChops, ImageStat
ROOT=pathlib.Path(__file__).resolve().parents[1]
reports=[
 json.loads((ROOT/"data/audits/classic-71-app-source-image-recovery-20261018.json").read_text("utf-8")),
 json.loads((ROOT/"data/audits/s-era-69-app-source-image-recovery-20261018.json").read_text("utf-8"))]
cards=[x for rep in reports for x in rep["entries"] if x["status"]=="approved_KR_app_source_decoded"]
if len(cards)!=138:raise RuntimeError(f"Expected 138 card-specific Korean app photos; got {len(cards)}")
def fnv64(value):
 h=0xcbf29ce484222325
 for c in value:
  h^=ord(c)
  h=(h*0x100000001b3)&0xffffffffffffffff
 return format(h,"016x")
def download(url):
 error=None
 for attempt in range(4):
  try:
   req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (KoreanImageVerification/1.0)","Cache-Control":"no-cache"})
   res=urllib.request.urlopen(req,timeout=27)
   b=res.read(8_000_000)
   if len(b)<5000:raise ValueError(f"Too-small card image ({len(b)} bytes)")
   im=Image.open(io.BytesIO(b));im.load()
   if im.width<180 or im.height<220:raise ValueError("Not a full-size card-like image")
   return im.convert("RGB"),len(b)
  except Exception as e:
   error=str(e)
   if attempt<3:time.sleep(1.5+attempt)
 raise ValueError(str(error))
def verify(row):
 url=row["newImage"]
 if not url.startswith("https://static.tcgexchange.kr/"):return {"slot":row["slot"],"workId":row["workId"],"passed":False,"error":"Unexpected host"}
 cdn="https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/"+fnv64(url)+".webp"
 try:
  source,sourceSize=download(url)
  own,ownSize=download(cdn)
  if source.size[0]/source.size[1] < 0.58 or source.size[0]/source.size[1] > 0.85:
   raise ValueError("Unexpected source aspect ratio")
  tiny=(128,175)
  a=source.resize(tiny,Image.Resampling.LANCZOS)
  b=own.resize(tiny,Image.Resampling.LANCZOS)
  difference=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
  return {"slot":row["slot"],"workId":row["workId"],"passed":difference<18,
   "difference":round(difference,2),"url":cdn,"size":ownSize}
 except Exception as e:return {"slot":row["slot"],"workId":row["workId"],"passed":False,"url":cdn,"error":str(e)[:210]}
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
 results=list(pool.map(verify,cards))
passed=[x for x in results if x["passed"]]
failed=[x for x in results if not x["passed"]]
print("KOREAN_APP_CDN_AUDIT_RESULTS",json.dumps({"total":len(results),"passed":len(passed),"failed":len(failed),"passIds":[x["workId"] for x in passed],"failing":failed},ensure_ascii=False))
if failed:raise SystemExit(1)
