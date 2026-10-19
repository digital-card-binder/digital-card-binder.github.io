#!/usr/bin/env python3
"""Generate transient visual proof panels for unresolved Korean SM2L image cards.

Actual bytes are compared with audited SHA256s. These are log previews only; no
source/card/user data is modified, and nothing is auto-marked as visually read.
"""
from __future__ import annotations
import base64, concurrent.futures, hashlib, io, json, os, sys
from pathlib import Path
import requests
from PIL import Image, ImageDraw, ImageOps

root=json.loads(Path("data/audits/theme-sm2l-korean-visual-confirmation-batch01-20261019.json").read_text(encoding="utf-8"))
source=json.loads(Path("data/audits/theme-sm2l-canonical-image-http-and-decoding-20261019.json").read_text(encoding="utf-8"))
unreviewed=root["needsFurtherInspection"]
assert len(unreviewed)==43
all_lookups={x["code"]:x for x in source["sourceRecords"]}
chunk=int(os.environ["SM2L_PREVIEW_CHUNK"])
assert chunk in (1,2,3)
batch=unreviewed[(chunk-1)*15:chunk*15]
assert 0<len(batch)<=15
HEADERS={"User-Agent":"Mozilla/5.0 (compatible; PokemonCardAudit/1.0)","Accept":"image/png,image/jpeg,*/*"}

def fetch(item):
    code=item["code"]
    src=all_lookups[code]
    url=src["originalUrl"].replace(" ","%20")
    response=requests.get(url,headers=HEADERS,timeout=24)
    response.raise_for_status()
    im=Image.open(io.BytesIO(response.content))
    im.load()
    digest=hashlib.sha256(response.content).hexdigest()
    assert digest==src["sha256"],f"{code} SHA256 changed between audit and current proof"
    return code,im.convert("RGB"),src

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    imgs=list(pool.map(fetch,batch))
print("SM2L_PREVIEW_CHUNK",chunk,"codes",[x[0] for x in imgs],"bytehashChecked",len(imgs))
def emit(tag,image):
    stream=io.BytesIO()
    image.save(stream,format="JPEG",quality=77,optimize=True)
    print(f"{tag}_BEGIN")
    print(base64.b64encode(stream.getvalue()).decode("ascii"))
    print(f"{tag}_END")
def render_group(group,group_idx):
    width,height=505,710
    panel=Image.new("RGB",(width*len(group),height+33),"#f1f1f1")
    draw=ImageDraw.Draw(panel)
    for i,(code,im,_) in enumerate(group):
        thumb=ImageOps.contain(im,(width-18,height-14))
        panel.paste(thumb,(i*width+(width-thumb.width)//2,33+(height-thumb.height)//2))
        draw.text((i*width+8,6),code,fill="#111111")
    emit(f"SM2L_PREVIEW_CHUNK{chunk}_PART{group_idx+1}",panel)

for gi in range(0,len(imgs),3):
    render_group(imgs[gi:gi+3],gi//3)

# Enlarged footer region helps visually read code and rarity on small retailer scans.
w,h=505,172
rows=(len(imgs)+2)//3
sheet=Image.new("RGB",(w*3,rows*(h+26)),"white")
draw=ImageDraw.Draw(sheet)
for i,(code,im,_) in enumerate(imgs):
    col,row=i%3,i//3
    cut=im.crop((0,int(im.height*.775),im.width,im.height))
    cut=ImageOps.contain(cut,(w-16,h-4))
    sheet.paste(cut,(col*w+(w-cut.width)//2,row*(h+26)+26))
    draw.text((col*w+8,row*(h+26)+5),code+" FOOTER",fill="black")
emit(f"SM2L_FOOTERS_CHUNK{chunk}",sheet)
