#!/usr/bin/env python3
import os,re,subprocess,tempfile,json,glob
from collections import defaultdict

CANDIDATES=["Oswaldo KATO","GOSSAN","kantaro","Saboteri","Atsushi Furusawa","Hitoshi Ariga","Naoki Saito","kawayoo","Mitsuhiro Arita"]
records=[]
def walk(node,src):
    if isinstance(node,dict):
        if isinstance(node.get('image'),str) and (node.get('name') or node.get('code') or node.get('cardNumber')):
            r=dict(node); r['_src']=src; records.append(r)
        for v in node.values(): walk(v,src)
    elif isinstance(node,list):
        for v in node: walk(v,src)
for path in glob.glob('data/*.json'):
    try: walk(json.load(open(path,encoding='utf-8')),path)
    except Exception: pass
idx=defaultdict(list)
for r in records:
    raw=str(r.get('code') or '').strip(); setv=str(r.get('set') or '').strip(); numv=str(r.get('cardNumber') or '').strip(); img=str(r.get('image') or '')
    pairs=[]
    m=re.match(r'^([^_]+)_0*(\d+)(?:/|$)',raw,re.I)
    if m: pairs.append((m.group(1),m.group(2)))
    im=re.search(r'/wmimages/[^/]+/([^/]+)/([^/?#]+)',img,re.I)
    if im:
        directory,filename=im.groups()
        nm=re.search(r'_0*(\d{1,4})(?:[_\.]|$)',filename,re.I)
        if nm: pairs.append((directory,nm.group(1)))
    m=re.search(r'(\d{1,4})',numv)
    if setv and m: pairs.append((setv,m.group(1)))
    for code,num in pairs:
        key=(code.lower(),str(int(num)))
        ident=(r.get('name',''),r.get('image',''),r.get('source',''))
        if not any((x.get('name',''),x.get('image',''),x.get('source',''))==ident for x in idx[key]): idx[key].append(r)

with tempfile.TemporaryDirectory() as td:
    repo=os.path.join(td,'db'); subprocess.run(['git','clone','--depth=1','-q','https://github.com/tcgdex/cards-database.git',repo],check=True)
    base=os.path.join(repo,'data-asia')
    korean_sets=set()
    for era in os.listdir(base):
        ep=os.path.join(base,era)
        if not os.path.isdir(ep): continue
        for fn in os.listdir(ep):
            if not fn.endswith('.ts'): continue
            txt=open(os.path.join(ep,fn),encoding='utf-8',errors='ignore').read()
            if re.search(r'\bko\s*:',txt) or re.search(r'["\']ko["\']\s*:',txt): korean_sets.add((era,fn[:-3]))
    print('KOREAN SETS',len(korean_sets),sorted(korean_sets)[:30])
    hits=defaultdict(list)
    for root,_,files in os.walk(base):
        for fn in files:
            if not fn.endswith('.ts'): continue
            path=os.path.join(root,fn); txt=open(path,encoding='utf-8',errors='ignore').read()
            for artist in CANDIDATES:
                if re.search(r'illustrator:\s*["\']'+re.escape(artist)+r'["\']',txt): hits[artist].append(os.path.relpath(path,base))
    for artist in CANDIDATES:
        relevant=[]; matched=[]; unresolved=[]
        for p in hits[artist]:
            parts=p.split(os.sep)
            if len(parts)<3: continue
            era,setcode=parts[0],parts[1]; stem=os.path.splitext(parts[-1])[0]
            m=re.match(r'^0*(\d+)$',stem)
            vals=[] if not m else idx.get((setcode.lower(),str(int(m.group(1)))),[])
            proven=bool(vals) or (era,setcode) in korean_sets
            if not proven: continue
            relevant.append(p)
            if vals: matched.append((p,vals))
            else: unresolved.append(p)
        print('KOREA_RESULT',artist,'RELEVANT',len(relevant),'MATCHED',len(matched),'UNRESOLVED',len(unresolved))
        print('UNRESOLVED_SAMPLE',unresolved[:20])
