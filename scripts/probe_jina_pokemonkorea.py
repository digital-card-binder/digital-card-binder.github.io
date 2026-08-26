#!/usr/bin/env python3
from urllib.request import Request, urlopen
from urllib.parse import quote
from pathlib import Path

urls = [
    'https://r.jina.ai/http://pokemoncard.co.kr/cards/detail/BS2010001002',
    'https://s.jina.ai/?q=' + quote('site:pokemoncard.co.kr/cards/detail "Ken Sugimori"'),
]
lines=[]
for u in urls:
    try:
        req=Request(u,headers={'User-Agent':'Mozilla/5.0'})
        with urlopen(req,timeout=45) as r:
            body=r.read().decode('utf-8','replace')
        lines.append(f'URL={u}\nSTATUS=200\nLEN={len(body)}\nHEAD={body[:2000]}\n')
    except Exception as e:
        lines.append(f'URL={u}\nERROR={type(e).__name__}: {e}\n')
Path('data/jina-probe.txt').write_text('\n---\n'.join(lines),encoding='utf-8')
print('\n---\n'.join(lines))
