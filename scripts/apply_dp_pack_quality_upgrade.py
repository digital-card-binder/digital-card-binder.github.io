from pathlib import Path
from PIL import Image
import json

ROOT=Path(__file__).resolve().parents[1]
CAND=ROOT/"assets"/"packs"/"candidates"
OUT=ROOT/"assets"/"packs"/"legacy"
MANIFEST=OUT/"manifest.json"
EVIDENCE=OUT/"evidence.json"

SPECS={
  "BS4":{
    "source":"bs4-ebay.jpg",
    "crop":(0.065,0.03,0.91,0.975),
    "name":"또 다른 세계",
    "sourcePage":"https://www.ebay.com/itm/372935590817",
    "sourceImage":"https://i.ebayimg.com/images/g/h9QAAOSwealaZTCB/s-l1200.jpg",
  },
  "BS7":{
    "source":"bs7-ebay.jpg",
    "crop":(0.15,0.04,0.86,0.96),
    "name":"보이지 않는 힘",
    "sourcePage":"https://www.ebay.com/itm/173096395865",
    "sourceImage":"https://i.ebayimg.com/images/g/UBoAAOSwZ3BaWk4t/s-l1200.jpg",
  },
}

def crop_ratio(image, box):
    w,h=image.size
    l,t,r,b=box
    return image.crop((round(w*l),round(h*t),round(w*r),round(h*b)))

def fit_canvas(image):
    image=image.convert("RGBA")
    canvas=Image.new("RGBA",(700,900),(0,0,0,0))
    scale=min(680/image.width,880/image.height)
    size=(max(1,round(image.width*scale)),max(1,round(image.height*scale)))
    image=image.resize(size,Image.Resampling.LANCZOS)
    canvas.alpha_composite(image,((700-image.width)//2,(900-image.height)//2))
    return canvas

manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
evidence=json.loads(EVIDENCE.read_text(encoding="utf-8"))

for code,spec in SPECS.items():
    src=Image.open(CAND/spec["source"])
    src.load()
    final=fit_canvas(crop_ratio(src,spec["crop"]))
    dest=OUT/f"{code.lower()}.webp"
    final.save(dest,"WEBP",quality=92,method=6)
    if dest.stat().st_size < 10000:
        raise RuntimeError(f"{code}: generated asset too small")
    manifest["images"][code.lower()]=f"./assets/packs/legacy/{code.lower()}.webp"
    evidence["items"][code]={
      "name":spec["name"],
      "sourcePage":spec["sourcePage"],
      "sourceImage":spec["sourceImage"],
      "sourceType":"verified-sealed-korean-pack-photo",
      "storedLocally":True,
      "qualityUpgrade":True,
      "rendering":"aspect-ratio-preserved",
    }
    print(code,dest.stat().st_size)

MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
EVIDENCE.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
