#!/usr/bin/env python3
"""Read-only Korean Time Gazer 001-030 owned CDN proof from Digital Card Binder-owned CDN.
No official or external source image download; no master/theme/ownership edits."""
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from PIL import Image,ImageDraw
from io import BytesIO
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
import base64,json
ROOT=Path(__file__).resolve().parents[1]
CODE="s10d"
COUNT=30
AUDIT=ROOT/"data"/"audits"/"theme-visual-evidence"/CODE/"001-030"
AUDIT.mkdir(parents=True,exist_ok=True)
def read(p):
 return json.loads((ROOT/p).read_text(encoding="utf-8"))
masters=[s for s in read("data/series.json")+read("data/series-legacy.json") if str(s.get("code","")).lower()==CODE.lower()]
assert len(masters)==1 and len(masters[0].get("cards",[]))==88, "s10D Korean master should have 88 cards"
master=masters[0]
themes=read("data/art-themes.json")
existing={}
for group in themes["groups"]:
 for card in group.get("cards",[]):
  key=str(card.get("code","")).upper()
  if str(card.get("set","")).lower()==CODE.lower() or key.startswith(CODE.upper()+"_"):
   existing.setdefault(key,[]).append(group["code"])
def fnv64(text):
 h=0xcbf29ce484222325
 for ch in text:
  h^=ord(ch); h=(h*0x100000001b3)&0xffffffffffffffff
 return f"{h:016x}"
def cdn_route(src):
 if not src or not src.startswith("https://"):return ""
 url=urlsplit(src);base=f"{url.scheme}://{url.netloc}{url.path}"
 if url.hostname in ("dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"):
  return base
 if url.hostname=="cards.image.pokemonkorea.co.kr":
  p=url.path.lstrip("/")
  root=p.split("/")[2].upper() if p.startswith("data/wmimages/") else ""
  host="modern" if root in ("MEGA","S","SV") else "legacy"
  return "https://dcb-card-images-"+host+"-2026.pages.dev/"+p.rsplit(".",1)[0]+".webp"
 return f"https://dcb-card-images-legacy-2026.pages.dev/external/{url.hostname}/{fnv64(base)}.webp"
cards=[]
for i,card in enumerate(master["cards"][0:30],1):
 ident=str(card.get("code") or "")
 assert ident.lower().startswith(f"{CODE.lower()}_{i:03d}/"),(i,ident)
 raw=card.get("sourceImage") or card.get("image") or ""
 key=CODE.upper()+"_"+ident.split("_",1)[1].split("/")[0].split(" ")[0]
 cards.append({"canonicalOrder":i,"masterCode":ident,"name":card.get("name") or "",
  "rawSource":raw,"cdnUrl":cdn_route(raw),"existingThemes":sorted(set(existing.get(key,[])))})
def fetch_image(card):
 result={"canonicalOrder":card["canonicalOrder"],"cdnUrl":card["cdnUrl"],"status":"pending"}
 im=None
 try:
  target=card["cdnUrl"]
  assert target.startswith(("https://dcb-card-images-modern-2026.pages.dev/","https://dcb-card-images-legacy-2026.pages.dev/"))
  with urlopen(Request(target,headers={"User-Agent":"DCB-Korean-OwnArchiveVisualReview/1.0"}),timeout=18) as response:
   data=response.read(3000000)
   result["http"]=response.status
  im=Image.open(BytesIO(data));im.load()
  result.update({"status":"decoded","bytes":len(data),"dimensions":[im.width,im.height],"format":im.format})
  im=im.convert("RGB");im.thumbnail((218,307))
 except Exception as err:
  result.update({"status":"unavailable","error":str(err)[:180]})
 return card["canonicalOrder"],result,im
records={}
with ThreadPoolExecutor(max_workers=12) as pool:
 for result in as_completed([pool.submit(fetch_image,c) for c in cards]):
  order,proof,im=result.result();records[order]=(proof,im)
items=[records[c["canonicalOrder"]] for c in cards]
sheets=[]
for start in range(0,COUNT,15):
 sheet=Image.new("RGB",(1220,1104),(242,242,242));draw=ImageDraw.Draw(sheet)
 for j,(proof,im) in enumerate(items[start:start+15]):
  x=(j%5)*244;y=(j//5)*368
  draw.rectangle((x+2,y+2,x+240,y+364),outline=(180,180,180),width=2)
  if im: sheet.paste(im,(x+(244-im.width)//2,y+4))
  else: draw.text((x+10,y+140),"OWN CDN MISSING",fill=(25,25,25))
  c=cards[start+j]
  draw.text((x+7,y+318),str(c["canonicalOrder"])+" "+str(c["name"])[:18],fill=(10,10,10))
  draw.text((x+7,y+338),str(c["masterCode"])[:25]+" "+proof["status"],fill=(10,10,10))
 out=BytesIO();sheet.save(out,format="WEBP",quality=78)
 file=f"s10d-001-030-{start//15+1:02}.webp.b64"
 (AUDIT/file).write_text(base64.b64encode(out.getvalue()).decode("ascii"),encoding="ascii")
 sheets.append({"file":file,"canonicalStart":start+1,"canonicalEnd":min(start+15,30),"encodedBytes":len(out.getvalue())})
counter={"verified":sum(proof["status"]=="decoded" for proof,_ in items),"missing":sum(proof["status"]!="decoded" for proof,_ in items)}
report={"schemaVersion":1,"recordedAt":"2026-10-14","set":CODE,
 "name":master.get("name"),"cardCount":COUNT,"masterSetCardCount":88,"canonicalRange":"001-030","verificationCounts":counter,
 "existingThemeRecords":existing,
 "masterMissingKoreanNames":sum(not str(c["name"]).strip() for c in cards),
 "source":"User-owned DCB Cloudflare archives only; 0 third-party origin requests.",
 "cards":[{**card,"imageCheck":proof} for card,(proof,_) in zip(cards,items)],
 "sheets":sheets,
 "nextSafeStart":"s10D canonical 001-030 image proofs ready; artwork still requires direct visual review"}
(AUDIT/"visual-index.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"set":CODE,"cardCount":COUNT,"decoded":counter["verified"],"missing":counter["missing"],
 "nameMissing":report["masterMissingKoreanNames"],"existingThemeSlots":sum(len(x) for x in existing.values()),
 "sheets":len(sheets)},ensure_ascii=False))
