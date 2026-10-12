#!/usr/bin/env python3
"""Build self-hosted Korean Battle Partners 132-image contact sheets, read only to main master.
Read-only relative to master, theme data, and user ownership states."""
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from PIL import Image,ImageDraw
from io import BytesIO
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
import base64,json,time
ROOT=Path(__file__).resolve().parents[1]
CODE="sv9"
AUDIT=ROOT/"data"/"audits"/"theme-visual-evidence"/"sv9"
AUDIT.mkdir(parents=True,exist_ok=True)
def read(p):
 return json.loads((ROOT/p).read_text(encoding="utf-8"))
series=read("data/series.json")+read("data/series-legacy.json")
master=next((s for s in series if str(s.get("code")).lower()==CODE.lower()),None)
assert master and len(master["cards"])==132,("master set changed",len(master["cards"]) if master else None)
themes=read("data/art-themes.json")
state=read("data/audits/theme-series-review-status.json")
existing={}
for g in themes["groups"]:
 for c in g.get("cards",[]):
  if str(c.get("set","")).lower()==CODE.lower() or str(c.get("code","")).lower().startswith(CODE.lower()+"_"):
   existing.setdefault(str(c.get("code","")).upper(),[]).append(g["code"])
def fnv(text):
 h=0xcbf29ce484222325
 for ch in text:
  h ^=ord(ch);h=(h*0x100000001b3)&((1<<64)-1)
 return f"{h:016x}"
def route(src):
 if not src or not src.startswith("https://"):return ""
 u=urlsplit(src);base=f"{u.scheme}://{u.netloc}{u.path}"
 if u.hostname=="cards.image.pokemonkorea.co.kr":
  p=u.path.lstrip("/")
  root=p.split("/")[2].upper() if p.startswith("data/wmimages/") else ""
  host="modern" if root in ["MEGA","S","SV"] else "legacy"
  name=p.rsplit(".",1)[0]+".webp"
  return f"https://dcb-card-images-{host}-2026.pages.dev/{name}"
 return f"https://dcb-card-images-legacy-2026.pages.dev/external/{u.hostname}/{fnv(base)}.webp"
cards=[]
for i,c in enumerate(master["cards"],1):
 name=c.get("name") or "";raw=c.get("sourceImage") or c.get("image") or ""
 ident=str(c.get("code") or "")
 assert ident.lower().startswith("sv9_"),(i,ident)
 cards.append({"canonicalOrder":i,"masterCode":ident,"name":name,
 "rawSource":raw,"cdnUrl":route(raw),
 "existingThemes":sorted(set(existing.get(f"SV9_{i:03d}",[]))),
 "rarity":c.get("rarity") or ""})
def get(c):
 r={"canonicalOrder":c["canonicalOrder"],"code":c["masterCode"],"name":c["name"],"cdnUrl":c["cdnUrl"],"status":"pending"}
 im=None
 try:
  assert c["cdnUrl"]
  with urlopen(Request(c["cdnUrl"],headers={"User-Agent":"DigitalCardBinder-VisualAudit/1.1"}),timeout=14) as response:
   payload=response.read(3000000);r["http"]=response.status
  im=Image.open(BytesIO(payload));im.load()
  r["status"]="decoded";r["bytes"]=len(payload);r["dimensions"]=[im.width,im.height];r["format"]=im.format
  im=im.convert("RGB");im.thumbnail((220,310))
 except Exception as exc:r.update({"status":"unavailable","error":str(exc)[:180]})
 return c["canonicalOrder"],r,im
results={}
with ThreadPoolExecutor(max_workers=12) as pool:
 for fut in as_completed([pool.submit(get,c) for c in cards]):
  idx,r,im=fut.result();results[idx]=(r,im)
items=[results[c["canonicalOrder"]] for c in cards]
counter={"verified":sum(x[0]["status"]=="decoded" for x in items),"missing":sum(x[0]["status"]!="decoded" for x in items)}
sheets=[]
for start in range(0,len(items),15):
 page=items[start:start+15];sheet=Image.new("RGB",(1220,1104),(242,242,242));draw=ImageDraw.Draw(sheet)
 for i,(r,im) in enumerate(page):
  x=(i%5)*244;y=(i//5)*368
  draw.rectangle((x+2,y+2,x+240,y+364),outline=(180,180,180),width=2)
  if im:sheet.paste(im,(x+(244-im.width)//2,y+5))
  else:draw.text((x+9,y+130),"IMAGE UNAVAILABLE",fill=(30,30,30))
  draw.text((x+8,y+319),str(r["canonicalOrder"])+": "+str(r["name"])[:19],fill=(10,10,10))
  draw.text((x+8,y+339),str(r["code"])[:28]+" "+r["status"],fill=(10,10,10))
 out=BytesIO();sheet.save(out,format="WEBP",quality=78)
 p=f"sv9-{start//15+1:02d}.webp.b64"
 (AUDIT/p).write_text(base64.b64encode(out.getvalue()).decode("ascii"),encoding="ascii")
 sheets.append({"file":p,"canonicalStart":start+1,"canonicalEnd":min(start+15,len(items)),"encodedBytes":len(out.getvalue())})
report={"schemaVersion":1,"recordedAt":"2026-10-13","set":CODE,
 "name":master.get("name"),"cardCount":len(cards),"verificationCounts":counter,
 "existingThemeRecords":{k:v for k,v in existing.items()},
 "currentReviewState":state.get("reviews",{}).get(CODE) or state.get("reviews",{}).get(CODE.upper()),
 "source":"Existing Digital Card Binder self-hosted CDN images; no third-party image downloads.",
 "cards":[{**c,"imageCheck":r} for c,(r,im) in zip(cards,items)],"sheets":sheets}
(AUDIT/"visual-index.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"set":CODE,"cards":len(cards),"decoded":counter["verified"],"missing":counter["missing"],"preexistingThemeRecords":len(existing),"sheets":len(sheets)},ensure_ascii=False))
