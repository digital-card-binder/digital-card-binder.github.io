import requests
from urllib.parse import quote

queries=[
  "호수의 기적","호수의기적","DP9 포켓몬","DP 9탄 포켓몬","포켓몬 제9탄","제9탄 호수",
  "화려한 전설","화려한전설","DP8 포켓몬","DP 8탄 포켓몬","포켓몬 제8탄",
  "고대의 수호자","고대의수호자","DP10 포켓몬","DP 10탄 포켓몬","포켓몬 제10탄"
]
headers={"User-Agent":"Mozilla/5.0"}
api="https://api.bunjang.co.kr/api/1/find_v2.json"
for q in queries:
    url=api+"?q="+quote(q)+"&order=score&page=0&request_id=packdex4&stat_device=w&n=100&stat_category_required=1&req_ref=search&version=4"
    r=requests.get(url,headers=headers,timeout=30)
    print("\nQUERY",q,"STATUS",r.status_code)
    data=r.json()
    for item in data.get("list",[])[:100]:
        print("ITEM",item.get("pid"),"|",item.get("name"),"|",item.get("product_image"))
