#!/usr/bin/env python3
from urllib.request import Request,urlopen
from pathlib import Path
urls=[
 'https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_291.png',
 'https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV4a/SV4a_335.png',
 'https://cards.image.pokemonkorea.co.kr/data/wmimages/DP/BS2/bs2_kr_26.jpg',
 'https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S8/S8_033.png',
]
out=[]
for u in urls:
    try:
        req=Request(u,headers={'User-Agent':'Mozilla/5.0','Range':'bytes=0-63'})
        with urlopen(req,timeout=30) as r:
            data=r.read(64)
            out.append(f'{u}\t{r.status}\t{r.headers.get("Content-Type")}\t{r.headers.get("Content-Length")}\t{data[:8].hex()}')
    except Exception as e:
        out.append(f'{u}\tERROR\t{type(e).__name__}: {e}')
Path('data/pokemonkorea-cdn-probe.txt').write_text('\n'.join(out)+'\n',encoding='utf-8')
print('\n'.join(out))
