from pathlib import Path
from io import BytesIO
import requests
from PIL import Image

OUT=Path("assets/packs/candidates")
OUT.mkdir(parents=True, exist_ok=True)

URLS={
  "bs8-official":"https://cards.image.pokemonkorea.co.kr/data/wmimages/DP/BS8/bs8_ko_1.jpg?w=512",
  "bs9-official":"https://cards.image.pokemonkorea.co.kr/data/wmimages/DP/BS9/bs9_ko_1.jpg?w=512",
  "bs10-official":"https://cards.image.pokemonkorea.co.kr/data/wmimages/DP/BS10/bs10_ko_1.jpg?w=512",
}

headers={
  "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
  "Accept":"image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Referer":"https://www.pokemonkorea.co.kr/",
}

for name,url in URLS.items():
    r=requests.get(url,headers=headers,timeout=45)
    print(name,r.status_code,r.headers.get("content-type"),len(r.content),r.url)
    r.raise_for_status()
    image=Image.open(BytesIO(r.content))
    image.load()
    print(name,"SIZE",image.size,"FORMAT",image.format)
    ext=".jpg" if image.format in ("JPEG","JPG") else ".png"
    (OUT/f"{name}{ext}").write_bytes(r.content)
