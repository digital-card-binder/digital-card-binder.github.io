#!/usr/bin/env python3
"""Read-only inspect official Korea S6K_094 asset and physical seller photo footer.
Never update canonical cards based on Japanese print or conflicting app metadata.
"""
import base64,io,json,time,urllib.request
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageEnhance
sources=[
 ("pokemon_official_S6K_094","https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S6K/S6K_094.png"),
 ("pokemon_official_s6k_094","https://cards.image.pokemonkorea.co.kr/data/wmimages/S/s6K/s6K_094.png"),
 ("ebay_korean_echo_horn_1600","https://i.ebayimg.com/images/g/jMkAAeSwVqBp7IPR/s-l1600.jpg"),
 ("ebay_korean_echo_horn_500","https://i.ebayimg.com/images/g/jMkAAeSwVqBp7IPR/s-l500.jpg"),
 ("dogam_korean_fog_crystal_094","https://static.tcgexchange.kr/ef029559a1d9428e4e35cffe972a2b58.png")
]
results=[]; portraits=[]
for label,url in sources:
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0","Accept":"image/webp,image/png,image/jpeg,*/*"})
  with urllib.request.urlopen(req,timeout=28) as response:
   raw=response.read(6000000)
   contentType=response.headers.get("Content-Type","")
  im=Image.open(io.BytesIO(raw)).convert("RGB"); im.load()
  info={"label":label,"url":url,"status":"decoded","width":im.width,"height":im.height,"bytes":len(raw),"contentType":contentType}
  if im.width<220 or im.height<220:info["warning"]="not a full card visual"
  else: portraits.append((label,im))
  print("S6K094_CANDIDATE",json.dumps(info,ensure_ascii=False),flush=True)
  results.append(info)
 except Exception as e:
  info={"label":label,"url":url,"status":"unavailable","error":str(e)[:170]}
  print("S6K094_CANDIDATE",json.dumps(info,ensure_ascii=False),flush=True)
  results.append(info)
for label,photo in portraits:
 if label=="ebay_korean_echo_horn_1600":
  # Full native pixels for small printed footer, not OCR and not an altered card file.
  crop=photo.crop((145,1245,525,1465))
  crop=ImageEnhance.Contrast(crop).enhance(1.9)
  crop=ImageEnhance.Sharpness(crop).enhance(2.8)
  crop=crop.resize((1140,660),Image.Resampling.NEAREST)
  buf=io.BytesIO();crop.save(buf,format="PNG")
  print("S6K094_KOREAN_ECHOHORN_FOOTER_ZOOM_B64="+base64.b64encode(buf.getvalue()).decode("ascii"),flush=True)
if portraits:
 W,H=380,780
 canvas=Image.new("RGB",(W*len(portraits),H),"#fafafa")
 d=ImageDraw.Draw(canvas)
 for i,(label,im) in enumerate(portraits):
  x=i*W
  d.text((x+8,10),label,fill="black")
  im.thumbnail((W-22,580),Image.Resampling.LANCZOS)
  canvas.paste(im,(x+(W-im.width)//2,40))
  # Enlarged last 16% of the same full card: read original printed footer.
  original=next(orig for tag,orig in portraits if tag==label)
  crop=original.crop((0,int(original.height*.80),original.width,original.height))
  crop=ImageEnhance.Contrast(crop).enhance(1.6)
  crop.thumbnail((W-12,160),Image.Resampling.LANCZOS)
  canvas.paste(crop,(x+(W-crop.width)//2,615))
 buf=io.BytesIO();canvas.save(buf,format="JPEG",quality=75,optimize=True)
 print("S6K094_KOREAN_FOOTERS_SHEET_B64="+base64.b64encode(buf.getvalue()).decode("ascii"),flush=True)
print("S6K094_CANDIDATE_SUMMARY",json.dumps(results,ensure_ascii=False))
