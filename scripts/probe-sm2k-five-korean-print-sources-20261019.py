#!/usr/bin/env python3
"""Source probe ONLY for five held Korean SM2K prints; do not approve metadata as a print."""
from __future__ import annotations
import base64
import hashlib
import html
import io
import json
import re
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
import requests
from PIL import Image, ImageOps, ImageDraw

TRIAGE=Path("data/audits/sm2k-five-remaining-korean-photo-source-triage-20261018.json")
CHECKPOINT=Path("data/audits/theme-sm2k-031-062-progress-20261018.json")
COVERAGE=Path("data/audits/theme-series-coverage.json")
OUT=Path("data/audits/sm2k-five-korean-print-source-probe-20261019.json")
triage=json.loads(TRIAGE.read_text(encoding="utf-8"))
checkpoint=json.loads(CHECKPOINT.read_text(encoding="utf-8"))
coverage=json.loads(COVERAGE.read_text(encoding="utf-8"))
HOLD=[57,58,60,61,62]
assert checkpoint["themeReviewed"]==57 and checkpoint["heldCardNumbers"]==HOLD
assert triage["remainingImageHolds"]==HOLD
assert coverage["summary"]["strictCompleteSetCount"]==109
assert coverage["summary"]["themeCardSlots"]==18011
assert next(x for x in coverage["sets"] if x["code"].lower()=="sm2k")["status"]=="pending"
session=requests.Session()
header={"User-Agent":"Mozilla/5.0 (compatible; PokemonCardBinderResearch/1.0; one-time print source verification)","Accept":"image/png,image/jpeg,image/webp,text/html,*/*"}
indexRoots=[
 "https://k-tcgpanda.com/cardimg/SM/SM2K/",
 "https://k-tcgpanda.com/cardimg/SM/sm2K/",
]
sources=[]
catalogueChecks=[]
for root in indexRoots:
    try:
      response=session.get(root,headers=header,timeout=15)
      matched=[]
      if response.ok and "text/html" in response.headers.get("content-type",""):
        for href in re.findall(r'<a\s+[^>]*href\s*=\s*["\']([^"\']+)["\']',response.text,re.I):
          candidate=urljoin(root,html.unescape(href))
          part=unquote(urlparse(candidate).path).lower()
          if urlparse(candidate).hostname == 'k-tcgpanda.com' and any(part.endswith('_sm2k_%03d_kor.%s' % (num, ext)) for num in HOLD for ext in ('jpg', 'jpeg', 'png', 'webp')):
            matched.append(candidate)
      catalogueChecks.append({"url":root,"httpStatus":response.status_code,"matchingKoreanPhotos":len(matched)})
      sources+=matched
    except Exception as ex:
      catalogueChecks.append({"url":root,"error":str(ex)[:240]})
for num in HOLD:
    sources.append(f"https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM2K/SM2K_{num:03d}.png")
    sources.append(f"https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM2K/SM2K_{num:03d}.png?w=512")
sources=list(dict.fromkeys(sources))
print("SM2K_HOLD_INDEX_CHECK",json.dumps(catalogueChecks,ensure_ascii=False))
results=[]
preview=[]
for src in sources:
  decoded=unquote(src)
  code=re.search(r'SM2K[_ ](057|058|060|061|062)',decoded,re.I)
  number=int(code.group(1)) if code else None
  item={"source":src,"number":number,"kind":"KOR_filename" if "_KOR." in decoded.upper() else "officialKoreaCDN_probe",
        "cardTextVisuallyRead":False,"printedKoreanNumberVisuallyRead":False}
  try:
    res=session.get(src,headers=header,timeout=22)
    item["httpStatus"]=res.status_code
    item["mimeType"]=res.headers.get("content-type")
    item["imageBytes"]=len(res.content)
    res.raise_for_status()
    image=Image.open(io.BytesIO(res.content))
    image.load()
    item.update(decoded=True,width=image.width,height=image.height,format=image.format,
                sha256=hashlib.sha256(res.content).hexdigest())
    if number in HOLD:
      preview.append((number,src,image.convert("RGB")))
  except Exception as exc:
    item.update(decoded=False,error=str(exc)[:270])
  results.append(item)
# One image per held printed number; prefer KOR explicitly labelled files to guessed CDN.
selected=[]
for num in HOLD:
  options=[p for p in preview if p[0]==num]
  preferred=sorted(options,key=lambda x:(0 if "_kor." in unquote(x[1]).lower() else 1,len(x[1])))
  if preferred: selected.append(preferred[0])
if selected:
  W,H=460,665
  sheet=Image.new("RGB",(W*len(selected),H+29),"white")
  draw=ImageDraw.Draw(sheet)
  for i,(num,url,img) in enumerate(selected):
    thumb=ImageOps.contain(img,(W-10,H-12))
    sheet.paste(thumb,(i*W+(W-thumb.width)//2,29+(H-thumb.height)//2))
    draw.text((i*W+9,5),f"SM2K_{num:03d}",fill="black")
  stream=io.BytesIO()
  sheet.save(stream,format="JPEG",quality=75,optimize=True)
  print("SM2K_HOLD_PREVIEW_BEGIN")
  print(base64.b64encode(stream.getvalue()).decode("ascii"))
  print("SM2K_HOLD_PREVIEW_END")
report={
 "schemaVersion":1,"recordedAt":"2026-10-19",
 "scope":"Existing five unresolved Korean SM2K printed-card image holds only",
 "totalKoreanSetCards":62,"previouslyStrictlyApprovedKoreanPrints":57,
 "previouslyApprovedThemeCards":57,"unresolvedHoldNumbers":HOLD,
 "visualKoreanPrintedCardApprovalsThisAutomatedProbe":0,
 "sourcesInspected":len(results),
 "sourceIndexProbes":catalogueChecks,
 "imageSourceProbes":results,
 "visualReviewNeeded":True,
 "semanticWarning":"HTTP success and SHA256 are not evidence of Korean text. The selected preview must be visually read before advancing any of the 5 holds.",
 "cardOrThemeMasterEdits":0,"ownershipOrFirestoreEdits":0,
 "previousSM2KReviewStateUnchanged":True,
 "previousStrictCompleteSeriesCountUnchanged":109,
 "original191CardRecoveryUnchanged":True,
 "next":"Review preview card pixels for Korean-language text and exact footer 057,058,060,061,062; obtain self-host permission if migrating photos."
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SM2K_HELD_PRINT_SOURCE_PROBE",json.dumps({ "filesDecoded":sum(x["decoded"] for x in results),"selectedPreviewCount":len(selected),"count":len(results),"holdNumbers":HOLD },ensure_ascii=False))
