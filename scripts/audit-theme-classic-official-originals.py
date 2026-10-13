#!/usr/bin/env python3
"""One-shot, rate-limited public official Pokemon Korea Korean Classic image availability proof.
This is a metadata probe only: never rewrites master cards, theme data or hosted site assets.
Never guesses that 415/403 means missing; preserves full provenance and allows manual review.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from urllib.parse import urlparse
from time import sleep
import json
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-classic-official-image-discovery-20261013.json"
domain="cards.image.pokemonkorea.co.kr"
cases={s:["001","004","018","031"] for s in ("CLL","CLK","CLF")}
rows=[]
for s,numbers in cases.items():
 for n in numbers:
  url=f"https://{domain}/data/wmimages/SV/{s}/{s}_{n}.png"
  result={"set":s,"cardNumber":n,"candidateOfficialImageUrl":url,
    "source":"Pokémon Korea official Korean image domain candidate; unconfirmed until HTTP 200 and image visually checked",
    "method":"HEAD","httpStatus":None,"contentType":"","knownKoreanCard":False}
  assert urlparse(url).hostname==domain
  try:
   with urlopen(Request(url,method="HEAD",headers={
     "User-Agent":"DigitalCardBinder-RegionalOriginalImageAudit/1.0 (+https://digital-card-binder.github.io/)",
     "Accept-Language":"ko-KR,ko;q=0.9"}),timeout=11) as resp:
    result["httpStatus"]=resp.status
    result["contentType"]=resp.headers.get("Content-Type","")
    result["contentLength"]=resp.headers.get("Content-Length","")
  except HTTPError as err:
   result["httpStatus"]=err.code;result["error"]=str(err.reason)[:100]
  except (URLError,OSError,TimeoutError) as err:
   result["error"]=type(err).__name__+": "+str(err)[:150]
  result["availability"]="official_candidate_http_200_image_headers_only" if result.get("httpStatus")==200 and result["contentType"].lower().startswith("image/") else (
   "official_not_found" if result.get("httpStatus") in (404,410) else
   "official_access_blocked_or_not_proven")
  rows.append(result)
  print(s,n,result["httpStatus"],result["availability"],flush=True)
  sleep(.45)
summary={"confirmedImageHeaders":sum(r["availability"]=="official_candidate_http_200_image_headers_only" for r in rows),
 "notFound":sum(r["availability"]=="official_not_found" for r in rows),
 "blockedOrUnproven":sum(r["availability"]=="official_access_blocked_or_not_proven" for r in rows)}
out.write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-13","scope":"CLL CLK CLF four representative official Pokemon Korea art paths per set",
 "networkRequestsToOfficialHost":len(rows),
 "policy":"One HEAD per representative number. HTTP 200 image header alone does not prove Korean printed card; no files ingested or deployed. Never infer missing for 403, 415, 5xx.",
 "summary":summary,"probes":rows},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps(summary),flush=True)
