#!/usr/bin/env python3
"""One-shot 37-set XY card-art evidence and conservative independent color-dex audit.

Every canonical card is visited once. Only actual decoded official Korean-hosted
artwork with matching source index is eligible for objective pixel color tags.
Semantic themes (night, sleeping, connected etc.) require manual scene evidence;
they are NOT inferred from card names, type, Pokemon species or artwork color.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit, unquote
import colorsys
import hashlib
import io
import json
import re
import time
import requests
from PIL import Image, ImageOps, ImageDraw

TODAY = "2026-10-26"
BASELINE = 22032
ROOT = Path(".")
OUT = Path("data/audits/theme-xy-all37-source-color-20261026.json")
ARTIFACT = Path("audit-artifacts/xy37-20261026")
ARTIFACT.mkdir(parents=True, exist_ok=True)
ALL_THEMES = ["sleeping","connected","evolution","night","season","color",
              "sunset","reflections","food","street","work","cameo"]
ALLOWED_HOST = "cards.image.pokemonkorea.co.kr"
def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))
def save(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
def norm(value):
    return str(value or "").strip().lower()

series_by_code = {}
for group in load("data/series.json")+load("data/series-legacy.json"):
    series_by_code[norm(group.get("code"))] = group
xy = [g for g in series_by_code.values() if g.get("era") == "XY"]
assert len(xy)==37, "XY set count changed"
assert sum(len(g["cards"]) for g in xy)==2313, "XY master count changed"
art=load("data/art-themes.json")
status=load("data/audits/theme-series-review-status.json")
coverage=load("data/audits/theme-series-coverage.json")
assert len(art["groups"])==12
assert set(g["code"] for g in art["groups"])==set(ALL_THEMES)
assert sum(len(g["cards"]) for g in art["groups"])==BASELINE, "Concurrent themed cards changed"
assert coverage["summary"]["masterCardCount"]==20243
assert coverage["summary"]["themeCardSlots"]==BASELINE
for g in xy:
    assert coverage["sets"] and next(s for s in coverage["sets"] if norm(s["code"])==norm(g["code"]))["status"]=="pending"

group_by_theme={g["code"]:g for g in art["groups"]}
already=set()
for g in art["groups"]:
    for card in g["cards"]:
        already.add((g["code"],norm(card.get("set")),norm(card.get("code"))))
original_existing_count=len(already)

tasks=[]
for group in xy:
    for n,card in enumerate(group["cards"],1):
        assert card.get("order")==n, (group["code"],n)
        m=re.search(r"_(\d{1,3})(?:/|$)",str(card.get("code","")),re.I)
        assert m and int(m.group(1))==n, (group["code"],card.get("code"),n)
        tasks.append((group,n,card))
assert len(tasks)==2313

def hold_reason(group,n,card):
    url=str(card.get("image",""))
    parts=urlsplit(url)
    if parts.scheme!="https" or parts.hostname!=ALLOWED_HOST:
        return "external or inaccessible Korean printed-card provenance"
    if "다른 수록판" in str(card.get("imageReferenceNote","")):
        return "another Korean printing substituted; exact XY printed artwork unverified"
    filename=unquote(parts.path.rsplit("/",1)[-1])
    match=re.search(r"_(\d{1,3})\.(?:jpg|jpeg|png|webp)$",filename,re.I)
    if not match:
        return "image filename does not carry original card index"
    if int(match.group(1))!=n:
        return "official-host image filename differs from canonical printed index"
    return None

def color_bin(rgb):
    r,g,b=[v/255 for v in rgb]
    h,s,v=colorsys.rgb_to_hsv(r,g,b)
    if s < .17:
        return "검정" if v<.28 else ("흰색" if v>.85 else "회색")
    if v < .15: return "검정"
    if h < .035 or h >= .965:return "빨강"
    if h < .095:return "주황"
    if h < .175:return "노랑"
    if h < .275:return "연두"
    if h < .425:return "초록"
    if h < .525:return "청록"
    if h < .69:return "파랑"
    if h < .79:return "보라"
    if h < .89:return "분홍"
    return "자주"

def inspect(task):
    group,n,card=task
    reason=hold_reason(group,n,card)
    row={"set":group["code"],"index":n,"code":card["code"],
         "name":card["name"],"image":card["image"],"status":"held"}
    if reason:
        row["reason"]=reason
        return row,None
    url=card["image"]
    for attempt in range(2):
        try:
            result=requests.get(url,timeout=(7,20),headers={
                "User-Agent":"Mozilla/5.0 (KoreanPokemonXYArtAudit/1.0)",
                "Accept":"image/webp,image/png,image/jpeg,*/*"})
            result.raise_for_status()
            data=result.content
            if not 2500<=len(data)<=8_000_000:
                raise ValueError("unexpected image byte size")
            raw=Image.open(io.BytesIO(data))
            raw.load()
            if raw.width<160 or raw.height<200 or raw.width*raw.height>18_000_000:
                raise ValueError("unexpected image dimensions")
            im=ImageOps.exif_transpose(raw).convert("RGB")
            width,height=im.size
            artwork=im.crop((int(width*.09),int(height*.135),
                             int(width*.91),int(height*.40)))
            artwork.thumbnail((70,40))
            bins=Counter(color_bin(rgb) for rgb in artwork.getdata()).most_common()
            first=bins[0][0]
            second=next((c for c,count in bins[1:] if c!=first),
                        "회색" if first!="회색" else "흰색")
            row.update({"status":"source_art_color_screened",
                        "imageSha256":hashlib.sha256(data).hexdigest(),
                        "width":width,"height":height,
                        "colorTag":first+"·"+second,
                        "artPixelColorBins":dict(bins),
                        "printedFooterVerified":False})
            thumb=im.copy()
            thumb.thumbnail((120,165))
            return row,thumb
        except (requests.RequestException,ValueError,OSError) as err:
            if attempt==1:
                row["reason"]="image could not be downloaded/decoded: "+str(err)[:175]
                return row,None
            time.sleep(.35)
    return row,None

with ThreadPoolExecutor(max_workers=14) as pool:
    results=list(pool.map(inspect,tasks))
assert len(results)==2313

# Exact image reuse for multiple canonical printings within a single XY set may
# be a substituted rarity/photo; never certify their distinct artwork by hash.
by_hash=defaultdict(list)
for row,_ in results:
    if row["status"]=="source_art_color_screened":
        by_hash[(norm(row["set"]),row["imageSha256"])].append(row)
duplicate_hashes={key for key,items in by_hash.items() if len(items)>1}
for row,_ in results:
    if (norm(row["set"]),row.get("imageSha256")) in duplicate_hashes:
        row["status"]="held"
        row["reason"]="same decoded card photograph reused for multiple printed identities"
        row.pop("colorTag",None)

# Contact sheets: review candidates and holds for all 37 sets (no Korean text
# rendered because system fonts vary; canonical set and card index are stable).
by_set=defaultdict(list)
for row,thumb in results:
    by_set[norm(row["set"])].append((row,thumb))
contact_sheets=[]
for group in xy:
    group_rows=by_set[norm(group["code"])]
    assert len(group_rows)==len(group["cards"])
    sheet_names=[]
    for start in range(0,len(group_rows),60):
        section=group_rows[start:start+60]
        tile_w,tile_h,cols=145,207,10
        canvas=Image.new("RGB",(tile_w*cols,tile_h*6),(242,242,242))
        draw=ImageDraw.Draw(canvas)
        for i,(row,thumb) in enumerate(section):
            x=(i%cols)*tile_w
            y=(i//cols)*tile_h
            if thumb is not None:
                canvas.paste(thumb,(x+(tile_w-thumb.width)//2,y+3))
            draw.text((x+5,y+168),"%s #%03d"%(group["code"],row["index"]),
                      fill=(15,15,15))
            draw.text((x+5,y+183),"OK" if row["status"]=="source_art_color_screened"
                      else "HOLD",fill=(22,110,45) if row["status"]=="source_art_color_screened"
                      else (165,45,45))
        safe=re.sub(r"[^a-zA-Z0-9_-]","_",group["code"])
        name="%s-%03d-%03d.jpg"%(safe,start+1,start+len(section))
        canvas.save(ARTIFACT/name,"JPEG",quality=82,optimize=True)
        sheet_names.append(name)
        contact_sheets.append(name)
    for row,_ in group_rows:
        row["contactSheets"]=sheet_names

added=[]
for row,_ in results:
    if row["status"]!="source_art_color_screened":
        continue
    group=series_by_code[norm(row["set"])]
    card=group["cards"][row["index"]-1]
    card_id=group["code"].upper()+"_"+str(row["index"]).zfill(3)
    key=("color",norm(group["code"]),norm(card_id))
    if key in already:
        row["status"]="previously_classified"
        continue
    payload={"code":card_id,"name":card["name"],"series":"XY",
             "set":group["code"],"setName":group.get("displayName") or group.get("name") or group["code"],
             "cardNumber":str(card["code"]).split("_",1)[1],
             "rarity":card.get("rarity",""),"category":row["colorTag"],
             "image":card["image"],
             "evidence":"XY 37-set consolidated 2026-10-26: actual official-hosted "
                "decoded Korean reference artwork SHA256 and cropped art HSV pixel bins; "
                "printed footer / narrative scene not certified. "+str(OUT)}
    group_by_theme["color"]["cards"].append(payload)
    already.add(key)
    added.append(card_id)
for group in xy:
    rows=[r for r,_ in by_set[norm(group["code"])]]
    n_screen=sum(r["status"] in ["source_art_color_screened","previously_classified"] for r in rows)
    key=next((k for k in status.get("reviews",{}) if norm(k)==norm(group["code"])),group["code"])
    assert status.get("reviews",{}).get(key,{}).get("status")!="complete"
    status.setdefault("reviews",{})[key]={
        **status.get("reviews",{}).get(key,{}),
        "status":"partial",
        "reviewedAt":TODAY,
        "reviewedCardCount":n_screen,
        "reviewedThemes":["color"],
        "evidence":str(OUT),
        "note":"Whole XY set source audited. Original-pixel color only; all other 11 themes and "
               "Korean printed footer authentication remain a separate visual-evidence gate. "
               "Held "+str(len(rows)-n_screen)+" source/identity slots."
    }
status["updatedAt"]=TODAY
art["updatedAt"]=TODAY
delta=len(added)
actual_total=sum(len(g["cards"]) for g in art["groups"])
assert actual_total==BASELINE+delta
assert original_existing_count==BASELINE-6, "Prior XY baseline duplicate identities changed unexpectedly"
assert len(added)==len(set(added)), "Duplicate card identity added"

by_status=dict(Counter(r["status"] for r,_ in results))
report={"schemaVersion":1,"recordedAt":TODAY,
        "scope":"ALL 37 Korean XY sets, 2313 canonical cards, one consolidated batch",
        "masterSetCount":len(xy),"masterCardCount":len(results),
        "previousThemeSlots":BASELINE,"newColorMemberships":delta,
        "newAllThemeSlots":actual_total,
        "sourceArtworkStatus":by_status,
        "officialHostedURLsInitially":sum(ALLOWED_HOST in c["image"] for _,_,c in tasks),
        "externalUrlsInitially":sum(ALLOWED_HOST not in c["image"] for _,_,c in tasks),
        "imageSha256Rechecked":True,
        "notCertified":["subjective artwork-based non-color themes",
                        "Korean physical printed footer authenticity",
                        "distinct original art for substituted reprint images"],
        "canonicalCardsChanged":0,"FirestoreOrOwnershipChanged":0,"cardRadarChanged":0,
        "contactSheets":contact_sheets,
        "themeDeltas":{k:(delta if k=="color" else 0) for k in ALL_THEMES},
        "sets":[],
        "cards":[r for r,_ in results]}
for group in xy:
    group_rows=[r for r,_ in by_set[norm(group["code"])]]
    report["sets"].append({
        "code":group["code"],"name":group.get("displayName") or group.get("name"),
        "masterCards":len(group_rows),
        "originalPhotoColorScreened":sum(r["status"] in
             ["source_art_color_screened","previously_classified"] for r in group_rows),
        "imageAndPrintedIdentityHolds":sum(r["status"]=="held" for r in group_rows),
        "newColorMemberships":sum((group["code"].upper()+"_"+str(r["index"]).zfill(3)) in added
                                    for r in group_rows),
        "strictComplete":False,"contactSheets":group_rows[0]["contactSheets"]})
save("data/art-themes.json",art)
save("data/audits/theme-series-review-status.json",status)
save(OUT,report)
test_path=Path("tests/theme-card-identity.test.mjs")
tests=test_path.read_text(encoding="utf-8")
old="assert.equal(total,22032);"
assert tests.count(old)==1,"Baseline total assertion moved, do not edit blindly"
tests=tests.replace(old,"assert.equal(total,%d); // one-shot XY 37-set verified-art color additions"%actual_total)
test_path.write_text(tests,encoding="utf-8")
summary={k:report[k] for k in ["masterSetCount","masterCardCount",
         "previousThemeSlots","newColorMemberships","newAllThemeSlots",
         "sourceArtworkStatus","contactSheets"]}
summary["contactSheets"]=len(contact_sheets)
save(ARTIFACT/"summary.json",summary)
print("XY_37SET_RESULT "+json.dumps(summary,ensure_ascii=False))
