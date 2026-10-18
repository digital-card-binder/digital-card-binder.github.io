#!/usr/bin/env python3
"""Read-only Korean print inspection for 5 held Sun/Moon gold/HR cards.
Checks source URLs and prints visual contact sheets to Actions logs.
"""
import base64,io,json,urllib.request
from PIL import Image,ImageDraw
src=[
("SM1M_067","라란티스 GX","067/060","https://gi.esmplus.com/latjong1/shop/GX/81.jpg"),
("SM1M_069","블래키 GX","069/060","https://i.ebayimg.com/images/g/1RoAAeSwypJosQdf/s-l400.png"),
("SM1M_071","네스트볼","071/060","https://image.hnsmall.com/images/goods/222/54741222_g.jpg"),
("SM1S_071","로토무도감","071/060","https://sitem.ssgcdn.com/47/36/20/item/1000523203647_i1_750.jpg"),
("SM1S_072","하이퍼볼","072/060","https://cdn.011st.com/11dims/resize/600x600/quality/75/11src/cat/24/4/9/7/7/0/0/cIzYt/410497700_1.jpg")
]
records=[]
canvas=Image.new("RGB",(1100,1800),"white");d=ImageDraw.Draw(canvas)
for i,(slot,name,expected,url) in enumerate(src):
 x=(i%3)*365;y=(i//3)*900
 d.text((x+5,y+3),slot+" "+name,fill="black")
 d.text((x+5,y+23),"Target "+expected,fill="black")
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; card image source verification)"})
  blob=urllib.request.urlopen(req,timeout=30).read()
  im=Image.open(io.BytesIO(blob));im.load();sz=im.size
  im=im.convert("RGB");im.thumbnail((340,780),Image.Resampling.LANCZOS)
  canvas.paste(im,(x+(365-im.width)//2,y+60))
  status="downloaded"
 except Exception as e:
  status=str(e)[:200];sz=None;blob=b""
  d.text((x+5,y+75),"NOT ACCESSIBLE",fill="red")
 r={"slot":slot,"name":name,"expected":expected,"source":url,"status":status,"size":sz,"bytes":len(blob)}
 records.append(r)
 print("SM_CANDIDATE",json.dumps(r,ensure_ascii=False))
out=io.BytesIO();canvas.save(out,format="WEBP",quality=80)
print("SM_FIVE_SHEET_BASE64="+base64.b64encode(out.getvalue()).decode("ascii"))
print("SM_FIVE_SUMMARY",json.dumps({"total":len(records),"downloaded":sum(x["status"]=="downloaded" for x in records)}))
