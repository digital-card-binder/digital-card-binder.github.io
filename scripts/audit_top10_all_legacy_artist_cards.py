#!/usr/bin/env python3
from __future__ import annotations
import json, os, re, sys, tempfile
from collections import defaultdict
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_artist_batch2_data as b
ARTISTS=["nagimiso","Ken Sugimori","Kouki Saitou","Akira Komayama","Masakazu Fukuda","Megumi Mizutani","Anesaki Dynamic","Hideki Ishikawa","Shin Nagasawa","takuyoa"]
ERAS={'DP','DPt','L','BW','XY'}
OUT=Path('data/artist-top10-all-legacy-audit.json')
def names(t):
 m=re.search(r"name:\s*\{(.*?)\n\s*\}",t,re.S); block=m.group(1) if m else ''
 return {k:v for k,v in re.findall(r"([a-z]{2}):\s*['\"]([^'\"]+)",block)}
def dex(t):
 m=re.search(r"dexId:\s*\[(.*?)\]",t,re.S)
 return [int(x) for x in re.findall(r'\b(\d{1,4})\b',m.group(1))] if m else []
def main():
 out={'artists':{},'totals':{}}
 with tempfile.TemporaryDirectory() as td:
  repo=os.path.join(td,'tcgdex'); b.clone_tcgdex(repo); base=os.path.join(repo,'data-asia')
  grouped=defaultdict(list)
  for root,_,files in os.walk(base):
   relroot=os.path.relpath(root,base).split(os.sep)
   if not relroot or relroot[0] not in ERAS: continue
   for fn in files:
    if not re.fullmatch(r'0*\d+\.ts',fn): continue
    p=Path(root,fn); t=p.read_text(encoding='utf-8',errors='ignore')
    m=re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]",t)
    if not m: continue
    a=next((x for x in ARTISTS if x.casefold()==m.group(1).strip().casefold()),None)
    if not a: continue
    parts=os.path.relpath(p,base).split(os.sep)
    grouped[a].append({'era':parts[0],'set':parts[1],'number':int(p.stem),'names':names(t),'dexId':dex(t),'path':'/'.join(parts)})
  for a in ARTISTS:
   rows=sorted(grouped[a],key=lambda r:(r['era'],r['set'],r['number']))
   out['artists'][a]={'count':len(rows),'cards':rows}
   out['totals'][a]=len(rows)
 OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(out['totals'],ensure_ascii=False))
if __name__=='__main__': main()
