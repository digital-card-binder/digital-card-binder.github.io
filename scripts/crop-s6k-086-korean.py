#!/usr/bin/env python3
"""Crop verified S6K 086 Korean printed Shadow Rider Calyrex VMAX photo.
Evidence preparation only. Does not modify card catalog.
"""
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw
import base64,hashlib,json
root=Path(__file__).resolve().parents[1]
base=root/"data/audits/theme-visual-evidence/s6K/korean-candidates"
j=json.loads((base/"candidate-index.json").read_text(encoding="utf-8"))
rows=[r for r in j["cards"] if r["number"]==86]
assert len(rows)==1
r=rows[0]
assert r["name"]=="흑마 버드렉스 VMAX" and r["code"]=="s6k_086/070"
assert r["candidateImage"]=="https://media.bunjang.co.kr/product/250071997_1_1706006498_w1200.jpg"
assert r["listing"]=="https://globalbunjang.com/product/250071997"
assert r["status"]=="photo_collected_requires_Korean_title_and_number_visual_review"
pic=Image.open(BytesIO(base64.b64decode((base/"086-candidate.webp.b64").read_text(encoding="ascii")))).convert("RGB")
w,h=pic.size
assert w==900 and h==900
# Seller photo: full Korean card occupies x=141..764, y=13..873; footer must be retained.
rect=(137,10,769,879)
crop=pic.crop(rect)
crop=crop.resize((420,586),Image.Resampling.LANCZOS)
target=root/"assets/cards/s6k-korean-rare/086-korean.webp"
target.parent.mkdir(parents=True,exist_ok=True)
crop.save(target,"WEBP",quality=94,method=6)
assert target.stat().st_size>15000
contact=Image.new("RGB",(840,586),(245,245,245))
contact.paste(crop,(0,0))
preview=pic.copy();preview.thumbnail((420,420))
contact.paste(preview,(420,0))
draw=ImageDraw.Draw(contact)
draw.text((433,435),"S6K 086 Korean source / compare",fill=(15,15,15))
buf=BytesIO();contact.save(buf,"WEBP",quality=86)
(base/"086-crop-contact.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode("ascii"),encoding="ascii")
proof={
"schemaVersion":1,"recordedAt":"2026-10-15","set":"s6K","count":1,
"cards":[{
"number":86,"code":"s6k_086/070","name":"흑마 버드렉스 VMAX",
"source":r["candidateImage"],"sourceProductPage":r["listing"],
"sourceSha256":r["sha256"],"sourceSize":[w,h],"cropBox":list(rect),
"ownedPath":"assets/cards/s6k-korean-rare/086-korean.webp","size":[420,586],
"status":"Korean_card_photo_reviewed",
"koreanPrintedEditionVerified":True,"sourceCardNumberVisualConfidence":"visible",
"inspection":{"visibleKoreanTitle":"흑마 버드렉스 VMAX",
"visibleKoreanText":"명계의 문·다이가이스트",
"numberEvidence":"S6K 086/070 HR printed footer visible"}
}],
"pendingNumbers":[84,85,87,88,89,90,91,92,93,94,95],
"notes":"Only 086 photograph verified. 084 screenshot is cut off; no completion inferred. Eleven other Japanese placeholders held."
}
(base/"approved-crops.json").write_text(json.dumps(proof,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"approved":[86],"crop":str(target.relative_to(root)),"byteCount":target.stat().st_size}))
