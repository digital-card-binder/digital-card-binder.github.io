#!/usr/bin/env python3
"""Magnify Korean Classic official-product image cards' lower-left printed set number.
Never fetch a third party. All source images already selfhosted in GitHub.
Read-only evidentiary output; no catalog modifications.
"""
from pathlib import Path
from PIL import Image,ImageDraw
from io import BytesIO
import json,base64
root=Path(__file__).resolve().parents[1]
folder=root/"assets/cards/classic-korean-official-2023"
out=root/"data/audits/theme-classic-official-printed-number-crosscheck-20261013"
out.mkdir(parents=True,exist_ok=True)
keys=["CLL_021","CLL_026","CLL_030","CLK_014","CLK_025","CLK_031","CLF_003","CLF_017","CLF_025","CLF_026","CLF_028"]
sheet=Image.new("RGB",(1260,2800),"#eeeeee")
draw=ImageDraw.Draw(sheet)
report=[]
for i,key in enumerate(keys):
 p=folder/(key+".webp")
 im=Image.open(p);im.load()
 w,h=im.size
 # Full card no interpolation bigger: upper body and footer both shown side-by-side
 full=im.resize((336,470),Image.Resampling.NEAREST)
 x=(i%3)*420;y=(i//3)*700
 sheet.paste(full,(x+33,y+38))
 lower=im.crop((0,int(h*.77),w,h))
 lower=lower.resize((390,125),Image.Resampling.NEAREST)
 sheet.paste(lower,(x+14,y+532))
 draw.text((x+20,y+14),key+" official KOR marketing asset",fill="#000000")
 draw.text((x+25,y+664),f"Source {w} x {h}, pixel enlarged (no synthetic text)",fill="#222222")
 report.append({"cardKey":key,"sourceSelfHosted":"/assets/cards/classic-korean-official-2023/"+key+".webp",
  "sourcePixels":[w,h],"numberCropArtifact":"data/audits/theme-classic-official-printed-number-crosscheck-20261013/bottom-number-contact.webp.b64",
  "printedCardNumberLegibility":"await_human_inspection","safeToChangeCanonicalKeyAutomatically":False})
mem=BytesIO();sheet.save(mem,format="WEBP",quality=95)
(out/"bottom-number-contact.webp.b64").write_text(base64.b64encode(mem.getvalue()).decode("ascii"),encoding="ascii")
(out/"index.json").write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-13",
 "scope":"11 official Korean brochure artworks whose printed card numbers require cross-check against master/catalog",
 "method":"Nearest-neighbor enlargement of actual existing 11 self-hosted source cards; no new downloaded media, no OCR",
 "sourceCatalogIntegrityStatus":"crosscheck_in_progress","cards":report},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"count":len(keys),"sheetPixels":sheet.size,"bytes":len(mem.getvalue())}))
