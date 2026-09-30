from __future__ import annotations

import json
import time
from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import requests
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "packs" / "legacy"
MANIFEST = OUT / "manifest.json"
EVIDENCE = OUT / "evidence.json"

SOURCES = {
    "BASE": {
        "name": "Base Set",
        "page": "https://www.ebay.com/itm/166709655802",
        "image": "https://i.ebayimg.com/images/g/rFwAAOSwxLNmGLME/s-l1200.jpg",
        "sourceType": "verified-sealed-korean-pack-photo",
    },
    "ADV1": {
        "name": "제1탄 확장팩",
        "page": "https://namu.moe/w/%EC%A0%9C1%ED%83%84%20%ED%99%95%EC%9E%A5%ED%8C%A9",
        "image": "https://file.namu.moe/file/2164c75f0fabb006756abdb8f8a1f375b3b13f2629fcaec2974b23b31a983966",
        "sourceType": "archived-korean-pack-image",
    },
    "BS1": {
        "name": "모험의 시작",
        "page": "https://namu.moe/w/%EB%AA%A8%ED%97%98%EC%9D%98%20%EC%8B%9C%EC%9E%91(%ED%8F%AC%EC%BC%93%EB%AA%AC%20%EC%B9%B4%EB%93%9C%20%EA%B2%8C%EC%9E%84)",
        "image": "https://file.namu.moe/file/b13a2746efdd25a10d7735193a1e4a4503cc8ed5959ed6d77721ab1ef68ef70e",
        "sourceType": "archived-korean-pack-image",
    },
    "BS2": {
        "name": "불꽃 튀는 대결",
        "page": "https://namu.moe/w/%EB%B6%88%EA%BD%83%20%ED%8A%80%EB%8A%94%20%EB%8C%80%EA%B2%B0",
        "image": "https://file.namu.moe/file/dd70eb813a928f6c81d9a86b47faca1fc906917beac5866fba7599cb1a31020d",
        "sourceType": "archived-korean-pack-image",
    },
    "BS3": {
        "name": "시공의 격돌",
        "page": "https://namu.moe/w/%EC%8B%9C%EA%B3%B5%EC%9D%98%20%EA%B2%A9%EB%8F%8C",
        "image": "https://file.namu.moe/file/f81c55441323071b3bea5453ea0d30d938b4b2900aa3b1f5d8abb038ded10109",
        "sourceType": "archived-korean-pack-image",
    },
    "BS4": {
        "name": "또 다른 세계",
        "page": "https://namu.moe/w/%EB%98%90%20%EB%8B%A4%EB%A5%B8%20%EC%84%B8%EA%B3%84",
        "image": "https://file.namu.moe/file/a6a286d810f94155aadf4557e1d675f8c3d1c14b4fedff9b032244a690313db1",
        "sourceType": "archived-korean-pack-image",
    },
    "BS5": {
        "name": "7개의 신비",
        "page": "https://namu.moe/w/7%EA%B0%9C%EC%9D%98%20%EC%8B%A0%EB%B9%84",
        "image": "https://file.namu.moe/file/26f1ade7d7e8e62c25386eff67f87f27425365005c30320d32b5d7945fb5ac8d",
        "sourceType": "archived-korean-pack-image",
    },
    "BS6": {
        "name": "암흑의 초승달",
        "page": "https://namu.moe/w/%EC%95%94%ED%9D%91%EC%9D%98%20%EC%B4%88%EC%8A%B9%EB%8B%AC",
        "image": "https://file.namu.moe/file/7f63e25a651a59f4407c94c9765ec3d71a1e26d3dcbefdc77da81ff65a2e4365",
        "sourceType": "archived-korean-pack-image",
    },
    "BS7": {
        "name": "보이지 않는 힘",
        "page": "https://namu.moe/w/%EB%B3%B4%EC%9D%B4%EC%A7%80%20%EC%95%8A%EB%8A%94%20%ED%9E%98",
        "image": "https://file.namu.moe/file/19e42841d6c377269d13af1c793a4c5a858d5b684c3befa76552092146510106",
        "sourceType": "archived-korean-pack-image",
    },
    "BS8": {
        "name": "화려한 전설",
        "page": "https://namu.moe/w/%ED%99%94%EB%A0%A4%ED%95%9C%20%EC%A0%84%EC%84%A4",
        "image": "https://file.namu.moe/file/8ae8b528101ede59c2e29eb72bd501d7353393e3d42859beb75499094b49d0d2",
        "sourceType": "archived-korean-pack-image",
    },
    "BS9": {
        "name": "호수의 기적",
        "page": "https://namu.moe/w/%ED%98%B8%EC%88%98%EC%9D%98%20%EA%B8%B0%EC%A0%81",
        "image": "https://file.namu.moe/file/2e617578aaaa76b38065aba6f3f5d87d4cfd11616783fa8ca9cecffb3ac9e4f8",
        "sourceType": "archived-korean-pack-image",
    },
    "BS10": {
        "name": "고대의 수호자",
        "page": "https://namu.moe/w/%EA%B3%A0%EB%8C%80%EC%9D%98%20%EC%88%98%ED%98%B8%EC%9E%90(%ED%8F%AC%EC%BC%93%EB%AA%AC%20%EC%B9%B4%EB%93%9C%20%EA%B2%8C%EC%9E%84)",
        "image": "https://file.namu.moe/file/954b07d3b8603250dc2f03c02db853cc0b8f9accb0cd0db50bc3c2fef8d39508fa6689c612c7c7a615ed141f0e42c63d",
        "sourceType": "archived-korean-pack-image",
    },
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
    "Referer": "https://namu.moe/",
}

def proxy_urls(url: str) -> list[str]:
    if "file.namu.moe" not in url:
        return [url]
    bare = url.replace("https://", "")
    encoded = quote(url, safe="")
    return [
        url,
        f"https://images.weserv.nl/?url={bare}&output=png",
        f"https://wsrv.nl/?url={encoded}&output=png",
    ]

def fetch_image(session: requests.Session, url: str) -> tuple[bytes, str]:
    errors = []
    for candidate in proxy_urls(url):
        for attempt in range(3):
            try:
                response = session.get(candidate, headers=HEADERS, timeout=45)
                ctype = response.headers.get("content-type", "")
                print(f"GET {candidate[:90]} -> {response.status_code} {ctype} {len(response.content)}")
                if response.ok and len(response.content) > 2000:
                    Image.open(BytesIO(response.content)).verify()
                    return response.content, candidate
                errors.append(f"{candidate} -> {response.status_code} {ctype} {len(response.content)}")
            except Exception as exc:
                errors.append(f"{candidate} -> {type(exc).__name__}: {exc}")
            time.sleep(1 + attempt)
    raise RuntimeError("\n".join(errors[-9:]))

def edge_background(image: Image.Image):
    image = image.convert("RGBA")
    pts = [(0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1)]
    vals = [image.getpixel(p) for p in pts]
    return tuple(sorted(v[i] for v in vals)[len(vals)//2] for i in range(4))

def crop_content(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    bg = edge_background(image)
    if bg[3] < 100:
        mask = image.getchannel("A").point(lambda v: 255 if v > 18 else 0)
    else:
        flat = Image.new("RGBA", image.size, bg)
        mask = ImageChops.difference(image, flat).convert("L").point(lambda v: 255 if v > 24 else 0)
    mask = mask.filter(ImageFilter.MaxFilter(9))
    box = mask.getbbox()
    if not box:
        return image
    pad = max(4, int(min(image.size) * 0.015))
    return image.crop((max(0,box[0]-pad),max(0,box[1]-pad),min(image.width,box[2]+pad),min(image.height,box[3]+pad)))

def filename(code: str) -> str:
    return code.lower().replace("+","plus") + ".webp"

def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    images = dict(manifest.get("images") or {})
    items = dict(evidence.get("items") or {})
    session = requests.Session()

    for code, src in SOURCES.items():
        raw, fetched_from = fetch_image(session, src["image"])
        image = Image.open(BytesIO(raw)).convert("RGBA")
        image = crop_content(image)
        image.thumbnail((720, 980), Image.Resampling.LANCZOS)
        target = OUT / filename(code)
        image.save(target, "WEBP", quality=88, method=6)
        if target.stat().st_size < 2000:
            raise RuntimeError(f"{code}: generated file too small")

        images[code.lower()] = f"./assets/packs/legacy/{target.name}"
        items[code] = {
            "name": src["name"],
            "sourcePage": src["page"],
            "sourceImage": src["image"],
            "fetchedFrom": fetched_from,
            "sourceType": src["sourceType"],
            "storedLocally": True,
        }
        print(f"SAVED {code}: {target.name} {target.stat().st_size} bytes")

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
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    EVIDENCE.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if len(images) != 87:
        raise RuntimeError(f"Expected 87 pre-S pack images, found {len(images)}")

if __name__ == "__main__":
    main()
