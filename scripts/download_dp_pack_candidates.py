from pathlib import Path
import requests

OUT=Path("assets/packs/candidates")
OUT.mkdir(parents=True,exist_ok=True)
URLS={
  "bs4-ebay":"https://i.ebayimg.com/images/g/h9QAAOSwealaZTCB/s-l1200.jpg",
  "bs7-ebay":"https://i.ebayimg.com/images/g/UBoAAOSwZ3BaWk4t/s-l1200.jpg",
}
headers={"User-Agent":"Mozilla/5.0","Referer":"https://www.ebay.com/"}
for name,url in URLS.items():
    r=requests.get(url,headers=headers,timeout=30)
    print(name,r.status_code,len(r.content),r.headers.get("content-type"))
    r.raise_for_status()
    (OUT/f"{name}.jpg").write_bytes(r.content)
