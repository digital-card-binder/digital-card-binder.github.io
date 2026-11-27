#!/usr/bin/env python3
"""M-P 058~084 (30주년 파트너 카드 세트) 공식 한국판 이미지를 WebP로 저장한다. 일회성."""
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image

OUT = Path("assets/cards/mp-30th-partner")
UA = {"User-Agent": "Mozilla/5.0 (DigitalCardBinder selfhost)", "Referer": "https://www.pokemoncard.co.kr/", "Accept": "image/*"}
OUT.mkdir(parents=True, exist_ok=True)
for n in range(58, 85):
    name = f"M-P_{n:03d}"
    errors = []
    for url in (f"https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M-P/{name}.png",
                f"https://www.pokemoncard.co.kr/public-assets/home/data/cards.image_www/data/wmimages/MEGA/M-P/{name}.webp"):
        try:
            with urlopen(Request(url, headers=UA), timeout=40) as res:
                data = res.read(8_000_001)
            im = Image.open(BytesIO(data)); im.load()
            if im.width < 300 or im.height < 420:
                raise ValueError(f"too small {im.size}")
            im = im.convert("RGBA")
            if im.width > 734:
                im = im.resize((734, round(im.height * 734 / im.width)), Image.LANCZOS)
            im.save(OUT / f"{n:03d}.webp", "WEBP", quality=86, method=6)
            print("OK", name, url, im.size, (OUT / f"{n:03d}.webp").stat().st_size)
            break
        except Exception as error:
            errors.append(f"{url}: {error}")
    else:
        raise SystemExit("FAILED " + name + " " + " | ".join(errors))
