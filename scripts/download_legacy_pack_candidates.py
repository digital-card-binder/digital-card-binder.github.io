from pathlib import Path
import requests

OUT=Path("assets/packs/candidates")
OUT.mkdir(parents=True,exist_ok=True)
URLS={
"adv1":"https://media.bunjang.co.kr/product/234574785_1_1768874568_w840.jpg",
"bs1":"https://media.bunjang.co.kr/product/411176949_1_1780114709_w840.jpg",
"bs2":"https://media.bunjang.co.kr/product/411177289_1_1780114780_w840.jpg",
"bs3":"https://media.bunjang.co.kr/product/411177637_1_1780114862_w840.jpg",
"bs5":"https://media.bunjang.co.kr/product/411177951_1_1780114927_w840.jpg",
"bs6":"https://media.bunjang.co.kr/product/422715439_1_1785809153_w840.jpg",
"multi":"https://media.bunjang.co.kr/product/396838239_1_1779587841_w840.jpg",
"wanted":"https://media.bunjang.co.kr/product/430162505_1_1790050194_w840.jpg",
"bs10-wanted":"https://media.bunjang.co.kr/product/432524947_1_1789638894_w840.jpg",
}
headers={"User-Agent":"Mozilla/5.0","Referer":"https://m.bunjang.co.kr/"}
for name,url in URLS.items():
    r=requests.get(url,headers=headers,timeout=30)
    print(name,r.status_code,len(r.content),r.headers.get("content-type"))
    r.raise_for_status()
    (OUT/f"{name}.jpg").write_bytes(r.content)
