#!/usr/bin/env python3
"""Read-only M6a 157 Korean candidate check. Do not alter canonical card or CDN mapping."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from hashlib import sha256
from io import BytesIO
from PIL import Image,ImageDraw
from datetime import datetime,timezone
import json,base64
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/mega-visual-evidence/m6a-157"
CANDIDATES={
 "official":"https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6a/M6a_157.png",
 "secondaryKoreanDatabase":"https://static.tcgexchange.kr/09990710ea66217b9eccf98775c348de.webp"}
def check(origin,url):
 info={"origin":origin,"url":url,"confirmedKoreanPrint":False}
 try:
  with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0 (DigitalCardBinder audit)","Referer":"https://pokemoncard.co.kr/","Accept":"image/*"}),timeout=22) as r:
   info["http"]=r.status
   blob=r.read(10000001)
  if not 1000<len(blob)<=10000000:raise ValueError("binary size invalid")
  with Image.open(BytesIO(blob)) as im:
   im.load()
   info.update(status="decoded_region_unverified",size=list(im.size),bytes=len(blob),format=im.format,sha256=sha256(blob).hexdigest())
   preview=im.convert("RGB")
   preview.thumbnail((320,460))
  return info,preview
 except (HTTPError,URLError,ValueError,OSError) as e:
  info.update(status="not_usable",reason=str(e)[:160])
  return info,None
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 records=[check(k,v) for k,v in CANDIDATES.items()]
 canvas=Image.new("RGB",(800,590),"white")
 d=ImageDraw.Draw(canvas)
 for i,(meta,im) in enumerate(records):
  x=i*400
  d.rectangle((x+4,4,x+396,586),outline="gray",width=2)
  if im:canvas.paste(im,(x+(400-im.width)//2,25))
  d.text((x+10,510),meta["origin"],fill="black")
  d.text((x+10,532),str(meta.get("size",meta.get("reason"))),fill="black")
  d.text((x+10,554),"PRINT NOT APPROVED",fill="red")
 buf=BytesIO()
 canvas.save(buf,"WEBP",quality=88)
 (OUT/"m6a-157-source-comparison.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode("ascii"))
 report={"schemaVersion":1,"recordedAt":datetime.now(timezone.utc).isoformat(),"set":"M6a","number":157,
 "name":"개굴닌자 BREAK","canApprove":False,"siteChanges":False,
 "candidateSourceRecord":"https://www.dogam.app/cards/01M2FKQCHSS1JANZ60JE5TWT18",
 "note":"Secondary Korean image can be considered only after visual matching of Korean printed title and number; official bad dimensions are not sufficient.","sources":[meta for meta,_ in records]}
 (OUT/"visual-index.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
 print(json.dumps({"card":157,"sources":[{"origin":m["origin"],"status":m["status"],"size":m.get("size")} for m,_ in records]}))
if __name__=="__main__":main()
