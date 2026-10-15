#!/usr/bin/env python3
"""Stage a real Korean S6K 093 Fog Crystal UR SSG listing image for manual QA.
No catalog updates. Do not claim Korean print until title and 093/070 UR footer inspected.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from io import BytesIO
from PIL import Image,ImageOps,ImageDraw
import json,hashlib,base64
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s6K/korean-candidates/ssg-093"
CARD=ROOT/"assets/cards/s6k-korean-rare"
OUT.mkdir(parents=True,exist_ok=True);CARD.mkdir(parents=True,exist_ok=True)
URL="https://sitem.ssgcdn.com/98/22/20/item/1000523202298_i1_1200.jpg"
LISTING="https://www.ssg.com/item/itemView.ssg?itemId=1000523202298"
req=Request(URL,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36","Accept":"image/*"})
with urlopen(req,timeout=25) as response:
    blob=response.read(6000001)
    status=response.status
    content_type=response.headers.get("content-type","")
if status!=200 or len(blob)<12000 or len(blob)>6000000:raise RuntimeError("Missing original image")
pic=ImageOps.exif_transpose(Image.open(BytesIO(blob)).convert("RGB"))
w,h=pic.size
if w<350 or h<350:raise RuntimeError("Photo quality too small")
# Inspect image foreground on white/off-white listing background. Preserve entire card border and footer.
# Bounding box search excludes uniformly white background; no manual URL spoofing.
from PIL import ImageChops
bg=Image.new("RGB",pic.size,"white")
diff=ImageChops.difference(pic,bg).convert("L")
mask=diff.point(lambda p:255 if p>28 else 0)
bbox=mask.getbbox()
if not bbox:raise RuntimeError("No card object in listing photo")
left,top,right,bottom=bbox
pad=max(3,round(min(w,h)*.012))
left=max(0,left-pad);top=max(0,top-pad);right=min(w,right+pad);bottom=min(h,bottom+pad)
cropped=pic.crop((left,top,right,bottom))
if cropped.width/cropped.height<.55 or cropped.width/cropped.height>.85:
    raise RuntimeError("Unexpected card crop geometry - inspect source")
card=cropped.resize((420,586),Image.Resampling.LANCZOS)
cardpath=CARD/"093-korean.webp"
card.save(cardpath,"WEBP",quality=95,method=6)
board=Image.new("RGB",(940,775),(245,245,245));draw=ImageDraw.Draw(board)
board.paste(card,(10,33))
thumb=pic.copy();thumb.thumbnail((470,500))
board.paste(thumb,(450,35))
foot=card.crop((0,518,420,586)).resize((420,134),Image.Resampling.NEAREST)
board.paste(foot,(465,566))
draw.text((10,9),"S6K 093 Korean UR photo - footer manual QA",fill=(10,10,10))
draw.text((465,544),"Enlarged 093/070 and original source",fill=(10,10,10))
buf=BytesIO();board.save(buf,"WEBP",quality=88)
(OUT/"093-proof-sheet.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode("ascii"),encoding="ascii")
proof={"schemaVersion":1,"set":"s6K","number":93,"code":"s6k_093/070","name":"안개의 수정",
"status":"staged_needs_visual_review_do_not_mark_complete","source":URL,"sourceProductPage":LISTING,
"sourceSha256":hashlib.sha256(blob).hexdigest(),"sourceSize":[w,h],
"cropBox":[left,top,right,bottom],"imageSize":[420,586],
"ownedPath":"assets/cards/s6k-korean-rare/093-korean.webp","sourceContentType":content_type,
"verifiedKoreanPrint":False,
"requiredManualChecks":["visible Korean title 안개의 수정","footer reads s6K 093/070 UR","no cropped card edges","not a Japanese print"]}
(OUT/"stage.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"staged":93,"size":[w,h],"bbox":list(bbox),"cropSize":list(cropped.size),"webpBytes":cardpath.stat().st_size}))
