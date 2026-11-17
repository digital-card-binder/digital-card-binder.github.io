#!/usr/bin/env python3
"""MEZ/MEE/MEM 시리즈 카드(61장)의 외부 이미지를 자체 assets로 옮긴다.

- 대상: data/series-legacy.json 중 image가 pokemoncard.co.kr 프록시 또는 collec-hub.store 인 카드
- 이미지는 현재 사이트가 보여 주는 주소(프록시/허브)를 그대로 받아 WebP로 저장한다. 공식 원본 URL이 열리면 그쪽을 우선 사용한다.
- 카드 번호/수집 키(code)는 바꾸지 않고 image만 교체하며, 원래 주소는 sourceImage에 보존한다.
- 이미 옮겨진 카드는 건너뛴다(재실행 안전).
"""
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen
import json
import re
import sys

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "series-legacy.json"
SITE = "https://digital-card-binder.github.io"
UA = {"User-Agent": "Mozilla/5.0 (DigitalCardBinder selfhost)", "Referer": "https://pokemoncard.co.kr/", "Accept": "image/*"}


def fetch(url):
    with urlopen(Request(url, headers=UA), timeout=25) as res:
        data = res.read(6_000_001)
    if not 2000 < len(data) <= 6_000_000:
        raise ValueError(f"unexpected size {len(data)}")
    im = Image.open(BytesIO(data))
    im.load()
    if im.width < 200 or im.height < 280:
        raise ValueError(f"too small {im.width}x{im.height}")
    return im


def hub_page_image(page, setdir):
    """collec-hub 카드 페이지에서 이 카드의 고해상도 이미지 주소를 찾는다."""
    with urlopen(Request(page, headers={"User-Agent": UA["User-Agent"]}), timeout=25) as res:
        html = res.read(600_000).decode("utf8", "ignore")
    for width in ("w1200", "w600"):
        m = re.search(rf"https://collec-hub\.store/media/pokecards/{width}/ko/{setdir.upper()}/[\w.-]+\.webp", html)
        if m:
            return m.group(0)
    return None


def candidates(image, code):
    """(시도할 주소 목록, 저장 파일명)"""
    if "pokemoncard.co.kr" in image:
        key = parse_qs(urlsplit(image).query).get("key", [""])[0]
        m = re.search(r"wmimages/(MEGA/(MEZ|MEE|MEM)/(\w+))\.png$", key)
        if not m:
            raise ValueError(f"unknown proxy key {key}")
        name = m.group(3)
        return [f"https://cards.image.pokemonkorea.co.kr/data/wmimages/{m.group(1)}.png", image], m.group(2).lower(), name
    m = re.match(r"(mez|mee|mem)_(\w+)", code)
    return [image], m.group(1), None


def main():
    cards = json.loads(DATA.read_text(encoding="utf8"))
    done = failed = skipped = 0
    problems = []

    def walk(o):
        nonlocal done, failed, skipped
        if isinstance(o, dict):
            image = str(o.get("image", ""))
            if "pokemoncard.co.kr" in image or "collec-hub.store" in image:
                code = str(o.get("code", ""))
                try:
                    urls, setdir, name = candidates(image, code)
                    page = str(o.get("source", ""))
                    if page.startswith("https://collec-hub.store/cards/ko/"):
                        try:
                            hub = hub_page_image(page, setdir)
                        except Exception:  # noqa: BLE001
                            hub = None
                        if hub:
                            urls = [hub] + urls
                    if name is None:
                        name = f"{setdir.upper()}_{o.get('printedCode') or code.split('_')[-1].split('/')[0]}"
                    rel = f"assets/cards/mega/{setdir}/{name}.webp"
                    dest = ROOT / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    if not dest.exists():
                        im, last = None, None
                        for url in urls:
                            try:
                                im = fetch(url)
                                break
                            except Exception as exc:  # noqa: BLE001
                                last = exc
                        if im is None:
                            raise last or ValueError("no source")
                        ImageOps.exif_transpose(im).convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB").save(dest, format="WEBP", quality=90, method=6)
                        with Image.open(dest) as check:
                            assert check.format == "WEBP" and check.width >= 200
                        done += 1
                    else:
                        skipped += 1
                    o.setdefault("sourceImage", image)
                    o["image"] = f"{SITE}/{rel}"
                except Exception as exc:  # noqa: BLE001
                    failed += 1
                    problems.append((code, str(exc)))
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(cards)
    print(f"saved={done} skipped={skipped} failed={failed}")
    for code, msg in problems:
        print("FAIL", code, msg)
    if failed:
        sys.exit(1)
    DATA.write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
