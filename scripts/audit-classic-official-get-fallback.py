#!/usr/bin/env python3
"""Single minimal followup GET after official HEAD 415. Original-only, not hotlinking."""
from pathlib import Path
from urllib.request import urlopen,Request
from urllib.error import HTTPError,URLError
from urllib.parse import urlsplit
from io import BytesIO
from time import sleep
import json,base64
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-classic-official-get-fallback-20261013.json"
path=root/"data/audits/theme-classic-official-image-discovery-20261013.json"
p=json.loads(path.read_text(encoding="utf8"))
assert p["summary"]["blockedOrUnproven"]==12
cases=[("CLL","001"),("CLL","004"),("CLK","004"),("CLF","001")]
result=[]
for code,num in cases:
 url=f"https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/{code}/{code}_{num}.png"
 assert urlsplit(url).hostname=="cards.image.pokemonkorea.co.kr"
 row={"set":code,"number":num,"candidate":url,"method":"GET",
      "result":"pending","status":None,"bytesRead":0,"isKoreanPrinted":False,"file":None}
 try:
  req=Request(url,headers={"User-Agent":"DigitalCardBinder-Image-SourceCheck/1.1 (+https://digital-card-binder.github.io/)","Accept":"image/png,image/webp,image/*;q=0.8","Accept-Language":"ko-KR,ko;q=0.9"})
  with urlopen(req,timeout=12) as response:
   row["status"]=response.status
   row["contentType"]=response.headers.get_content_type().lower()
   payload=response.read(950_000+1)
   row["bytesRead"]=len(payload)
   if response.status==200 and row["contentType"].startswith("image/") and 1024<len(payload)<=950_000:
    from PIL import Image
    im=Image.open(BytesIO(payload));im.verify()
    row["imageDimensions"]=[im.width,im.height]
    row["result"]="candidate_image_awaits_human_korean_print_inspection"
    encoded=base64.b64encode(payload).decode("ascii")
    outfile=root/f"data/audits/classic-korean-candidate-{code}-{num}.b64"
    outfile.write_text(encoded,encoding="ascii")
    row["file"]="data/audits/"+outfile.name
   else:row["result"]="unexpected_or_untrusted_response_no_asset_ingested"
 except HTTPError as err:
  row["status"]=err.code;row["result"]="official_origin_rejects_GET" if err.code in [403,415,429] else "official_origin_no_confirmed_image"
 except (URLError,OSError,TimeoutError) as err:
  row["result"]="network_inaccessible";row["error"]=str(err)[:120]
 result.append(row);print(code,num,row["status"],row["result"],flush=True)
 sleep(.5)
out.write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-13","scope":"4 sampled Classic GETs after all 12 HEAD probes blocked with 415",
"thirdPartyRequests":0,"officialFirstPartyRequests":4,"records":result,"note":"GET failures cannot prove absence. Verified Korean print artwork is a separate human gate. No public site assets deployed."},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
