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


from urllib.parse import quote
queries={
  "bs8":"화려한 전설 포켓몬카드 DP 팩",
  "bs9":"호수의 기적 포켓몬카드 DP 팩",
  "bs10":"고대의 수호자 포켓몬카드 DP 팩",
}
api="https://api.bunjang.co.kr/api/1/find_v2.json"
for code,q in queries.items():
    url=api+"?q="+quote(q)+"&order=score&page=0&request_id=packdex&stat_device=w&n=30&stat_category_required=1&req_ref=search&version=4"
    data=requests.get(url,headers=headers,timeout=30).json()
    saved=0
    for item in data.get("list",[]):
        name=str(item.get("name") or "")
        image=str(item.get("product_image") or "")
        if not image or "포켓몬" not in name:
            continue
        if code=="bs8" and "화려한" not in name:
            continue
        if code=="bs9" and "호수" not in name:
            continue
        if code=="bs10" and "고대" not in name:
            continue
        image=image.replace("{cnt}","1").replace("{res}","840")
        rr=requests.get(image,headers=headers,timeout=30)
        if not rr.ok or len(rr.content)<2000:
            continue
        pid=str(item.get("pid") or saved)
        (OUT/f"{code}-bunjang-{pid}.jpg").write_bytes(rr.content)
        print("candidate",code,pid,name,image)
        saved+=1
        if saved>=5:
            break
