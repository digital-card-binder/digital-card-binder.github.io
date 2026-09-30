import requests,re,html
url="https://cardnaru.com/cards?game=pokemon-card-game&lang=ko&view=series"
r=requests.get(url,headers={"User-Agent":"Mozilla/5.0"},timeout=30)
print("STATUS",r.status_code,"LEN",len(r.text))
text=html.unescape(r.text)
for title in ["화려한 전설","호수의 기적","고대의 수호자"]:
    pos=text.find(title)
    print("\nTITLE",title,"POS",pos)
    if pos>=0:
        frag=text[max(0,pos-2500):pos+3500]
        print("FRAG",frag.replace("\n"," "))
        urls=re.findall(r'https?://[^"\'<> ]+',frag)
        for u in urls:
            if any(ext in u.lower() for ext in [".png",".jpg",".jpeg",".webp","image"]):
                print("IMGURL",title,u[:700])
