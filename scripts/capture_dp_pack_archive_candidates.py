import requests, re, html

pages={
  "bs8":"https://d.namu.moe/w/%ED%99%94%EB%A0%A4%ED%95%9C%20%EC%A0%84%EC%84%A4",
  "bs9":"https://d.namu.moe/w/%ED%98%B8%EC%88%98%EC%9D%98%20%EA%B8%B0%EC%A0%81",
  "bs10":"https://d.namu.moe/w/%EA%B3%A0%EB%8C%80%EC%9D%98%20%EC%88%98%ED%98%B8%EC%9E%90(%ED%8F%AC%EC%BC%93%EB%AA%AC%20%EC%B9%B4%EB%93%9C%20%EA%B2%8C%EC%9E%84)",
}
headers={"User-Agent":"Mozilla/5.0"}
for code,url in pages.items():
    r=requests.get(url,headers=headers,timeout=30)
    print("\nPAGE",code,r.status_code,len(r.text),r.url)
    text=html.unescape(r.text)
    for needle in ["file.namu.moe","화려한 전설.png","호수의 기적.png","고대의 수호자_포케카.png"]:
        pos=text.find(needle)
        if pos>=0:
            print("FRAGMENT",code,needle,text[max(0,pos-1200):pos+2200].replace("\n"," "))
            break
    urls=sorted(set(re.findall(r'https?://[^"\'<> ]+',text)))
    for u in urls:
        if "namu" in u and ("file" in u or "/i/" in u or "image" in u):
            print("URL",code,u[:500])
