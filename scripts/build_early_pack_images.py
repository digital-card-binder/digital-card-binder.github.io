from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "assets" / "packs" / "legacy"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
EVIDENCE_PATH = OUTPUT_DIR / "evidence.json"
USER_AGENT = (
    "Mozilla/5.0 (compatible; DigitalCardBinder/1.0; "
    "+https://digital-card-binder.github.io/)"
)

SOURCES = {
    "BASE": {
        "name": "Base Set",
        "image": "https://i.ebayimg.com/images/g/yRcAAOSw5aJmGLJT/s-l1200.jpg",
        "sourcePage": "https://www.ebay.com/itm/166709654921",
        "sourceLabel": "Korean Base Set sealed booster photo",
    },
    "ADV1": {
        "name": "제1탄 확장팩",
        "image": "https://file.namu.moe/file/2164c75f0fabb006756abdb8f8a1f375b3b13f2629fcaec2974b23b31a983966",
        "sourcePage": "https://www.namu.moe/w/%EC%A0%9C1%ED%83%84%20%ED%99%95%EC%9E%A5%ED%8C%A9",
        "sourceLabel": "advpokemoncardkorea.jpg",
    },
    "BS1": {
        "name": "모험의 시작",
        "image": "https://file.namu.moe/file/b13a2746efdd25a10d7735193a1e4a4503cc8ed5959ed6d77721ab1ef68ef70e",
    },
    "BS2": {
        "name": "불꽃 튀는 대결",
        "image": "https://file.namu.moe/file/dd70eb813a928f6c81d9a86b47faca1fc906917beac5866fba7599cb1a31020d",
    },
    "BS3": {
        "name": "시공의 격돌",
        "image": "https://file.namu.moe/file/f81c55441323071b3bea5453ea0d30d938b4b2900aa3b1f5d8abb038ded10109",
    },
    "BS4": {
        "name": "또 다른 세계",
        "image": "https://file.namu.moe/file/a6a286d810f94155aadf4557e1d675f8c3d1c14b4fedff9b032244a690313db1",
    },
    "BS5": {
        "name": "7개의 신비",
        "image": "https://file.namu.moe/file/26f1ade7d7e8e62c25386eff67f87f27425365005c30320d32b5d7945fb5ac8d",
    },
    "BS6": {
        "name": "암흑의 초승달",
        "image": "https://file.namu.moe/file/7f63e25a651a59f4407c94c9765ec3d71a1e26d3dcbefdc77da81ff65a2e4365",
    },
    "BS7": {
        "name": "보이지 않는 힘",
        "image": "https://file.namu.moe/file/19e42841d6c377269d13af1c793a4c5a858d5b684c3befa76552092146510106",
    },
    "BS8": {
        "name": "화려한 전설",
        "image": "https://file.namu.moe/file/8ae8b528101ede59c2e29eb72bd501d7353393e3d42859beb75499094b49d0d2",
    },
    "BS9": {
        "name": "호수의 기적",
        "image": "https://file.namu.moe/file/2e617578aaaa76b38065aba6f3f5d87d4cfd11616783fa8ca9cecffb3ac9e4f8",
    },
    "BS10": {
        "name": "고대의 수호자",
        "image": "https://file.namu.moe/file/954b07d3b8603250dc2f03c02db853cc0b8f9accb0cd0db50bc3c2fef8d39508fa6689c612c7c7a615ed141f0e42c63d",
    },
}

DP_SOURCE_PAGE = "https://www.namu.moe/w/%EC%8B%9C%EA%B3%B5%EC%9D%98%20%EA%B2%A9%EB%8F%8C"


def asset_name(code: str) -> str:
    return code.lower().replace("+", "plus").replace("/", "-").replace(" ", "-")


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
    return image.crop((
        max(0, box[0] - pad),
        max(0, box[1] - pad),
        min(image.width, box[2] + pad),
        min(image.height, box[3] + pad),
    ))


def load_json(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_json(
        MANIFEST_PATH,
        {"schemaVersion": 1, "source": "", "count": 0, "images": {}},
    )
    evidence = load_json(
        EVIDENCE_PATH,
        {"schemaVersion": 1, "source": "", "items": {}},
    )
    images = dict(manifest.get("images") or {})
    items = dict(evidence.get("items") or {})

    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept-Language": "ko-KR,ko;q=0.9",
    })

    for code, source in SOURCES.items():
        response = session.get(source["image"], timeout=45)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content))
        image.load()
        image = crop_content(image)
        image.thumbnail((720, 920), Image.Resampling.LANCZOS)

        filename = f"{asset_name(code)}.webp"
        destination = OUTPUT_DIR / filename
        image.save(destination, "WEBP", quality=88, method=6)
        if destination.stat().st_size < 2_000:
            raise RuntimeError(f"Generated image is suspiciously small: {destination}")

        key = code.lower()
        images[key] = f"./assets/packs/legacy/{filename}"
        source_page = source.get("sourcePage") or DP_SOURCE_PAGE
        items[code] = {
            "name": source["name"],
            "sourcePage": source_page,
            "sourceImage": source["image"],
            "sourceLabel": source.get("sourceLabel") or f"{source['name']} Korean pack image",
            "crop": "content",
            "sourceType": "secondary-korean-reference",
        }
        print(f"{code}: {source['name']} -> {filename}")

    manifest["schemaVersion"] = 2
    manifest["source"] = "mixed-verified-korean-pack-images"
    manifest["count"] = len(images)
    manifest["images"] = dict(sorted(images.items()))
    evidence["schemaVersion"] = 2
    evidence["source"] = "mixed-verified-korean-pack-images"
    evidence["items"] = items

    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    EVIDENCE_PATH.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    if len(images) != 87:
        raise RuntimeError(f"Expected 87 pre-S pack images after merge, got {len(images)}")


if __name__ == "__main__":
    main()
