#!/usr/bin/env python3
"""Archive independently matched Korean s8b UR card photos as self-hosted GitHub Pages assets.
Never use incorrectly mapped official index 278-285 (those images are basic energies).
Fail safely if any reference fails. Preserve source provenance, do not change card DB.
"""
from pathlib import Path
from io import BytesIO
from urllib.request import Request, urlopen
from PIL import Image, ImageChops, ImageStat, ImageDraw
import json, hashlib, re, sys, html

SOURCES = {
278: [
 "https://kream-phinf.pstatic.net/MjAyNTExMTlfMTU0/MDAxNzYzNTMwNjA0NDA2.1LMudv7yiwAH-hwNAaDYyImu6zx18vI3sjK3Aqm7GT4g.4tpod2N2b6SurpHa7F4hviH1KaF20bIghZ6c4ayYuVgg.PNG/a_55138e48fc744363a1b3a53940942eb2.png",
 "https://kream.co.kr/products/69937"
],
279: [
 "https://sitem.ssgcdn.com/85/33/20/item/1000523203385_i1_750.jpg"
],
280: [
 "https://kream-phinf.pstatic.net/MjAyNTExMTlfMTM1/MDAxNzYzNTMwODU4MTc5.4J54KR0Xt9V8kj-ZbacrFj5B58_EGjwuUVfUC-RbYlUg.kLYldMIWcXIK6mlIW6u4IxeaeLQMk2LBeSEv5QHqrNEg.PNG/a_ec8bae769cff45f383b9f003364e8755.png",
 "https://kream.co.kr/products/69936"
],
281: [
 "https://kream-phinf.pstatic.net/MjAyNTExMTlfMjYw/MDAxNzYzNTMxMTc3NDgz.Drh6ddZGPR5ZHgiCiwopJH8mzSy7jYzyEpWQR2jEA9Qg.cM6fF69GEZwS3p8nwMpWCsJcezYbiZXPfiv0y-SmjGog.PNG/a_45c35bff360745b0b074b1a5713f7776.png",
 "https://kream.co.kr/products/69941"
],
282: [
 "https://kream.co.kr/products/69939",
 "https://media.bunjang.co.kr/product/364867610_1_1761340043_w1200.jpg",
 "https://media.bunjang.co.kr/product/364867610_1_1761340043_w800.jpg"
],
283: [
 "https://sitem.ssgcdn.com/52/87/07/item/1000532078752_i1_750.jpg",
 "https://kream.co.kr/products/69938"
],
284: [
 "https://kream.co.kr/products/69935",
 "https://media.bunjang.co.kr/product/251565132_1_1706663628_w1200.jpg",
 "https://media.bunjang.co.kr/product/251565132_1_1706663628_w800.jpg"
],
285: [
 "https://kream.co.kr/products/69934",
 "https://media.bunjang.co.kr/product/358635261_1_1766112156_w1200.jpg",
 "https://media.bunjang.co.kr/product/358635261_1_1766112156_w800.jpg"
]
}
NAMES={278:"백마 버드렉스 VMAX",279:"피카츄 VMAX",280:"뮤 VMAX",281:"흑마 버드렉스 VMAX",282:"일격 우라오스 VMAX",283:"연격 우라오스 VMAX",284:"레쿠쟈 VMAX",285:"두랄루돈 VMAX"}
OUT=Path("assets/cards/s8b-ur-korean")
PROOF=Path("data/audits/theme-visual-evidence/s8b/ur-278-285")
OUT.mkdir(parents=True,exist_ok=True)
PROOF.mkdir(parents=True,exist_ok=True)
HEADERS={"User-Agent":"Mozilla/5.0 (compatible; DCB-curation/1.0)","Accept":"image/avif,image/webp,image/png,image/jpeg,text/html;q=0.9,*/*;q=0.8"}

def load(url, depth=0):
    if depth>1: raise RuntimeError("nested HTML")
    with urlopen(Request(url,headers=HEADERS),timeout=22) as r:
        raw=r.read(15_000_000)
        content_type=str(r.headers.get("content-type",""))
    if raw[:16].lower().lstrip().startswith(b"<!doctype") or "<html" in content_type:
        page=raw.decode("utf-8","ignore")
        pat=r'<meta[^>]*(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]*content=["\']([^"\']+)'
        m=re.search(pat,page,re.I)
        if not m:
            pat=r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\'](?:og:image|twitter:image)'
            m=re.search(pat,page,re.I)
        if not m: raise RuntimeError("no public product image meta")
        url=html.unescape(m.group(1))
        if not url.startswith("https://"):raise RuntimeError("invalid open graph image")
        return load(url,depth+1)
    im=Image.open(BytesIO(raw))
    im.load()
    if im.width<280 or im.height<280:raise RuntimeError("too small")
    return im.convert("RGB"),url,hashlib.sha256(raw).hexdigest()

def cut(im):
    w,h=im.size
    # Bright-white square product backgrounds: detect centered nonwhite photo/card.
    # Keep small padding; do not crop physical card faces when background is dark.
    corner=[im.getpixel((x,y)) for x,y in [(2,2),(w-3,2),(2,h-3),(w-3,h-3)]]
    if all(min(c)>235 for c in corner):
        import numpy as np
        arr=np.asarray(im)
        mask=(arr.min(axis=2)<220)
        ys,xs=np.where(mask)
        if len(xs)>200:
            x0,x1=int(xs.min()),int(xs.max()+1)
            y0,y1=int(ys.min()),int(ys.max()+1)
            if .25<(x1-x0)/w<.97 and .45<(y1-y0)/h<.98:
                pad=max(2,int(min(w,h)*.006))
                im=im.crop((max(0,x0-pad),max(0,y0-pad),min(w,x1+pad),min(h,y1+pad)))
    w,h=im.size
    target=420/586
    if w/h>target:
        neww=round(h*target)
        left=(w-neww)//2
        im=im.crop((left,0,left+neww,h))
    else:
        newh=round(w/target)
        top=(h-newh)//2
        im=im.crop((0,top,w,top+newh))
    return im.resize((420,586),Image.Resampling.LANCZOS)

images=[]
items=[]
failures=[]
for n in range(278,286):
    errors=[]
    for url in SOURCES[n]:
        try:
            im,actual,original_hash=load(url)
            photo=cut(im)
            path=OUT/f"{n}.webp"
            photo.save(path,"WEBP",quality=91,method=6)
            im2=Image.open(path);im2.load()
            if im2.size!=(420,586):raise RuntimeError("saved image size mismatch")
            images.append((n,photo))
            items.append(dict(number=n,name=NAMES[n],source=actual,sha256=original_hash,originalDimensions=list(im.size),
                             ownedPath=str(path),width=420,height=586,status="downloaded_for_visual_review",
                             koreanArtworkIdentityVerifiedBy="separate image-source review"))
            print("FETCHED",n,actual,im.size)
            break
        except Exception as e:
            errors.append(str(e)[:160])
    else:
        failures.append({"number":n,"tried":len(SOURCES[n]),"errors":errors})
        print("FAILED",n,errors)
proof={"schemaVersion":1,"set":"s8b","range":"278-285","expected":8,"fetched":len(items),"items":items,"failed":failures,
       "criticalNote":"Current official sequence BS2022001278-1285 resolves to unnumbered energies, not eight Korean UR 278-285. Never reuse those images for UR."}
(PROOF/"rehost-source-index.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n")
if images:
    from PIL import ImageDraw,ImageFont
    sheet=Image.new("RGB",(5*244,2*372),"#e6e6e6")
    d=ImageDraw.Draw(sheet)
    for i,(n,im) in enumerate(images):
        x=(i%5)*244;y=(i//5)*372
        sheet.paste(im.resize((232,324)),(x+6,y+17))
        d.text((x+6,y+2),f"s8b {n}/184 UR",fill="#171717")
    sheet.save(PROOF/"contact.webp","WEBP",quality=85)
if failures:
    print("WARNING: incomplete Korean UR images; retain prior checkpoint and do not apply this batch.")
    sys.exit(0)
print("ALL EIGHT SOURCE PHOTOS DOWNLOADED; VISUAL REVIEW STILL REQUIRED")
