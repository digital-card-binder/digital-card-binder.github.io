#!/usr/bin/env python3
"""Read-only initial Korean S4 Astonishing Volt Tackle final-31 artwork source/owned CDN preflight.
Decoded artwork != verified Korean print. This script never changes master, themes or ownership.
"""
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from io import BytesIO
from hashlib import sha256
import json
import base64
import re

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/audits/theme-visual-evidence"
DATE = "2026-10-17"
SETS = {"s4": "앙천의 볼트태클"}
THEMES = ["sleeping", "connected", "evolution", "night", "season", "color",
          "sunset", "reflections", "food", "street", "work", "cameo"]
GLOBAL = "s6K Korean print source pending: 089,090,092,094"

def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf8"))

def own_destination(raw):
    s = urlsplit(raw)
    if s.scheme not in {"http", "https"} or not s.hostname:
        return ""
    if s.hostname in {"dcb-card-images-modern-2026.pages.dev",
                      "dcb-card-images-legacy-2026.pages.dev"}:
        return "https://" + s.hostname + s.path
    source = s.scheme + "://" + s.netloc + s.path
    if s.hostname == "cards.image.pokemonkorea.co.kr":
        p = s.path.lstrip("/")
        if not p.startswith("data/wmimages/") or "." not in p:
            return ""
        root = p.split("/")[2].upper()
        suffix = p.rsplit(".", 1)[0] + ".webp"
        project = "modern" if root in {"MEGA", "S", "SV"} else "legacy"
        return f"https://dcb-card-images-{project}-2026.pages.dev/{suffix}"
    hosts = {"static.tcgexchange.kr", "tcgbox.co.kr", "cdn.collectory.cc",
             "k-tcgpanda.com", "cdn6966.templcdn.com"}
    if s.hostname not in hosts:
        return ""
    h = 0xcbf29ce484222325
    for c in source:
        h = ((h ^ ord(c)) * 0x100000001b3) & 0xffffffffffffffff
    return (f"https://dcb-card-images-legacy-2026.pages.dev/"
            f"external/{s.hostname}/{h:016x}.webp")

modern = read("data/series.json")
legacy = read("data/series-legacy.json")
theme_data = read("data/art-themes.json")
status = read("data/audits/theme-series-review-status.json")
hosting = read("data/audits/theme-image-selfhost-audit.json")
assert status["execution"]["nextStart"] == GLOBAL
assert hosting["nextStart"] == GLOBAL
assert len(theme_data["groups"]) == 12
assert set(x["code"] for x in theme_data["groups"]) == set(THEMES)

def inspect(row):
    url = row["ownedUrl"]
    check = {"status": "unavailable", "http": None}
    im = None
    if urlsplit(url).hostname not in {"dcb-card-images-modern-2026.pages.dev",
                                      "dcb-card-images-legacy-2026.pages.dev"}:
        check["status"] = "not_own_cdn"
        return row["canonicalOrder"], check, im
    try:
        with urlopen(Request(url, headers={"User-Agent": "DCB-S4-Visual-Preflight/1.0"}),
                     timeout=25) as response:
            check["http"] = response.status
            data = response.read(6_000_001)
        if not 1000 < len(data) <= 6_000_000:
            raise ValueError("binary size invalid")
        picture = Image.open(BytesIO(data))
        picture.load()
        if not 150 <= picture.width <= 4000 or not 200 <= picture.height <= 5000:
            raise ValueError("image dimensions invalid")
        check.update(status="decoded_region_unverified", format=picture.format,
                     dimensions=[picture.width, picture.height], bytes=len(data),
                     sha256=sha256(data).hexdigest())
        im = picture.convert("RGB")
        im.thumbnail((210, 300))
    except Exception as exc:
        check.update(status="owned_archive_missing", error=str(exc)[:150])
    return row["canonicalOrder"], check, im

for key, name in SETS.items():
    matched = [s for s in modern + legacy if str(s.get("code", "")).lower() == key]
    assert len(matched) == 1, (key, len(matched))
    set_data = matched[0]
    assert len(set_data["cards"]) == 121, (key, len(set_data["cards"]))
    rows = []
    for i in range(31):
        number = i + 91
        c = set_data["cards"][number-1]
        code = str(c.get("code") or "")
        pattern = rf"^{key}_{number:03d}/\d{{3}}$"
        assert re.fullmatch(pattern, code.lower()), (key, number, code)
        assert str(c.get("name") or "").strip(), (key, number)
        image = str(c.get("sourceImage") or c.get("image") or "")
        own = own_destination(image)
        prior = []
        for g in theme_data["groups"]:
            if any(str(x.get("code") or "").upper().split("/")[0] ==
                   f"{key}_{number:03d}".upper() for x in g["cards"]):
                prior.append(g["code"])
        rows.append({
            "canonicalOrder": number, "code": code, "name": c["name"],
            "rarity": c.get("rarity") or "", "masterCardNumber": c.get("cardNumber") or "",
            "sourceUrl": image, "sourceHost": urlsplit(image).hostname or "",
            "ownedUrl": own,
            "sourceAppearsPokemonKoreaOfficial":
                urlsplit(image).hostname == "cards.image.pokemonkorea.co.kr",
            "preExistingThemeMemberships": prior,
            "printedKoreanLanguageVisuallyVerified": False,
            "reviewedTwelveThemes": False
        })
    with ThreadPoolExecutor(max_workers=7) as workers:
        checks = dict((n, (c, image)) for n, c, image in workers.map(inspect, rows))
    dest = OUT / key / "091-121"
    dest.mkdir(parents=True, exist_ok=True)
    sheets = []
    for page in range((len(rows) + 14) // 15):
        canvas = Image.new("RGB", (5 * 244, 3 * 370), (246, 246, 246))
        draw = ImageDraw.Draw(canvas)
        for j, row in enumerate(rows[page*15:(page+1)*15]):
            index = j % 5
            x, y = index * 244, (j // 5) * 370
            n = row["canonicalOrder"]
            check, im = checks[n]
            draw.rectangle((x+2, y+2, x+241, y+367), outline=(140,140,140),width=2)
            if im is not None:
                canvas.paste(im, (x+(244-im.width)//2,y+5))
            else:
                draw.text((x+7,y+155),"OWN IMAGE MISSING",fill=(20,20,20))
            draw.text((x+9,y+312),f"{key.upper()} {n:03d} {row['name'][:13]}",
                      fill=(20,20,20))
            draw.text((x+9,y+336),f"{check['status'][:20]}",
                      fill=(20,20,20))
            draw.text((x+9,y+353),"PRINT NOT YET APPROVED",fill=(130,10,10))
        buf = BytesIO()
        canvas.save(buf, format="WEBP", quality=78, method=4)
        filename = f"{key}-091-121-{page+1:02d}.webp.b64"
        (dest / filename).write_text(base64.b64encode(buf.getvalue()).decode("ascii"),encoding="ascii")
        sheets.append(filename)
    for row in rows:
        row["imageCheck"] = checks[row["canonicalOrder"]][0]
    decoded = sum(row["imageCheck"]["status"] == "decoded_region_unverified" for row in rows)
    existing_count = sum(len(row["preExistingThemeMemberships"]) for row in rows)
    report = {
        "schemaVersion": 1, "recordedAt": DATE,
        "set": key, "name": name, "range": "091-121",
        "masterCanonicalCards": len(set_data["cards"]),
        "checkedCardCount": len(rows), "ownedImageDecodedCount": decoded,
        "ownedImageMissingCount": len(rows)-decoded,
        "sourceHostCounts": dict(Counter(x["sourceHost"] for x in rows)),
        "preExistingThemeMemberships": existing_count,
        "visuallyVerifiedKoreanPrintCount": 0,
        "artworkThemesReviewedCount": 0,
        "all12ThemesInspected": False,
        "setComplete": False,
        "globalCheckpointPreserved": GLOBAL,
        "status": "candidate_preflight_no_master_mutation",
        "notes": "Source provenance, owned DCB CDN binary image decoding and contact sheets only. JPEG/WebP decoding or Korean-looking URL is NOT Korean print identity or artwork classification. Existing ownership, collection IDs, and theme memberships remain unmodified.",
        "sheets": sheets, "cards": rows
    }
    (dest/"visual-index.json").write_text(
        json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"set":key,"checked":len(rows),"ownedDecoded":decoded,
                      "missing":len(rows)-decoded,"preexistingMemberships":existing_count,
                      "hosts":report["sourceHostCounts"]},ensure_ascii=False))
