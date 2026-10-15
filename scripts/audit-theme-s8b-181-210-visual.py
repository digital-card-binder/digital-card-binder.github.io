#!/usr/bin/env python3
"""Read-only s8b Battle Region Korean print and owned-CDN preflight (001–030).
Proof collection only: never infer illustration theme membership from card names.
Only user-owned DCB CDN image binaries are requested, not third-party origins.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import base64
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CODE = "s8b"
START, END, EXPECTED_SET_COUNT = 181, 210, 293
OUT = ROOT / "data/audits/theme-visual-evidence/s8b/181-210"
OUT.mkdir(parents=True, exist_ok=True)
OWNED = ("dcb-card-images-modern-2026.pages.dev", "dcb-card-images-legacy-2026.pages.dev")

def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))

status = read("data/audits/theme-series-review-status.json")
checkpoint = status.get("execution", {}).get("nextStart", "")
previous = status.get("reviews", {}).get("s8b", {})
if previous.get("status") == "complete":
    print("s8b already complete; no preflight required.")
    raise SystemExit(0)
if checkpoint != "s8b canonical 181":
    raise RuntimeError("Unsafe s8b starting checkpoint: " + checkpoint)
sets = [s for s in read("data/series.json") + read("data/series-legacy.json")
        if str(s.get("code", "")).casefold() == CODE]
if len(sets) != 1 or len(sets[0].get("cards", [])) != EXPECTED_SET_COUNT:
    raise RuntimeError("Expected precisely one 293-card Korean VMAX Climax s8b set")
master = sets[0]
first_code = str(master["cards"][0].get("code", ""))
denominator = first_code.split("/", 1)[-1] if "/" in first_code else ""
if not denominator.isdigit() or len(denominator) > 3:
    raise RuntimeError("Missing consistent Korean s8b printed card denominator")
groups = read("data/art-themes.json").get("groups", [])
existing = {}
for group in groups:
    for card in group.get("cards", []):
        key = str(card.get("code", "")).upper()
        if str(card.get("set", "")).casefold() == CODE or key.startswith("S8B_"):
            existing.setdefault(key, []).append(group["code"])

def fnv64(value):
    h = 0xcbf29ce484222325
    for char in value:
        h ^= ord(char)
        h = (h * 0x100000001b3) & 0xffffffffffffffff
    return f"{h:016x}"

def hosted_url(source):
    if not source.startswith("https://"):
        return ""
    parts = urlsplit(source)
    base = f"{parts.scheme}://{parts.netloc}{parts.path}"
    if parts.hostname in OWNED:
        return base
    if parts.hostname == "cards.image.pokemonkorea.co.kr":
        rel = parts.path.lstrip("/")
        route = rel.split("/")[2].upper() if rel.startswith("data/wmimages/") else ""
        host = "modern" if route in ("MEGA", "S", "SV") else "legacy"
        return f"https://dcb-card-images-{host}-2026.pages.dev/" + rel.rsplit(".", 1)[0] + ".webp"
    return "https://dcb-card-images-legacy-2026.pages.dev/external/" + parts.hostname + "/" + fnv64(base) + ".webp"

cards = []
for order, record in enumerate(master["cards"][START - 1:END], START):
    number = f"{order:03d}"
    master_key = str(record.get("code", ""))
    expected = f"s8b_{number}/{denominator}"
    source = str(record.get("sourceImage") or record.get("image") or "")
    name = str(record.get("name") or "")
    cards.append({
        "canonicalOrder": order, "masterCode": master_key,
        "expectedPrintedNumber": number + "/" + denominator, "name": name,
        "koreanNameNonempty": bool(name.strip()),
        "printedNumberMatches": master_key.casefold() == expected,
        "rawSource": source, "ownedCdnUrl": hosted_url(source),
        "priorThemes": sorted(set(existing.get("S8B_" + number, []))),
    })

def fetch_card(row):
    proof = {"canonicalOrder": row["canonicalOrder"], "url": row["ownedCdnUrl"], "status": "unavailable"}
    picture = None
    try:
        url = row["ownedCdnUrl"]
        if urlsplit(url).hostname not in OWNED:
            raise ValueError("Route is not an owned CDN host")
        with urlopen(Request(url, headers={"User-Agent": "DigitalCardBinder-S8B-Audit/1.0"}), timeout=22) as response:
            blob = response.read(3000001)
            proof["http"] = response.status
        if len(blob) > 3000000:
            raise ValueError("Image too large")
        image = Image.open(BytesIO(blob))
        image.load()
        proof.update(status="decoded", byteCount=len(blob), dimensions=[image.width, image.height], format=image.format)
        picture = image.convert("RGB")
        picture.thumbnail((218, 307))
    except Exception as err:
        proof["error"] = str(err)[:220]
    return row["canonicalOrder"], proof, picture

found = {}
with ThreadPoolExecutor(max_workers=12) as pool:
    for future in as_completed([pool.submit(fetch_card, item) for item in cards]):
        number, info, photo = future.result()
        found[number] = (info, photo)

ordered = [found[card["canonicalOrder"]] for card in cards]
sheets = []
for offset in range(0, len(cards), 15):
    canvas = Image.new("RGB", (1220, 1104), (242, 242, 242))
    painter = ImageDraw.Draw(canvas)
    for idx, (proof, photo) in enumerate(ordered[offset:offset + 15]):
        row = cards[offset + idx]
        x, y = (idx % 5) * 244, (idx // 5) * 368
        painter.rectangle((x + 2, y + 2, x + 240, y + 364), outline=(160, 160, 160), width=2)
        if photo:
            canvas.paste(photo, (x + (244 - photo.width) // 2, y + 5))
        else:
            painter.text((x + 10, y + 150), "OWN CDN NOT VERIFIED", fill=(20, 20, 20))
        painter.text((x + 7, y + 316), f"{row['canonicalOrder']:03d} {row['name'][:15]}", fill=(20, 20, 20))
        painter.text((x + 7, y + 338), row["masterCode"][:21] + " " + proof["status"], fill=(20, 20, 20))
    output = BytesIO()
    canvas.save(output, format="WEBP", quality=78)
    filename = f"s8b-181-210-{offset // 15 + 1:02d}.webp.b64"
    (OUT / filename).write_text(base64.b64encode(output.getvalue()).decode("ascii"), encoding="ascii")
    sheets.append({"file": filename, "start": offset + START, "end": min(offset + START + 14, END)})
image_ok = sum(proof["status"] == "decoded" for proof, _ in ordered)
name_ok = sum(row["koreanNameNonempty"] for row in cards)
number_ok = sum(row["printedNumberMatches"] for row in cards)
result = {
    "schemaVersion": 1, "recordedAt": "2026-10-15",
    "set": CODE, "name": "VMAX 클라이맥스", "masterSetCardCount": EXPECTED_SET_COUNT,
    "range": "181-210", "canonicalCardsChecked": len(cards),
    "checkpointAtStart": checkpoint, "evidenceStatus": "image_and_identity_preflight_only",
    "verifiedOwnedCdnImageCount": image_ok, "unavailableOwnedCdnImageCount": len(cards) - image_ok,
    "koreanNameNonemptyCount": name_ok, "printedNumberMatchCount": number_ok,
    "sourceRequestCount": 0,
    "nameEvidence": "Master Korean names inventoried; print-name and illustration confirmation requires direct review of Korean card scans. No automatic name-match claims.",
    "cards": [{**row, "imageCheck": proof} for row, (proof, _) in zip(cards, ordered)],
    "sheets": sheets, "artworkThemeReviewComplete": False,
    "nextSafeStep": "Directly inspect the contact sheets / Korean artwork, classify all 12 themes, then update theme DB and status."
}
(OUT / "visual-index.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: result[k] for k in (
    "set", "range", "verifiedOwnedCdnImageCount", "unavailableOwnedCdnImageCount",
    "koreanNameNonemptyCount", "printedNumberMatchCount", "artworkThemeReviewComplete")}, ensure_ascii=False))
