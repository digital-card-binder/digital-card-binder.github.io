#!/usr/bin/env python3
"""Read-only compare Dogam 093/094 printed Korean pixels and catalogue metadata."""
import urllib.request,re,html,io,base64,json
from PIL import Image,ImageDraw
pages=[
("APP_093","https://www.dogam.app/cards/01KW1C623Q2AACTE37C6H86V44"),
("APP_094","https://www.dogam.app/sets/01KW0QFGBXF892GC515FMJWY30/cards/01KW1C623QH7F713BF7KXMRRNR")
]
imgs=[]
for code,url in pages:
 try:
  h=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=30).read().decode("utf8","replace")
  meta=re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"',h)
  og=html.unescape(meta.group(1)) if meta else ""
  print("DOGAM_SOURCE",json.dumps({"slot":code,"url":url,"pageLen":len(h),"og":og,"hasEcho":"메아리호른" in h,"hasFog":"안개의 수정" in h,"has093":"093/070" in h,"has094":"094/070" in h},ensure_ascii=False))
  if og:
   raw=urllib.request.urlopen(urllib.request.Request(og,headers={"User-Agent":"Mozilla/5.0"}),timeout=30).read()
   im=Image.open(io.BytesIO(raw));im.load()
   if im.height>300 and im.width>200:imgs.append((code,im.convert("RGB"),og))
 except Exception as e:print("DOGAM_FAIL",code,str(e)[:200])
if imgs:
 w,h=450,680
 img=Image.new("RGB",(len(imgs)*w,h),"white")
 d=ImageDraw.Draw(img)
 for i,(code,im,url) in enumerate(imgs):
  im.thumbnail((430,610))
  x=i*w;img.paste(im,(x+(w-im.width)//2,45))
  d.text((x+5,8),code,fill="black")
  d.text((x+5,25),url[-42:],fill="black")
 buf=io.BytesIO();img.save(buf,format="JPEG",quality=73,optimize=True)
 print("DOGAM_S6K_COMPARE_BASE64="+base64.b64encode(buf.getvalue()).decode())
