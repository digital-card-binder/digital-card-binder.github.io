#!/usr/bin/env python3
import re
import requests
from urllib.parse import urljoin

UA={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36"}

for url in ["https://icu.gg/card/list", "https://pokemon.cardmon.com"]:
    print("\nURL",url)
    try:
        r=requests.get(url,headers=UA,timeout=30)
        print("STATUS",r.status_code,"LEN",len(r.text),"FINAL",r.url)
        print(r.text[:1000].replace("\n"," "))
        scripts=re.findall(r'<script[^>]+src=["\']([^"\']+)',r.text,re.I)
        print("SCRIPTS",scripts)
        for src in scripts[-8:]:
            jsurl=urljoin(r.url,src)
            try:
                j=requests.get(jsurl,headers=UA,timeout=30)
                print("JS",j.status_code,len(j.text),jsurl)
                for pat in [r'https?://[^"\'\s]+',r'/api/[^"\'\s]+',r'axios[^;]{0,300}',r'illustrator[^,;]{0,200}',r'artist[^,;]{0,200}']:
                    hits=re.findall(pat,j.text,re.I)
                    if hits: print("PAT",pat,"HITS",hits[:20])
            except Exception as e: print("JSERR",jsurl,e)
    except Exception as e: print("ERR",e)
