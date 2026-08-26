#!/usr/bin/env python3
from __future__ import annotations
import json, os, re, sys, tempfile
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_artist_batch2_data as b

ARTISTS=["nagimiso","Ken Sugimori","Kouki Saitou","Akira Komayama","Masakazu Fukuda","Megumi Mizutani","Anesaki Dynamic","Hideki Ishikawa","Shin Nagasawa","takuyoa"]
OUT=Path('data/artist-top10-korean-candidate-audit.json')

def card_names(text):
    m=re.search(r"name:\s*\{(.*?)\n\s*\}",text,re.S)
    block=m.group(1) if m else ''
    vals={}
    for lang,val in re.findall(r"([a-z]{2}):\s*['\"]([^'\"]+)",block): vals[lang]=val
    return vals

def scalar_field(text, key):
    m=re.search(rf"\b{re.escape(key)}:\s*['\"]([^'\"]+)['\"]", text)
    return m.group(1).strip() if m else ''

def dex_ids(text):
    m=re.search(r"\bdexId:\s*\[(.*?)\]", text, re.S)
    if not m: return []
    return [int(x) for x in re.findall(r"\b(\d{1,4})\b", m.group(1))]

def main():
    local=b.build_local_index()
    report={"artists":{},"totals":{"candidates":0,"localMatched":0,"unresolved":0}}
    with tempfile.TemporaryDirectory() as td:
        repo=os.path.join(td,'tcgdex'); b.clone_tcgdex(repo); base=os.path.join(repo,'data-asia'); kr=b.korean_sets(base)
        grouped=defaultdict(list)
        for root,_,files in os.walk(base):
            for fn in files:
                if not re.fullmatch(r'0*\d+\.ts',fn): continue
                path=os.path.join(root,fn); text=Path(path).read_text(encoding='utf-8',errors='ignore')
                im=re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]",text)
                if not im: continue
                artist=next((a for a in ARTISTS if a.casefold()==im.group(1).strip().casefold()),None)
                if not artist: continue
                parts=os.path.relpath(path,base).split(os.sep)
                if len(parts)<3: continue
                era,setname=parts[0],parts[1]
                if (era,setname) not in kr: continue
                num=int(Path(fn).stem)
                matches=local.get((setname.casefold(),num),[])
                names=card_names(text)
                grouped[artist].append({
                    "era":era,"set":setname,"number":num,"names":names,
                    "rarity":scalar_field(text,'rarity'),"category":scalar_field(text,'category'),"dexId":dex_ids(text),
                    "localMatchCount":len(matches),
                    "localMatches":[{"name":b.row_name(r),"rarity":str(r.get('rarity') or ''),"cardNumber":str(r.get('cardNumber') or r.get('number') or ''),"image":str(r.get('image') or '')} for r in matches[:5]]
                })
        for artist in ARTISTS:
            rows=grouped[artist]
            matched=[r for r in rows if r['localMatchCount']]
            unresolved=[r for r in rows if not r['localMatchCount']]
            eras=defaultdict(lambda:{"candidates":0,"matched":0,"unresolved":0})
            for r in rows:
                eras[r['era']]['candidates']+=1
                if r['localMatchCount']: eras[r['era']]['matched']+=1
                else: eras[r['era']]['unresolved']+=1
            report['artists'][artist]={"candidateCount":len(rows),"localMatchedCount":len(matched),"unresolvedCount":len(unresolved),"eras":dict(eras),"unresolved":unresolved}
            report['totals']['candidates']+=len(rows); report['totals']['localMatched']+=len(matched); report['totals']['unresolved']+=len(unresolved)
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({a:{k:v for k,v in d.items() if k!='unresolved'} for a,d in report['artists'].items()},ensure_ascii=False,indent=2))
    print(report['totals'])
if __name__=='__main__': main()
