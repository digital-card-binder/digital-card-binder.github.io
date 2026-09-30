import re, requests, html

URLS = [
  "https://m.bunjang.co.kr/keywords/DP%ED%8C%A9",
  "https://m.bunjang.co.kr/products/431466324",
  "https://m.bunjang.co.kr/products/430449269",
  "https://m.bunjang.co.kr/products/432817025",
  "https://web.joongna.com/product/133147362",
  "https://globalbunjang.com/product/431466324",
  "https://globalbunjang.com/product/430449269",
  "https://api.bunjang.co.kr/api/1/product/431466324/detail_info.json",
  "https://api.bunjang.co.kr/api/1/product/430449269/detail_info.json",
  "https://api.bunjang.co.kr/api/1/find_v2.json?q=DP%ED%8C%A9&order=date&page=0&request_id=20260930&stat_device=w&n=100&stat_category_required=1&req_ref=search&version=4",
]
headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129 Safari/537.36"}
for url in URLS:
    print("\nURL",url)
    try:
        r=requests.get(url,headers=headers,timeout=30)
        print("STATUS",r.status_code,"LEN",len(r.content),"CTYPE",r.headers.get("content-type"))
        t=html.unescape(r.text)
        for pattern in [
            r'https?://[^"\'<> ]*media[.]bunjang[.]co[.]kr[^"\'<> ]+',
            r'https?://[^"\'<> ]*(?:joongna|jnmarket)[^"\'<> ]+\.(?:jpg|jpeg|png|webp)[^"\'<> ]*',
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        ]:
            hits=re.findall(pattern,t,re.I)
            if hits:
                print("HITS",pattern, hits[:12])
        print("TITLE", re.findall(r'<title[^>]*>(.*?)</title>',t,re.I|re.S)[:1])
        if "application/json" in (r.headers.get("content-type") or ""):
            print("JSONHEAD", t[:4000])
    except Exception as e:
        print("ERROR",repr(e))


print("\n=== BUNJANG EXACT QUERY RESULTS ===")
queries = [
  "ADV 제1탄 확장팩 포켓몬카드",
  "모험의 시작 포켓몬카드 DP",
  "불꽃 튀는 대결 포켓몬카드 DP",
  "시공의 격돌 포켓몬카드 DP",
  "또 다른 세계 포켓몬카드 DP",
  "7개의 신비 포켓몬카드 DP",
  "암흑의 초승달 포켓몬카드 DP",
  "보이지 않는 힘 포켓몬카드 DP",
  "화려한 전설 포켓몬카드 DP",
  "호수의 기적 포켓몬카드 DP",
  "고대의 수호자 포켓몬카드 DP",
]
from urllib.parse import quote
for q in queries:
    url = "https://api.bunjang.co.kr/api/1/find_v2.json?q=" + quote(q) + "&order=score&page=0&request_id=20260930&stat_device=w&n=40&stat_category_required=1&req_ref=search&version=4"
    try:
        r=requests.get(url,headers=headers,timeout=30)
        data=r.json()
        print("\nQUERY",q,"status",r.status_code,"count",len(data.get("list",[])))
        for item in data.get("list",[])[:12]:
            print("ITEM",item.get("pid"),"|",item.get("name"),"|",item.get("product_image"))
    except Exception as e:
        print("QUERYERROR",q,repr(e))


print("\n=== BUNJANG MISSING DP VARIANTS ===")
queries2 = [
  "DP 4탄 고대팩", "또 다른 세계 고대팩", "또다른세계 포켓몬",
  "DP 7탄 고대팩", "보이지 않는 힘 고대팩", "보이지않는힘 포켓몬",
  "DP 8탄 고대팩", "화려한 전설 고대팩", "화려한전설 포켓몬",
  "DP 9탄 고대팩", "호수의 기적 고대팩", "호수의기적 포켓몬",
  "DP 10탄 고대팩", "고대의 수호자 고대팩", "고대의수호자 포켓몬",
]
for q in queries2:
    url = "https://api.bunjang.co.kr/api/1/find_v2.json?q=" + quote(q) + "&order=score&page=0&request_id=20260930b&stat_device=w&n=30&stat_category_required=1&req_ref=search&version=4"
    try:
        data=requests.get(url,headers=headers,timeout=30).json()
        print("\nQUERY2",q,"count",len(data.get("list",[])))
        for item in data.get("list",[])[:8]:
            print("ITEM2",item.get("pid"),"|",item.get("name"),"|",item.get("product_image"))
    except Exception as e:
        print("QUERY2ERROR",q,repr(e))


print("\n=== CORE API PRODUCT DETAIL ===")
for pid in ["431466324","430449269","432817025","411177289","411177637","411177951","422715439"]:
    url=f"https://core-api.bunjang.co.kr/api/1/product/{pid}/detail_info.json?stat_uid=9056251&version=2"
    try:
        r=requests.get(url,headers=headers,timeout=30)
        print("\nCORE",pid,"status",r.status_code,"len",len(r.content),r.headers.get("content-type"))
        if r.ok:
            t=html.unescape(r.text)
            print("COREHEAD",t[:2500])
    except Exception as e:
        print("COREERROR",pid,repr(e))


print("\n=== BING IMAGE CACHE CANDIDATES ===")
import json as _json
for q in [
  '"또 다른 세계" 포켓몬 카드 팩',
  '"보이지 않는 힘" 포켓몬 카드 팩',
  '"화려한 전설" 포켓몬 카드 팩',
  '"호수의 기적" 포켓몬 카드 팩',
  '"고대의 수호자" 포켓몬 카드 팩',
  '"제1탄 확장팩" 포켓몬 ADV 한국',
]:
    url="https://www.bing.com/images/search?q="+quote(q)+"&form=HDRSC2"
    try:
        rr=requests.get(url,headers=headers,timeout=30)
        print("\nBING",q,"status",rr.status_code,"len",len(rr.content))
        raw=rr.text
        count=0
        for m in re.findall(r' m="({[^"]*(?:&quot;|[^"])*})"', raw):
            try:
                obj=_json.loads(html.unescape(m))
            except Exception:
                continue
            p=str(obj.get("purl") or "")
            mu=str(obj.get("murl") or "")
            tu=str(obj.get("turl") or "")
            if "namu" in p or "bunjang" in p or "joongna" in p or "ebay" in p or count<3:
                print("BINGITEM",p,"|",mu,"|",tu)
                count+=1
                if count>=12: break
    except Exception as e:
        print("BINGERROR",q,repr(e))


print("\n=== BING RAW SAMPLE ===")
q='"또 다른 세계" 포켓몬 카드 팩'
rr=requests.get("https://www.bing.com/images/search?q="+quote(q)+"&form=HDRSC2",headers=headers,timeout=30)
raw=rr.text
for needle in ["murl", "&quot;murl&quot;", "class=\"iusc\""]:
    ii=raw.find(needle)
    print("NEEDLE",needle,"INDEX",ii)
    if ii>=0: print("SAMPLE",raw[max(0,ii-500):ii+1800])
