#!/usr/bin/env python3
from __future__ import annotations

import glob, json, os, re, subprocess, tempfile
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ARTISTS=["Ryo Ueda","Kagemaru Himeno","Mitsuhiro Arita","kodama","Hitoshi Ariga"]
TCGDEX_REPO="https://github.com/tcgdex/cards-database.git"
TCGDEX_REF="d9083b73db080979123ebf5e9e97338d4e0745b2"
OFFICIAL_IMAGE_PREFIX="https://cards.image.pokemonkorea.co.kr/data/"

def norm(url):
    p=urlsplit(url); return urlunsplit((p.scheme,p.netloc,p.path,"",""))
def row_name(row):
    for key in ("name","pokemonName","cardName"):
        val=str(row.get(key) or "").strip()
        if val: return val
    return ""
def walk(node):
    if isinstance(node,dict):
        yield node
        for v in node.values(): yield from walk(v)
    elif isinstance(node,list):
        for v in node: yield from walk(v)
def identities(row):
    image=str(row.get("image") or "").strip()
    if not image.startswith(OFFICIAL_IMAGE_PREFIX): return []
    out=[]; raw=str(row.get("code") or "").strip(); setv=str(row.get("set") or "").strip(); numv=str(row.get("cardNumber") or row.get("number") or "").strip()
    m=re.match(r"^([^_]+)_0*(\d+)(?:/|$)",raw,re.I)
    if m: out.append((m.group(1),int(m.group(2))))
    im=re.search(r"/wmimages/[^/]+/([^/]+)/([^/?#]+)",image,re.I)
    if im:
        folder,filename=im.groups(); nm=re.search(r"_0*(\d{1,4})(?:[_\.]|$)",filename,re.I)
        if nm: out.append((folder,int(nm.group(1))))
    nm=re.search(r"(\d{1,4})",numv)
    if setv and nm: out.append((setv,int(nm.group(1))))
    return out
def local_index():
    idx=defaultdict(list)
    for fn in sorted(glob.glob("data/*.json")):
        if fn.replace('\\','/') in {"data/artists.json","data/artists-popular.json"}: continue
        try: payload=json.loads(Path(fn).read_text(encoding="utf-8"))
        except Exception: continue
        for row in walk(payload):
            image=str(row.get("image") or "").strip()
            if not image.startswith(OFFICIAL_IMAGE_PREFIX): continue
            for setname,num in identities(row):
                key=(setname.casefold(),num)
                ident=(norm(image),str(row.get("code") or ""),row_name(row))
                if not any((norm(str(x.get("image") or "")),str(x.get("code") or ""),row_name(x))==ident for x in idx[key]): idx[key].append(row)
    return idx
def field(text,key):
    m=re.search(r"\b"+re.escape(key)+r":\s*['\"]([^'\"]*)['\"]",text)
    return m.group(1) if m else ""
def names(text):
    m=re.search(r"name:\s*\{(.*?)\}\s*,",text,re.S)
    if not m: return {}
    return dict(re.findall(r"(?:['\"]?([a-z-]+)['\"]?)\s*:\s*['\"]([^'\"]+)['\"]",m.group(1),re.I))

idx=local_index(); print("LOCAL KEYS",len(idx))
with tempfile.TemporaryDirectory() as td:
    repo=os.path.join(td,"tcgdex")
    subprocess.run(["git","clone","--filter=blob:none","-q",TCGDEX_REPO,repo],check=True)
    subprocess.run(["git","-C",repo,"checkout","-q",TCGDEX_REF],check=True)
    base=os.path.join(repo,"data-asia"); krsets=set()
    for era in os.listdir(base):
        ep=os.path.join(base,era)
        if not os.path.isdir(ep): continue
        for fn in os.listdir(ep):
            if not fn.endswith('.ts'): continue
            text=Path(ep,fn).read_text(encoding='utf-8',errors='ignore')
            if re.search(r"\bko\s*:",text) or re.search(r"['\"]ko['\"]\s*:",text): krsets.add((era,fn[:-3]))
    grouped=defaultdict(list); variants=defaultdict(set)
    for root,_,files in os.walk(base):
        for fn in files:
            if not fn.endswith('.ts'): continue
            path=os.path.join(root,fn); text=Path(path).read_text(encoding='utf-8',errors='ignore')
            m=re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]",text)
            if not m: continue
            ill=m.group(1)
            for target in ARTISTS:
                if ill.casefold()==target.casefold():
                    variants[target].add(ill); rel=os.path.relpath(path,base); parts=rel.split(os.sep)
                    if len(parts)>=3 and re.fullmatch(r"0*\d+",Path(fn).stem): grouped[target].append((parts[0],parts[1],int(Path(fn).stem),rel,text))
    for artist in ARTISTS:
        allrows=grouped[artist]; relevant=[]; matched=[]; unresolved=[]; ambiguous=[]
        for era,setcode,num,rel,text in allrows:
            vals=idx.get((setcode.casefold(),num),[]); proven=bool(vals) or (era,setcode) in krsets
            if not proven: continue
            relevant.append(rel); valid=[r for r in vals if row_name(r)]
            if valid:
                matched.append((rel,valid))
                unique={(row_name(r),str(r.get('code') or ''),norm(str(r.get('image') or '')),str(r.get('cardNumber') or ''),str(r.get('set') or '')) for r in valid}
                if len(unique)>1: ambiguous.append((rel,names(text),sorted(unique)))
            else: unresolved.append((rel,names(text),field(text,'rarity'),field(text,'category')))
        print("\nARTIST",artist,"VARIANTS",sorted(variants[artist]))
        print("ALL",len(allrows),"KOREA_RELEVANT",len(relevant),"MATCHED",len(matched),"UNRESOLVED",len(unresolved),"AMBIGUOUS",len(ambiguous))
        for rel,nm,rar,cat in unresolved: print("UNRESOLVED",json.dumps({"path":rel,"names":nm,"rarity":rar,"category":cat},ensure_ascii=False))
        for rel,nm,vals in ambiguous: print("AMBIGUOUS",json.dumps({"path":rel,"tcgNames":nm,"candidates":[{"name":v[0],"code":v[1],"image":v[2],"cardNumber":v[3],"set":v[4]} for v in vals]},ensure_ascii=False))
