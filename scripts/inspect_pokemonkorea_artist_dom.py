#!/usr/bin/env python3
import os,re,subprocess,tempfile,json
from collections import Counter,defaultdict

CANDIDATES=["Hitoshi Ariga","Oswaldo KATO","GOSSAN","kantaro","rika","Saboteri","Atsushi Furusawa","Naoki Saito","kawayoo"]
payload=json.load(open('data/series.json',encoding='utf-8'))
print('SERIES TOP',type(payload).__name__, list(payload.keys()) if isinstance(payload,dict) else len(payload))
if isinstance(payload,dict):
    for k,v in payload.items():
        print('TOPKEY',k,'TYPE',type(v).__name__,'SAMPLE',str(v)[:500])
        break

# collect likely card records recursively
records=[]
def walk(node,ctx=None):
    if isinstance(node,dict):
        if isinstance(node.get('image'),str) and (node.get('name') or node.get('cardNumber')):
            records.append(node)
        for v in node.values(): walk(v,ctx)
    elif isinstance(node,list):
        for v in node: walk(v,ctx)
walk(payload)
print('CARDLIKE RECORDS',len(records))
print('FIRST RECORDS',records[:3])

# index on set/code and leading card number from cardNumber or image filename
idx=defaultdict(list)
for r in records:
    code=str(r.get('set') or r.get('code') or r.get('series') or '').strip()
    num=str(r.get('cardNumber') or r.get('number') or '').strip()
    img=str(r.get('image') or '')
    if not code:
        m=re.search(r'/wmimages/[^/]+/([^/]+)/',img,re.I)
        if m: code=m.group(1)
    if not num:
        m=re.search(r'[_/]([0-9]{1,4})(?:[_\.])',img)
        if m: num=m.group(1)
    m=re.search(r'(\d{1,4})',num)
    if code and m:
        idx[(code.lower(),str(int(m.group(1))))].append(r)

with tempfile.TemporaryDirectory() as td:
    repo=os.path.join(td,'db')
    subprocess.run(['git','clone','--depth=1','-q','https://github.com/tcgdex/cards-database.git',repo],check=True)
    base=os.path.join(repo,'data-asia')
    hits=defaultdict(list)
    for root,_,files in os.walk(base):
        era=os.path.relpath(root,base).split(os.sep)[0]
        for fn in files:
            if not fn.endswith('.ts'): continue
            path=os.path.join(root,fn)
            text=open(path,encoding='utf-8',errors='ignore').read()
            for artist in CANDIDATES:
                if re.search(r'illustrator:\s*["\']'+re.escape(artist)+r'["\']',text):
                    hits[artist].append(os.path.relpath(path,base))
    for artist in CANDIDATES:
        paths=hits[artist]
        eras=Counter(p.split(os.sep)[0] for p in paths)
        modern=[p for p in paths if p.split(os.sep)[0] in {'SM','S','SV','M'}]
        matched=[]; unmatched=[]
        for p in modern:
            parts=p.split(os.sep); code=parts[1] if len(parts)>2 else ''
            stem=os.path.splitext(parts[-1])[0]
            m=re.match(r'0*(\d+)$',stem)
            if not m:
                unmatched.append(p); continue
            key=(code.lower(),str(int(m.group(1))))
            if idx.get(key): matched.append((p,len(idx[key])))
            else: unmatched.append(p)
        print('RESULT',artist,'ALL',len(paths),'ERAS',dict(sorted(eras.items())),'MODERN',len(modern),'MATCH',len(matched),'UNMATCH',len(unmatched))
        print('UNMATCH_SAMPLE',unmatched[:20])
