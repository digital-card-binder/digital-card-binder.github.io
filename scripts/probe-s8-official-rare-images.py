from urllib.request import Request,urlopen
from io import BytesIO
from pathlib import Path
from PIL import Image
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/audits/theme-visual-evidence/s8/official-111-129-probe"
IMAGES=ROOT/"assets/cards/s8-korean-official"
OUT.mkdir(parents=True,exist_ok=True)
IMAGES.mkdir(parents=True,exist_ok=True)
rows=[]
for n in range(111,130):
  good=None
  errors=[]
  for ext in ["png","jpg","jpeg"]:
    url=f"https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S8/S8_{n:03d}.{ext}"
    try:
      with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=12) as r:
        raw=r.read(5000000);mime=r.headers.get("content-type","")
      im=Image.open(BytesIO(raw));im.load()
      if im.width<150 or im.height<200: raise ValueError("small source")
      photo=im.convert("RGB")
      path=IMAGES/f"{n:03d}.webp"
      photo.save(path,"WEBP",quality=90,method=6)
      good={"number":n,"url":url,"size":[im.width,im.height],"sha256":hashlib.sha256(raw).hexdigest(),"ownedPath":str(path.relative_to(ROOT)),"source":"pokemonkorea_official"}
      break
    except Exception as e:errors.append(str(e)[:100])
  rows.append(good or {"number":n,"available":False,"errors":errors[:1]})
(OUT/"official-image-probe.json").write_text(json.dumps({"set":"s8","range":"111-129","available":sum("ownedPath" in v for v in rows),"results":rows},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"available":sum("ownedPath" in v for v in rows),"results":rows},ensure_ascii=False))
