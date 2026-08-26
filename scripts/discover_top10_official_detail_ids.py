#!/usr/bin/env python3
from __future__ import annotations
import html
import json
import re
import time
from pathlib import Path
from urllib.parse import quote_plus, unquote, urlparse, parse_qs
from urllib.request import Request, urlopen

ARTISTS=["nagimiso","Ken Sugimori","Kouki Saitou","Akira Komayama","Masakazu Fukuda","Megumi Mizutani","Anesaki Dynamic","Hideki Ishikawa","Shin Nagasawa","takuyoa"]
QUALIFIERS=["", "DP", "BW", "XY", "프로모", "구축덱"]
OUT=Path('data/artist-top10-official-detail-discovery.json')
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36'
DETAIL_RE=re.compile(r'https?://pokemoncard\.co\.kr/cards/detail/([A-Za-z0-9_-]+)',re.I)
BARE_RE=re.compile(r'pokemoncard\.co\.kr/cards/detail/([A-Za-z0-9_-]+)',re.I)

def fetch(url):
    req=Request(url,headers={'User-Agent':UA,'Accept-Language':'ko-KR,ko;q=0.9,en;q=0.5'})
    with urlopen(req,timeout=35) as r:
        return r.read().decode('utf-8','replace')

def extract(text):
    text=html.unescape(text)
    candidates=[text, unquote(text), unquote(unquote(text))]
    ids=set()
    for t in candidates:
        ids.update(m.group(1) for m in DETAIL_RE.finditer(t))
        ids.update(m.group(1) for m in BARE_RE.finditer(t))
    return sorted(ids)

def search_urls(query):
    q=quote_plus(query)
    return [
        ('google',f'https://www.google.com/search?q={q}&num=100&filter=0'),
        ('bing',f'https://www.bing.com/search?q={q}&count=50'),
        ('ddg',f'https://html.duckduckgo.com/html/?q={q}'),
    ]

def main():
    report={'artists':{},'totals':{'uniqueDetailIds':0,'requests':0,'failed':0}}
    for artist in ARTISTS:
        found={}
        query_reports=[]
        for qual in QUALIFIERS:
            q=f'site:pokemoncard.co.kr/cards/detail "{artist}"'
            if qual:
                q += f' {qual}'
            qr={'query':q,'engines':{}}
            for engine,url in search_urls(q):
                report['totals']['requests']+=1
                try:
                    body=fetch(url)
                    ids=extract(body)
                    qr['engines'][engine]={'count':len(ids),'ids':ids}
                    for cid in ids:
                        found.setdefault(cid,[]).append({'engine':engine,'query':q})
                except Exception as e:
                    report['totals']['failed']+=1
                    qr['engines'][engine]={'error':f'{type(e).__name__}: {e}'}
                time.sleep(0.25)
            query_reports.append(qr)
        report['artists'][artist]={'count':len(found),'detailIds':sorted(found),'evidence':found,'queries':query_reports}
        report['totals']['uniqueDetailIds']+=len(found)
        print(artist,len(found))
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(report['totals'])
if __name__=='__main__': main()
