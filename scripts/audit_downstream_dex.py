#!/usr/bin/env python3
"""새 시리즈 추가 후 도감별 누락 후보를 점검하는 읽기 전용 스크립트.

아무 파일도 수정하지 않는다. 사용: python3 scripts/audit_downstream_dex.py [--strict]
--strict: AR/포켓몬 컬렉션/작가 누락이 있으면 종료코드 1.
art-themes 0장은 눈으로 검수하는 도감이라 참고용으로만 표시한다.
"""
import sys
import json,re,os
from collections import defaultdict,Counter
L=lambda f:json.load(open(f'data/{f}.json'))
series=L('series'); cat=L('pokemon-search-index')
packs=open('packs.js',encoding='utf-8').read()
packcodes={m.lower() for m in re.findall(r'\["[A-Za-z]+","[^"]*","([^"]+)",[01]\]',packs)}
assets={f.rsplit('.',1)[0].lower() for f in os.listdir('assets/packs') if '.' in f}
def lst(d,*keys):
    if isinstance(d,list):return d
    for k in keys:
        if k in d:return d[k]
    return []
pc=lst(L('pokemon-collections'),'groups','collections')+lst(L('pokemon-collections-21-40'),'groups','collections')
pcset=Counter()
for g in pc:
    for c in g.get('cards',[]):
        pcset[c['meta'].split(' · ')[-1].lower().replace('+','plus')]+=1
ar=lst(L('ar'),'groups')+lst(L('ar-supplement'),'groups')
arset={g['code'].lower():len(g['cards']) for g in ar}
art=L('artists');artset=Counter(c['set'].lower().replace('+','plus') for a in art['artists'] for c in a['cards'])
th=L('art-themes');thset=Counter()
def walk(o):
    if isinstance(o,dict):
        if 'code' in o and isinstance(o['code'],str) and '_' in o['code'] and ('image' in o or 'name' in o): yield o
        for v in o.values(): yield from walk(v)
    elif isinstance(o,list):
        for v in o: yield from walk(v)
seen=set()
for c in walk(th['groups']):
    k=c['code'].lower()
    if k in seen: continue
    seen.add(k);thset[k.split('_')[0]]+=1
fo=L('fossil');foset=Counter()
for g in lst(fo,'groups','sets'):
    foset[g['set'].lower()]+=len(g['cards'])
tp=L('trainer-pokemon');tpset=Counter()
for g in tp['groups']:
    for c in g['cards']: tpset[c['set'].lower()]+=1


ser_codes=[(g['code'],len(g['cards']),g.get('era')) for g in series]
groups={g[0].lower():g for g in cat['groups']}
pcnames={}
for g in pc: pcnames[g['name']]=g
# per-set expected
rows=[]
modern=[(c,n,e) for c,n,e in ser_codes if e in('S','SV','M','SM')]
gap=defaultdict(dict)
for code,n,era in modern:
    c=code.lower();g=groups.get(c);c=c.replace('+','plus')
    # packs
    if not g: gap[code]['catalog']='카탈로그 그룹 없음';continue
    entries=g[4]
    # AR
    ars=[e for e in entries if e[9]=='AR']
    if len(ars)!=arset.get(c,0) and (ars or arset.get(c)): gap[code]['ar']=f'카탈로그 AR {len(ars)} / AR도감 {arset.get(c,0)}'
    # pokemon collections: exact name matches
    have={ (cc['name'],cc['meta'].split(' · ')[0]) for gg in pc for cc in gg['cards'] if cc['meta'].split(' · ')[-1].lower().replace('+','plus')==c}
    expect=[e for e in entries if e[1] in pcnames]
    if pcset.get(c,0)<len(expect): gap[code]['pokemon-collections']=f'이름 일치 {len(expect)} / 수록 {pcset.get(c,0)}'
    # artists
    cred=[e for e in entries if e[10]]
    if cred and artset.get(c,0)==0: gap[code]['artists']=f'작가표기 카드 {len(cred)}장인데 작가도감 0'
    if era in('S','SV','M') and thset.get(c,0)==0: gap[code]['art-themes']='아트테마 0장(미검토 가능)'


hard={c:{k:v for k,v in d.items() if k!='art-themes'} for c,d in gap.items()}
hard={c:d for c,d in hard.items() if d}
soft=[c for c,d in gap.items() if 'art-themes' in d]
print(f"점검 세트 {len(modern)}개 / 누락 후보 세트 {len(hard)}개")
for c,d in hard.items():
    print(" -",c,d)
print("아트테마 0장(참고):",", ".join(soft) or "없음")
sys.exit(1 if hard and "--strict" in sys.argv else 0)
