#!/usr/bin/env python3
"""Replace ONLY wrong SM2K 056/050 with actual Korean rainbow GX card art from
exact Korean Dogam card detail; selfhost original in this repository.
Preserve all collection card codes and old user ownership state untouched.
"""
import hashlib,io,json,pathlib,re,urllib.request
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
MASTER=ROOT/"data/series.json"
SOURCE="https://www.dogam.app/sets/01KW0QNEZ0CVFEB2YEH850TS9Z/cards/01KW1C67P6F7QC2KWBBG4DGBVB"
IMAGE="https://static.tcgexchange.kr/f74819f882b3aaad3623a8f88111b09f.png"
OUT="assets/cards/sm2k-korean/056.webp"
URL="https://digital-card-binder.github.io/"+OUT
REPORT="data/audits/sm2k-056-exact-Korean-image-recovery-20261018.json"
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (DCB KoreanCardIdentityRepair)"})
 with urllib.request.urlopen(req,timeout=45) as response:return response.read(7000000)
raw=MASTER.read_text(encoding="utf8")
catalog=json.loads(raw)
groups=[g for g in catalog if str(g.get("code","")).lower()=="sm2k"]
assert len(groups)==1 and len(groups[0]["cards"])==62
card=groups[0]["cards"][55]
assert card["code"].lower()=="sm2k_056/050" and card["name"]=="폭거북스 GX" and card["order"]==56
old=card["image"]
if old==URL and (ROOT/OUT).exists():
 print("Already patched SM2K 056");raise SystemExit(0)
if not old.startswith("https://k-tcgpanda.com/"):
 raise ValueError("Unexpected SM2K_056 old image; no unsafe replacement "+old)
page=get(SOURCE).decode("utf8","replace")
if "한글판" not in page or "056" not in page or "폭거북스 GX" not in page or IMAGE not in page:
 raise ValueError("Exact Korean card source-page title, number or image inconsistent")
binary=get(IMAGE)
if len(binary)<100000:raise ValueError("Korean Rainbow image unexpectedly short")
im=Image.open(io.BytesIO(binary));im.load()
if im.width<500 or im.height<700 or not .66<im.width/im.height<.76:
 raise ValueError("Image is not a full exact-size Korean card")
buf=io.BytesIO()
im.convert("RGB").save(buf,"WEBP",quality=93,method=6)
own=buf.getvalue()
if not own[:4]==b"RIFF" or own[8:12]!=b"WEBP" or len(own)<40000:
 raise ValueError("New own WebP damaged")
dest=ROOT/OUT
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_bytes(own)
oldSource=card.get("source")
card["image"]=URL
card["source"]=SOURCE
if "imageReferenceNote" in card:
 card["imageReferenceNote"]="한국판 폭거북스 GX 056/050 실물 카드 이미지 · 카드별 도감앱 확인 및 자체 보관"
MASTER.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
report={
 "schemaVersion":1,"date":"2026-10-18","slot":"SM2K_056","name":card["name"],
 "sourcePage":SOURCE,"koreanImageOrigin":IMAGE,"oldMismatchedImage":old,
 "oldSourcePage":oldSource,"newOwnedImage":URL,"selfHostedPath":OUT,
 "sourcePhotoSHA256":hashlib.sha256(binary).hexdigest(),
 "ownedWebpSHA256":hashlib.sha256(own).hexdigest(),
 "sourceDimensions":[im.width,im.height],"ownedBytes":len(own),
 "verifiedPrintedCardNumberFromKoreanCardApp":"056/050",
 "status":"approved_exact_Korean_source_and_repository_image",
 "note":"Exact Korean SM2K 056 rainbow art, unlike prior k-tcgpanda photo. Live Pages integrity should be checked after deployment.",
 "masterCardCodesChanged":0,"userCollectionRecordsChanged":0,"otherCardsChanged":0,
 "outstandingSM2KImageHoldsAfterPublicValidation":[57,58,60,61,62]
}
(ROOT/REPORT).write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SM2K_056_KOREAN_CARD_IMAGE_SELFHOSTED",json.dumps(report,ensure_ascii=False),flush=True)
