import requests,re,html
sets={
 "BS8":"https://cardnaru.com/cards/series/pokemon-set-pkkr-1dae12cd4d023c98?lang=ko",
 "BS9":"https://cardnaru.com/cards/series/pokemon-set-pkkr-152ab7e0ab09e9c6?lang=ko",
 "BS10":"https://cardnaru.com/cards/series/pokemon-set-pkkr-7c59fcc59fbead19?lang=ko",
}
headers={"User-Agent":"Mozilla/5.0"}
for code,url in sets.items():
    r=requests.get(url,headers=headers,timeout=30)
    print("\nSET",code,r.status_code,len(r.text),r.url)
    text=html.unescape(r.text)
    for pat in [
      r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>',
      r'"image"\s*:\s*"([^"]+)"',
      r'/api/card-image\?src=([^"&]+)[^"\']*',
    ]:
      vals=re.findall(pat,text,re.I)
      print("PATTERN",pat,"COUNT",len(vals))
      for v in vals[:25]:
        if "card-image" in v or "pokemonkorea" in v or "data1." in v:
          print("CAND",code,v[:900])
    for title in ["화려한 전설","호수의 기적","고대의 수호자"]:
      p=text.find(title)
      if p>=0:
        print("FRAG",code,text[max(0,p-1500):p+4000].replace("\n"," "))
        break
