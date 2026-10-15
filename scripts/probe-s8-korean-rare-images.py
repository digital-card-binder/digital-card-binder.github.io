from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from io import BytesIO
import json,hashlib,base64
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-visual-evidence/s8/korean-candidate-117-124"
assets=root/"assets/cards/s8-korean-rare"
out.mkdir(parents=True,exist_ok=True);assets.mkdir(parents=True,exist_ok=True)
numbers=[117,118,119,120,123,124]
def fetch(n):
    urls=[f"https://tcgbox.co.kr/web/product/big/S8/S8_{n}.jpg",
      f"https://tcgbox.co.kr/web/product/medium/S8/S8_{n}.jpg"]
    err=[]
    for u in urls:
      try:
        with urlopen(Request(u,headers={"User-Agent":"Mozilla/5.0","Accept":"image/avif,image/webp,image/png,image/jpeg,*/*"}),timeout=14) as r:
          data=r.read(8000000);mime=r.headers.get("content-type","")
        im=Image.open(BytesIO(data));im.load()
        if im.width<150 or im.height<190:raise ValueError(f"undersize {im.size}")
        p=assets/f"{n}.webp"
        im.convert("RGB").save(p,format="WEBP",quality=90)
        return n,dict(number=n,source=u,ownedPath=str(p.relative_to(root)),width=im.width,height=im.height,sha256=hashlib.sha256(data).hexdigest(),status="candidate_subject_to_manual_korean_print_check"),im.convert("RGB")
      except Exception as e:
        err.append(str(e)[:160])
    return n,{"number":n,"status":"not_found","errors":err},None
rs={}
with ThreadPoolExecutor(max_workers=6) as pool:
 for fut in as_completed([pool.submit(fetch,n) for n in numbers]):
   n,row,im=fut.result();rs[n]=(row,im)
sheet=Image.new("RGB",(6*230,400),(246,246,246))
d=ImageDraw.Draw(sheet)
for i,n in enumerate(numbers):
  row,im=rs[n];x=i*230
  d.text((x+8,5),f"S8 {n}/100 {row['status']}",fill=(0,0,0))
  if im:
   im.thumbnail((218,342))
   sheet.paste(im,(x+(230-im.width)//2,28))
buf=BytesIO();sheet.save(buf,format="WEBP",quality=84)
(out/"contact.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode())
(out/"candidates.json").write_text(json.dumps({"set":"s8","numbers":numbers,"available":sum(x[0]["status"]!="not_found" for x in rs.values()),"cards":[rs[n][0] for n in numbers]},ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"available":sum(x[0]["status"]!="not_found" for x in rs.values()),"cards":[rs[n][0] for n in numbers]},ensure_ascii=False))
