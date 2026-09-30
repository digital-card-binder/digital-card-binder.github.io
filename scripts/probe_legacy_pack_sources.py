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
