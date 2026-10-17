#!/usr/bin/env python3
"""Sample Korean retailer scans for *unresolved* S-era cards, without publishing them.

Public seller image discovery is not redistribution permission or exact-print proof.
Copies used for contact review are bounded, low-res audit previews only.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
import re,base64,json,socket
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
Q=json.loads((ROOT/"data/audits/korean-recovery-active-queue-20261017.json").read_text(encoding="utf-8"))
OUT=ROOT/"data/audits/korean-recovery-retailer-source-s-20261017"
OUT.mkdir(parents=True,exist_ok=True)
assert Q["queueCount"]==191 and len(Q["unresolved"])==191

def candidate(row):
    series=str(row["series"]).upper()
    key=row["slot"]
    # Preview only exact S set cards where Korean retailer source URL pattern is already supported by prior audits.
    if not re.fullmatch(r"S[0-9][A-Z]?",series):
        return None
    num=re.search(r"[_:]0*([0-9]{1,3})(?:/|$)",key)
    if not num:
        return None
    n=int(num.group(1))
    if not (1<=n<=999):
        return None
    return f"https://tcgbox.co.kr/web/product/big/{series}/{series}_{n:03d}.jpg"

def check(row):
    uri=candidate(row)
    result={"slot":row["slot"],"name":row["cardName"],"set":row["series"],
            "status":"not_probed","verifiedKoreanNumber":False,
            "licenseToPublish":False,"imageApplied":False}
    if not uri:return result,None
    result["candidateUrl"]=uri
    try:
        req=Request(uri,headers={"User-Agent":"Mozilla/5.0 (Korean card print source audit)","Accept":"image/jpeg,image/webp,*/*"})
        with urlopen(req,timeout=12) as res:
            result["http"]=res.status
            binary=res.read(2_500_001)
        if len(binary)>2_500_000:return {**result,"status":"over_size_limit"},None
        with Image.open(BytesIO(binary)) as im:
            im.verify()
        with Image.open(BytesIO(binary)) as im:
            w,h=im.size
            result["dimensions"]=[w,h]
            if min(w,h)<190 or len(binary)<4500 or h/w<1.15:
                return {**result,"status":"tiny_or_non_card_photo_not_approved"},None
            result.update({"bytes":len(binary),"sha256":sha256(binary).hexdigest(),"status":"retailer_image_candidate_requires_korean_print_visual_check"})
            img=ImageOps.exif_transpose(im).convert("RGB")
            img.thumbnail((360,510),Image.Resampling.LANCZOS)
            output=BytesIO();img.save(output,"WEBP",quality=80)
            return result,output.getvalue()
    except HTTPError as e:result.update({"http":e.code,"status":"http_not_available_no_conclusion"})
    except (URLError,TimeoutError,socket.timeout,OSError) as e:
        result.update({"status":"fetch_error_no_conclusion","errorClass":type(e).__name__})
    return result,None

rows=[r for r in Q["unresolved"] if candidate(r)]
with ThreadPoolExecutor(max_workers=5) as pool:
    results=list(pool.map(check,rows))
record=[]
previews=0
for row,img in results:
    if img is not None and previews<20:
        filename=f"{row['slot'].replace('/','_').replace(':','_').replace('+','plus')}.webp.b64"
        (OUT/filename).write_text(base64.b64encode(img).decode("ascii"),encoding="ascii")
        row["preview"]=f"data/audits/{OUT.name}/{filename}"
        row["previewIsReviewOnly"]=True
        previews+=1
    record.append(row)
statuses={}
for x in record:statuses[x["status"]]=statuses.get(x["status"],0)+1
report={"schemaVersion":1,"recordedAt":datetime.now(timezone.utc).isoformat(),
    "queueSizePreserved":191,"era":"S","source":"Korean retail-card image URL pattern recorded in prior audits",
    "scanned":len(record),"previewCount":previews,"statuses":statuses,"rows":record,
    "masterChanges":0,"cardImageChanges":0,"doNotPromoteToApprovedWithoutReadableFooter":True,
    "usageNote":"These are low-res review candidates from a retailer; publisher-owned source rights remain to be confirmed. No copied thumbnails are used in the site.",
    "next":"Visually compare candidate images against exact Korean name, printed number and rarity before any individually justified replacement."}
(OUT/"index.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"scanned":len(record),"statuses":statuses,"previews":previews},ensure_ascii=False),flush=True)
