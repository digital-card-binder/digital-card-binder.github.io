#!/usr/bin/env python3
"""Safely self-host the genuine Korean official landscape BREAK card M6a 157."""
from pathlib import Path
from urllib.request import Request,urlopen
from hashlib import sha256
from io import BytesIO
from PIL import Image
from datetime import datetime,timezone
import json
ROOT=Path(__file__).resolve().parents[1]
PREFLIGHT=ROOT/"data/audits/mega-visual-evidence/m6a-157/visual-index.json"
OVERRIDE=ROOT/"data/series-image-overrides.json"
DEST=ROOT/"assets/cards/mega/m6a/M6a_157.webp"
MANIFEST=ROOT/"data/audits/m6a-157-official-korean-landscape.json"
URL="https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6a/M6a_157.png"
KEY="m6a_157/103"
def main():
 proof=json.loads(PREFLIGHT.read_text(encoding="utf8"))
 original=next(c for c in proof["sources"] if c["origin"]=="official")
 foreign=next(c for c in proof["sources"] if c["origin"]=="secondaryKoreanDatabase")
 if proof["number"]!=157 or original["url"]!=URL or original["size"]!=[1212,868] or original["format"]!="PNG":
  raise ValueError("Official M6a 157 landscape Korean proof changed")
 if foreign["size"]!=[550,768]:
  raise ValueError("Cannot preserve Japanese secondary source exclusion")
 with urlopen(Request(URL,headers={"User-Agent":"Mozilla/5.0 (DigitalCardBinder archive)","Referer":"https://pokemoncard.co.kr/"}),timeout=35) as res:
  if res.status!=200:raise ValueError("Official source unavailable")
  raw=res.read(12000001)
 if sha256(raw).hexdigest()!=original["sha256"]:raise ValueError("Official original hash mismatch")
 with Image.open(BytesIO(raw)) as im:
  im.load()
  if im.format!="PNG" or list(im.size)!=[1212,868]:
   raise ValueError("Official landscape orientation changed")
  card=im.convert("RGB")
  card.thumbnail((860,650),Image.Resampling.LANCZOS)
  if card.width<=card.height:raise ValueError("Landscape card orientation lost")
  buf=BytesIO()
  card.save(buf,"WEBP",quality=88,method=5)
  binary=buf.getvalue()
 with Image.open(BytesIO(binary)) as verify:
  verify.verify()
 overrides=json.loads(OVERRIDE.read_text(encoding="utf8"))
 images=overrides.setdefault("sets",{}).setdefault("m6a",{})
 if len(images)!=164:raise ValueError("M6a existing image mapping count changed")
 expected="./assets/cards/mega/m6a/M6a_157.webp"
 if KEY in images and images[KEY]!=expected:raise ValueError("Existing 157 slot reference differs")
 if DEST.exists() and sha256(DEST.read_bytes()).hexdigest()!=sha256(binary).hexdigest():
  raise ValueError("Existing M6a 157 binary differs")
 DEST.parent.mkdir(parents=True,exist_ok=True)
 DEST.write_bytes(binary)
 images[KEY]=expected
 OVERRIDE.write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 summary={"schemaVersion":1,"setCode":"M6a","number":157,"cardKey":KEY,"name":"개굴닌자 BREAK",
 "recordedAt":datetime.now(timezone.utc).isoformat(),"source":URL,
 "sourceDimensions":[1212,868],"sourceSha256":sha256(raw).hexdigest(),
 "localPath":expected,"selfHostedDimensions":list(card.size),"sha256":sha256(binary).hexdigest(),
 "printedLanguageVisuallyConfirmed":"Korean","physicalPrintedNumberIndividuallyVerified":False,
 "excludedJapaneseSource":foreign["url"],"onlyImageMappingChanged":True,
 "ownershipAndCanonicalUnchanged":True}
 MANIFEST.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 print(json.dumps({"saved":1,"landscape":card.width>card.height,"sourceHashMatched":True}))
if __name__=="__main__":main()
