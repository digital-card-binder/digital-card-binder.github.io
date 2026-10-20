#!/usr/bin/env python3
"""Evidence-only next 3 Korean SM sets. No card/thematic classification is auto-approved."""
from __future__ import annotations

import base64
import hashlib
import io
import json
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageOps

AUDIT = Path("data/audits")
OUT = AUDIT / "theme-sm5plus-sm6-sm6a-korean-image-preflight-20261020.json"
CODES = ("sm5+", "sm6", "sm6a")
MASTER_PATHS = (Path("data/series.json"), Path("data/series-legacy.json"))

def read(path):
    return json.loads(path.read_text(encoding="utf-8"))

master = [s for p in MASTER_PATHS for s in read(p)]
art = read(Path("data/art-themes.json"))
coverage = read(AUDIT / "theme-series-coverage.json")
all_theme_cards = [c for g in art["groups"] for c in g["cards"]]
baseline_theme_rows = len(all_theme_cards)
assert len(art["groups"]) == 12, "Standalone thematic dex contract changed"
assert baseline_theme_rows == coverage["summary"]["themeCardSlots"], "Current theme baseline drift"
assert coverage["summary"]["strictCompleteSetCount"] >= 109
assert not OUT.exists(), "Earlier preflight already exists; do not overwrite evidence"

batch = []
for code in CODES:
    found = [s for s in master if str(s.get("code", "")).lower() == code]
    assert len(found) == 1, ("Expected exactly one Korean master set", code, len(found))
    series = found[0]
    reviews = [s for s in coverage["sets"] if str(s.get("code", "")).lower() == code]
    assert len(reviews) == 1 and reviews[0]["status"] != "complete", (
        "Already complete series, do not repeat audit", code, reviews
    )
    prior = [(g["code"], c.get("code")) for g in art["groups"] for c in g["cards"]
             if str(c.get("set", "")).lower() == code]
    batch.append((code, series, prior))
    print("SM_NEXT_SET", json.dumps({
        "code":code,"name":series.get("displayName"),"masterCards":len(series["cards"]),
        "priorThemeMembersToPreserve":len(prior),"currentReviewStatus":reviews[0]["status"]
    }, ensure_ascii=False), flush=True)

def fetch(payload):
    code, n, card = payload
    url = str(card.get("image") or "")
    record = {
        "index":n,"code":card.get("code"),"name":card.get("name"),"image":url,
        "imageDecoded":False,"koreanPrintedNameVisuallyRead":False,
        "enlargedPrintedFooterVerified":False,"approvedThemeMemberships":[]
    }
    if not url.startswith("https://"):
        record["error"] = "Missing secure canonical image URL"
        return code,record,None
    try:
        response = requests.get(url, timeout=25, headers={
            "User-Agent":"Mozilla/5.0 (KoreanPokemonCardArtAudit/1.0)",
            "Accept":"image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8"
        })
        response.raise_for_status()
        if len(response.content) > 8_000_000:
            raise ValueError("Image larger than 8MB")
        pic = Image.open(io.BytesIO(response.content))
        pic.load()
        record.update(imageDecoded=True,statusCode=response.status_code,
                      sha256=hashlib.sha256(response.content).hexdigest(),
                      format=pic.format,width=pic.width,height=pic.height)
        return code,record,pic.convert("RGB")
    except Exception as error:
        record["error"] = str(error)[:260]
        return code,record,None

todo = [(code,n,card) for code,series,prior in batch
        for n,card in enumerate(series["cards"],start=1)]
assert 1 <= len(todo) <= 700, ("unexpected set size",len(todo))
with ThreadPoolExecutor(max_workers=12) as executor:
    results = list(executor.map(fetch,todo))

per_series = {}
for code,series,prior in batch:
    ordered = [(row,pic) for c,row,pic in results if c == code]
    rows = [row for row,pic in ordered]
    pics = {row["index"]:pic for row,pic in ordered if pic is not None}
    groups = defaultdict(list)
    for r in rows:
        if r["imageDecoded"]:groups[r["sha256"]].append(r["index"])
    duplicates = [{"numbers":indices,"sha256":sha}
                  for sha,indices in groups.items() if len(indices)>1]
    per_series[code] = {
        "code":series["code"],"setName":series.get("displayName"),
        "masterCards":len(rows),"imagesDownloadedAndDecoded":len(pics),
        "imageSourceFailures":len(rows)-len(pics),
        "existingThemeMembershipsPreserved":len(prior),
        "existingThemeCodesPreserved":[c for theme,c in prior],
        "duplicateDecodedSourceGroups":duplicates,
        "artworksActuallyVisuallyScreened":0,"newThemeRowsWritten":0,
        "sourceRows":rows
    }
    print("SM_NEXT_SOURCE_RESULT",json.dumps({
        "set":code,"total":len(rows),"decoded":len(pics),
        "duplicates":duplicates,
        "failures":[{"number":r["index"],"name":r["name"],"error":r.get("error")}
                    for r in rows if not r["imageDecoded"]]
    }, ensure_ascii=False), flush=True)
    for page,start in enumerate(range(1,len(rows)+1,15),start=1):
        numbers=range(start,min(start+15,len(rows)+1))
        if not any(n in pics for n in numbers):continue
        W,H,COLS=248,350,5
        sheet=Image.new("RGB",(W*COLS,H*3),"white")
        draw=ImageDraw.Draw(sheet)
        for n in numbers:
            pic=pics.get(n)
            if pic is None:continue
            relative=n-start
            x,y=(relative%COLS)*W,(relative//COLS)*H
            draw.text((x+7,y+4),f"{n:03d}",fill="black")
            thumb=ImageOps.contain(pic,(W-8,H-29))
            sheet.paste(thumb,(x+(W-thumb.width)//2,y+23))
        buf=io.BytesIO()
        sheet.save(buf,"JPEG",quality=58,optimize=True)
        tag={"sm5+":"SM5PLUS","sm6":"SM6","sm6a":"SM6A"}[code]
        print(f"{tag}_CONTACT_SHEET_{page}_BEGIN", flush=True)
        print(base64.b64encode(buf.getvalue()).decode("ascii"),flush=True)
        print(f"{tag}_CONTACT_SHEET_{page}_END", flush=True)
report = {
    "schemaVersion":1,"recordedAt":"2026-10-20",
    "scope":"Next three independent Korean SM series: SM5+, SM6, SM6a",
    "totalMasterCards":len(todo),
    "previousThemeRowsPreserved":baseline_theme_rows,
    "previousStrictCompleteSetsPreserved":coverage["summary"]["strictCompleteSetCount"],
    "automatedArtworkOrKoreanPrintApprovals":0,
    "previousApprovedThemeRowsModified":0,"canonicalMasterRowsModified":0,
    "ownerDataOrFirestoreChanged":0,"CardRadarChanged":0,
    "warning":"A decoded image is only a candidate, never proof of Korean printed name, number or independent thematic eligibility. All candidate pictures must be visually reviewed before changes to art-themes.",
    "sets":[per_series[code] for code in CODES]
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SM_NEXT_PREFLIGHT_SAVED", json.dumps({
    "path":str(OUT),"total":len(todo),
    "decodedBySet":{k:v["imagesDownloadedAndDecoded"] for k,v in per_series.items()},
    "preservedPreviousRows":baseline_theme_rows
},ensure_ascii=False),flush=True)
