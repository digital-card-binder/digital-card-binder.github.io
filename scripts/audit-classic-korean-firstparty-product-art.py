#!/usr/bin/env python3
"""First-party Korean Pokemon TCG Classic marketing card-image evidence.
Download only three explicitly linked assets on pokemoncard.co.kr/card/590.
Archive as evidence only; not intended as full-quality standalone card replacements.
"""
from pathlib import Path
from urllib.request import urlopen,Request
from urllib.parse import urlsplit
from io import BytesIO
from PIL import Image
import json,hashlib,base64
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-classic-official-product-20261013"
out.mkdir(parents=True,exist_ok=True)
urls={
 "CLF":"https://data1.pokemonkorea.co.kr/2023/12/2023-12-08_17-51-49-77668-1702025509.png",
 "CLL":"https://data1.pokemonkorea.co.kr/2023/12/2023-12-08_17-51-56-94665-1702025516.png",
 "CLK":"https://data1.pokemonkorea.co.kr/2023/12/2023-12-08_17-52-00-44554-1702025520.png"}
records={}
for code,url in urls.items():
 assert urlsplit(url).hostname=="data1.pokemonkorea.co.kr"
 rec={"set":code,"officialProductPage":"https://pokemoncard.co.kr/card/590",
  "sourceUrl":url,"status":"unavailable","originalCardReplacementsCreated":0,
  "officialProductImageIsNotIndividualPrintScan":True}
 try:
  with urlopen(Request(url,headers={"User-Agent":"DigitalCardBinder-OfficialProductArtworkReview/1.0 (+https://digital-card-binder.github.io/)",
    "Accept":"image/png,image/*;q=0.9"}),timeout=25) as res:
   data=res.read(6_500_000)
   rec["http"]=res.status;rec["contentType"]=res.headers.get_content_type()
  if not (200<=rec["http"]<300 and rec["contentType"].startswith("image/") and 1024<len(data)<6_500_000):
   raise ValueError("Unexpected response or invalid image payload")
  src=Image.open(BytesIO(data));src.load()
  rec.update({"status":"first_party_product_page_image_saved_for_evidence",
   "originalPixelSize":[src.width,src.height],
   "originalByteSize":len(data),"sha256":hashlib.sha256(data).hexdigest()})
  snapshot=src.convert("RGB")
  # Keep aspect ratio and printed text legible without altering colors in the evidence.
  if snapshot.width>1250:snapshot.thumbnail((1250,5000))
  mem=BytesIO();snapshot.save(mem,format="WEBP",quality=92,method=6)
  fn=f"{code}-official-product-full.webp.b64"
  (out/fn).write_text(base64.b64encode(mem.getvalue()).decode("ascii"),encoding="ascii")
  rec["evidenceFile"]="data/audits/theme-classic-official-product-20261013/"+fn
  rec["evidenceImageDimensions"]=[snapshot.width,snapshot.height]
 except Exception as exc:
  rec["error"]=str(exc)[:250]
 records[code]=rec
 print(code,rec["status"],rec.get("originalPixelSize"),flush=True)
obj={"schemaVersion":1,"recordedAt":"2026-10-13",
 "source":"Official Korean Pokémon TCG Classic product https://pokemoncard.co.kr/card/590",
 "policy":{"firstPartyProductPageOnly":True,
           "doNotInferAll102IndividualKoreanImages":True,
           "notApprovedAsIndividualCardFullResolutionSource":True,
           "noProductionAssetsReplaced":True,
           "mustPreserveOriginalCardTextAndPixels":True},
 "records":records}
(out/"index.json").write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
if not any(x["status"]=="first_party_product_page_image_saved_for_evidence" for x in records.values()):
 raise RuntimeError("No official Korean product images decoded; detailed source error saved locally")
