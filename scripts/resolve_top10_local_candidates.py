#!/usr/bin/env python3
from __future__ import annotations
import json, re
from collections import defaultdict
from pathlib import Path

AUDIT=Path('data/artist-top10-korean-candidate-audit.json')
SERIES=Path('data/series.json')
POKEDEX=Path('data/pokedex.json')
OUT=Path('data/artist-top10-local-resolution.json')
OFFICIAL='https://cards.image.pokemonkorea.co.kr/data/'

MANUAL_BASE={
    ('Akira Komayama','S9a',83): '아쿠스타 V',
}
TRAINER_NAMES={
    'カゲツ':'회연',
    'ジャッジマン':'심판',
}

def walk(node):
    if isinstance(node,dict):
        yield node
        for v in node.values(): yield from walk(v)
    elif isinstance(node,list):
        for v in node: yield from walk(v)

def row_name(r):
    for k in ('name','pokemonName','cardName'):
        v=str(r.get(k) or '').strip()
        if v: return v
    return ''

def norm(s):
    return re.sub(r'[^0-9a-z가-힣]+','',str(s).casefold())

def set_name(r):
    s=str(r.get('set') or '').strip()
    if s: return s
    img=str(r.get('image') or '')
    m=re.search(r'/wmimages/[^/]+/([^/]+)/',img,re.I)
    return m.group(1) if m else ''

def suffix_for(row):
    txt=' '.join(str(x) for x in row.get('names',{}).values())
    if re.search(r'\bVMAX\b|VMAX',txt,re.I): return ' VMAX'
    if re.search(r'\bVSTAR\b|VSTAR',txt,re.I): return ' VSTAR'
    if re.search(r'\bGX\b|GX',txt,re.I): return ' GX'
    if re.search(r'\bEX\b|EX',txt,re.I): return ' EX'
    if re.search(r'\bex\b|ex',txt): return ' ex'
    if re.search(r'\bV\b|V$',txt): return ' V'
    return ''

def main():
    audit=json.loads(AUDIT.read_text(encoding='utf-8'))
    pd=json.loads(POKEDEX.read_text(encoding='utf-8'))
    by_dex={int(r['number']):r['nameKo'] for r in pd.get('records',[]) if r.get('number') and r.get('nameKo')}
    local=[]
    for r in walk(json.loads(SERIES.read_text(encoding='utf-8'))):
        img=str(r.get('image') or '').strip()
        name=row_name(r)
        s=set_name(r)
        if img.startswith(OFFICIAL) and name and s:
            local.append({
                'set':s,'name':name,'rarity':str(r.get('rarity') or ''),
                'cardNumber':str(r.get('cardNumber') or r.get('number') or r.get('code') or ''),
                'image':img,'source':str(r.get('source') or '')
            })
    out={'artists':{},'totals':{'input':0,'withCandidates':0,'withoutCandidates':0}}
    for artist,adata in audit['artists'].items():
        entries=[]
        for u in adata.get('unresolved',[]):
            out['totals']['input']+=1
            key=(artist,u['set'],u['number'])
            target=MANUAL_BASE.get(key,'')
            if not target and u.get('dexId'):
                base=by_dex.get(int(u['dexId'][0]),'')
                if base:
                    target=base+suffix_for(u)
            if not target:
                ja=str(u.get('names',{}).get('ja') or '')
                target=TRAINER_NAMES.get(ja,'')
            same=[r for r in local if r['set'].casefold()==u['set'].casefold()]
            exact=[r for r in same if target and norm(r['name'])==norm(target)]
            if not exact and target:
                base=norm(re.sub(r'\s+(?:GX|EX|ex|V|VMAX|VSTAR)$','',target))
                exact=[r for r in same if base and base in norm(r['name'])]
            # keep unique images only
            ded=[]; seen=set()
            for r in exact:
                k=r['image'].split('?')[0]
                if k in seen: continue
                seen.add(k); ded.append(r)
            entries.append({**u,'targetKo':target,'candidates':ded})
            if ded: out['totals']['withCandidates']+=1
            else: out['totals']['withoutCandidates']+=1
        out['artists'][artist]=entries
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(out['totals'],ensure_ascii=False))
    for a,rows in out['artists'].items():
        print('\n'+a)
        for r in rows:
            print(r['set'],r['number'],r['targetKo'],'=>',[(c['name'],c['cardNumber'],c['rarity']) for c in r['candidates']])
if __name__=='__main__': main()
