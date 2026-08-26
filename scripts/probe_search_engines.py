#!/usr/bin/env python3
from urllib.request import Request, urlopen
from urllib.parse import quote_plus
from pathlib import Path

q=quote_plus('site:pokemoncard.co.kr/cards/detail "Ken Sugimori"')
urls=[
 f'https://www.google.com/search?q={q}&num=20',
 f'https://www.bing.com/search?q={q}&count=20',
 f'https://html.duckduckgo.com/html/?q={q}',
]
out=[]
for u in urls:
    try:
        req=Request(u,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36'})
        with urlopen(req,timeout=30) as r:
            body=r.read().decode('utf-8','replace')
        out.append(f'URL={u}\nSTATUS=200 LEN={len(body)}\nHAS_DETAIL={"pokemoncard.co.kr/cards/detail" in body}\nHEAD={body[:3000]}')
    except Exception as e:
        out.append(f'URL={u}\nERROR={type(e).__name__}: {e}')
Path('data/search-engine-probe.txt').write_text('\n\n---\n\n'.join(out),encoding='utf-8')
print('\n\n---\n\n'.join(out))
