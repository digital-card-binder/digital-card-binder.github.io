#!/usr/bin/env python3
"""Check actual bytes of existing canonical SM2L Korean-card image URLs, not guessed URLs.

Does NOT upgrade Korean-printed-physical-card visual verification. The evidence
shows whether canonical bytes are retrievable/decodable and match file labels.
No existing URLs, ownership, master cards, or themes are changed.
"""
from __future__ import annotations
import base64
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import requests
from PIL import Image, ImageDraw, ImageOps, ImageStat

SOURCE = Path("data/audits/theme-sm2l-047-048-korean-number-resolution-20261019.json")
OUT = Path("data/audits/theme-sm2l-canonical-image-http-and-decoding-20261019.json")
PREVIEW_CODES = [
    "SM2L_002","SM2L_006","SM2L_008","SM2L_010",
    "SM2L_012","SM2L_013","SM2L_014","SM2L_015",
    "SM2L_047","SM2L_048","SM2L_056","SM2L_058",
]
entries=json.loads(SOURCE.read_text(encoding="utf-8"))["imageSourceInventory"]["cards"]
assert len(entries)==62
assert [x["code"] for x in entries]==[f"SM2L_{n:03d}" for n in range(1,63)]
assert sum(x["requiresDirectKoreanImageVisualVerification"] for x in entries)==55
session=requests.Session()
HEADERS={"User-Agent":"Mozilla/5.0 (compatible; PokemonCardAudit/1.0; archive screenshot verification)","Accept":"image/avif,image/webp,image/png,image/jpeg,*/*"}
def check(entry):
    result={
        "code":entry["code"],"name":entry["canonicalName"],
        "sourceType":entry["providerClass"],"originalUrl":entry["canonicalImage"],
        "originHttpAccessible":False,"imageDecoded":False,
        "explicitKoreanLanguageInArtworkInspected":False,
        "koreanPrintedNumberHumanVerified":False,
    }
    source=entry["canonicalImage"]
    if source.startswith("https://tcgbox.co.kr/"):
        source=source.replace(" ","%20")
    try:
        response=session.get(source,headers=HEADERS,timeout=18)
        result.update(httpStatus=response.status_code,
            mimeType=response.headers.get("content-type",""),
            downloadedBytes=len(response.content),requestFinalUrl=response.url)
        response.raise_for_status()
        im=Image.open(io.BytesIO(response.content))
        im.load()
        result.update(originHttpAccessible=True,imageDecoded=True,
            width=im.width,height=im.height,format=im.format,
            sha256=hashlib.sha256(response.content).hexdigest())
        rgb=im.convert("RGB")
        stats=ImageStat.Stat(rgb.resize((64,64)))
        result["rgbStddevAverage"]=round(sum(stats.stddev)/3,2)
        # A file is not automatically a confirmed Korean-language physical card
        # just because it is on an official Korean image CDN.
        return result,rgb
    except Exception as exc:
        result["failure"]=str(exc)[:450]
        return result,None

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    outcomes=list(pool.map(check,entries))
items=[entry for entry,img in outcomes]
pictures={entry["code"]:img for entry,img in outcomes if img is not None}
countOfficial=sum(v["imageDecoded"] and v["sourceType"]=="official_korean_card_art_cdn" for v in items)
countExternal=sum(v["imageDecoded"] and v["sourceType"]!="official_korean_card_art_cdn" for v in items)
results={
    "schemaVersion":1,
    "date":"2026-10-19",
    "set":"SM2L",
    "checkpoint":"data/audits/theme-sm2l-047-048-korean-number-resolution-20261019.json",
    "explanation":"Downloaded actual existing canonical image URL bytes and decoded each with Pillow. This verifies source availability, type, dimensions, and stable SHA256; not that printed Korean names/numbers are visually readable/correct.",
    "baselineCards":62,
    "previouslyStrictKoreanPhysicalVerified":7,
    "knownStrictKoreanPhotoHolds":55,
    "strictKoreanPhotoHoldsReducedByThisAutomatedCheck":0,
    "canonicalURLsChanged":0,
    "masterDBChanged":0,
    "themeEntriesChanged":0,
    "officialKoreanCDNImagesDownloadedAndDecoded":countOfficial,
    "externalKoreanSourceImagesDownloadedAndDecoded":countExternal,
    "allImagesDownloadedAndDecoded":sum(z["imageDecoded"] for z in items),
    "httpOrDecodeFailures":[z["code"] for z in items if not z["imageDecoded"]],
    "originalScope":{k:sum(x["sourceType"]==k for x in items) for k in set(x["sourceType"] for x in items)},
    "sourceRecords":items,
    "requiresHumanVisualVerification":True,
    "prioritizedPreviewCodes":PREVIEW_CODES,
}
OUT.write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SM2L_ORIGINAL_IMAGE_BYTE_VERIFY",json.dumps({
    "officialDecoded":countOfficial,"externalDecoded":countExternal,
    "total":results["allImagesDownloadedAndDecoded"],
    "failures":results["httpOrDecodeFailures"],
},ensure_ascii=False))

def show_previews(codes,part):
    selected=[(code,pictures[code]) for code in codes if code in pictures]
    if not selected:
        print(f"PREVIEW_MISSING_{part}",codes)
        return
    target_w=485
    target_h=680
    panel=Image.new("RGB",(target_w*len(selected),target_h+30),"#eeeeee")
    d=ImageDraw.Draw(panel)
    for pos,(code,img) in enumerate(selected):
        resized=ImageOps.contain(img,(target_w-20,target_h-20))
        x=pos*target_w+(target_w-resized.width)//2
        y=30+(target_h-resized.height)//2
        panel.paste(resized,(x,y))
        d.text((pos*target_w+8,6),code,fill="black")
    # Previews are transient GitHub CI log evidence, NOT copied/rehosted Korean cards.
    stream=io.BytesIO()
    panel.save(stream,format="JPEG",quality=72,optimize=True)
    b64=base64.b64encode(stream.getvalue()).decode("ascii")
    print(f"PREVIEW_BEGIN_PART_{part}")
    print(b64)
    print(f"PREVIEW_END_PART_{part}")

for index in range(0,len(PREVIEW_CODES),3):
    show_previews(PREVIEW_CODES[index:index+3],index//3+1)
