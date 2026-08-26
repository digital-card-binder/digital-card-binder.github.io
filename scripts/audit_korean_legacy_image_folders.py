#!/usr/bin/env python3
from __future__ import annotations
import glob,json,re
from collections import defaultdict,Counter
from pathlib import Path
from urllib.parse import urlsplit
OUT=Path('data/korean-legacy-image-folders.json')
PREFIX='https://cards.image.pokemonkorea.co.kr/data/'
def walk(x):
 if isinstance(x,dict):
  yield x
  for v in x.values(): yield from walk(v)
 elif isinstance(x,list):
  for v in x: yield from walk(v)
def main():
 folders=defaultdict(lambda:{'count':0,'samples':[],'files':Counter()})
 for fn in glob.glob('data/*.json'):
  if fn.endswith('artists.json') or 'artist-top10' in fn: continue
  try:p=json.loads(Path(fn).read_text(encoding='utf-8'))
  except:continue
  for r in walk(p):
   u=str(r.get('image') or r.get('imageUrl') or '')
   if not u.startswith(PREFIX):continue
   path=urlsplit(u).path
   m=re.search(r'/data/wmimages/(DP|BW|XY)/([^/]+)/([^/]+)$',path,re.I)
   if not m:continue
   era,folder,file=m.groups(); key=f'{era.upper()}/{folder}'
   d=folders[key]; d['count']+=1; d['files'][file]+=1
   if len(d['samples'])<8:d['samples'].append({'file':file,'name':str(r.get('name') or r.get('nameKo') or r.get('pokemonName') or ''),'number':str(r.get('cardNumber') or r.get('number') or ''),'sourceFile':fn})
 out={k:{'count':v['count'],'samples':v['samples'],'filePrefixes':[x for x,_ in v['files'].most_common(8)]} for k,v in sorted(folders.items())}
 OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({k:v['count'] for k,v in out.items()},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
