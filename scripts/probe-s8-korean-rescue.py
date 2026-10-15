from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor,as_completed
from PIL import Image,ImageDraw
from io import BytesIO
import html,re,json,hashlib,base64
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-visual-evidence/s8/korean-rescued-sources"
assets=root/"assets/cards/s8-korean-rare"
out.mkdir(parents=True,exist_ok=True);assets.mkdir(parents=True,exist_ok=True)
urls={
117:["https://ai.esmplus.com/asum0726/MSET/pulsmung_vmax_hr.jpg"],
119:["https://image.coupangcdn.com/image/vendor_inventory/5603/ec9574825add7ad4b89c71bf2a70df65e6e85490e4f69f46d0c27c86bf3b.png"],
120:["https://media.bunjang.co.kr/product/437611641_1_1791209238_w360.jpg"],
123:[]}
def fetch(url):
 with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0","Accept":"image/*,*/*"}),timeout=24) as r:content=r.read(12000000)
 im=Image.open(BytesIO(content));im.load()
 if im.width<190 or im.height<270:raise ValueError("too-small source image")
 return im.convert("RGB"),hashlib.sha256(content).hexdigest()
try:
 with urlopen(Request("https://web.joongna.com/product/82423214",headers={"User-Agent":"Mozilla/5.0"}),timeout=25) as r:
   page=html.unescape(r.read(9000000).decode("utf-8","ignore"))
 matches=re.findall(r"""https?:(?:\\/\\/|//)[^"' <>\s]+""",page)
 matches+=[u.replace("\\/","/") for u in re.findall(r"""https?:\\/\\/[^"' <>\s]+""",page)]
 candidates=[u.rstrip("',}]") for u in matches if
   ("joongna" in u.lower() or "joonggonara" in u.lower()) and
   any(x in u.lower() for x in [".jpg",".jpeg",".png",".webp"])]
 # There is no reason to trust arbitrary product thumbnails; retain for explicit visual validation.
 candidates=list(dict.fromkeys(candidates))[:35]
 print("JOONGNA_PRODUCT_IMAGE_URLS",len(candidates),candidates[:18])
 urls[123].extend(candidates)
except Exception as e:print("JOONGNA_HTML_ERROR",str(e)[:200])
saved=[]
for n in [117,119,120,123]:
 errs=[]
 for u in urls[n]:
  try:
   im,sha=fetch(u)
   # Preserve the entire source picture for image review; do not crop blindly.
   path=assets/f"{n}.webp"
   im.save(path,"WEBP",quality=92,method=6)
   saved.append({"number":n,"source":u,"sha256":sha,"originalSize":[im.width,im.height],
      "ownedPath":str(path.relative_to(root)),"status":"candidate_requires_human_korean_print_verification"})
   break
  except Exception as e:errs.append(str(e)[:90])
 if not any(x["number"]==n for x in saved):saved.append({"number":n,"status":"not_found","attempts":len(urls[n]),"errors":errs[:4]})
s=Image.new("RGB",(4*286,430),(237,237,237));d=ImageDraw.Draw(s)
for i,row in enumerate(saved):
 x=286*i;n=row["number"]
 d.text((x+8,5),f"Korean S8 {n}/100, {row['status'][:15]}",fill=(0,0,0))
 if "ownedPath" in row:
  im=Image.open(root/row["ownedPath"]).convert("RGB")
  im.thumbnail((278,390))
  s.paste(im,(x+(286-im.width)//2,27))
b=BytesIO();s.save(b,"WEBP",quality=82)
(out/"contact.webp.b64").write_text(base64.b64encode(b.getvalue()).decode())
(out/"sources.json").write_text(json.dumps({"set":"s8","candidates":saved},ensure_ascii=False,indent=2)+"\n")
print(json.dumps(saved,ensure_ascii=False))
