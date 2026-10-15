#!/usr/bin/env python3
"""Read-only S6K Korean final-four picture discovery; never change card names or completion.
Exclude Japanese printed pictures, card-number-mismatch and generic product placeholder.
"""
from pathlib import Path
from urllib.parse import quote,urlsplit
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor,as_completed
from io import BytesIO
from PIL import Image,ImageDraw,ImageOps
import base64,json,hashlib,re,html,time
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s6K/korean-candidates/final-four-source-discovery"
OUT.mkdir(parents=True,exist_ok=True)
TARGETS={89:"니아",90:"즈미",92:"붐볼",94:"메아리호른"}
PAGES={
89:["https://tcgbox.co.kr/product/detail.html?product_no=13092","https://m.bunjang.co.kr/products/417574579"],
90:["https://tcgbox.co.kr/product/detail.html?product_no=13093","https://www.coupang.com/vp/products/5630205706"],
92:["https://tcgbox.co.kr/product/detail.html?product_no=13095"],
94:["https://tcgbox.co.kr/product/detail.html?product_no=13097"]
}
DOMAIN_ALLOW=("tcgbox.co.kr","skylook8624.cafe24.com","images.coupangcdn.com","image.coupangcdn.com","image11.coupangcdn.com","image12.coupangcdn.com","image13.coupangcdn.com","media.bunjang.co.kr")
def fetch(url,limit=3500000,timeout=8):
    req=Request(quote(url,safe=":/?=&#%-._~"),headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36","Accept":"image/avif,image/webp,image/apng,image/*,*/*;q=0.8","Accept-Language":"ko-KR,ko;q=0.9"})
    with urlopen(req,timeout=timeout) as r:
        data=r.read(limit+1)
        if len(data)>limit:raise ValueError("response too large")
        return data
def sources(n):
    for pref in ["https://tcgbox.co.kr","https://skylook8624.cafe24.com"]:
      for folder in ["big","medium","small"]:
        for ext in ["jpg","png","webp"]:
          yield f"{pref}/web/product/{folder}/s6k/S6K_{n:03d}.{ext}"
    if n==89:
      yield "https://media.bunjang.co.kr/product/417574579_1_1783014759_w1200.jpg"
      yield "https://media.bunjang.co.kr/product/417574579_2_1783014759_w1200.jpg"
      yield "https://media.bunjang.co.kr/product/417574579_3_1783014759_w1200.jpg"
      yield "https://media.bunjang.co.kr/product/417574579_4_1783014759_w1200.jpg"
def listing_images(url):
    try: raw=fetch(url,limit=2000000,timeout=11).decode("utf-8","replace")
    except Exception as e:return [],{"page":url,"error":str(e)[:150]}
    raw=html.unescape(raw).replace("\\/","/")
    matches=re.findall(r'https?://[^"\s<>\\]+',raw)
    accepted=[]
    for m in matches:
        candidate=m.rstrip("',;)")
        if urlsplit(candidate).hostname not in DOMAIN_ALLOW:continue
        if not re.search(r'\.(?:jpg|png|webp|jpeg)(?:\?|$)',candidate,re.I):continue
        if any(x in candidate.lower() for x in ["logo","blank","badge","banner","icon","share","btn"]):continue
        accepted.append(candidate)
    accepted=list(dict.fromkeys(accepted))[:12]
    return accepted,{"page":url,"urlsFound":len(accepted)}
def inspect(n,url):
    try:
        blob=fetch(url,limit=4200000,timeout=9)
        im=Image.open(BytesIO(blob));im.load()
        w,h=im.size
        if w<245 or h<345 or (w/h)<.56 or (w/h)>.84:raise ValueError("Not a plausible full card image "+str((w,h)))
        img=ImageOps.exif_transpose(im).convert("RGB")
        buf=BytesIO();img.save(buf,"WEBP",quality=91,method=6)
        return {"n":n,"url":url,"status":"decoded_card_shaped_candidate_requires_Korean_print_manual_review",
                "size":[w,h],"sha256":hashlib.sha256(blob).hexdigest(),"payload":base64.b64encode(buf.getvalue()).decode("ascii")}
    except Exception as e:return {"n":n,"url":url,"status":"unavailable_or_not_card","error":str(e)[:160]}
rows=[];board=Image.new("RGB",(4*310,550),(247,247,247));draw=ImageDraw.Draw(board)
for idx,(n,name) in enumerate(TARGETS.items()):
    urls=list(sources(n));probes=[]
    for page in PAGES[n]:
        got,record=listing_images(page);probes.append(record)
        urls+=got
    urls=list(dict.fromkeys(urls))[:64]
    results=[]
    with ThreadPoolExecutor(max_workers=10) as pool:
        jobs=[pool.submit(inspect,n,u) for u in urls]
        for f in as_completed(jobs):results.append(f.result())
    found=[x for x in results if x["status"].startswith("decoded")]
    # prefer exact canonical-set host (s6k product directory) over untrusted third-party listings.
    found.sort(key=lambda x:(0 if ("/s6k/S6K_"+f"{n:03d}") in x["url"] else 1, -x["size"][0]))
    selected=[]
    for k,r in enumerate(found[:3]):
        filename=f"{n:03d}-candidate-{k+1}.webp.b64"
        (OUT/filename).write_text(r.pop("payload"),encoding="ascii")
        r["evidenceFile"]=filename
        selected.append(r)
    x=idx*310
    draw.text((x+8,7),f"S6K {n:03d} / Korean printed number to verify",fill=(15,15,15))
    if selected:
        pic=Image.open(BytesIO(base64.b64decode((OUT/selected[0]["evidenceFile"]).read_text())))
        pic.thumbnail((290,445));board.paste(pic,(x+(310-pic.width)//2,34))
    else:draw.text((x+25,200),"NO FULL CARD PHOTO FOUND",fill=(5,5,5))
    rows.append({"number":n,"name":name,"expectedCode":f"s6k_{n:03d}/070",
      "status":"unverified_collect_only","pages":probes,"candidateCount":len(found),
      "selected":selected,"failureSample":[x for x in results if x["status"]!="decoded_card_shaped_candidate_requires_Korean_print_manual_review"][:8]})
buf=BytesIO();board.save(buf,"WEBP",quality=83)
(OUT/"contact.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode("ascii"))
(OUT/"index.json").write_text(json.dumps({"set":"s6K","status":"image_source_discovery_only_none_are_verified","cards":rows},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"candidateNumbers":[r["number"] for r in rows if r["selected"]],
                  "emptyNumbers":[r["number"] for r in rows if not r["selected"]]},ensure_ascii=False))
