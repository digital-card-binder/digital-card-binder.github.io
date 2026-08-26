#!/usr/bin/env python3
from __future__ import annotations
import json, os, re, sys, tempfile
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_artist_batch2_data as b
ARTISTS=["nagimiso","Ken Sugimori","Kouki Saitou","Akira Komayama","Masakazu Fukuda","Megumi Mizutani","Anesaki Dynamic","Hideki Ishikawa","Shin Nagasawa","takuyoa"]
OUT=Path('data/artists-top10-local-official.json')
PREFIX='https://cards.image.pokemonkorea.co.kr/data/'
def norm(u):
 p=urlsplit(u); return urlunsplit((p.scheme,p.netloc,p.path,'',''))
def main():
 local=b.build_local_index(); result=[]
 with tempfile.TemporaryDirectory() as td:
  repo=os.path.join(td,'tcgdex'); b.clone_tcgdex(repo); base=os.path.join(repo,'data-asia')
  grouped={a:[] for a in ARTISTS}
  for root,_,files in os.walk(base):
   for fn in files:
    if not re.fullmatch(r'0*\d+\.ts',fn): continue
    path=os.path.join(root,fn); text=Path(path).read_text(encoding='utf-8',errors='ignore')
    im=re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]",text)
    if not im: continue
    artist=next((a for a in ARTISTS if a.casefold()==im.group(1).strip().casefold()),None)
    if not artist: continue
    rel=os.path.relpath(path,base).split(os.sep)
    if len(rel)<3: continue
    grouped[artist].append((rel[0],rel[1],int(Path(fn).stem)))
  for artist in ARTISTS:
   cards=[]; seen=set()
   for era,setname,num in grouped[artist]:
    for row in local.get((setname.casefold(),num),[]):
     card=b.normalize_local_card(row,setname,num)
     if not card['name'] or not card['image'].startswith(PREFIX): continue
     key=norm(card['image']).casefold()
     if key in seen: continue
     seen.add(key); cards.append(card)
   # deterministic ordering by rough era/set/number while preserving distinct official images
   def sk(c):
    s=str(c.get('set') or ''); nums=tuple(int(x) for x in re.findall(r'\d+',s)); n=re.search(r'(\d+)',str(c.get('cardNumber') or ''))
    era=0 if s.upper().startswith('M') else 1 if s.upper().startswith('SV') else 2 if s.upper().startswith('S') else 3 if s.upper().startswith('SM') else 4 if s.upper().startswith('XY') else 5 if s.upper().startswith('BW') else 6
    return (era,tuple(-x for x in nums),s.casefold(),int(n.group(1)) if n else 9999,norm(c['image']))
   cards.sort(key=sk)
   for i,c in enumerate(cards,1): c['order']=i; c['owned']=False
   result.append({'name':artist,'cards':cards})
 payload={'source':'Pokemon Korea official image-matched local catalog + pinned TCGdex illustrator index','artistCount':len(result),'cardCount':sum(len(x['cards']) for x in result),'ownedCount':0,'artists':result}
 OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 print('TOTAL',payload['cardCount'])
 for a in result: print(a['name'],len(a['cards']))
if __name__=='__main__': main()
