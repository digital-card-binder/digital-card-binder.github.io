from pathlib import Path
from io import BytesIO
import json, requests
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets"/"packs"/"legacy"
MANIFEST=OUT/"manifest.json"
EVIDENCE=OUT/"evidence.json"

SOURCE_URL="https://media.bunjang.co.kr/product/430162505_1_1790050194_w840.jpg"
SOURCE_PAGE="https://m.bunjang.co.kr/products/430162505"

# Exact proportional crops reviewed against the Korean DP pack lineup.
# Bunjang may serve the same source at different pixel sizes, so use ratios.
CROPS={
  "BS8":(0.402, 0.475, 0.598, 0.995),
  "BS9":(0.602, 0.475, 0.798, 0.995),
  "BS10":(0.802, 0.475, 0.998, 0.995),
}
NAMES={
  "BS8":"화려한 전설",
  "BS9":"호수의 기적",
  "BS10":"고대의 수호자",
}

def fit_canvas(image):
    image=image.convert("RGBA")
    # Mild sharpening only; do not synthesize or stretch missing detail.
    image=image.filter(ImageFilter.UnsharpMask(radius=0.8, percent=110, threshold=3))
    canvas=Image.new("RGBA",(700,900),(0,0,0,0))
    scale=min(670/image.width,870/image.height)
    size=(max(1,round(image.width*scale)),max(1,round(image.height*scale)))
    image=image.resize(size,Image.Resampling.LANCZOS)
    x=(700-image.width)//2
    y=(900-image.height)//2
    canvas.alpha_composite(image,(x,y))
    return canvas

r=requests.get(
    SOURCE_URL,
    headers={"User-Agent":"Mozilla/5.0","Referer":"https://m.bunjang.co.kr/"},
    timeout=45,
)
r.raise_for_status()
src=Image.open(BytesIO(r.content))
src.load()
print("SOURCE",src.size,src.format,len(r.content))

manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
evidence=json.loads(EVIDENCE.read_text(encoding="utf-8"))

for code,box in CROPS.items():
    l,t,r,b=box
    px=(round(src.width*l),round(src.height*t),round(src.width*r),round(src.height*b))
    crop=src.crop(px)
    final=fit_canvas(crop)
    dest=OUT/f"{code.lower()}.webp"
    final.save(dest,"WEBP",quality=92,method=6)
    if dest.stat().st_size < 10000:
        raise RuntimeError(f"{code}: output too small")
    manifest["images"][code.lower()]=f"./assets/packs/legacy/{code.lower()}.webp"
    evidence["items"][code]={
      "name":NAMES[code],
      "sourcePage":SOURCE_PAGE,
      "sourceImage":SOURCE_URL,
      "sourceType":"verified-korean-multi-pack-photo",
      "storedLocally":True,
      "qualityUpgrade":True,
      "rendering":"aspect-ratio-preserved",
      "note":"Exact individual-pack crop from a verified Korean DP sealed-pack lineup; no generative reconstruction.",
    }
    print(code,px,dest.stat().st_size)

MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
EVIDENCE.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
