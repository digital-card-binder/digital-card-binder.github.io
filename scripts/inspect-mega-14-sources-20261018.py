#!/usr/bin/env python3
"""Read-only audit: download 14 queued MEGA images and create labelled inspection sheets.
Print WebP base64 to GitHub Actions logs; never save/rewrite production assets.
"""
import base64, io, json, urllib.request
from PIL import Image, ImageDraw
from pathlib import Path
master=json.loads(Path("data/series.json").read_text("utf-8"))
queue=json.loads(Path("data/audits/korean-recovery-active-queue-20261018.json").read_text("utf-8"))
cards={}
def walk(node):
 if isinstance(node,list):
  for child in node: walk(child)
 elif isinstance(node,dict):
  code=str(node.get("code","")).lower()
  if code and "image" in node: cards[code]=node
  for v in node.values():
   if isinstance(v,(dict,list)): walk(v)
walk(master)
items=[]
for work in queue["unresolved"]:
 if work.get("era")!="MEGA": continue
 prefix,_,suffix=work["slot"].split("::")
 code=(prefix+"_"+suffix).lower()
 if prefix=="m-p": code="m-p_"+suffix.zfill(3)+"/m-p"
 elif prefix=="mc": code="mc_"+suffix.zfill(3)+"/742"
 elif prefix=="m6a": code="m6a_"+suffix
 obj=cards.get(code)
 if not obj: raise ValueError("Cannot resolve "+code)
 url=obj["image"]
 response=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (card print audit)"}),timeout=30)
 data=response.read()
 im=Image.open(io.BytesIO(data)); im.load()
 items.append((work,obj,im.convert("RGB"),len(data)))
 print("MEGA_SOURCE",json.dumps({"workId":work["workId"],"code":obj["code"],"name":obj["name"],"image":url,"sourceOriginalSize":im.size,"sourceBytes":len(data)},ensure_ascii=False))
if len(items)!=14: raise ValueError("Expected 14 but got "+str(len(items)))
for start in (0,7):
 chosen=items[start:start+7]
 w,h=380,555
 canvas=Image.new("RGB",(w*2,h*4),"#fafafa")
 draw=ImageDraw.Draw(canvas)
 for i,(work,obj,img,bytecount) in enumerate(chosen):
  x,y=(i%2)*w,(i//2)*h
  img.thumbnail((350,490),Image.Resampling.LANCZOS)
  canvas.paste(img,(x+(w-img.width)//2,y+45))
  draw.text((x+10,y+8),obj["code"]+" "+obj["name"]+" / "+str(work["workId"]),fill="#111111")
  draw.text((x+10,y+530),f"source {bytecount} bytes",fill="#666666")
 buf=io.BytesIO();canvas.save(buf,format="WEBP",quality=80)
 b64=base64.b64encode(buf.getvalue()).decode("ascii")
 print("MEGA_SHEET_"+str(start//7+1)+"_BASE64="+b64)
print("MEGA_SOURCE_AUDIT_COMPLETE",len(items))
