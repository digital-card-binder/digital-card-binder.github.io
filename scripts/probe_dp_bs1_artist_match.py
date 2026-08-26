#!/usr/bin/env python3
from __future__ import annotations
import io,json,re,urllib.request
from pathlib import Path
from PIL import Image
import imagehash
ARTISTS={'nagimiso','ken sugimori','kouki saitou','akira komayama','masakazu fukuda','megumi mizutani','anesaki dynamic','hideki ishikawa','shin nagasawa','takuyoa'}
DB=Path('/tmp/tcgdex-db')
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}); return urllib.request.urlopen(req,timeout=30).read()
def im(url): return Image.open(io.BytesIO(get(url))).convert('RGB')
def ah(im):
 w,h=im.size
 crops=[(0.06,0.16,0.94,0.56),(0.08,0.19,0.92,0.54),(0.10,0.20,0.90,0.52)]
 return [imagehash.phash(im.crop((int(w*x1),int(h*y1),int(w*x2),int(h*y2))).resize((256,128)),hash_size=16) for x1,y1,x2,y2 in crops]
def dist(a,b): return min(x-y for x in a for y in b)
def main():
 # download Korean BS1 official images that exist
 ko=[]
 for n in range(1,81):
  u=f'https://cards.image.pokemonkorea.co.kr/data/wmimages/DP/BS1/bs1_kr_{n}.jpg'
  try: ko.append((n,u,ah(im(u))))
  except Exception: pass
 print('KO_EXISTS',len(ko),[n for n,_,_ in ko])
 # target artist cards from global dp1
 rows=[]
 root=DB/'data'/'Diamond & Pearl'/'Diamond & Pearl'
 for p in root.glob('*.ts'):
  if not p.stem.isdigit(): continue
  t=p.read_text(encoding='utf-8',errors='ignore')
  m=re.search(r"illustrator:\s*['\"]([^'\"]+)['\"]",t)
  if not m or m.group(1).strip().casefold() not in ARTISTS: continue
  nm=re.search(r'en:\s*["\']([^"\']+)',t)
  rows.append((int(p.stem),m.group(1).strip(),nm.group(1) if nm else ''))
 print('GLOBAL_TARGETS',len(rows))
 results=[]
 for num,artist,name in sorted(rows):
  u=f'https://assets.tcgdex.net/en/dp/dp1/{num}/high.webp'
  try: gh=ah(im(u))
  except Exception as e:
   print('GLOBAL_IMAGE_FAIL',num,repr(e)); continue
  best=sorted((dist(gh,kh),kn,ku) for kn,ku,kh in ko)[:5]
  results.append({'globalNumber':num,'artist':artist,'name':name,'best':[{'d':d,'ko':kn} for d,kn,_ in best]})
  print('MATCH',num,artist,name,best[:3])
 Path('data/probe-dp-bs1-matches.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__': main()
