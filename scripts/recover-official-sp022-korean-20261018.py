#!/usr/bin/env python3
"""Apply only official Korean S-P 022 Meowth VMAX event-preview card image.

Changes one Korean card image/source, one explicit "unavailable" override and
writes a provenance report. Does not assert physical distribution or change IDs.
"""
import hashlib, io, json, pathlib, time, urllib.request
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
URL="https://data1.pokemonkorea.co.kr/2020/01/2020-01-31_16-39-43-27197-1580456383.png"
OFFICIAL="https://pokemonkorea.co.kr/pkl2020_s2_card"
KEY="s-p_022/s-p"
CARD_CODE="s-p_022/S-P"
IMAGE_PATH="assets/cards/s-p-korean-promo/022-korean.webp"
OWNED="https://digital-card-binder.github.io/"+IMAGE_PATH
REPORT="data/audits/sp022-official-Korean-preview-recovery-20261018.json"
OLD_FOREIGN={
 "https://static.tcgexchange.kr/00a26102a9e1b0550f7e647ec9134e2f.jpg",
 "https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/0d823c90a6041637.webp",
 "/assets/card-image-unavailable.svg",
}
catalogs=[]
matches=[]
for fn in ("data/series.json","data/series-legacy.json"):
 p=ROOT/fn
 data=json.loads(p.read_text(encoding="utf-8"))
 catalogs.append((p,data))
 for group in data:
  if str(group.get("code","")).lower()=="s-p":
   if len(group.get("cards",[]))!=204:raise RuntimeError("S-P 204 count changed")
   for card in group["cards"]:
    if str(card.get("code","")).lower()==KEY:matches.append((p,data,card))
if len(matches)!=1:raise RuntimeError("One and only one S-P 022 canonical card required")
p,catalog,card=matches[0]
if card.get("name")!="나옹 VMAX":raise RuntimeError("Unexpected Korean S-P 022 identity")
old=card.get("image","")
if old!=OWNED and old not in OLD_FOREIGN:raise RuntimeError("Unknown existing S-P 022 image; no blind replace: "+str(old))
overridePath=ROOT/"data/series-image-overrides.json"
overrides=json.loads(overridePath.read_text(encoding="utf-8"))
key=next((k for k in overrides.get("sets",{}) if k.lower()=="s-p"),None)
if not key:raise RuntimeError("Missing canonical s-p image override group")
existing=overrides["sets"][key].get(KEY)
if existing not in ("/assets/card-image-unavailable.svg", OWNED):
 raise RuntimeError("Unrecognized S-P 022 override: "+str(existing))
if old==OWNED and pathlib.Path(ROOT/IMAGE_PATH).exists():
 print("SP022_ALREADY_APPLIED");raise SystemExit(0)
last=None
for attempt in range(3):
 try:
  req=urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0 (KoreanPokemonCardEvidence/1.0)"})
  imgbytes=urllib.request.urlopen(req,timeout=40).read(8_000_000)
  if not imgbytes.startswith(b"\x89PNG\r\n\x1a\n") or len(imgbytes)<70000:raise RuntimeError("Invalid/small official PNG")
  im=Image.open(io.BytesIO(imgbytes));im.load()
  if im.width<650 or im.height<900 or not .67<im.width/im.height<.75:raise RuntimeError("Not full 022 S-P card art")
  break
 except Exception as ex:
  last=ex
  time.sleep(2+attempt*3)
else:raise RuntimeError("Official promo asset not downloadable "+str(last))
target=ROOT/IMAGE_PATH
target.parent.mkdir(parents=True,exist_ok=True)
im.convert("RGB").save(target,format="WEBP",lossless=True,method=6)
raw=target.read_bytes()
if len(raw)<35000 or raw[:4]!=b"RIFF" or raw[8:12]!=b"WEBP":raise RuntimeError("Failed self-hosted WebP")
wasSource=card.get("source","")
card["image"]=OWNED
card["source"]=OFFICIAL
card["koreanPreviewImageVerified"]=True
card["koreanPhysicalDistributionVerified"]=False
card["sourceImage"]=URL
card["previousForeignPrintImage"]=old
overrides["sets"][key][KEY]=OWNED
p.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
overridePath.write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
report={
 "schemaVersion":1,"date":"2026-10-18","cardKey":"S-P_022",
 "canonicalCode":CARD_CODE,"koreanCardName":"나옹 VMAX",
 "officialEventPage":OFFICIAL,"officialKoreanArtUrl":URL,
 "visualProof":"On official preview, the printed footer reads 022/S-P, Korean Meowth VMAX, Korean rules text.",
 "photoFormat":"official Korean-language full-card preview, not evidence of physically issued copies",
 "sourceSha256":hashlib.sha256(imgbytes).hexdigest(),
 "selfhostedPath":IMAGE_PATH,"selfhostedUrl":OWNED,"selfhostedSha256":hashlib.sha256(raw).hexdigest(),
 "selfhostedBytes":len(raw),"imageDimensions":[im.width,im.height],
 "oldForeignArt":old,"oldSource":wasSource,"replacedCardImage":True,"replacedUnavailableOverride":True,
 "officialEventPostponed":True,"physicalKoreanDistributionConfirmed":False,
 "catalogCodeUnchanged":True,"ownerCollectionRecordsChanged":False,
 "remainingReleaseHoldMustNotAutoClose":True
}
out=ROOT/REPORT
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("SP022_OFFICIAL_KOREAN_IMAGE_RECOVERED",json.dumps(report,ensure_ascii=False))
