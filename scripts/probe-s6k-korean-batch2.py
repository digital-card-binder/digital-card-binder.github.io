#!/usr/bin/env python3
"""Capture only matched Korean S6K rare card product-image candidates for human print-number review.
Do not promote a candidate to a Korean print or mutate catalogs.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from io import BytesIO
import base64,hashlib,json
from PIL import Image,ImageDraw,ImageOps
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s6K/korean-candidates/batch2"
OUT.mkdir(parents=True,exist_ok=True)
ROWS=[
 (84,"세레비 VMAX","https://m.bunjang.co.kr/products/435482104","https://media.bunjang.co.kr/product/435482104_1_1790580923_w1200.jpg"),
 (85,"흑마 버드렉스 VMAX","https://m.bunjang.co.kr/products/392889452","https://media.bunjang.co.kr/product/392889452_1_1772516123_w1200.jpg"),
 (85,"흑마 버드렉스 VMAX","https://m.bunjang.co.kr/products/431443137","https://media.bunjang.co.kr/product/431443137_1_1789301424_w1200.jpg"),
 (87,"메타그로스 VMAX","https://m.bunjang.co.kr/products/434330735","https://media.bunjang.co.kr/product/434330735_1_1790211220_w1200.jpg"),
 (89,"니아","https://m.bunjang.co.kr/products/417574579","https://media.bunjang.co.kr/product/417574579_1_1783014759_w1200.jpg")
]
contact=Image.new("RGB",(5*300,500),(246,246,246))
draw=ImageDraw.Draw(contact)
collected=[]
for i,(number,name,listing,url) in enumerate(ROWS):
    row={"number":number,"name":name,"code":f"s6k_{number:03d}/070","productPage":listing,"directPhotoUrl":url,"status":"candidate_pending_Korean_card_footer_verification"}
    x=i*300;draw.text((x+8,8),f"S6K {number:03d} PHOTO ONLY",fill=(10,10,10))
    try:
        req=Request(url,headers={"User-Agent":"Mozilla/5.0","Accept":"image/*"})
        with urlopen(req,timeout=25) as res:
            blob=res.read(6000001)
            row["http"]=res.status
            row["contentType"]=res.headers.get("content-type","")
        if len(blob)>6000000:raise ValueError("Photo too large")
        im=Image.open(BytesIO(blob));im.load()
        if im.width<300 or im.height<300:raise ValueError("Photo too small")
        im=ImageOps.exif_transpose(im).convert("RGB")
        preview=im.copy();preview.thumbnail((290,425))
        contact.paste(preview,(x+(300-preview.width)//2,24))
        fp=BytesIO();im.save(fp,"WEBP",quality=91,method=6)
        filename=f"{number:03d}-source-{i+1}.webp.b64"
        (OUT/filename).write_text(base64.b64encode(fp.getvalue()).decode("ascii"),encoding="ascii")
        row.update(status="decoded_pending_Korean_print_review",sha256=hashlib.sha256(blob).hexdigest(),
                sourceSize=[im.width,im.height],evidenceFile=filename)
    except Exception as e:
        row["status"]="source_unavailable";row["error"]=str(e)[:220]
    collected.append(row)
buf=BytesIO();contact.save(buf,"WEBP",quality=85)
(OUT/"candidate-contact.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode("ascii"),encoding="ascii")
(OUT/"candidate-index.json").write_text(json.dumps({"schemaVersion":1,"set":"s6K","status":"visual_evidence_only_no_catalog_changes","cards":collected},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"collected":[f"{x['number']}-{i+1}" for i,x in enumerate(collected) if x["status"]=="decoded_pending_Korean_print_review"],"errors":[{"n":x["number"],"error":x.get("error")} for x in collected if x["status"]=="source_unavailable"]},ensure_ascii=False))
