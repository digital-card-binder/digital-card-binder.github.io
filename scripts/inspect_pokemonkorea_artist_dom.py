#!/usr/bin/env python3
import re
import requests
from bs4 import BeautifulSoup

UA={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36"}

for url in [
    "https://pokemoncard.co.kr/cards",
    "https://pokemoncard.co.kr/cards/detail/BS2024012107",
]:
    print("\nURL", url)
    r=requests.get(url,headers=UA,timeout=30)
    print("STATUS",r.status_code,"LEN",len(r.text))
    s=BeautifulSoup(r.text,"html.parser")
    print("SCRIPTS")
    for x in s.find_all("script",src=True): print(x.get("src"))
    print("INPUTS")
    for x in s.find_all(["input","select","button"]):
        print(x.name, {k:x.get(k) for k in ["name","id","class","type","value","placeholder"] if x.get(k) is not None}, "TXT=",x.get_text(" ",strip=True)[:100])
    print("DETAIL LINKS",len(s.select('a[href*="/cards/detail/"]')))
    if "/detail/" in url:
        artist=s.find(string=re.compile(r"Naoki Saito",re.I))
        if artist:
            node=artist.parent
            print("ARTIST NODE",node)
            print("PARENT",node.parent)
            print("GRANDPARENT",node.parent.parent)
        for img in s.find_all("img",src=True):
            if "cards.image.pokemonkorea.co.kr" in img.get("src",""):
                print("CARD IMG",img)
        print("TEXT SAMPLE")
        print(s.get_text("\n",strip=True)[:5000])
