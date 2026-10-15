#!/usr/bin/env python3
"""Crop seven S6a sourced seller Korean card photos without touching live catalog."""
import json,base64
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
from io import BytesIO
root=Path(__file__).resolve().parents[1]
folder=root/"data/audits/theme-visual-evidence/s6a/korean-candidates"
cards=root/"assets/cards/s6a-korean-rare"
j=json.loads((folder/"sources.json").read_text())
expected=[88,92,96,97,99,100,101]
if [row["number"] for row in j["cards"]]!=expected:raise RuntimeError("Unexpected candidate card numbers")
boxes={
 88:(.210,.035,.855,.970),
 92:(.225,.260,.705,.755),
 96:(.088,.018,.868,.886),
 97:(.025,.018,.958,.968),
 99:(.220,.130,.773,.900),
 100:(.097,.070,.942,.950),
 101:(.085,.078,.955,.915)
}
proof=[];canvas=Image.new("RGB",(4*330,2*505),(245,245,245));draw=ImageDraw.Draw(canvas)
for i,row in enumerate(j["cards"]):
 n=row["number"];orig=root/row["ownedSource"]
 im=ImageOps.exif_transpose(Image.open(orig).convert("RGB"))
 w,h=im.size;ratios=boxes[n]
 rect=(round(w*ratios[0]),round(h*ratios[1]),round(w*ratios[2]),round(h*ratios[3]))
 crop=im.crop(rect).resize((420,586),Image.Resampling.LANCZOS)
 path=cards/f"{n:03d}-korean.webp";crop.save(path,"WEBP",quality=94,method=6)
 preview=crop.copy();preview.thumbnail((304,440))
 x=(i%4)*330;y=(i//4)*505
 canvas.paste(preview,(x+(330-preview.width)//2,y+28))
 draw.text((x+6,y+5),f"S6a #{n:03d}: Korean crop, candidate",fill=(10,10,10))
 proof.append({"number":n,"name":row["name"],"code":row["code"],"source":row["source"],
 "sourceProductPage":row["productPage"],"ownedPath":str(path.relative_to(root)),
 "sourceSize":[w,h],"cropBox":list(rect),"size":[420,586],
 "status":"candidate_crop_requires_card_text_and_number_visual_confirmation"})
bio=BytesIO();canvas.save(bio,"WEBP",quality=85)
(folder/"crop-contact.webp.b64").write_text(base64.b64encode(bio.getvalue()).decode())
(folder/"candidate-crops.json").write_text(json.dumps({"set":"s6a","count":len(proof),"cards":proof},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"cropped":[x["number"] for x in proof]},ensure_ascii=False))
