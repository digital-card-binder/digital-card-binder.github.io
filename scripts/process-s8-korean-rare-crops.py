from PIL import Image,ImageDraw
from pathlib import Path
from io import BytesIO
import json,base64
root=Path(__file__).resolve().parents[1]
assets=root/"assets/cards/s8-korean-rare"
proof=root/"data/audits/theme-visual-evidence/s8/korean-rescued-sources"
sourced=json.loads((proof/"sources.json").read_text())
assert len(sourced["candidates"])==4 and all("ownedPath" in x for x in sourced["candidates"])
boxes={
 117:(.19,.042,.83,.945),
 119:(.19,.035,.83,.949),
 120:(.08,.005,.87,.988),
 123:(.24,.303,.665,.72)
}
imout=[]
for row in sourced["candidates"]:
 n=row["number"];im=Image.open(root/row["ownedPath"]).convert("RGB")
 b=boxes[n];box=tuple(round(v*(im.width if i%2==0 else im.height)) for i,v in enumerate(b))
 crop=im.crop(box)
 if crop.width<200 or crop.height<260:raise RuntimeError(f"crop too small {n} {crop.size}")
 photo=crop.resize((420,586),Image.Resampling.LANCZOS)
 path=assets/f"{n}-korean.webp";photo.save(path,"WEBP",quality=94,method=6)
 imout.append({"number":n,"source":row["source"],"ownedPath":str(path.relative_to(root)),"cropBox":list(box),"width":420,"height":586,"confirmedKoreanCardName":{117:"펄스멍 VMAX",119:"뮤 VMAX",120:"요씽리스 VMAX",123:"팟과 덴트와 콘"}[n],"sourceOriginal":row["ownedPath"],"verifiedKoreanPrint":True})
s=Image.new("RGB",(4*260,385),(244,244,244));d=ImageDraw.Draw(s)
for i,x in enumerate(imout):
 im=Image.open(root/x["ownedPath"]);im.thumbnail((245,343));a=i*260
 s.paste(im,(a+(260-im.width)//2,18));d.text((a+8,3),f"S8 {x['number']} Korean edition",fill=(10,10,10))
buf=BytesIO();s.save(buf,"WEBP",quality=86)
(proof/"approved-crops.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode())
(proof/"approved-crops.json").write_text(json.dumps({"set":"s8","total":4,"cards":imout},ensure_ascii=False,indent=2)+"\n")
print(json.dumps(imout,ensure_ascii=False))
