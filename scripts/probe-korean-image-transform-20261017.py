#!/usr/bin/env python3
"""Probe documented Pokémon Korea image width-parameter fallback; never publish bytes."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from io import BytesIO
import json, socket
from PIL import Image
root=Path(__file__).resolve().parents[1]
samples=[
("MEGA/M-P/M-P_085.png","M-P_085"),
("MEGA/M-P/M-P_086.png","M-P_086"),
("MEGA/MC/MC_766.png","MC_766"),
("SV/CLL/CLL_004.png","CLL_004"),
("SV/CLF/CLF_004.png","CLF_004"),
("S/S6K/S6K_089.png","S6K_089"),
("S/S1a/S1a_079.png","S1a_079"),
("SM/SM1M/SM1M_067.png","SM1M_067"),
("S/S-P/S-P_022.png","S-P_022"),
("S/S4a/S4a_138.png","S4a_138"),
("SM/SM1+/SM1+_059.png","SM1+_059"),
("S/S3a/S3a_086.png","S3a_086"),
]
rows=[]
for rel,key in samples:
  url="https://cards.image.pokemonkorea.co.kr/data/wmimages/"+rel+"?w=512"
  result={"card":key,"candidate":url,"status":None,"decodedImage":False,"KoreanPrintFooterVerified":False}
  try:
    request=Request(url,headers={"User-Agent":"DigitalCardBinder-PrintSourceProbe/1.1","Accept":"image/png,image/webp,image/jpeg"})
    with urlopen(request,timeout=10) as response:
      result["status"]=response.status
      body=response.read(6_000_001)
      result["byteCount"]=len(body)
      if len(body)<=6_000_000 and body.startswith((b"\\x89PNG",b"RIFF",b"\\xff\\xd8")):
        with Image.open(BytesIO(body)) as im:
          im.verify()
        with Image.open(BytesIO(body)) as im:
          result["dimensions"]=list(im.size)
          result["decodedImage"]=True
  except HTTPError as e:
    result["status"]=e.code
  except (URLError,TimeoutError,socket.timeout,OSError) as e:
    result["errorClass"]=type(e).__name__
  rows.append(result)
  print(key,result.get("status"),result.get("decodedImage"),flush=True)
out=root/"data/audits/korean-recovery-official-image-width-transform-20261017.json"
out.write_text(json.dumps({"schemaVersion":1,"strategy":"GET PNG candidate with w=512 first-party width parameter","scope":len(samples),"statuses":rows,"downloadedBytesStored":0,"replacedImages":0,"notProofOfKoreanPrint":True},ensure_ascii=False,indent=2)+"\\n",encoding="utf-8")
