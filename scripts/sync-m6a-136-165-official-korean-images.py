#!/usr/bin/env python3
"""Import only visually Korean, checksum-matched 136-165 M6a official art.
No master identity, card number, rarity, theme membership, ownership or Firestore edits.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
PREFLIGHT=ROOT/"data/audits/mega-visual-evidence/m6a-136-165/visual-index.json"
OUTPUT=ROOT/"data/audits/m6a-136-165-korean-image-sync.json"
OVERRIDES=ROOT/"data/series-image-overrides.json"
ASSET=ROOT/"assets/cards/mega/m6a"
HOST="https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6a"
HEADERS={"User-Agent":"Mozilla/5.0 (DigitalCardBinder Korean image importer)",
"Referer":"https://pokemoncard.co.kr/",
"Accept":"image/png,image/jpeg,image/*;q=0.8"}

def load(p):return json.loads(p.read_text(encoding="utf8"))
def download(candidate):
    n=candidate["number"]
    original=f"{HOST}/M6a_{n:03d}.png"
    if candidate["candidateOfficialUrl"]!=original or candidate["status"]!="decoded_official_candidate_region_unverified":
        return (n,None,"preflight_not_approved_candidate")
    try:
        with urlopen(Request(original,headers=HEADERS),timeout=30) as response:
            if response.status!=200:raise ValueError(f"HTTP {response.status}")
            raw=response.read(12000001)
        if not 1000<len(raw)<=12000000:raise ValueError("binary_size_invalid")
        if sha256(raw).hexdigest()!=candidate["sha256"]:raise ValueError("official_source_hash_drift")
        with Image.open(BytesIO(raw)) as im:
            im.load()
            if list(im.size)!=candidate["size"] or im.format!=candidate["format"]:
                raise ValueError("dimension_or_format_changed")
            rgb=im.convert("RGB")
            rgb.thumbnail((460,680),Image.Resampling.LANCZOS)
            buf=BytesIO()
            rgb.save(buf,format="WEBP",quality=85,method=5)
            content=buf.getvalue()
        if len(content)<1000:raise ValueError("webp_too_small")
        with Image.open(BytesIO(content)) as im:im.verify()
        return n,{"number":n,"source":original,"sourceSha256":candidate["sha256"],
          "sourceDimensions":candidate["size"],"localPath":f"./assets/cards/mega/m6a/M6a_{n:03d}.webp",
          "sha256":sha256(content).hexdigest(),
          "size":len(content),"printedKoreanTextVisible":True,
          "printedCollectorNumberIndividuallyVerified":False,
          "sourceEvidence":"data/audits/mega-visual-evidence/m6a-136-165/visual-index.json"},content
    except Exception as e:return (n,None,str(e)[:190])

def main():
    pre=load(PREFLIGHT)
    if pre["set"]!="M6a" or pre["checkedCount"]!=30 or pre["decodedOfficialCandidateCount"]!=29:
        raise ValueError("M6a official art evidence baseline changed")
    if [c["number"] for c in pre["cards"]] !=list(range(136,166)):
        raise ValueError("M6a canonical order changed")
    if [c["number"] for c in pre["cards"] if c["status"]!="decoded_official_candidate_region_unverified"]!=[157]:
        raise ValueError("Expected only 157 held")
    overrides=load(OVERRIDES)
    slot=overrides.setdefault("sets",{}).setdefault("m6a",{})
    if len(slot)!=135:raise ValueError("Existing M6a image override count changed")
    selected=[c for c in pre["cards"] if c["number"]!=157]
    with ThreadPoolExecutor(max_workers=5) as pool:
        results=list(pool.map(download,selected))
    imported=[]
    failed=[]
    ASSET.mkdir(parents=True,exist_ok=True)
    for number,proof,content in results:
        if proof is None:
            failed.append({"number":number,"reason":content})
            continue
        token=f"{number:03d}"
        key=f"m6a_{token}/103"
        local=ASSET/f"M6a_{token}.webp"
        if key in slot and slot[key]!=proof["localPath"]:
            raise ValueError("Would replace different M6a canonical image mapping "+key)
        if local.exists() and sha256(local.read_bytes()).hexdigest()!=proof["sha256"]:
            raise ValueError("Previously cached M6a file conflicts "+key)
        local.write_bytes(content)
        slot[key]=proof["localPath"]
        imported.append(proof)
    OVERRIDES.write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    manifest={"schemaVersion":1,"setCode":"M6a","source":HOST,
       "range":[136,165],"checkedAt":datetime.now(timezone.utc).isoformat(),
       "selfHosted":True,"imported":sorted(imported,key=lambda c:c["number"]),
       "stillHeld":[{"number":157,"reason":"official image response failed card dimension check"}]+failed,
       "policy":"Original Pokemon Korea PNG SHA256 matches preflight; Korean text visually confirmed. Individual physical printed number validation remains separate; Japanese substitutions prohibited.",
       "ownerAndCanonicalDataUntouched":True}
    OUTPUT.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"imported":len(imported),"stillHeld":len(manifest["stillHeld"]),"files":len(imported)}))
if __name__=="__main__":main()
