#!/usr/bin/env python3
"""SM Korean art audit batch: SM4+, SM5S, SM5M. Source provenance only.
Avoid changing pre-reviewed dex entries; HTTP 200 is NOT physical Korean print proof.
"""
from __future__ import annotations
import base64, hashlib, io, json, re
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import requests

AUDIT = Path("data/audits")
OUTPUT = AUDIT / "theme-sm4plus-sm5s-sm5m-korean-image-preflight-20261020.json"
SETS = (("sm4+", 125), ("sm5s", 78), ("sm5m", 78))
master = [*json.loads(Path("data/series.json").read_text(encoding="utf8")),
          *json.loads(Path("data/series-legacy.json").read_text(encoding="utf8"))]
themes = json.loads(Path("data/art-themes.json").read_text(encoding="utf8"))
coverage = json.loads((AUDIT / "theme-series-coverage.json").read_text(encoding="utf8"))
assert coverage["summary"]["themeCardSlots"] == 18611
assert coverage["summary"]["strictCompleteSetCount"] == 109
assert len(themes["groups"]) == 12
assert sum(len(g.get("cards", [])) for g in themes["groups"]) == 18611
batch = []
for code, count in SETS:
    s = next(x for x in master if str(x.get("code","")).lower() == code)
    assert len(s["cards"]) == count, ("master count mismatch", code, len(s["cards"]))
    matching = next(x for x in coverage["sets"] if x["code"].lower() == code)
    assert matching["status"] == "pending", (code, matching["status"])
    existing = [(g["code"], c.get("code"))
                for g in themes["groups"] for c in g.get("cards", [])
                if str(c.get("set", "")).lower() == code]
    assert not existing, ("previously reviewed cards must be preserved", code, existing)
    batch.append((code,s))

def fetch(payload):
    code,n,card=payload
    url = str(card.get("image") or "")
    row = {"index":n,"code":card.get("code"),"name":card.get("name"),
           "image":url,"imageDecoded":False,
           "koreanPrintedNameVisuallyRead":False,
           "enlargedPrintedFooterVerified":False,
           "approvedThemeMemberships":[]}
    if not url.startswith("https://"):
        row["error"] = "missing/non-HTTPS canonical image";return code,row,None
    try:
        res = requests.get(url,timeout=25,headers={
            "User-Agent":"Mozilla/5.0 (compatible; KoreanPokemonCardArtAudit/1.0)",
            "Accept":"image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8"})
        res.raise_for_status()
        if len(res.content) > 8_000_000:
            raise ValueError("image exceeds 8MB")
        pic = Image.open(io.BytesIO(res.content));pic.load()
        row.update(imageDecoded=True,statusCode=res.status_code,
                   sha256=hashlib.sha256(res.content).hexdigest(),
                   format=pic.format,width=pic.width,height=pic.height)
        return code,row,pic.convert("RGB")
    except Exception as err:
        row["error"] = str(err)[:260]
        return code,row,None

todo = [(code,n,c) for code,s in batch for n,c in enumerate(s["cards"],start=1)]
with ThreadPoolExecutor(max_workers=12) as pool:
    results = list(pool.map(fetch, todo))
bySet = {}
for code,s in batch:
    ordered = [(row,image) for c,row,image in results if c==code]
    rows = [row for row,image in ordered]
    photos = {row["index"]:image for row,image in ordered if image is not None}
    shaGroups = defaultdict(list)
    for row in rows:
        if row["imageDecoded"]:
            shaGroups[row["sha256"]].append(row["index"])
    dup = [{"indexList": nums,"sha256":digest}
           for digest,nums in shaGroups.items() if len(nums)>1]
    bySet[code] = {
        "code":s["code"],"setName":s.get("displayName"),"masterCards":len(rows),
        "imagesDownloadedAndDecoded":len(photos),
        "imageSourceFailures":len(rows)-len(photos),
        "duplicateDecodedSourceGroups":dup,
        "artworksActuallyScreenedByThisAutomatedPass":0,
        "themeRowsWritten":0,
        "sourceRows":rows
    }
    print("SM_TRIPLE_KOREAN_SOURCE_RESULT",
          json.dumps({"set":code,"name":s.get("displayName"),
          "cards":len(rows),"decoded":len(photos),
          "duplicateSourceGroups":dup,
          "failures":[{"n":r["index"],"code":r["code"],"name":r["name"],"error":r.get("error")}
                      for r in rows if not r["imageDecoded"]],
          "allCards":[{"n":r["index"],"code":r["code"],"name":r["name"],
                      "decoded":r["imageDecoded"]} for r in rows]},ensure_ascii=False))
    for page,offset in enumerate(range(1,len(rows)+1,15),start=1):
        indices = range(offset,min(offset+15,len(rows)+1))
        if not any(n in photos for n in indices):continue
        W,H,COLS = 248,350,5
        sheet = Image.new("RGB",(W*COLS,H*3),"white")
        draw = ImageDraw.Draw(sheet)
        for n in indices:
            if n not in photos:continue
            idx=n-offset
            x,y = (idx%COLS)*W,(idx//COLS)*H
            draw.text((x+7,y+4),f"{n:03d}",fill="black")
            thumbnail=ImageOps.contain(photos[n],(W-8,H-29))
            sheet.paste(thumbnail,(x+(W-thumbnail.width)//2,y+23))
        out = io.BytesIO()
        sheet.save(out,"JPEG",quality=58,optimize=True)
        tag = "SM4PLUS" if code=="sm4+" else code.upper()
        print(f"{tag}_CONTACT_SHEET_{page}_BEGIN")
        print(base64.b64encode(out.getvalue()).decode("ascii"))
        print(f"{tag}_CONTACT_SHEET_{page}_END")
report = {
    "schemaVersion":1,"recordedAt":"2026-10-20",
    "scope":"3 separate Korean SM series: SM4+, SM5S, SM5M",
    "totalMasterCards":sum(count for code,count in SETS),
    "preexistingThemeRowsPreserved":18611,
    "strictCompleteSetsPreserved":109,
    "artworkClassificationByAutomatedProbe":0,
    "previousCompletedOrPartialCardReopened":0,
    "masterDataModified":0,
    "ownedCardsOrFirestoreModified":0,
    "CardRadarFilesModified":0,
    "warning":"Image decode and matching a master path cannot prove Korean print or its footer number. Require direct image inspection; suspect duplicate or missing photo is held pending independent Korean print evidence.",
    "sets":[bySet[code] for code,count in SETS]
}
OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SM_TRIPLE_PREFLIGHT_CHECKPOINT_SAVED",
      json.dumps({"path":str(OUTPUT),"decodedBySet":{k:v["imagesDownloadedAndDecoded"]
        for k,v in bySet.items()}},ensure_ascii=False))
