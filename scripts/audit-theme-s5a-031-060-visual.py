#!/usr/bin/env python3
"""Independent evidence-only S5a 031-060 preflight for 12-theme Korean review.
Never mark cards complete based on source URLs or machine-created contact sheets.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from io import BytesIO
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from PIL import Image, ImageDraw
import json, base64, hashlib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/audits/theme-visual-evidence/s5a/031-060"
OUT.mkdir(parents=True, exist_ok=True)
def read(p):
    return json.loads((ROOT / p).read_text(encoding="utf8"))
modern = read("data/series.json")
legacy = read("data/series-legacy.json")
status = read("data/audits/theme-series-review-status.json")
coverage = read("data/audits/theme-series-coverage.json")
hosting = read("data/audits/theme-image-selfhost-audit.json")
global_hold = "s6K Korean print source pending: 089,090,092,094"
assert status["execution"]["nextStart"] == hosting["nextStart"] == global_hold
sets = [s for s in modern + legacy if str(s.get("code","")).lower() == "s5a"]
assert len(sets) == 1 and len(sets[0]["cards"]) == 96, "Expected unchanged Korean S5a 96 slots"
meta = coverage["sets"]
target = next((s for s in meta if str(s.get("code","")).lower() == "s5a"),None)
assert target is not None and target["status"] in ("pending", "in_progress") and target["cardCount"] == 96
assert not any(k.lower() == "s5a" and v.get("status") == "complete"
               for k,v in status["reviews"].items())
master = sets[0]
cards = []
for i in range(31,61):
    c=master["cards"][i-1]
    n="%03d" % i
    expected="s5a_"+n+"/070"
    assert c.get("code","").lower()==expected, "Unexpected master number "+expected
    src = c.get("sourceImage") or c.get("image") or ""
    assert c.get("name","").strip(), "Unnamed Korean card "+n
    assert src.startswith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5a/")
    owned="https://dcb-card-images-modern-2026.pages.dev/" + src.split(".co.kr/",1)[1].rsplit(".",1)[0] + ".webp"
    cards.append({
      "canonicalOrder":i,"code":expected,"name":c["name"],
      "printedNumber":n+"/070","rawSource":src,"ownedUrl":owned,
      "ownedHostingExpectation":"existing_DCB_modern_CDN",
      "printLanguageVerifiedByHuman":False,"twelveThemesReviewedByHuman":False
    })
def fetch_card(record):
    proof={"order":record["canonicalOrder"],"url":record["ownedUrl"],"status":"unavailable"}
    photo=None
    try:
        assert urlsplit(record["ownedUrl"]).hostname=="dcb-card-images-modern-2026.pages.dev"
        with urlopen(Request(record["ownedUrl"],headers={
            "User-Agent":"DigitalCardBinder-S5a-Korean-Audit/1.0"
        }),timeout=30) as response:
            binary=response.read(3000001)
            proof["http"]=response.status
        assert 1000 < len(binary) < 3000000
        img=Image.open(BytesIO(binary));img.load()
        assert 180 <= img.width <= 3000 and 230 <= img.height <= 4000
        proof.update(status="decoded",byteCount=len(binary),
                     dimensions=[img.width,img.height],format=img.format,
                     sha256=hashlib.sha256(binary).hexdigest())
        photo=img.convert("RGB")
        photo.thumbnail((213,302))
    except Exception as e:
        proof["error"]=str(e)[:180]
    return record["canonicalOrder"],proof,photo
found={}
with ThreadPoolExecutor(max_workers=10) as pool:
    futures=[pool.submit(fetch_card,c) for c in cards]
    for f in as_completed(futures):
        n,proof,img=f.result()
        found[n]=(proof,img)
for offset in range(0,30,15):
    canvas=Image.new("RGB",(1220,1110),(243,243,243))
    draw=ImageDraw.Draw(canvas)
    for idx in range(15):
        row=cards[offset+idx]
        proof,img=found[row["canonicalOrder"]]
        x=(idx%5)*244;y=(idx//5)*370
        draw.rectangle((x+3,y+3,x+241,y+367),outline=(150,150,150),width=2)
        if img is not None:
            canvas.paste(img,(x+(244-img.width)//2,y+5))
        else:
            draw.text((x+12,y+145),"MISSING OWNED IMAGE",fill=(30,30,30))
        draw.text((x+8,y+317),("%03d "%row["canonicalOrder"]+row["name"][:14]),fill=(15,15,15))
        draw.text((x+8,y+340),row["code"]+" "+proof["status"],fill=(15,15,15))
    out=BytesIO()
    canvas.save(out,"WEBP",quality=80,method=5)
    (OUT/("s5a-031-060-%02d.webp.b64"%(offset//15+1))).write_text(
        base64.b64encode(out.getvalue()).decode("ascii"),encoding="ascii")
results=[{**c,"imageCheck":found[c["canonicalOrder"]][0]} for c in cards]
success=sum(r["imageCheck"]["status"]=="decoded" for r in results)
evidence={
 "schemaVersion":1,"recordedAt":"2026-10-16","set":"s5a",
 "name":"쌍벽의 파이터","canonicalSetCardCount":96,"range":"031-060",
 "status":"independent_Korean_source_image_preflight_only",
 "checkedCardCount":30,"canonicalNumberAndNameCount":30,
 "ownedImageDecodedCount":success,"ownedImageUnavailableCount":30-success,
 "humanKoreanPrintVerificationCount":0,"humanArtworkThemeReviewCount":0,
 "artworkThemeReviewComplete":False,"setComplete":False,
 "sourceRequestsToExternalThirdParties":0,
 "globalCheckpointPreserved":global_hold,
 "nextSafeStep":"Manually inspect first two contact sheets, verify Korean printed text and number, then independently inspect all 12 visual themes before applying a reviewed batch.",
 "cards":results,
 "contactSheets":["s5a-031-060-01.webp.b64","s5a-031-060-02.webp.b64"]
}
(OUT/"visual-index.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({k:evidence[k] for k in ["set","range","checkedCardCount","ownedImageDecodedCount","ownedImageUnavailableCount","artworkThemeReviewComplete"]},ensure_ascii=False))
