from __future__ import annotations

import json
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image, ImageChops, ImageFilter
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "packs" / "legacy"
MANIFEST = OUT / "manifest.json"
EVIDENCE = OUT / "evidence.json"

SOURCES = {
    "BASE": {
        "name": "Base Set",
        "page": "https://www.ebay.com/itm/166709655802",
        "direct": "https://i.ebayimg.com/images/g/rFwAAOSwxLNmGLME/s-l1200.jpg",
        "sourceType": "verified-sealed-korean-pack-photo",
    },
    "ADV1": {
        "name": "제1탄 확장팩",
        "page": "https://namu.moe/w/%EC%A0%9C1%ED%83%84%20%ED%99%95%EC%9E%A5%ED%8C%A9",
        "alt": "advpokemoncardkorea.jpg",
        "sourceType": "archived-korean-pack-image",
    },
    "BS1": {
        "name": "모험의 시작",
        "page": "https://namu.moe/w/%EB%AA%A8%ED%97%98%EC%9D%98%20%EC%8B%9C%EC%9E%91(%ED%8F%AC%EC%BC%93%EB%AA%AC%20%EC%B9%B4%EB%93%9C%20%EA%B2%8C%EC%9E%84)",
        "alt": "모험의 시작.png",
        "sourceType": "archived-korean-pack-image",
    },
    "BS2": {
        "name": "불꽃 튀는 대결",
        "page": "https://namu.moe/w/%EB%B6%88%EA%BD%83%20%ED%8A%80%EB%8A%94%20%EB%8C%80%EA%B2%B0",
        "alt": "불꽃 튀는 대결.png",
        "sourceType": "archived-korean-pack-image",
    },
    "BS3": {
        "name": "시공의 격돌",
        "page": "https://namu.moe/w/%EC%8B%9C%EA%B3%B5%EC%9D%98%20%EA%B2%A9%EB%8F%8C",
        "alt": "시공의 격돌.png",
        "sourceType": "archived-korean-pack-image",
    },
    "BS4": {
        "name": "또 다른 세계",
        "page": "https://namu.moe/w/%EB%98%90%20%EB%8B%A4%EB%A5%B8%20%EC%84%B8%EA%B3%84",
        "alt": "또 다른 세계.png",
        "sourceType": "archived-korean-pack-image",
    },
    "BS5": {
        "name": "7개의 신비",
        "page": "https://namu.moe/w/7%EA%B0%9C%EC%9D%98%20%EC%8B%A0%EB%B9%84",
        "alt": "7개의 신비.png",
        "sourceType": "archived-korean-pack-image",
    },
    "BS6": {
        "name": "암흑의 초승달",
        "page": "https://namu.moe/w/%EC%95%94%ED%9D%91%EC%9D%98%20%EC%B4%88%EC%8A%B9%EB%8B%AC",
        "alt": "암흑의 초승달.png",
        "sourceType": "archived-korean-pack-image",
    },
    "BS7": {
        "name": "보이지 않는 힘",
        "page": "https://namu.moe/w/%EB%B3%B4%EC%9D%B4%EC%A7%80%20%EC%95%8A%EB%8A%94%20%ED%9E%98",
        "alt": "보이지 않는 힘.png",
        "sourceType": "archived-korean-pack-image",
    },
    "BS8": {
        "name": "화려한 전설",
        "page": "https://namu.moe/w/%ED%99%94%EB%A0%A4%ED%95%9C%20%EC%A0%84%EC%84%A4",
        "alt": "화려한 전설.png",
        "sourceType": "archived-korean-pack-image",
    },
    "BS9": {
        "name": "호수의 기적",
        "page": "https://namu.moe/w/%ED%98%B8%EC%88%98%EC%9D%98%20%EA%B8%B0%EC%A0%81",
        "alt": "호수의 기적.png",
        "sourceType": "archived-korean-pack-image",
    },
    "BS10": {
        "name": "고대의 수호자",
        "page": "https://namu.moe/w/%EA%B3%A0%EB%8C%80%EC%9D%98%20%EC%88%98%ED%98%B8%EC%9E%90(%ED%8F%AC%EC%BC%93%EB%AA%AC%20%EC%B9%B4%EB%93%9C%20%EA%B2%8C%EC%9E%84)",
        "alt": "고대의 수호자_포케카.png",
        "sourceType": "archived-korean-pack-image",
    },
}

def filename(code: str) -> str:
    return code.lower().replace("+", "plus") + ".webp"

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
    mask = mask.filter(ImageFilter.MaxFilter(7))
    box = mask.getbbox()
    if not box:
        return image
    pad = max(2, int(min(image.size) * 0.01))
    return image.crop((max(0,box[0]-pad),max(0,box[1]-pad),min(image.width,box[2]+pad),min(image.height,box[3]+pad)))

def optimize(raw: bytes) -> bytes:
    image = Image.open(BytesIO(raw)).convert("RGBA")
    image = crop_content(image)
    image.thumbnail((720, 980), Image.Resampling.LANCZOS)
    out = BytesIO()
    image.save(out, "WEBP", quality=90, method=6)
    return out.getvalue()

def direct_download(url: str) -> tuple[bytes, str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    }
    response = requests.get(url, headers=headers, timeout=45)
    response.raise_for_status()
    Image.open(BytesIO(response.content)).verify()
    return response.content, url

def chrome_driver() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1600,2200")
    options.add_argument("--force-device-scale-factor=2")
    options.add_argument("--lang=ko-KR")
    return webdriver.Chrome(options=options)

def browser_capture(driver: webdriver.Chrome, page: str, alt_fragment: str) -> tuple[bytes, str]:
    last_error = None
    for host in ("https://namu.moe", "https://m.namu.moe", "https://dark.namu.moe"):
        current = page.replace("https://namu.moe", host)
        try:
            driver.get(current)
            wait = WebDriverWait(driver, 25)
            def find_ready(d):
                elements = d.find_elements(By.CSS_SELECTOR, "img")
                for element in elements:
                    alt = element.get_attribute("alt") or ""
                    if alt_fragment not in alt:
                        continue
                    width = d.execute_script("return arguments[0].naturalWidth || 0", element)
                    height = d.execute_script("return arguments[0].naturalHeight || 0", element)
                    src = element.get_attribute("currentSrc") or element.get_attribute("src") or ""
                    print(f"FOUND {alt_fragment}: {width}x{height} {src}")
                    if width >= 80 and height >= 120:
                        d.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
                        time.sleep(0.8)
                        return element
                return False
            element = wait.until(find_ready)
            png = element.screenshot_as_png
            Image.open(BytesIO(png)).verify()
            return png, current
        except Exception as exc:
            last_error = exc
            print(f"BROWSER FAILED {current}: {type(exc).__name__}: {exc}")
    raise RuntimeError(f"Could not capture {alt_fragment}: {last_error}")

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    images = dict(manifest.get("images") or {})
    items = dict(evidence.get("items") or {})

    driver = None
    try:
        for code, src in SOURCES.items():
            if src.get("direct"):
                raw, fetched_from = direct_download(src["direct"])
            else:
                if driver is None:
                    driver = chrome_driver()
                raw, fetched_from = browser_capture(driver, src["page"], src["alt"])

            webp = optimize(raw)
            target = OUT / filename(code)
            target.write_bytes(webp)
            if target.stat().st_size < 2000:
                raise RuntimeError(f"{code}: generated file too small")

            images[code.lower()] = f"./assets/packs/legacy/{target.name}"
            items[code] = {
                "name": src["name"],
                "sourcePage": src["page"],
                "fetchedFrom": fetched_from,
                "sourceType": src["sourceType"],
                "storedLocally": True,
            }
            print(f"SAVED {code}: {target.name} {target.stat().st_size} bytes")
    finally:
        if driver is not None:
            driver.quit()

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
