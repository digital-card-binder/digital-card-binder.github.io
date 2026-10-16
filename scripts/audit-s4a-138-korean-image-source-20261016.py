#!/usr/bin/env python3
"""Read-only S4a 138 Korean Zamazenta print investigation. No card mutation."""
import json,hashlib
from pathlib import Path
from urllib.request import urlopen,Request
from io import BytesIO
from PIL import Image
BASE=Path(__file__).resolve().parents[1]
out=BASE/"data/audits/theme-visual-evidence/s4a/121-150"
assert out.is_dir()
manifest=json.loads((out/"visual-index.json").read_text("utf-8"))
held=manifest["cards"][17]
assert held["code"]=="s4a_138/190" and held["name"]=="자마젠타"
assert held["imageCheck"]["status"]=="owned_archive_missing"
urls=[
 held["ownedUrl"],
 held["sourceUrl"],
 "https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S4a/S4a_138.jpg",
 "https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S4a/S4a_138.webp"
]
rows=[]
for url in urls:
 result={"url":url,"decoded":False}
 try:
  req=Request(url,headers={"User-Agent":"Mozilla/5.0"})
  with urlopen(req,timeout=20) as response:
   payload=response.read(6_000_001)
   result.update(http=response.status,mime=response.headers.get("Content-Type",""),bytes=len(payload),
                 prefix=payload[:12].hex())
  if len(payload)<2000 or len(payload)>6_000_000:raise ValueError("Too small or large to be a Pokemon card image")
  with Image.open(BytesIO(payload)) as im:
   im.load()
   if im.width<160 or im.height<220:raise ValueError("Not a card-size raster")
   result.update(decoded=True,format=im.format,dimensions=[im.width,im.height],
                 sha256=hashlib.sha256(payload).hexdigest())
 except Exception as err:
  result["error"]=str(err)[:180]
 rows.append(result)
report={"schemaVersion":1,"recordedAt":"2026-10-16","card":"s4a_138/190",
 "purpose":"Investigate one missing self-hosted Korean official S4a image while preserving printed-language/card-ID evidence",
 "status":"source_diagnostics_only",
 "officialSourceConfirmed":any(x["decoded"] and "cards.image.pokemonkorea.co.kr" in x["url"] for x in rows),
 "ownedArchiveConfirmed":rows[0]["decoded"],"masterOrThemeMutation":False,
 "sources":rows}
(out/"s4a-138-source-diagnostics.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps(report,ensure_ascii=False))
