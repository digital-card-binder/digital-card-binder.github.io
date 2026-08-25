#!/usr/bin/env python3
import os,re,subprocess,tempfile,json,glob
from collections import Counter,defaultdict

CANDIDATES=["Oswaldo KATO","GOSSAN","kantaro","Saboteri","Atsushi Furusawa","Hitoshi Ariga","Naoki Saito","kawayoo"]
records=[]
def walk(node,src):
    if isinstance(node,dict):
        if isinstance(node.get('image'),str) and (node.get('name') or node.get('code') or node.get('cardNumber')):
            r=dict(node); r['_src']=src; records.append(r)
        for v in node.values(): walk(v,src)
    elif isinstance(node,list):
        for v in node: walk(v,src)
for path in glob.glob('data/*.json'):
    try: payload=json.load(open(path,encoding='utf-8'))
    except Exception: continue
    walk(payload,path)
idx=defaultdict(list)
for r in records:
    raw=str(r.get('code') or '').strip()
    setv=str(r.get('set') or '').strip()
    numv=str(r.get('cardNumber') or r.get('number') or '').strip()
    img=str(r.get('image') or '')
    candidates=[]
    m=re.match(r'^([^_]+)_0*(\d+)(?:/|$)',raw,re.I)
    if m: candidates.append((m.group(1),m.group(2)))
    m=re.search(r'/wmimages/[^/]+/([^/]+)/[^/]*?_?0*(\d+)(?:[_\.]|$)',img,re.I)
    if m: candidates.append((m.group(1),m.group(2)))
    m=re.search(r'(\d{1,4})',numv)
    if setv and m: candidates.append((setv,m.group(1)))
    for code,num in candidates:
        key=(code.lower(),str(int(num)))
        identity=(r.get('name',''),r.get('image',''),r.get('source',''))
        if not any((x.get('name',''),x.get('image',''),x.get('source',''))==identity for x in idx[key]): idx[key].append(r)
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
                if re.search(r'illustrator:\s*["\']'+re.escape(artist)+r'["\']',text): hits[artist].append(os.path.relpath(path,base))
    for artist in CANDIDATES:
        paths=hits[artist]; matched=[]; unmatched=[]; ambiguous=[]
        for p in paths:
            parts=p.split(os.sep)
            if len(parts)<3: unmatched.append(p); continue
            code=parts[1]; stem=os.path.splitext(parts[-1])[0]
            m=re.match(r'^0*(\d+)$',stem)
            if not m: unmatched.append(p); continue
            vals=idx.get((code.lower(),str(int(m.group(1)))),[])
            # Prefer a unique Pokemon Korea source/image identity; exact duplicates from different catalogs collapse above.
            if len(vals)==1: matched.append((p,vals[0]))
            elif len(vals)>1: ambiguous.append((p,vals))
            else: unmatched.append(p)
        eras=Counter(p.split(os.sep)[0] for p in paths)
        print('RESULT',artist,'ALL',len(paths),'ERAS',dict(sorted(eras.items())),'MATCH',len(matched),'AMBIG',len(ambiguous),'UNMATCH',len(unmatched))
        print('UNMATCH_SAMPLE',unmatched[:20])
        print('AMBIG_SAMPLE',[(p,[(v.get('_src'),v.get('name'),v.get('code'),v.get('cardNumber')) for v in vs[:3]]) for p,vs in ambiguous[:5]])
