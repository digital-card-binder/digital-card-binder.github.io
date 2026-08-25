#!/usr/bin/env python3
import os,re,subprocess,tempfile,json
from collections import Counter,defaultdict

CANDIDATES=["Oswaldo KATO","GOSSAN","kantaro","Saboteri","Atsushi Furusawa","Hitoshi Ariga","Naoki Saito","kawayoo"]
payload=json.load(open('data/series.json',encoding='utf-8'))
records=[]
def walk(node):
    if isinstance(node,dict):
        if isinstance(node.get('image'),str) and (node.get('name') or node.get('code')):
            records.append(node)
        for v in node.values(): walk(v)
    elif isinstance(node,list):
        for v in node: walk(v)
walk(payload)
idx=defaultdict(list)
for r in records:
    raw=str(r.get('code') or '').strip()
    m=re.match(r'^([^_]+)_0*(\d+)(?:/|$)',raw,re.I)
    if not m:
        img=str(r.get('image') or '')
        im=re.search(r'/wmimages/[^/]+/([^/]+)/[^/]*?_0*(\d+)',img,re.I)
        if im: m=im
    if m:
        idx[(m.group(1).lower(),str(int(m.group(2))))].append(r)
print('CARDLIKE',len(records),'INDEX',len(idx))

with tempfile.TemporaryDirectory() as td:
    repo=os.path.join(td,'db')
    subprocess.run(['git','clone','--depth=1','-q','https://github.com/tcgdex/cards-database.git',repo],check=True)
    base=os.path.join(repo,'data-asia')
    hits=defaultdict(list)
    for root,_,files in os.walk(base):
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
        matched=[]; unmatched=[]; ambiguous=[]
        for p in paths:
            parts=p.split(os.sep)
            if len(parts)<3: unmatched.append(p); continue
            code=parts[1]
            stem=os.path.splitext(parts[-1])[0]
            m=re.match(r'^0*(\d+)$',stem)
            if not m: unmatched.append(p); continue
            vals=idx.get((code.lower(),str(int(m.group(1)))),[])
            if len(vals)==1: matched.append((p,vals[0]))
            elif len(vals)>1: ambiguous.append((p,vals))
            else: unmatched.append(p)
        print('RESULT',artist,'ALL',len(paths),'ERAS',dict(sorted(eras.items())),'MATCH',len(matched),'AMBIG',len(ambiguous),'UNMATCH',len(unmatched))
        print('MATCH_SAMPLE',[(p,v.get('code'),v.get('name')) for p,v in matched[:5]])
        print('UNMATCH_SAMPLE',unmatched[:12])
