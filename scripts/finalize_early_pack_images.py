from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / "assets" / "packs" / "candidates"
OUT = ROOT / "assets" / "packs" / "legacy"
MANIFEST = OUT / "manifest.json"
EVIDENCE = OUT / "evidence.json"

BASE_URL = "https://i.ebayimg.com/images/g/rFwAAOSwxLNmGLME/s-l1200.jpg"

# Crop rectangles are proportional to each source image and were visually reviewed.
# The goal is to retain the Korean pack face while excluding unrelated listing background.
SPECS = {
    "ADV1": ("adv1.jpg", (0.18, 0.00, 0.84, 1.00)),
    "BS1": ("bs1.jpg", (0.31, 0.17, 0.69, 0.86)),
    "BS2": ("bs2.jpg", (0.31, 0.17, 0.69, 0.86)),
    "BS3": ("bs3.jpg", (0.31, 0.17, 0.69, 0.86)),
    "BS4": ("multi.jpg", (0.00, 0.20, 0.37, 0.99)),
    "BS5": ("bs5.jpg", (0.31, 0.17, 0.69, 0.86)),
    "BS6": ("bs6.jpg", (0.14, 0.02, 0.86, 0.99)),
    "BS7": ("multi.jpg", (0.63, 0.20, 1.00, 0.99)),
    "BS8": ("wanted.jpg", (0.40, 0.49, 0.60, 1.00)),
    "BS9": ("wanted.jpg", (0.60, 0.49, 0.80, 1.00)),
    "BS10": ("wanted.jpg", (0.80, 0.49, 1.00, 1.00)),
}

NAMES = {
    "BASE": "Base Set",
    "ADV1": "제1탄 확장팩",
    "BS1": "모험의 시작",
    "BS2": "불꽃 튀는 대결",
    "BS3": "시공의 격돌",
    "BS4": "또 다른 세계",
    "BS5": "7개의 신비",
    "BS6": "암흑의 초승달",
    "BS7": "보이지 않는 힘",
    "BS8": "화려한 전설",
    "BS9": "호수의 기적",
    "BS10": "고대의 수호자",
}

SOURCE_PAGES = {
    "BASE": "https://www.ebay.com/itm/166709655802",
    "ADV1": "https://m.bunjang.co.kr/products/234574785",
    "BS1": "https://m.bunjang.co.kr/products/411176949",
    "BS2": "https://m.bunjang.co.kr/products/411177289",
    "BS3": "https://m.bunjang.co.kr/products/411177637",
    "BS4": "https://m.bunjang.co.kr/products/396838239",
    "BS5": "https://m.bunjang.co.kr/products/411177951",
    "BS6": "https://m.bunjang.co.kr/products/422715439",
    "BS7": "https://m.bunjang.co.kr/products/396838239",
    "BS8": "https://m.bunjang.co.kr/products/430162505",
    "BS9": "https://m.bunjang.co.kr/products/430162505",
    "BS10": "https://m.bunjang.co.kr/products/430162505",
}

SOURCE_TYPES = {
    "BASE": "verified-sealed-korean-pack-photo",
    "ADV1": "korean-marketplace-sealed-pack-photo",
    "BS1": "korean-marketplace-pack-set-photo",
    "BS2": "korean-marketplace-pack-set-photo",
    "BS3": "korean-marketplace-pack-set-photo",
    "BS4": "korean-marketplace-multi-pack-photo",
    "BS5": "korean-marketplace-pack-set-photo",
    "BS6": "korean-marketplace-pack-set-photo",
    "BS7": "korean-marketplace-multi-pack-photo",
    "BS8": "korean-marketplace-reference-grid",
    "BS9": "korean-marketplace-reference-grid",
    "BS10": "korean-marketplace-reference-grid",
}

REFERENCE_PAGES = {
    "ADV1": "https://namu.moe/w/%EC%A0%9C1%ED%83%84%20%ED%99%95%EC%9E%A5%ED%8C%A9",
    "BS1": "https://namu.moe/w/%EB%AA%A8%ED%97%98%EC%9D%98%20%EC%8B%9C%EC%9E%91(%ED%8F%AC%EC%BC%93%EB%AA%AC%20%EC%B9%B4%EB%93%9C%20%EA%B2%8C%EC%9E%84)",
    "BS2": "https://namu.moe/w/%EB%B6%88%EA%BD%83%20%ED%8A%80%EB%8A%94%20%EB%8C%80%EA%B2%B0",
    "BS3": "https://namu.moe/w/%EC%8B%9C%EA%B3%B5%EC%9D%98%20%EA%B2%A9%EB%8F%8C",
    "BS4": "https://namu.moe/w/%EB%98%90%20%EB%8B%A4%EB%A5%B8%20%EC%84%B8%EA%B3%84",
    "BS5": "https://namu.moe/w/7%EA%B0%9C%EC%9D%98%20%EC%8B%A0%EB%B9%84",
    "BS6": "https://namu.moe/w/%EC%95%94%ED%9D%91%EC%9D%98%20%EC%B4%88%EC%8A%B9%EB%8B%AC",
    "BS7": "https://namu.moe/w/%EB%B3%B4%EC%9D%B4%EC%A7%80%20%EC%95%8A%EB%8A%94%20%ED%9E%98",
    "BS8": "https://namu.moe/w/%ED%99%94%EB%A0%A4%ED%95%9C%20%EC%A0%84%EC%84%A4",
    "BS9": "https://namu.moe/w/%ED%98%B8%EC%88%98%EC%9D%98%20%EA%B8%B0%EC%A0%81",
    "BS10": "https://namu.moe/w/%EA%B3%A0%EB%8C%80%EC%9D%98%20%EC%88%98%ED%98%B8%EC%9E%90(%ED%8F%AC%EC%BC%93%EB%AA%AC%20%EC%B9%B4%EB%93%9C%20%EA%B2%8C%EC%9E%84)",
}


def open_source(path: Path) -> Image.Image:
    image = Image.open(path)
    image.load()
    return image.convert("RGBA")


def crop_proportional(image: Image.Image, box: tuple[float, float, float, float]) -> Image.Image:
    w, h = image.size
    left, top, right, bottom = box
    return image.crop((
        max(0, round(w * left)),
        max(0, round(h * top)),
        min(w, round(w * right)),
        min(h, round(h * bottom)),
    ))


def fit_canvas(image: Image.Image) -> Image.Image:
    # Match the pack-dex display ratio without stretching the source artwork.
    # Upscaling is intentional for low-resolution archive crops because the
    # final UI only renders them at small pack-card dimensions.
    canvas = Image.new("RGBA", (700, 900), (0, 0, 0, 0))
    scale = min(680 / image.width, 880 / image.height)
    size = (
        max(1, round(image.width * scale)),
        max(1, round(image.height * scale)),
    )
    image = image.resize(size, Image.Resampling.LANCZOS)
    x = (canvas.width - image.width) // 2
    y = (canvas.height - image.height) // 2
    canvas.alpha_composite(image, (x, y))
    return canvas


def save_webp(code: str, image: Image.Image) -> Path:
    destination = OUT / f"{code.lower()}.webp"
    fit_canvas(image).save(destination, "WEBP", quality=90, method=6)
    if destination.stat().st_size < 5_000:
        raise RuntimeError(f"{code}: generated file is suspiciously small")
    return destination


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    images = dict(manifest.get("images") or {})
    items = dict(evidence.get("items") or {})

    response = requests.get(
        BASE_URL,
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.ebay.com/"},
        timeout=45,
    )
    response.raise_for_status()
    base = Image.open(BytesIO(response.content)).convert("RGBA")
    base = crop_proportional(base, (0.16, 0.00, 0.84, 1.00))
    save_webp("BASE", base)
    images["base"] = "./assets/packs/legacy/base.webp"
    items["BASE"] = {
        "name": NAMES["BASE"],
        "sourcePage": SOURCE_PAGES["BASE"],
        "sourceImage": BASE_URL,
        "sourceType": SOURCE_TYPES["BASE"],
        "storedLocally": True,
    }

    for code, (candidate_name, box) in SPECS.items():
        source = open_source(CANDIDATES / candidate_name)
        cropped = crop_proportional(source, box)
        save_webp(code, cropped)
        images[code.lower()] = f"./assets/packs/legacy/{code.lower()}.webp"
        item = {
            "name": NAMES[code],
            "sourcePage": SOURCE_PAGES[code],
            "sourceType": SOURCE_TYPES[code],
            "storedLocally": True,
        }
        if code in REFERENCE_PAGES:
            item["referencePage"] = REFERENCE_PAGES[code]
        items[code] = item

    manifest.update({
        "schemaVersion": 2,
        "source": "self-hosted-korean-pack-reference-images",
        "count": len(images),
        "images": dict(sorted(images.items())),
    })
    evidence.update({
        "schemaVersion": 2,
        "source": "self-hosted-korean-pack-reference-images",
        "items": items,
    })

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    EVIDENCE.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    expected = {"base", "adv1", *(f"bs{i}" for i in range(1, 11))}
    missing = expected - set(images)
    if missing:
        raise RuntimeError(f"Missing early pack images: {sorted(missing)}")
    if len(images) != 87:
        raise RuntimeError(f"Expected 87 pre-S pack images, found {len(images)}")

    print("Finalized 12 early Korean pack images; manifest count=87")


if __name__ == "__main__":
    main()
