#!/usr/bin/env python3
"""Bounded original-image rescue probe for 13 exact SM high-rarity Korean cards.
Never approve a card by code-only name, Japanese art, or HTTP success.
Records 12-35 known-domain URL variants for each original missing card.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote, urlsplit
from collections import Counter
import requests, hashlib, io, json, re
from PIL import Image, ImageDraw, ImageOps
D=Path("data/audits")
evidence=json.loads((D/"theme-sm19-797-print-source-recheck-20261022.json").read_text())
prior=json.loads((D/"theme-sm19-six-korean-print-footer-verified-20261022.json").read_text())
missing=[c for c in evidence["cards"] if c["resolution"]=="image_unavailable_or_low_resolution"]
assert len(missing)==13 and sum(c["set"].lower()=="sm11b" for c in missing)==4 and sum(c["set"].lower()=="sm12" for c in missing)==3 and sum(c["set"].lower()=="sm12a" for c in missing)==6
assert prior["acceptedCount"]==6

def variants(c):
    setcode=c["set"].lower()
    i=c["index"]
    std=f"{i:03d}"
    caps={"sm11b":"SM11b","sm12":"SM12","sm12a":"SM12a"}[setcode]
    base=c["originalImageReference"]
    urls=[base]
    folders=[caps,setcode,setcode.upper()]
    stem=[f"{caps}_{std} copy",f"{caps}_{std}",f"{caps}_{std} Copy",f"{setcode}_{std}",f"{caps}_{std} (1)",f"{caps}_{std} copy 2",f"{caps}_{std} copy(1)"]
    for folder in folders:
        for direction in ["big","medium"]:
            for name in stem:
                urls.append("https://tcgbox.co.kr/web/product/"+direction+"/"+folder+"/"+quote(name,safe="_.-")+".jpg")
    urls= list(dict.fromkeys(urls))
    # Directories with Korean language filename are indexed but may forbid hotlinks.
    safe=c["name"].replace(" ","")
    for name in [f"{c['name']}_{caps}_{std}_KOR.jpg",f"{safe}_{caps}_{std}_KOR.jpg",f"{c['name']}_{caps}_{std}_KOR.png"]:
        urls.append("https://k-tcgpanda.com/cardimg/SM/"+caps+"/"+quote(name,safe="_.-"))
    return urls[:47]
rows=[(c,u) for c in missing for u in variants(c)]
print("SOURCE_PROBE_QUEUED",len(rows),flush=True)
def get(args):
 c,u=args
 result={"set":c["set"],"index":c["index"],"canonicalCode":c["canonicalCode"],
   "name":c["name"],"url":u,"status":None,"decoded":False,"sha256":None,"dimensions":None,"error":None}
 try:
    r=requests.get(u,timeout=(5,9),headers={"User-Agent":"Mozilla/5.0 (compatible; CardBinderKoreanCardVerification/1.0)","Accept":"image/avif,image/webp,image/jpeg,image/png,*/*"},allow_redirects=True)
    result["status"]=r.status_code
    r.raise_for_status()
    if len(r.content)>8_000_000:raise ValueError("payload over 8 MB")
    im=Image.open(io.BytesIO(r.content))
    im.load()
    if im.width<180 or im.height<260:raise ValueError(f"Too small {im.size}")
    result.update(decoded=True,sha256=hashlib.sha256(r.content).hexdigest(),dimensions=[im.width,im.height],format=im.format)
    return result,im.convert("RGB")
 except Exception as err:
    result["error"]=str(err)[:150]
    return result,None
with ThreadPoolExecutor(max_workers=22) as pool:
    results=list(pool.map(get,rows))
allchecks=[a for a,im in results]
good={}
for a,im in results:
 if not a["decoded"]: continue
 k=(a["set"].lower(),a["index"])
 if k not in good:good[k]=[]
 if len(good[k])>=3:continue
 if any(x[0]["sha256"]==a["sha256"] for x in good[k]):continue
 good[k].append((a,im))
P=D/"theme-sm19-13-source-rescue-contact-20261022"
P.mkdir(exist_ok=True)
sheet=Image.new("RGB",(1100, int((len(missing)+1)//2)*530),"white")
draw=ImageDraw.Draw(sheet)
for k,c in enumerate(missing):
 x=k%2*550;y=k//2*530
 draw.text((x+10,y+12),f'{c["set"]} {c["index"]} {c["canonicalCode"]}',fill="black")
 draw.text((x+10,y+30),c["name"],fill="black")
 candidates=good.get((c["set"].lower(),c["index"]),[])
 if not candidates:
    draw.text((x+10,y+100),"NO VALID IMAGE FOUND",fill="red")
 else:
    for i,(_,im) in enumerate(candidates):
       thumb=ImageOps.contain(im,(175,440))
       sheet.paste(thumb,(x+i*180+8,y+54))
sheet.save(P/"13-recovery-candidates.jpg","JPEG",quality=78)
rows2=[]
for c in missing:
    k=(c["set"].lower(),c["index"])
    choices=[]
    for z,im in good.get(k,[]):
        stem=f"{k[0]}-{k[1]:03d}-{len(choices)+1}"
        im.save(P/(stem+".jpg"),"JPEG",quality=93)
        w,h=im.size
        crop=im.crop((0,int(h*.83),w,h))
        crop.resize((w*2,crop.height*2)).save(P/(stem+"-footer.png"))
        choices.append({**z,"localImage":stem+".jpg","localFooter":stem+"-footer.png",
          "koreanPrintedFooterVerified":False})
    rows2.append({"set":c["set"],"index":c["index"],"code":c["canonicalCode"],
         "name":c["name"],"testedUrls":len(variants(c)),
         "candidatesFound":len(choices),"matches":choices,
         "remainingStatus":"no_downloadable_korean_print_source" if not choices else "image_candidate_pending_manual_korean_print_verification"})
report={"schemaVersion":1,"recordedAt":"2026-10-22","attemptedCards":13,
 "candidateUrlRequests":len(rows),"httpCounts":dict(Counter(str(x["status"]) for x in allchecks)),
 "candidateImagesFound":sum(x["candidatesFound"] for x in rows2),
 "candidateCards":sum(bool(x["candidatesFound"]) for x in rows2),
 "verifiedKoreanPrintedFooterCount":0,
 "warning":"A downloaded image may be Japanese or a mismatched print, so a human image-footer check is required.",
 "cards":rows2}
(D/"theme-sm19-13-source-rescue-probe-20261022.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("SM19_13_RESCUE_PROBE",json.dumps({"requests":len(rows),"candidateCards":report["candidateCards"],"candidateImages":report["candidateImagesFound"],
 "byCard":[{"code":r["code"],"found":r["candidatesFound"]} for r in rows2]},ensure_ascii=False),flush=True)
