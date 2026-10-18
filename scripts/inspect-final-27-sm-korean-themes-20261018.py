#!/usr/bin/env python3
"""Read-only last 27 SM Korean art-theme intake contact sheets + existing 12 themes."""
import base64,io,json,pathlib,urllib.request
from PIL import Image,ImageDraw,ImageOps
R=pathlib.Path(__file__).resolve().parents[1]
sets=json.loads((R/"data/series.json").read_text(encoding="utf8"))
m=json.loads((R/"data/audits/theme-sm1m-061-073-Korean-art-review-20261017.json").read_text(encoding="utf8"))
s=json.loads((R/"data/audits/theme-sm1s-061-073-Korean-art-review-20261017.json").read_text(encoding="utf8"))
themes=json.loads((R/"data/art-themes.json").read_text(encoding="utf8"))
print("SM_THEME_SCHEMA",json.dumps([{"code":g["code"],"name":g.get("name"),"description":g.get("description"),"categories":g.get("categories"),"count":len(g.get("cards",[])),"examples":[{k:x.get(k) for k in ("code","name","category","categories","source")} for x in g.get("cards",[])[-3:]]} for g in themes["groups"]],ensure_ascii=False),flush=True)
color=next(x for x in themes["groups"] if x["code"]=="color")
for key in ["SM1M_068","SM1S_069","SM1PLUS_057"]:
 sample=next((z for z in color["cards"] if z.get("code","").upper()==key),None)
 print("SM_COLOR_EXAMPLE",json.dumps({"key":key,"sample":sample},ensure_ascii=False),flush=True)
for code in ["sm1+","sm1M","sm1S"]:
 source=next(x for x in sets if x["code"].lower()==code.lower())
 print("SM_MASTER_EXAMPLE",json.dumps({"setCode":source["code"],"setDisplay":source.get("displayName"),"era":source.get("era"),"firstCard":source["cards"][0],"lastCard":source["cards"][-1]},ensure_ascii=False),flush=True)

print("SM_THEMES_META",json.dumps({"top":list(themes),"first":list(themes["groups"][0]["cards"][0]),"lastStatus":list(themes["groups"][-1])},ensure_ascii=False),flush=True)
for g in [x for x in sets if x["code"].lower() in ("sm1+","sm1m","sm1s")]:
 print("SM_SET",json.dumps({"code":g["code"],"cards":len(g["cards"]),"imageFirst":g["cards"][0]["image"],"imageLast":g["cards"][-1]["image"]},ensure_ascii=False),flush=True)
def name_for(code):
 for g in sets:
  if g["code"].lower()!=code.lower():continue
  return {c["code"].split("/")[0].lower():c["name"] for c in g["cards"]}
 return {}
target={"sm1plus":list(range(59,78)),"sm1m":[67,69,71,73],"sm1s":[70,71,72,73]}
rows={}
for group, nums in target.items():
 info=[]
 for n in nums:
  raw_set={"sm1plus":"sm1+","sm1m":"sm1M","sm1s":"sm1S"}[group]
  setdata=next(x for x in sets if x["code"].lower()==raw_set.lower())
  c=next(x for x in setdata["cards"] if x["code"].lower().startswith(f"{group}_{n:03d}/"))
  if group=="sm1plus":
   image_bytes=(R/f"assets/cards/sm1plus-korean/{n:03d}.webp").read_bytes()
   physical_source="repo-verified"
  else:
   held=next(x for x in (m if group=="sm1m" else s)["held"] if x["canonicalOrder"]==n)
   url=held["ownedUrl"]
   req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
   image_bytes=urllib.request.urlopen(req,timeout=38).read()
   physical_source=url
  pic=Image.open(io.BytesIO(image_bytes));pic.load()
  full=pic.convert("RGB")
  existing=[]
  for g in themes["groups"]:
   for cc in g.get("cards",[]):
    if str(cc.get("code","")).split("/")[0].lower()==f"{group}_{n:03d}":
     existing.append({"theme":g["code"],"category":cc.get("category"),"categories":cc.get("categories")})
  item={"set":raw_set,"number":n,"code":c["code"],"name":c["name"],"image":physical_source,"w":full.width,"h":full.height,"existingTheme":existing,"bytes":len(image_bytes)}
  info.append((item,full))
  print("SM_UNREVIEWED_THEME_IMAGE",json.dumps(item,ensure_ascii=False),flush=True)
 rows[group]=info
for group,pictures in rows.items():
 cols=5 if len(pictures)>9 else 4
 cw=240 if cols==5 else 360
 ch=355 if cols==5 else 535
 totalrows=(len(pictures)+cols-1)//cols
 sheet=Image.new("RGB",(cw*cols,ch*totalrows),"#eeeeee"); d=ImageDraw.Draw(sheet)
 for idx,(item,pic) in enumerate(pictures):
  x=(idx%cols)*cw;y=(idx//cols)*ch
  maxh=ch-52
  pic.thumbnail((cw-12,maxh),Image.Resampling.LANCZOS)
  sheet.paste(pic,(x+(cw-pic.width)//2,y+5))
  d.text((x+8,y+ch-43),f"{item['set']} {item['number']:03d}",fill="black")
  d.text((x+8,y+ch-22),item["code"][-16:],fill="black")
 buf=io.BytesIO();sheet.save(buf,"JPEG",quality=74,optimize=True)
 print(f"SM_THEME_{group.upper()}_SHEET_B64="+base64.b64encode(buf.getvalue()).decode("ascii"),flush=True)
