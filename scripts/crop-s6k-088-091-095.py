#!/usr/bin/env python3
"""Stage Korean-printed S6K 088,091,095 from TCGBOX retailer scans with visible watermarks.
For visual QA only, do not change the live card master until manually approved.
"""
from pathlib import Path
from PIL import Image, ImageDraw
from io import BytesIO
import base64,hashlib,json
root=Path(__file__).resolve().parents[1]
src=root/"data/audits/theme-visual-evidence/s6K/korean-candidates/retailer"
out=root/"data/audits/theme-visual-evidence/s6K/korean-candidates/retailer-approved"
assets=root/"assets/cards/s6k-korean-rare"
out.mkdir(parents=True,exist_ok=True);assets.mkdir(parents=True,exist_ok=True)
evidence=json.loads((src/"retailer-index.json").read_text(encoding="utf-8"))
targets={88:"국화",91:"카틀레야",95:"기본 초 에너지"}
board=Image.new("RGB",(3*440,810),(247,247,247));pen=ImageDraw.Draw(board)
rows=[]
for index,(n,name) in enumerate(targets.items()):
 row=next((c for c in evidence["cards"] if c["number"]==n),None)
 if not row or row["status"]!="retailer_photo_archived_await_print_language_review":raise RuntimeError(f"No verified Korean retailer proof for {n}")
 assert row["title"] and row["retailerImageUrl"]==f"https://tcgbox.co.kr/web/product/big/s6k/S6K_{n:03d}.jpg"
 data=base64.b64decode((src/row["evidenceFile"]).read_text(encoding="ascii"))
 card=Image.open(BytesIO(data));card.load()
 if card.width<250 or card.height<350:raise RuntimeError(f"Image too small for print label {n}: {card.size}")
 image=card.convert("RGB").resize((420,586),Image.Resampling.LANCZOS)
 filename=assets/f"{n:03d}-korean.webp"
 image.save(filename,"WEBP",quality=95,method=6)
 assert filename.stat().st_size>12000
 x=index*440
 board.paste(image,(x+10,28))
 footer=image.crop((0,518,420,586)).resize((420,140),Image.Resampling.NEAREST)
 board.paste(footer,(x+10,632))
 pen.text((x+8,5),f"S6K {n:03d} Korean source: watermark present",fill=(10,10,10))
 rows.append({"number":n,"code":f"s6k_{n:03d}/070","name":name,
  "source":row["retailerImageUrl"],"sourceProductPage":row["listing"],
  "sourceSha256":row["sha256"],"sourceSize":row["sourceSize"],
  "ownedPath":str(filename.relative_to(root)),"size":[420,586],
  "status":"staged_korean_retailer_photo_needs_number_and_text_review",
  "verifiedKoreanPrintedEdition":False,
  "watermark":"TCGBOX overlay; image quality upgrade desirable"})
img=BytesIO();board.save(img,"WEBP",quality=87)
(out/"card-footer-contact.webp.b64").write_text(base64.b64encode(img.getvalue()).decode("ascii"),encoding="ascii")
(out/"staged-crops.json").write_text(json.dumps({"schemaVersion":1,"set":"s6K","count":3,"status":"staged_pending_print_review","cards":rows},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"staged":[r["number"] for r in rows],"imageQuality":"TCGBOX watermarks"}))
