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
