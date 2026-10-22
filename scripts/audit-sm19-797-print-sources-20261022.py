#!/usr/bin/env python3
"""Second-pass Korean card image identity and recovery audit for all 797 held SM cards.

Only gather evidence. HTTP success, visual similarity, Korean image origin,
or a corrected image URL alone is NOT verification of the printed footer.
Do not touch master cards, themes, Firestore, or user ownership.
"""
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, quote, urlsplit, urlunsplit
import hashlib, io, json, re, requests
from PIL import Image, ImageDraw, ImageOps

DIR=Path("data/audits")
PRE=DIR/"theme-sm-remaining19-visual-decisions-20261022.json"
SOURCE=DIR/"theme-sm-remaining19-source-evidence-20261022.json"
OUTPUT=DIR/"theme-sm19-797-print-source-recheck-20261022.json"
SHEETS=DIR/"theme-sm19-797-recovery-sheets-20261022"
assert not OUTPUT.exists(), "Preserve previous verified evidence"
holds=json.loads(PRE.read_text(encoding="utf-8"))["held"]
data=json.loads(SOURCE.read_text(encoding="utf-8"))
assert len(holds)==797 and data["canonicalSlots"]==1320
source={(x["set"].lower(),x["index"]):x for x in data["cards"]}
todo=[]
for h in holds:
    key=(h["set"].lower(),h["index"])
    assert key in source
    todo.append(source[key])
assert len(todo)==len({(x["set"].lower(),x["index"]) for x in todo})==797

def make_urls(u):
    if not u.startswith("https://"):return []
    try: parts=urlsplit(u)
    except ValueError:return []
    if parts.hostname not in {"tcgbox.co.kr","static.tcgexchange.kr"}:
        return [u]
    choices=[u]
    path=unquote(parts.path)
    candidates=[]
    if re.search(r'(?i)([ _%-]?copy)(?=\.[a-zA-Z]{3,5}$)',path):
        candidates.append(re.sub(r'(?i)([ _%-]?copy)(?=\.[a-zA-Z]{3,5}$)','',path))
    if "/medium/" in path:candidates.append(path.replace("/medium/","/big/"))
    if "/big/" in path:candidates.append(path.replace("/big/","/medium/"))
    for p in candidates:
        reform=urlunsplit((parts.scheme,parts.netloc,quote(p,safe="/._-"),parts.query,parts.fragment))
        if reform not in choices: choices.append(reform)
    return choices[:3]

def retrieve(x):
    out={"set":x["set"],"index":x["index"],"canonicalCode":x["canonicalCode"],
       "name":x["koreanNameInMaster"],"originalImageReference":x["originalImageReference"],
       "host":x["imageHost"],"priorDecoded":x["decoded"],"priorError":x["imageSourceError"],
       "priorSha256":x["actualSha256"],"liveHttpStatus":None,"liveDecoded":False,
       "liveSha256":None,"sha256SameAsFirstPass":False,"width":None,"height":None,
       "urlCandidateChecks":[],"possibleRecoveredUrl":None,"printedNumberVerified":False,
       "resolution":"korean_print_identity_pending","reason":None}
    decoded=None
    urls=make_urls(x["originalImageReference"])
    for j,url in enumerate(urls):
        if j and x["decoded"] and not x["imageSourceError"]:break
        info={"index":j,"url":url,"status":None,"decoded":False,"error":None}
        try:
            r=requests.get(url,timeout=(6,13),headers={"User-Agent":"Mozilla/5.0 (Korean SM Card Image Audit/1.0)","Accept":"image/jpeg,image/png,image/webp,*/*"})
            info["status"]=r.status_code
            if j==0: out["liveHttpStatus"]=r.status_code
            r.raise_for_status()
            if len(r.content)>8_000_000: raise ValueError("image over 8MB")
            im=Image.open(io.BytesIO(r.content)); im.load()
            info.update(decoded=True,width=im.width,height=im.height,sha256=hashlib.sha256(r.content).hexdigest())
            if im.width<180 or im.height<260:
                info["error"]="image too small to inspect number footer"
            else:
                if j==0:
                    out.update(liveDecoded=True,liveSha256=info["sha256"],width=im.width,height=im.height,
                               sha256SameAsFirstPass=(info["sha256"]==x["actualSha256"]))
                    decoded=im.convert("RGB")
                else:
                    out["possibleRecoveredUrl"]=url
                    decoded=im.convert("RGB")
                out["resolution"]="image_source_accessible_but_print_number_unverified"
                out["reason"]="Source decoded; Korean printed number not independently authenticated"
                out["urlCandidateChecks"].append(info)
                break
        except Exception as e: info["error"]=str(e)[:140]
        out["urlCandidateChecks"].append(info)
    if not out["urlCandidateChecks"]:
        out["resolution"]="source_url_missing"
        out["reason"]="No usable HTTPS image source"
    elif not decoded:
        out["resolution"]="image_unavailable_or_low_resolution"
        out["reason"]="Every tested URL failed or is too small to verify"
    return out,decoded

with ThreadPoolExecutor(max_workers=26) as pool:
    res=list(pool.map(retrieve,todo))
cards=[a for a,b in res]
# Contact sheets for 13 older unavailable cards and each recovered URL candidate.
priority=[(a,b) for a,b in res if not a["priorDecoded"] or a["priorError"] or a["possibleRecoveredUrl"]]
SHEETS.mkdir(parents=True,exist_ok=True)
pages=[]
for start in range(0,len(priority),12):
    segment=priority[start:start+12]
    W,H,COLS=300,410,4
    image=Image.new("RGB",(W*COLS,H*3),"white")
    draw=ImageDraw.Draw(image)
    for idx,(a,pic) in enumerate(segment):
        x=(idx%COLS)*W;y=(idx//COLS)*H
        draw.text((x+8,y+5),f'{a["set"]} #{a["index"]} [{a["resolution"][:18]}]',fill="black")
        draw.text((x+8,y+23),a["name"][:38],fill="black")
        if pic is None:
            draw.text((x+10,y+80),"MISSING / UNVERIFIED",fill="red")
        else:
            im=ImageOps.contain(pic,(W-12,H-63))
            image.paste(im,(x+(W-im.width)//2,y+48))
    filename=f"held-image-recovery-{start//12+1:02d}.jpg"
    image.save(SHEETS/filename,"JPEG",quality=78,optimize=True)
    pages.append({"name":filename,"start":start,"cards":len(segment)})
counts=dict(Counter(c["resolution"] for c in cards))
sets={}
for name in {a["set"] for a in cards}:
    rec=[a for a in cards if a["set"]==name]
    sets[name]={"heldCount":len(rec),"downloadableNow":sum(c["liveDecoded"] for c in rec),
        "sameSourceHashAsFirstPass":sum(c["sha256SameAsFirstPass"] for c in rec),
        "recoveredUrlCandidates":sum(bool(c["possibleRecoveredUrl"]) for c in rec),
        "stillBroken":sum(c["resolution"] in ("source_url_missing","image_unavailable_or_low_resolution") for c in rec)}
report={"schemaVersion":1,"date":"2026-10-22","method":"Real HTTP GET, image decode/dimensions and SHA256 recheck. Alternative paths tested ONLY on failed/small image URLs.",
        "priorHeldSlots":797,"reauditedSlots":len(cards),"statusBreakdown":counts,
        "knownKoreanPrintedFooterVerified":0,
        "sourceHashReverified":sum(c["sha256SameAsFirstPass"] for c in cards),
        "candidateImageRecoveryCount":sum(bool(c["possibleRecoveredUrl"]) for c in cards),
        "priorityImageSheets":pages,"perSet":sets,
        "safeguards":"The presence of Korean text or a successful alternate URL is insufficient to certify printed number; master and theme rows unchanged.",
        "next":"Manually verify full-resolution Korean printed-number footer and card set code for held cards before approving official replacement or theming.",
        "cards":cards}
OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SM19_797_PRINT_RECHECK",json.dumps({"held":797,"status":counts,
        "matchingBytes":report["sourceHashReverified"],"recoveredCandidates":report["candidateImageRecoveryCount"],
        "prioritySheets":len(pages),"perSet":sets},ensure_ascii=False),flush=True)
