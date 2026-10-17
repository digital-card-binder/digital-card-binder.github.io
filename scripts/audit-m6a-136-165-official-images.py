#!/usr/bin/env python3
"""Read-only Pokemon Korea M6a 136-165 image probe: no canonical, ownership or image-route changes."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import base64
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/audits/mega-visual-evidence/m6a-136-165"
OFFICIAL = "https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6a"
CARDS = range(136, 166)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (DigitalCardBinder Korean evidence audit)",
    "Referer": "https://pokemoncard.co.kr/",
    "Accept": "image/png,image/jpeg,image/*;q=0.8",
}
def check(number):
    target = f"{OFFICIAL}/M6a_{number:03d}.png"
    row = {"number": number, "candidateOfficialUrl": target,
           "officialKoreanPrintConfirmed": False, "artThemeReviewed": False}
    thumb = None
    try:
        with urlopen(Request(target, headers=HEADERS), timeout=16) as response:
            row["http"] = response.status
            row["contentType"] = response.headers.get_content_type()
            binary = response.read(12000001)
        if len(binary) < 1000 or len(binary) > 12000000:
            raise ValueError("image byte size invalid")
        with Image.open(BytesIO(binary)) as im:
            im.verify()
        with Image.open(BytesIO(binary)) as im:
            im.load()
            w, h = im.size
            if not (200 <= w <= 4000 and 260 <= h <= 6000 and 1.1 < h / w < 1.9):
                raise ValueError("image dimensions invalid")
            row.update(status="decoded_official_candidate_region_unverified",
                       format=im.format, size=[w, h], bytes=len(binary),
                       sha256=sha256(binary).hexdigest())
            thumb = im.convert("RGB")
            thumb.thumbnail((205, 290))
    except HTTPError as e:
        row.update(status="http_error_pending", http=e.code)
    except (URLError, ValueError, OSError) as e:
        row.update(status="unverified_pending", reason=str(e)[:160])
    return row, thumb

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(check, CARDS))
    cards = [a for a,_ in results]
    sheets = []
    for page in range(2):
        canvas = Image.new("RGB", (5*240, 3*352), "white")
        draw = ImageDraw.Draw(canvas)
        for idx, (record, im) in enumerate(results[page*15:page*15+15]):
            x=(idx%5)*240
            y=(idx//5)*352
            draw.rectangle((x+2,y+2,x+237,y+349),outline="gray",width=2)
            if im:
                canvas.paste(im, (x+(240-im.width)//2,y+10))
            else:
                draw.text((x+10,y+145),"OFFICIAL IMAGE PENDING",fill="black")
            draw.text((x+10,y+301),f"M6a {record['number']:03d}",fill="black")
            draw.text((x+10,y+320),record["status"][:30],fill="black")
            draw.text((x+10,y+336),"PRINT NOT APPROVED",fill="red")
        buf=BytesIO()
        canvas.save(buf,format="WEBP",quality=79,method=4)
        filename=f"m6a-136-165-{page+1:02d}.webp.b64"
        (OUT/filename).write_text(base64.b64encode(buf.getvalue()).decode("ascii"),encoding="ascii")
        sheets.append(filename)
    decoded=sum(c["status"]=="decoded_official_candidate_region_unverified" for c in cards)
    report={
        "schemaVersion":1,"recordedAt":datetime.now(timezone.utc).isoformat(),
        "set":"M6a","scope":"136-165 official asset candidate probe only",
        "checkedCount":len(cards),"decodedOfficialCandidateCount":decoded,
        "pendingCount":30-decoded,"koreanPrintVerifiedCount":0,
        "officialMembershipPromotedCount":0,
        "siteAssetOrOwnershipChanges":False,
        "policy":"Official URL decoded is not proof of Korean print, rarity, matching card number or finished 12-theme review; visual examination required before promotion or self-hosted mapping.",
        "sheets":sheets,"cards":cards
    }
    (OUT/"visual-index.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"checked":30,"decoded":decoded,"pending":30-decoded,"officialMembershipPromoted":0}))

if __name__=="__main__":main()
