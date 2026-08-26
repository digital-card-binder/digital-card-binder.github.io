#!/usr/bin/env python3
from __future__ import annotations
import json, os, re, sys, tempfile
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_artist_batch2_data as b
ARTISTS=["nagimiso","Ken Sugimori","Kouki Saitou","Akira Komayama","Masakazu Fukuda","Megumi Mizutani","Anesaki Dynamic","Hideki Ishikawa","Shin Nagasawa","takuyoa"]
ERAS={"DP","DPt","L","BW","XY"}
OUT=Path('data/artist-top10-legacy-candidate-audit.json')
def names(t):
 m=re.search(r"name:\s*\{(.*?)\n\s*\}",t,re.S); block=m.group(1) if m else ''
 return {k:v for k,v in re.findall(r"([a-z]{2}|id):\s*['\"]([^'\"]+)",block)}
def main():
 report={"artists":{},"total":0}
 with tempfile.TemporaryDirectory() as td:
  repo=os.path.join(td,'tcgdex'); b.clone_tcgdex(repo); base=os.path.join(repo,'data-asia'); g=defaultdict(lambda:defaultdict(list))
  for root,_,files in os.walk(base):
   for fn in files:
    if not re.fullmatch(r'0*\d+\.ts',fn): continue
    rel=os.path.relpath(os.path.join(root,fn),base).split(os.sep)
    if len(rel)<3 or rel[0] not in ERAS: continue
    t=Path(root,fn).read_text(encoding='utf-8',errors='ignore'); m=re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]",t)
    if not m: continue
    a=next((x for x in ARTISTS if x.casefold()==m.group(1).strip().casefold()),None)
    if not a: continue
    g[a][rel[1]].append({"number":int(Path(fn).stem),"names":names(t)})
  for a in ARTISTS:
   sets=[]; count=0
   for s,rows in sorted(g[a].items()):
    rows.sort(key=lambda x:x['number']); sets.append({"set":s,"count":len(rows),"cards":rows}); count+=len(rows)
   report['artists'][a]={"count":count,"sets":sets}; report['total']+=count
 OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({a:{'count':d['count'],'sets':[(s['set'],s['count']) for s in d['sets']]} for a,d in report['artists'].items()},ensure_ascii=False,indent=2)); print('TOTAL',report['total'])
if __name__=='__main__': main()
