#!/usr/bin/env python3
"""Prepare 15 self-hostable KOR-firstparty Classic individual images from official product art.
Exact 15 confirmed Japanese-language prior archive slots; exclude three neutral energies and
two miniature 110px hero small cards. Keep original art proportions and source provenance.
This only prepares static assets; caller must run site safety tests and separate theme mapping.
"""
from pathlib import Path
from io import BytesIO
from urllib.request import urlopen,Request
from urllib.parse import urlsplit
from PIL import Image
import json,hashlib
root=Path(__file__).resolve().parents[1]
evidence=json.loads((root/"data/audits/theme-classic-korean-official-card-crop-proposals-20261013/index.json").read_text())
official=json.loads((root/"data/audits/theme-classic-official-product-20261013/index.json").read_text())
region=json.loads((root/"data/audits/theme-classic-three-102-card-regional-print-checkpoint-20261013.json").read_text())
target={"CLL":{"021","026","030"},"CLK":{"014","015","021","025","031"},
        "CLF":{"003","010","015","017","025","026","028"}}
assert sum(map(len,target.values()))==15
output=root/"assets/cards/classic-korean-official-2023"
output.mkdir(parents=True,exist_ok=True)
images={}
audit=[]
for code,ids in target.items():
 source=official["records"][code]
 url=source["sourceUrl"]
 assert urlsplit(url).hostname=="data1.pokemonkorea.co.kr"
 with urlopen(Request(url,headers={"User-Agent":"DigitalCardBinder-Korean-Classic-Official-Source/1.0"}),timeout=25) as r:
  raw=r.read(6_500_000)
 assert hashlib.sha256(raw).hexdigest()==source["sha256"],"Source fingerprint unexpectedly changed: "+code
 full=Image.open(BytesIO(raw)).convert("RGB")
 images[code]=full
for row in evidence["items"]:
 code,no=row["cardKey"].split("_")
 if no not in target.get(code,set()):continue
 assert row["cropPixelSize"][0]>=180 and row["priorArchivedLanguageStatus"]=="Japanese_language_image_wrong_for_Korean_master",row["cardKey"]
 full=images[code]
 crop=full.crop(tuple(row["cropBoxSourcePixels"]))
 # Find the largest bright card-sized contiguous band, trim dark marketing panel and neighbor cards.
 n=crop.width
 values=[]
 for y in range(crop.height):
  total=0;count=0
  for x in range(round(n*.13),round(n*.87),6):
   rr,gg,bb=crop.getpixel((x,y))
   total+=(rr+gg+bb)/3;count+=1
  values.append(total/max(1,count))
 bright=[x>75 for x in values]
 spans=[];start=None
 for y,v in enumerate(bright+[False]):
  if v and start is None:start=y
  if not v and start is not None:spans.append((start,y));start=None
 strong=[(a,b) for a,b in spans if b-a>90]
 if not strong:raise ValueError("No complete card-sized bright band for "+row["cardKey"])
 y0,y1=max(strong,key=lambda x:x[1]-x[0])
 # Card edges can contain dark 1px anti-aliased round corners; allow a 3px edge.
 y0=max(0,y0-3);y1=min(crop.height,y1+3)
 trimmed=crop.crop((0,y0,crop.width,y1))
 if not(1.21<=trimmed.height/trimmed.width<=1.75 and trimmed.width>=180 and trimmed.height>=220):
  raise ValueError("Out-of-range original crop ratio / size for "+row["cardKey"]+": "+str(trimmed.size))
 dest=output/(row["cardKey"]+".webp")
 trimmed.save(dest,format="WEBP",quality=89,method=6)
 im=Image.open(dest);im.load()
 assert im.width==trimmed.width and im.height==trimmed.height and im.format=="WEBP"
 audit.append({"cardKey":row["cardKey"],"canonicalOrder":row["canonicalOrder"],
  "koreanMasterName":row["koreanMasterName"],
  "selfHostedAsset":"/assets/cards/classic-korean-official-2023/"+dest.name,
  "sourceFirstPartyProduct":"https://pokemoncard.co.kr/card/590",
  "sourceGraphicUrl":row["officialProductGraphicUrl"],
  "sourceFingerprint":row["originalGraphicSHA256"],
  "originalKoreanMarketingCropPixels":row["cropPixelSize"],
  "trimmedCropPixelSize":[trimmed.width,trimmed.height],
  "cropYTrim":[y0,y1],"quality":"low_resolution_official_Korean_marketing_card_photo",
  "verifiedPrintLanguage":"Korean","previousDisplayedImage":"Japanese",
  "regionEditionProof":"Official Korea product-page individual card artwork",
  "sourceImageBinaryCopiedToSelfHostedGitHubPages":True,
  "notYetWiredToLiveCard":True})
assert len(audit)==15
report={"schemaVersion":1,"preparedAt":"2026-10-13","count":15,
 "scope":"Official Korean product-card crop originals replacing 15 previously Japanese-printed displayed Classics, quality-review staged only",
 "safety":{"newThirdPartyImageHotlinks":0,"remainingJapanesePrintedMasterImages":65,
  "ambiguousEnergyPrintsStillHeld":6,
  "newImagesSelfHostedInRepo":True,
  "userOwnershipUnchanged":True,"liveThemeMembershipNotChangedYet":True,
  "hasOfficialKoreanStandaloneHighResolutionScans":False},
 "assets":sorted(audit,key=lambda x:x["cardKey"])}
out=root/"data/audits/theme-classic-15-interim-official-asset-preparation-20261013.json"
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({"prepared":len(audit),"bySet":{c:len(ns) for c,ns in target.items()},
 "dims":{x["cardKey"]:x["trimmedCropPixelSize"] for x in audit}},ensure_ascii=False))
