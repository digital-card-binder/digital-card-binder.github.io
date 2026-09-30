from pathlib import Path
import requests, re
from PIL import Image
from io import BytesIO

OUT=Path("assets/packs/candidates")
OUT.mkdir(parents=True, exist_ok=True)

TARGETS={
  "bs8":("https://d.namu.moe/w/%ED%99%94%EB%A0%A4%ED%95%9C%20%EC%A0%84%EC%84%A4","화려한 전설.png"),
  "bs9":("https://d.namu.moe/w/%ED%98%B8%EC%88%98%EC%9D%98%20%EA%B8%B0%EC%A0%81","호수의 기적.png"),
  "bs10":("https://d.namu.moe/w/%EA%B3%A0%EB%8C%80%EC%9D%98%20%EC%88%98%ED%98%B8%EC%9E%90(%ED%8F%AC%EC%BC%93%EB%AA%AC%20%EC%B9%B4%EB%93%9C%20%EA%B2%8C%EC%9E%84)","고대의 수호자_포케카.png"),
}

headers={
  "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
  "Accept-Language":"ko-KR,ko;q=0.9,en;q=0.7",
}
for code,(page,alt) in TARGETS.items():
    s=requests.Session()
    r=s.get(page,headers=headers,timeout=30)
    r.raise_for_status()
    pattern=rf"<img[^>]+alt=['\"]파일:{re.escape(alt)}['\"][^>]+(?:data-original|src)=['\"]([^'\"]+)"
    m=re.search(pattern,r.text,re.I)
    if not m:
        pattern=rf"<img[^>]+(?:data-original|src)=['\"]([^'\"]+)['\"][^>]+alt=['\"]파일:{re.escape(alt)}['\"]"
        m=re.search(pattern,r.text,re.I)
    if not m:
        raise RuntimeError(f"{code}: target image URL not found")
    imgurl=m.group(1)
    if imgurl.startswith("//"):
        imgurl="https:"+imgurl
    print(code,"URL",imgurl)
    ih={**headers,"Referer":page,"Accept":"image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}
    ir=s.get(imgurl,headers=ih,timeout=60)
    print(code,"FETCH",ir.status_code,ir.headers.get("content-type"),len(ir.content))
    ir.raise_for_status()
    image=Image.open(BytesIO(ir.content))
    image.load()
    print(code,"SIZE",image.size,image.format)
    (OUT/f"{code}-namu-source.png").write_bytes(ir.content)
