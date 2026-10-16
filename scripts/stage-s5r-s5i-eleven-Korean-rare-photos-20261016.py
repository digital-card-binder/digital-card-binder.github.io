#!/usr/bin/env python3
"""Stage only explicitly Korean-verified watermarked photos on our own GitHub Pages.
Does not mutate original master, themes, or ownership. Never removes source watermarks.
"""
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
from io import BytesIO
from hashlib import sha256
from PIL import Image,ImageOps
import json

ROOT=Path(__file__).resolve().parents[1]
AUDIT="data/audits/theme-s5r-s5i-082-091-eleven-Korean-photos-provisional-20261016.json"
HOLD="data/audits/theme-s5r-s5i-082-091-Japanese-image-holds-20261016.json"
report=json.loads((ROOT/AUDIT).read_text(encoding="utf8"))
holds=json.loads((ROOT/HOLD).read_text(encoding="utf8"))
assert report["approvedCount"]==11 and report["stillHeldCount"]==9
assert report["status"]=="visually_approved_provisional_Korean_images_11_of_20"
assert holds["status"]=="pending_Korean_image_provenance"
allowedHost="tcgbox.co.kr"
saved=[]
for row in report["approved"]:
 setcode=row["set"];number=row["canonicalOrder"]
 assert setcode in {"s5r","s5i"} and number in range(82,92)
 assert row["status"]=="approved_provisional_Korean_photo_watermarked"
 assert row["sourceHasRetailerWatermark"] is True
 assert row["printedLanguageVisuallyIdentified"]=="Korean"
 assert row["cardNumberArtworkVisuallyMatched"] is True
 assert row["code"]==f"{setcode}_{number:03d}/070"
 assert holds["foreignSourceHolds"][setcode]["cards"][number-82]["code"]==row["code"]
 expected=f"/assets/cards/korean-retail-sources-20261016/{setcode}/{number:03d}.webp"
 assert row["targetAsset"]==expected
 src=urlsplit(row["sourceImage"])
 assert src.scheme=="https" and src.hostname==allowedHost
 assert src.path==f"/web/product/big/{setcode.upper()}/{setcode.upper()}_{number:03d}.jpg"
 dest=ROOT/expected.lstrip("/")
 dest.parent.mkdir(parents=True,exist_ok=True)
 if dest.exists():
  with Image.open(dest) as old:
   assert old.format=="WEBP" and old.width>=200 and old.height>=280
  saved.append({"code":row["code"],"status":"already_staged"})
  continue
 with urlopen(Request(row["sourceImage"],headers={"User-Agent":"Mozilla/5.0"}),timeout=22) as res:
  b=res.read(3_000_001)
 assert 3000<len(b)<=3_000_000
 digest=sha256(b).hexdigest()
 assert digest==row["expectedSourceSha256"],("changed source!",row["code"],digest)
 im=Image.open(BytesIO(b));im.load()
 assert [im.width,im.height]==row["sourceDimensions"]
 assert im.width>=200 and im.height>=300
 if im.format not in {"JPEG","PNG","WEBP"}:raise ValueError("Unexpected image type")
 photo=ImageOps.exif_transpose(im).convert("RGB")
 # Keep original uncropped printed photograph including visible source watermark.
 photo.save(dest,format="WEBP",quality=90,method=6)
 with Image.open(dest) as check:
  assert check.format=="WEBP" and check.width==im.width and check.height==im.height
 saved.append({"code":row["code"],"status":"source_hash_verified",
               "sourceHash":digest,"ownedPath":expected,"bytes":dest.stat().st_size,
               "imageDimensions":[photo.width,photo.height]})
assert len(saved)==11
print(json.dumps({"staged":saved,"newlyDownloaded":sum(x["status"]=="source_hash_verified" for x in saved),
 "watermarkPreserved":True,"originalJapaneseHoldAuditPreserved":True},ensure_ascii=False))
