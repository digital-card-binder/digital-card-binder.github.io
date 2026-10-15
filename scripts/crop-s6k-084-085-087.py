#!/usr/bin/env python3
"""Stage three high-resolution Korean S6K photograph crops for human visual footer review.
Do not touch master DB or declare finished Korean print verification automatically.
"""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
from io import BytesIO
import json,base64,hashlib
root=Path(__file__).resolve().parents[1]
src=root/"data/audits/theme-visual-evidence/s6K/korean-candidates/batch2"
out=root/"data/audits/theme-visual-evidence/s6K/korean-candidates/approved-batch2"
assets=root/"assets/cards/s6k-korean-rare"
out.mkdir(parents=True,exist_ok=True);assets.mkdir(parents=True,exist_ok=True)
source=json.loads((src/"candidate-index.json").read_text(encoding="utf-8"))
specs=[
(84,"세레비 VMAX","084-source-1.webp.b64",(171,95,771,877)),
(85,"흑마 버드렉스 VMAX","085-source-2.webp.b64",(190,30,1000,1160)),
(87,"메타그로스 VMAX","087-source-4.webp.b64",(162,74,711,821))
]
assert source["set"]=="s6K" and len(source["cards"])==5
thumbs=Image.new("RGB",(3*430,795),(247,247,247))
draw=ImageDraw.Draw(thumbs)
proof=[]
for i,(n,name,sourceFile,box) in enumerate(specs):
    rows=[c for c in source["cards"] if c["number"]==n and c["evidenceFile"]==sourceFile]
    assert len(rows)==1
    row=rows[0]
    assert row["status"]=="decoded_pending_Korean_print_review" and row["name"]==name
    assert row["http"]==200 and len(row["sha256"])==64
    im=Image.open(BytesIO(base64.b64decode((src/sourceFile).read_text(encoding="ascii")))).convert("RGB")
    assert im.size==tuple(row["sourceSize"])
    l,t,r,b=box
    assert l>=0 and t>=0 and r<=im.width and b<=im.height and r>l and b>t
    crop=im.crop(box).resize((420,586),Image.Resampling.LANCZOS)
    output=assets/f"{n:03d}-korean.webp"
    crop.save(output,"WEBP",quality=94,method=6)
    assert output.stat().st_size>18000
    x=i*430
    thumbs.paste(crop,(x+5,28))
    footer=crop.crop((0,517,420,586)).resize((420,138),Image.Resampling.NEAREST)
    thumbs.paste(footer,(x+5,628))
    draw.text((x+5,5),f"S6K {n:03d} verify Korean footer",fill=(0,0,0))
    proof.append({"number":n,"code":f"s6k_{n:03d}/070","name":name,
     "source":row["directPhotoUrl"],"sourceProductPage":row["productPage"],
     "sourceSha256":row["sha256"],"sourceSize":row["sourceSize"],
     "ownedPath":f"assets/cards/s6k-korean-rare/{n:03d}-korean.webp",
     "cropBox":list(box),"size":[420,586],
     "status":"staged_crop_requires_direct_Korean_footer_review",
     "verifiedKoreanPrintedEdition":False})
buf=BytesIO();thumbs.save(buf,"WEBP",quality=89)
(out/"crop-and-footers.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode("ascii"))
(out/"staged-crops.json").write_text(json.dumps({"schemaVersion":1,"recordedAt":"2026-10-15",
 "set":"s6K","count":3,"status":"staged_pending_print_approval","cards":proof},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"staged":[p["number"] for p in proof],"files":[p["ownedPath"] for p in proof]}))
