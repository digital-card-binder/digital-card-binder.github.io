#!/usr/bin/env python3
"""Produce original-size Korean card identity images for six recovered URL candidates."""
from pathlib import Path
from urllib.parse import urlsplit
import requests, json, hashlib, io
from PIL import Image,ImageDraw,ImageOps
D=Path("data/audits")
src=json.loads((D/"theme-sm19-797-print-source-recheck-20261022.json").read_text())
selected=[x for x in src["cards"] if x.get("possibleRecoveredUrl")]
assert len(selected)==6, f'Expected six, got {len(selected)}'
OUT=D/"theme-sm19-797-six-recovered-printed-identity-evidence-20261022.json"
P=D/"theme-sm19-797-six-original-source-visual-20261022"
P.mkdir(parents=True,exist_ok=True)
records=[]
for a in selected:
    url=a["possibleRecoveredUrl"]
    assert urlsplit(url).hostname in {"tcgbox.co.kr","static.tcgexchange.kr"}
    req=requests.get(url,timeout=(8,20),headers={"User-Agent":"Mozilla/5.0 (Korean SM Card Audit)"})
    req.raise_for_status()
    im=Image.open(io.BytesIO(req.content)).convert("RGB")
    assert im.width>=180 and im.height>=260
    key=f'{a["set"].lower()}-{a["index"]:03d}'
    imgpath=P/f'{key}.jpg'
    im.save(imgpath,"JPEG",quality=96)
    w,h=im.size
    footer=im.crop((0,int(h*.84),w,h))
    footer=footer.resize((w*3,footer.height*3))
    footer.save(P/f'{key}-footer.png',"PNG")
    records.append({"set":a["set"],"index":a["index"],"expectedCode":a["canonicalCode"],
       "expectedKoreanName":a["name"],"originalBrokenImageUrl":a["originalImageReference"],
       "replacementCandidateUrl":url,"sourceSha256":hashlib.sha256(req.content).hexdigest(),
       "sourceImageWidth":w,"sourceImageHeight":h,"imageFile":imgpath.name,
       "footerFile":f'{key}-footer.png',"manuallyVerifiedKoreanPrintNumber":False})
assert len(records)==6
OUT.write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-22",
 "scope":"Six candidate recoveries, original full-size image and footer review pending",
 "sourceAudit":"data/audits/theme-sm19-797-print-source-recheck-20261022.json",
 "candidateCards":records},ensure_ascii=False,indent=2)+"\n")
print("SM19_SIX_RECOVERED_CANDIDATES",json.dumps(records,ensure_ascii=False))
