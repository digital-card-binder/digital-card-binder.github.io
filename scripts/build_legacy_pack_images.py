from __future__ import annotations

import json
import re
import unicodedata
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PACKS_JS = ROOT / "packs.js"
OUTPUT_DIR = ROOT / "assets" / "packs" / "legacy"
CATEGORY_URL = "https://pokemoncard.co.kr/card/category/info1"
TARGET_ERAS = {"BW", "XY", "SM"}
USER_AGENT = (
    "Mozilla/5.0 (compatible; DigitalCardBinder/1.0; "
    "+https://digital-card-binder.github.io/)"
)

PAIR_SIDES = {
    "BW1-Bb": "left", "BW1-Bw": "right",
    "BW3-Bp": "left", "BW3-Bh": "right",
    "BW5-Brz": "left", "BW5-Brn": "right",
    "BW6-Bf": "left", "BW6-Bc": "right",
    "BW8-Brf": "left", "BW8-Brn": "right",
    "XY1-Bx": "left", "XY1-By": "right",
    "XY5-Bg": "left", "XY5-Bt": "right",
    "XY8-Bb": "left", "XY8-Br": "right",
    "XY11-Bb": "left", "XY11-Br": "right",
    "sm1S": "left", "sm1M": "right",
    "sm2K": "left", "sm2L": "right",
    "sm3H": "left", "sm3N": "right",
    "sm4S": "left", "sm4A": "right",
    "sm5S": "left", "sm5M": "right",
}

EXACT_HINTS = {
    "sm1+": "강화 확장팩 썬&문",
    "sm4+": "하이클래스팩 GX 배틀부스트",
    "sm8b": "하이클래스팩 GX 울트라샤이니",
}

EXCLUDE_HINTS = {
    "sm4+": ["REMASTER"],
    "sm8b": ["ULTIMATE"],
}


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").lower()
    return re.sub(r"[^0-9a-z가-힣]+", "", value)


def asset_name(code: str) -> str:
    return (
        code.lower()
        .replace("+", "plus")
        .replace("/", "-")
        .replace(" ", "-")
    )


def parse_targets() -> list[dict[str, str]]:
    source = PACKS_JS.read_text(encoding="utf-8")
    entries = [
        {"era": era, "name": name, "code": code}
        for era, name, code, _owned in re.findall(
            r'\["([^"]+)","([^"]+)","([^"]+)",([01])\]',
            source,
        )
        if era in TARGET_ERAS
    ]
    if len(entries) != 75:
        raise RuntimeError(f"Expected 75 official-page legacy packs, found {len(entries)}")
    return entries


def image_records(session: requests.Session) -> list[dict[str, str]]:
    response = session.get(CATEGORY_URL, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    records: list[dict[str, str]] = []
    for image in soup.find_all("img"):
        alt = str(image.get("alt") or "").strip()
        src = str(
            image.get("data-src")
            or image.get("data-original")
            or image.get("src")
            or ""
        ).strip()
        if not alt or not src:
            continue
        if not any(token in alt for token in ("확장팩", "하이클래스팩", "컬렉션", "스페셜 팩")):
            continue
        records.append({"alt": alt, "url": urljoin(CATEGORY_URL, src)})
    if len(records) < 50:
        raise RuntimeError(f"Official product page exposed too few images: {len(records)}")
    return records


def choose_record(pack: dict[str, str], records: list[dict[str, str]]) -> dict[str, str]:
    code = pack["code"]
    name = pack["name"]
    hint = EXACT_HINTS.get(code, name)
    target = normalized(hint)

    candidates = [
        record
        for record in records
        if target and target in normalized(record["alt"])
    ]

    if not candidates and code == "CP5":
        target = normalized("환상 전설 드림 컬렉션")
        candidates = [
            record for record in records
            if target in normalized(record["alt"])
        ]

    excluded = EXCLUDE_HINTS.get(code, [])
    if excluded:
        filtered = [
            record for record in candidates
            if not any(word.lower() in record["alt"].lower() for word in excluded)
        ]
        if filtered:
            candidates = filtered

    if not candidates:
        raise RuntimeError(f"No official product image matched {code} {name}")

    # Paired products naturally have longer titles. For ambiguous reissues,
    # prefer the shortest official title after the exclusion rules above.
    return min(candidates, key=lambda record: (len(record["alt"]), record["alt"]))


def edge_background(image: Image.Image) -> tuple[int, int, int, int]:
    width, height = image.size
    points = [
        (0, 0),
        (max(0, width - 1), 0),
        (0, max(0, height - 1)),
        (max(0, width - 1), max(0, height - 1)),
    ]
    values = [image.getpixel(point) for point in points]
    return tuple(
        sorted(value[channel] for value in values)[len(values) // 2]
        for channel in range(4)
    )


def crop_content(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    background = edge_background(image)
    if background[3] < 100:
        mask = image.getchannel("A").point(lambda value: 255 if value > 18 else 0)
    else:
        flat = Image.new("RGBA", image.size, background)
        mask = ImageChops.difference(image, flat).convert("L").point(
            lambda value: 255 if value > 24 else 0
        )
    mask = mask.filter(ImageFilter.MaxFilter(9))
    box = mask.getbbox()
    if not box:
        return image
    pad = max(4, int(min(image.size) * 0.02))
    left = max(0, box[0] - pad)
    top = max(0, box[1] - pad)
    right = min(image.width, box[2] + pad)
    bottom = min(image.height, box[3] + pad)
    return image.crop((left, top, right, bottom))


def split_pair(image: Image.Image, side: str) -> Image.Image:
    width, height = image.size
    midpoint = width // 2
    overlap = max(2, int(width * 0.025))
    if side == "left":
        return image.crop((0, 0, min(width, midpoint + overlap), height))
    return image.crop((max(0, midpoint - overlap), 0, width, height))


def download_image(session: requests.Session, url: str) -> Image.Image:
    response = session.get(url, timeout=45, headers={"Referer": CATEGORY_URL})
    response.raise_for_status()
    image = Image.open(BytesIO(response.content))
    image.load()
    return image.convert("RGBA")


def save_pack(image: Image.Image, code: str) -> str:
    image = crop_content(image)
    image.thumbnail((720, 920), Image.Resampling.LANCZOS)
    filename = f"{asset_name(code)}.webp"
    destination = OUTPUT_DIR / filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=88, method=6)
    if destination.stat().st_size < 2_000:
        raise RuntimeError(f"Generated image is suspiciously small: {destination}")
    return filename


def main() -> None:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9"})
    targets = parse_targets()
    records = image_records(session)

    downloaded: dict[str, Image.Image] = {}
    manifest: dict[str, str] = {}
    evidence: dict[str, dict[str, str]] = {}

    for pack in targets:
        record = choose_record(pack, records)
        url = record["url"]
        if url not in downloaded:
            downloaded[url] = download_image(session, url)
        image = downloaded[url].copy()
        side = PAIR_SIDES.get(pack["code"])
        if side:
            image = split_pair(image, side)
        filename = save_pack(image, pack["code"])
        manifest[pack["code"].lower()] = f"./assets/packs/legacy/{filename}"
        evidence[pack["code"]] = {
            "name": pack["name"],
            "officialTitle": record["alt"],
            "officialImage": url,
            "crop": side or "full",
        }
        print(f"{pack['code']}: {record['alt']} -> {filename}")

    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "source": CATEGORY_URL,
                "count": len(manifest),
                "images": manifest,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (OUTPUT_DIR / "evidence.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "source": CATEGORY_URL,
                "items": evidence,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    if len(manifest) != 75:
        raise RuntimeError(f"Expected 75 generated images, got {len(manifest)}")


if __name__ == "__main__":
    main()
