from pathlib import Path
from io import BytesIO
import requests
from PIL import Image

OUT=Path("assets/packs/candidates")
OUT.mkdir(parents=True,exist_ok=True)

FILES={
  "bs8-fandom":"화려한 전설.png",
  "bs9-fandom":"호수의 기적.png",
  "bs10-fandom":"고대의 수호자.png",
}

session=requests.Session()
headers={
  "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
  "Accept":"application/json,text/plain,*/*",
}

for name,title in FILES.items():
    api="https://pokemon.fandom.com/ko/api.php"
    params={
      "action":"query",
      "titles":"File:"+title,
      "prop":"imageinfo",
      "iiprop":"url|size",
      "format":"json",
      "origin":"*",
    }
    r=session.get(api,params=params,headers=headers,timeout=45)
    print(name,"API",r.status_code,r.url,len(r.content),r.headers.get("content-type"))
    r.raise_for_status()
    data=r.json()
    pages=(data.get("query") or {}).get("pages") or {}
    page=next(iter(pages.values()))
    info=(page.get("imageinfo") or [None])[0]
    if not info:
        raise RuntimeError(f"{name}: imageinfo missing: {data}")
    url=info["url"]
    print(name,"URL",url,"META",info.get("width"),info.get("height"),info.get("size"))
    ir=session.get(url,headers={"User-Agent":headers["User-Agent"],"Referer":"https://pokemon.fandom.com/"},timeout=60)
    print(name,"IMG",ir.status_code,len(ir.content),ir.headers.get("content-type"))
    ir.raise_for_status()
    image=Image.open(BytesIO(ir.content))
    image.load()
    print(name,"SIZE",image.size,"FORMAT",image.format)
    ext=".png" if image.format=="PNG" else ".jpg"
    (OUT/f"{name}{ext}").write_bytes(ir.content)
