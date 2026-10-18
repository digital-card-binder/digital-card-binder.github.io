#!/usr/bin/env python3
"""Read-only SM2K 031-062 Korean identity/own CDN and existing theme audit.
Do not repeat reviewed thematic cards or change any card, image or owned state.
"""
import base64,concurrent.futures,html,io,json,pathlib,re,urllib.parse,urllib.request
from bs4 import BeautifulSoup
from PIL import Image,ImageChops,ImageDraw,ImageStat
ROOT=pathlib.Path(__file__).resolve().parents[1]
series=json.loads((ROOT/"data/series.json").read_text(encoding="utf8"))
themes=json.loads((ROOT/"data/art-themes.json").read_text(encoding="utf8"))
groups=[x for x in series if x.get("code","").lower()=="sm2k"]
assert len(groups)==1 and len(groups[0]["cards"])==62
group=groups[0]
def fetch(url):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (DCB Korean print audit)","Cache-Control":"no-cache"})
 with urllib.request.urlopen(req,timeout=40) as response:
  return response.read(7_000_000)
def norm(v):
 return re.sub(r"\s+","",str(v).lower())
def ownurl(url):
 from urllib.parse import urlsplit
 parsed=urlsplit(url)
 if parsed.hostname=="cards.image.pokemonkorea.co.kr":
  return "https://dcb-card-images-legacy-2026.pages.dev/"+parsed.path.lstrip("/").rsplit(".",1)[0]+".webp"
 if parsed.hostname in ("static.tcgexchange.kr","tcgbox.co.kr","k-tcgpanda.com","cdn.collectory.cc"):
  canonical=parsed.scheme+"://"+parsed.netloc+parsed.path
  h=0xcbf29ce484222325
  for c in canonical:h=((h^ord(c))*0x100000001b3)&0xffffffffffffffff
  return "https://dcb-card-images-legacy-2026.pages.dev/external/"+parsed.hostname+"/"+format(h,"016x")+".webp"
 return ""
home=BeautifulSoup(fetch("https://www.dogam.app/sets").decode("utf8","replace"),"html.parser")
setlinks=[{"label":x.get_text(" ",strip=True),"href":x["href"]} for x in home.select("a[href]") if "SM2K" in x.get_text(" ",strip=True).upper() and x["href"].startswith("/sets/")]
print("SM2K_SET_LINKS",json.dumps(setlinks,ensure_ascii=False),flush=True)
assert len(setlinks)==1,"Unique Korean SM2K app page is required"
seturl="https://www.dogam.app"+setlinks[0]["href"]
soup=BeautifulSoup(fetch(seturl).decode("utf8","replace"),"html.parser")
links={}
for a in soup.select("a[href]"):
 url=a.get("href","");label=a.get_text(" ",strip=True)
 if not url.startswith(setlinks[0]["href"]+"/cards/"):continue
 m=re.search(r"(?<!\d)(\d{3})$",label)
 if m and 31<=int(m.group(1))<=62:
  links.setdefault(int(m.group(1)),[]).append({"label":label,"url":"https://www.dogam.app"+url})
print("SM2K_LINK_COUNT",json.dumps({"set":seturl,"total":len(links),"duplicates":[n for n,v in links.items() if len(v)!=1]},ensure_ascii=False),flush=True)
assert len(links)==32 and all(len(links[n])==1 for n in range(31,63))
def photo(blob):
 im=Image.open(io.BytesIO(blob));im.load()
 if im.width<250 or im.height<350:return None
 return im.convert("RGB")
def pixel(a,b):
 a=a.resize((140,195),Image.Resampling.LANCZOS);b=b.resize((140,195),Image.Resampling.LANCZOS)
 return round(sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3,2)
def inspect(n):
 card=group["cards"][n-1]
 expected="sm2k_"+format(n,"03d")
 info=links[n][0];title=re.sub(r"\s+\d{3}$","",info["label"]).strip()
 other=[]
 for g in themes["groups"]:
  if any(str(c.get("code","")).upper()==expected.upper() for c in g.get("cards",[])):
   other.append(g["code"])
 out={"number":n,"code":card["code"],"name":card["name"],"appName":title,"appPage":info["url"],"existingThemes":other,"ownedSource":ownurl(card["image"])}
 if card["code"].split("/")[0].lower()!=expected or norm(card["name"])!=norm(title):
  out["status"]="held_name_or_catalog_code";return out,None
 try:
  page=BeautifulSoup(fetch(info["url"]).decode("utf8","replace"),"html.parser")
  titleTag=page.select_one('meta[property="og:title"]')
  pageTitle=html.unescape(titleTag.get("content","")) if titleTag else ""
  og=page.select_one('meta[property="og:image"]')
  imgurl=html.unescape(og.get("content","")) if og else ""
  if "한글판" not in pageTitle or format(n,"03d") not in pageTitle or not imgurl.startswith("https://static.tcgexchange.kr/"):
   raise ValueError("App KR detail metadata not exact")
  img=photo(fetch(imgurl))
  if not img:raise ValueError("App photo not full card")
  own=photo(fetch(out["ownedSource"])) if out["ownedSource"] else None
  if not own:raise ValueError("DCB own archive unavailable")
  diff=pixel(img,own)
  out.update(status="matching_Korean_card_and_own_CDN" if diff<18 else "held_artwork_diff",
             difference=diff,sourceImage=imgurl,pictureSize=[img.width,img.height],ownSize=[own.width,own.height])
  return out,img
 except Exception as e:
  out.update(status="held_photo_unavailable",error=str(e)[:180])
  return out,None
with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
 results=list(pool.map(inspect,range(31,63)))
items=[x for x,_ in results]
for item in items:print("SM2K_CARD",json.dumps(item,ensure_ascii=False),flush=True)
counts={}
for row in items:counts[row["status"]]=counts.get(row["status"],0)+1
print("SM2K_031_062_SUMMARY",json.dumps({
 "set":seturl,"checked":len(items),"status":counts,
 "alreadyThemeAssigned":sum(bool(x["existingThemes"]) for x in items),
 "noExistingTheme":sum(not x["existingThemes"] for x in items),
 "held":[{"n":x["number"],"name":x["name"],"status":x["status"],"reason":x.get("error")} for x in items if x["status"]!="matching_Korean_card_and_own_CDN"],
 "policy":"No existing theme cards reaudited; source previews only, no changes to collection or print numbers"},ensure_ascii=False),flush=True)
W,H=235,355;sheet=Image.new("RGB",(W*5,H*7),"white");d=ImageDraw.Draw(sheet)
for i,(row,im) in enumerate(results):
 x=(i%5)*W;y=(i//5)*H
 if im:
  im.thumbnail((W-12,H-45),Image.Resampling.LANCZOS)
  sheet.paste(im,(x+(W-im.width)//2,y+5))
 d.text((x+8,y+H-33),"SM2K "+format(row["number"],"03d"),fill="black")
 d.text((x+8,y+H-17),"theme="+",".join(row["existingThemes"]),fill="black")
bio=io.BytesIO();sheet.save(bio,"JPEG",quality=72,optimize=True)
print("SM2K_031_062_SHEET_B64="+base64.b64encode(bio.getvalue()).decode("ascii"),flush=True)
