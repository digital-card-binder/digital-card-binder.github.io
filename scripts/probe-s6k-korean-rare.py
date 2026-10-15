#!/usr/bin/env python3
"""Read-only S6K high-rarity Korean photo candidate collection.
Never trust seller title, language field, or eBay product metadata as printed-edition verification.
Writes evidence and contact sheet only, never updates catalog or marks cards verified.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlsplit
from io import BytesIO
from PIL import Image, ImageOps, ImageDraw
import hashlib, html, json, re, base64, time
root=Path(__file__).resolve().parents[1]
out=root/"data/audits/theme-visual-evidence/s6K/korean-candidates"
out.mkdir(parents=True,exist_ok=True)
seeds=[
(84,"세레비 VMAX",["https://www.ebay.com/itm/117282500302","https://m.bunjang.co.kr/products/435482104"]),
(85,"흑마 버드렉스 VMAX",["https://www.ebay.com/itm/286024346488","https://m.bunjang.co.kr/products/431443137"]),
(86,"흑마 버드렉스 VMAX",["https://www.ebay.com/itm/166273170223","https://www.ebay.com/itm/236643404499"]),
(87,"메타그로스 VMAX",["https://www.ebay.com/itm/407012646860"]),
(88,"국화",["https://www.ebay.com/itm/168470593177"]),
(89,"니아",["https://www.ebay.com/itm/157997410169"]),
(90,"즈미",["https://www.ebay.com/itm/286017694395"]),
(91,"카틀레야",["https://www.ebay.com/itm/198095996877"]),
(92,"붐볼",["https://www.ebay.com/itm/407012646860"]),
(93,"메아리호른",["https://www.ebay.com/itm/286020325996","https://www.ebay.com/itm/287293103698"]),
(94,"안개의 수정",[]),
(95,"기본 초 에너지",["https://www.ebay.com/itm/166457054412","https://www.ebay.com/itm/298283137311"])
]
def get(url,limit=6000000,timeout=19):
    if urlsplit(url).scheme!="https": raise ValueError("No insecure URL")
    req=Request(url,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36","Accept-Language":"en-US,en;q=0.8"})
    with urlopen(req,timeout=timeout) as res:
        buf=res.read(limit+1)
        if len(buf)>limit:raise ValueError("Too large")
        return buf
def collect_urls(page):
    raw=html.unescape(page).replace("\\/","/").replace("\\u002F","/").replace("\\u0026","&")
    links=re.findall(r'https?://(?:i\.ebayimg\.com/images/g|[^"\s<>]+?\.bunjang\.co\.kr/[^"\s<>]+)[^"<>\s\\]+',raw)
    meta=re.findall(r'<meta[^>]*(?:og:image|twitter:image)[^>]*>',raw,re.I)
    for tag in meta:
        m=re.search(r'content=["\x27]([^"\x27]+)',tag,re.I)
        if m:links.insert(0,html.unescape(m.group(1)))
    urls=[];seen=set()
    for rawurl in links:
        u=rawurl.rstrip("',;\\")
        if not u.startswith("https://"):continue
        if "i.ebayimg.com/images/g/" in u:
            m=re.search(r'https://i\.ebayimg\.com/images/g/([A-Za-z0-9~_-]+)/',u)
            if not m: continue
            u="https://i.ebayimg.com/images/g/"+m.group(1)+"/s-l1600.jpg"
        if not (u.startswith("https://i.ebayimg.com/images/g/") or (urlsplit(u).hostname=="media.bunjang.co.kr" and "/product/" in urlsplit(u).path)):continue
        if u in seen: continue
        seen.add(u);urls.append(u)
    return urls[:12]
directCandidates={
 84:["https://media.bunjang.co.kr/product/180251932_1_1645785721_w1200.jpg","https://media.bunjang.co.kr/product/180251932_1_1645785721_w500.jpg"],
 86:["https://media.bunjang.co.kr/product/250071997_1_1706006498_w1200.jpg"]
}
rows=[];canvas=Image.new("RGB",(4*304,3*470),(245,245,245))
pen=ImageDraw.Draw(canvas)
for i,(num,name,listings) in enumerate(seeds):
    x=(i%4)*304;y=(i//4)*470
    pen.text((x+6,y+4),f"S6K {num:03d} candidate / not verified",fill=(12,12,12))
    result={"number":num,"name":name,"set":"s6K","code":f"s6k_{num:03d}/070","status":"no_source_confirmed","sourceAttempts":[]}
    found=None
    for url in directCandidates.get(num,[]):
        attempt={"directPhoto":url}
        try:
            blob=get(url,limit=4500000,timeout=17)
            pic=Image.open(BytesIO(blob));pic.load()
            if min(pic.width,pic.height)<250:raise ValueError("Not a card photo")
            attempt.update(status="decoded",imageSize=[pic.width,pic.height])
            found=(pic.convert("RGB"),url,("https://globalbunjang.com/product/250071997" if num==86 else "https://m.bunjang.co.kr/products/180251932"),blob)
        except Exception as err:
            attempt["error"]=str(err)[:190]
        result["sourceAttempts"].append(attempt)
        if found:break
    for page in ([] if found else listings):
        entry={"listing":page}
        try:
            payload=get(page,limit=2800000)
            raw=payload.decode("utf-8",errors="replace")
            entry["pageBytes"]=len(payload)
            title=re.search(r'<title[^>]*>(.*?)</title',raw,re.I|re.S)
            entry["title"]=html.unescape(re.sub(r'\s+',' ',title.group(1)).strip())[:190] if title else ""
            urls=collect_urls(raw)
            entry["imageCandidateCount"]=len(urls)
            entry["candidateUrls"]=urls[:6]
            for url in urls[:6]:
                try:
                    blob=get(url,limit=4500000,timeout=13)
                    pic=Image.open(BytesIO(blob));pic.load()
                    if pic.width<250 or pic.height<300:continue
                    entry.update(firstDecodedImage=url,firstImageSize=[pic.width,pic.height],sha256=hashlib.sha256(blob).hexdigest())
                    if found is None:found=(pic.convert("RGB"),url,page,blob)
                    break
                except Exception as err:
                    entry.setdefault("failedImages",[]).append(str(err)[:100])
        except Exception as err:
            entry["error"]=str(err)[:200]
        result["sourceAttempts"].append(entry)
        if found:break
    if found:
        pic,url,page,blob=found
        thumb=ImageOps.exif_transpose(pic);thumb.thumbnail((292,415))
        canvas.paste(thumb,(x+(304-thumb.width)//2,y+25))
        proof=BytesIO();ImageOps.exif_transpose(pic).save(proof,"WEBP",quality=93,method=6)
        (out/f"{num:03d}-candidate.webp.b64").write_text(base64.b64encode(proof.getvalue()).decode("ascii"),encoding="ascii")
        result.update(status="photo_collected_requires_Korean_title_and_number_visual_review",
                      candidateImage=url,listing=page,sha256=hashlib.sha256(blob).hexdigest(),
                      dimensions=[pic.width,pic.height])
    else:pen.text((x+20,y+190),"NO IMAGE VERIFIED",fill=(15,15,15))
    rows.append(result)
buf=BytesIO();canvas.save(buf,"WEBP",quality=84)
(out/"s6k-12-contact.webp.b64").write_text(base64.b64encode(buf.getvalue()).decode(),encoding="ascii")
(out/"candidate-index.json").write_text(json.dumps({"schemaVersion":1,"set":"s6K","reviewedNumbers":list(range(84,96)),
    "status":"seller-photo-candidate-only_not_Korean_print_verified",
    "collected":sum(x["status"].startswith("photo_collected") for x in rows),
    "cards":rows},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"collected":[x["number"] for x in rows if x.get("candidateImage")],
 "missing":[x["number"] for x in rows if not x.get("candidateImage")]},ensure_ascii=False))
