#!/usr/bin/env python3
"""Conservative XY full-catalog image/source audit and automatic *color-only* tags.

The 11 scene/story themes cannot be certified by pixel colors. They remain held for
individual human visual review. Never turn source verification into a claim of
complete 12-theme or verified physical Korean footer certification.
"""
import concurrent.futures
import datetime
import hashlib
import io
import json
import re
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
LOAD=lambda name:json.loads((ROOT/name).read_text(encoding="utf-8"))
SAVE=lambda name,data:(ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
DATE="2026-10-26"
AUDIT="data/audits/theme-xy-all37-image-color-proof-20261026.json"
THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"]
MASTER=LOAD("data/series.json")+LOAD("data/series-legacy.json")
XY=[s for s in MASTER if s.get("era")=="XY"]
assert len(XY)==37, "XY set baseline changed; stop and reconcile"
assert sum(len(s["cards"]) for s in XY)==2313, "XY card baseline changed"
ART=LOAD("data/art-themes.json")
assert set(g["code"] for g in ART["groups"])==set(THEMES)
GROUP={g["code"]:g for g in ART["groups"]}
STATUS=LOAD("data/audits/theme-series-review-status.json")
COVER=LOAD("data/audits/theme-series-coverage.json")
assert sum(len(g["cards"]) for g in ART["groups"])==22032, "Concurrent theme changes; stop"
assert COVER["summary"]["themeCardSlots"]==22032
EXISTING={(str(c.get("set","")).lower(),str(c.get("code","")).lower()) for c in GROUP["color"]["cards"]}
SET_CODE={s["code"].lower():s for s in XY}
IMAGE_DIR=ROOT/"tmp"/"xy37-review-sheets"
IMAGE_DIR.mkdir(parents=True,exist_ok=True)

def download(item):
    sc,idx,card=item
    url=str(card.get("image") or "")
    host=(urllib.parse.urlsplit(url).hostname or "").lower()
    base=urllib.parse.urlsplit(url).path.rsplit("/",1)[-1]
    candidate=re.search(r"_0*(\d{1,4})\.(png|jpe?g|webp)$",base,re.I)
    printed=re.search(r"_0*(\d{1,4})(?:/|$)",str(card.get("code") or ""),re.I)
    entry={"set":sc,"index":idx,"code":card.get("code"),"name":card.get("name"),
       "url":url,"sourceHost":host,"status":"held","sha256":None,
       "printedFooterVisuallyVerified":False,"actualImageColorAnalyzed":False}
    if host!="cards.image.pokemonkorea.co.kr":
        entry["reason"]="external image host: not certified as authentic Korean printing"
        return entry,None
    if not candidate or not printed or int(candidate.group(1))!=int(printed.group(1)):
        entry["reason"]="source filename/index differs from Korean canonical slot"
        return entry,None
    # IMPORTANT: inspect the already archived WebP from OUR Cloudflare Pages.
    # No image request is ever sent to the original Pokemon Korea CDN.
    source_path=urllib.parse.urlsplit(url).path
    mirror_path=re.sub(r"\.(?:png|jpe?g|webp)$",".webp",source_path,flags=re.I)
    mirror_url="https://dcb-card-images-legacy-2026.pages.dev"+mirror_path
    entry["archiveUrl"]=mirror_url
    raw=None
    for attempt in range(3):
        try:
            req=urllib.request.Request(mirror_url,headers={
              "User-Agent":"Mozilla/5.0 (compatible; DigitalCardBinder XY Archive Audit/1.0)"})
            with urllib.request.urlopen(req,timeout=19) as resp:
                if not str(resp.headers.get("Content-Type","")).lower().startswith("image/"):
                    raise ValueError("non-image content type")
                raw=resp.read(6_000_001)
            if len(raw)>6_000_000: raise ValueError("image larger than limit")
            with Image.open(io.BytesIO(raw)) as photo:
                photo.load()
                if photo.width<140 or photo.height<180:raise ValueError("small/incomplete image")
                img=photo.convert("RGB")
            entry["archiveWebpSha256"]=hashlib.sha256(raw).hexdigest()
            entry["sha256"]=entry["archiveWebpSha256"]
            entry["width"],entry["height"]=img.size
            entry["status"]="source-image-verified"
            return entry,img
        except Exception as ex:
            entry["reason"]=type(ex).__name__+": "+str(ex)[:160]
            time.sleep(.6*(attempt+1))
    return entry,None

def artwork_color(img):
    # The illustration panel occupies the upper-central card, not the printed
    # footer and not the elemental-type border. Analyze artwork pixels only.
    w,h=img.size
    box=(int(w*.13),int(h*.14),int(w*.88),int(h*.51))
    p=img.crop(box).resize((84,64),Image.Resampling.BILINEAR).convert("HSV")
    bins=Counter()
    for hue,sat,val in p.getdata():
        h=float(hue)/255.;s=float(sat)/255.;v=float(val)/255.
        if v<.20: name="검정"
        elif s<.17: name="흰색" if v>.82 else "회색"
        elif h<.032 or h>=.968: name="빨강"
        elif h<.105:name="주황"
        elif h<.175:name="노랑"
        elif h<.390:name="초록"
        elif h<.515:name="청록"
        elif h<.690:name="파랑"
        elif h<.815:name="보라"
        else:name="분홍"
        bins[name]+=1
    total=sum(bins.values())
    primary=bins.most_common()
    if not primary or primary[0][1]/total<.16: return None,{}
    names=[k for k,n in primary if n/total>=.105]
    if not names: return None,{}
    category="·".join(names[:2]) if len(names)>1 else names[0]
    # This is objective color-palette categorization, NOT verification of other
    # scenery, activity, relations, evolution, cameo, sleep or sky themes.
    return category,{k:round(v/total,4) for k,v in primary}

tasks=[(s["code"],i+1,c) for s in XY for i,c in enumerate(s["cards"])]
results=[]
images={}
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
    future_to_task={pool.submit(download,t):t for t in tasks}
    for f in concurrent.futures.as_completed(future_to_task):
        t=future_to_task[f]
        try:entry,img=f.result()
        except Exception as ex:
            entry={"set":t[0],"index":t[1],"code":t[2].get("code"),
                "status":"held","reason":"unhandled download error "+repr(ex)}
            img=None
        if img is not None:
            category,distribution=artwork_color(img)
            if category:
                entry["colorCategory"]=category
                entry["colorDistribution"]=distribution
                entry["actualImageColorAnalyzed"]=True
                entry["status"]="official-source-color-reviewed"
                # save a small visual sheet sample, never publish full raw images
                if len(images.get(t[0],[]))<48:
                    images.setdefault(t[0],[]).append((t[1],img.copy()))
            else:
                entry["status"]="held"
                entry["reason"]="no distinguishable illustration palette"
        results.append(entry)

results.sort(key=lambda e:(list(SET_CODE).index(str(e["set"]).lower()),e["index"]))
for sc,items in images.items():
    items.sort(key=lambda x:x[0])
    sheet=Image.new("RGB",(8*143,6*184),"white")
    d=ImageDraw.Draw(sheet)
    for k,(index,img) in enumerate(items[:48]):
        card=img.copy()
        card.thumbnail((128,159))
        x=(k%8)*143+7;y=(k//8)*184+5
        sheet.paste(card,(x,y))
        d.text((x,y+160),f"{sc} #{index:03}",fill="black")
    sheet.save(IMAGE_DIR/(re.sub(r"[^A-Za-z0-9_-]","_",sc)+".jpg"),quality=79)

before=sum(len(g["cards"]) for g in ART["groups"])
added=0
new_ids=set()
for e in results:
    if e["status"]!="official-source-color-reviewed":continue
    sc=e["set"].lower()
    s=SET_CODE[sc]
    card=s["cards"][e["index"]-1]
    numeric=re.search(r"_0*(\d{1,4})(?:/|$)",card["code"],re.I)
    assert numeric is not None
    code=card["code"].split("_")[0].upper()+"_"+numeric.group(1).zfill(3)
    key=(sc,code.lower())
    if key in EXISTING:
        e["previousColorTagPreserved"]=True
        continue
    assert key not in new_ids, "collision "+str(key)
    new_ids.add(key)
    GROUP["color"]["cards"].append({
       "code":code,"name":card["name"],"series":"XY","set":s["code"],
       "setName":s.get("displayName") or s.get("title") or s["code"],
       "cardNumber":card["code"].split("_",1)[-1],
       "rarity":card.get("rarity") or "","category":e["colorCategory"],
       "image":card["image"],
       "evidence":"Our Cloudflare self-hosted Korean artwork WebP inspected for color only, archive SHA256="+e["sha256"]+
                  "; no independent scene or printed-footer certification; "+AUDIT})
    added+=1
assert len(GROUP["color"]["cards"])==len({(str(x.get("set","")).lower(),str(x.get("code","")).lower()) for x in GROUP["color"]["cards"]}),"duplicate color code"
assert sum(len(g["cards"]) for g in ART["groups"])==before+added
assert sum(1 for e in results if e["status"] in ("official-source-color-reviewed","held"))==2313

by_set=[]
for s in XY:
    row=[e for e in results if e["set"].lower()==s["code"].lower()]
    approved=sum(e["status"]=="official-source-color-reviewed" for e in row)
    held=len(row)-approved
    by_set.append({"code":s["code"],"name":s.get("displayName"),"masterCards":len(row),
                   "officialImagesColorReviewed":approved,"heldOrUndecodable":held,
                   "fullTwelveThemeCertification":False})
    original_key=next((k for k in STATUS["reviews"] if k.lower()==s["code"].lower()),s["code"])
    existing=STATUS["reviews"].get(original_key) or {}
    assert existing.get("status") not in ("complete",), "strict complete set unexpectedly modified"
    STATUS["reviews"][original_key]={
      **existing,"status":"partial","reviewedAt":DATE,
      "reviewedCardCount":approved,"reviewedThemes":["color"],
      "evidence":AUDIT,
      "note":f"Official Korean art image color checked {approved}/{len(row)}; {held} held. Eleven narrative/scenery themes and physical printed footer proof not certified; do not mark complete."}

report={
 "schemaVersion":1,"recordedAt":DATE,
 "task":"XY 37 Korean sets, 2,313 individual official source artwork images, conservative COLOR-only audit",
 "method":"Downloaded our already mirrored Cloudflare Pages archival WebP (no original-source requests); checked canonical number against original catalog filename, decoded image and archived WebP SHA256, sampled center illustration pixels. Archived copy provenance or Korean physical footer NOT verified.",
 "sets":by_set,
 "totalMasterCards":2313,
 "actualSourceImageColorReviewed":sum(x["officialImagesColorReviewed"] for x in by_set),
 "held":sum(x["heldOrUndecodable"] for x in by_set),
 "newIndependentColorThemeMemberships":added,
 "themeMembershipsBefore":before,"themeMembershipsAfter":before+added,
 "themeAdditionsByTheme":{"color":added},
 "preexistingOtherThemeMembershipsPreserved":True,
 "otherElevenThemeVisualCertificationsPending":True,
 "newStrictlyCompletedSetCount":0,
 "cards":results
}
ART["updatedAt"]=DATE
SAVE("data/art-themes.json",ART)
SAVE("data/audits/theme-series-review-status.json",STATUS)
SAVE(AUDIT,report)
path=ROOT/"tests"/"theme-card-identity.test.mjs"
src=path.read_text(encoding="utf-8")
old="assert.equal(total,22032);"
assert src.count(old)==1, "Unexpected theme test baseline"
path.write_text(src.replace(old,f"assert.equal(total,{before+added}); // XY 37 Korean-set official image color audit, 11 story/scene themes remain pending"),encoding="utf-8")
print("XY37_COLOR_AUDIT",json.dumps({k:v for k,v in report.items() if k!="cards"},ensure_ascii=False))
