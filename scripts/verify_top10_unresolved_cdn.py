#!/usr/bin/env python3
from __future__ import annotations
import concurrent.futures,json
from pathlib import Path
from urllib.request import Request,urlopen
AUDIT=Path('data/artist-top10-korean-candidate-audit.json')
OUT=Path('data/artist-top10-unresolved-cdn.json')
BASE='https://cards.image.pokemonkorea.co.kr/data/wmimages'
KO={
 ('nagimiso','S8',33):'투구뿌논',('nagimiso','SV4a',291):'깜까미',('nagimiso','SV4a',279):'팔데아 켄타로스',('nagimiso','SV4a',276):'망키',('nagimiso','SV4a',308):'두트리오',('nagimiso','SV4a',257):'네이티오',('nagimiso','SV4a',286):'초롱순',('nagimiso','CP1',15):'마그마단의 그란돈 EX',('nagimiso','CP1',6):'아쿠아단의 가이오가 EX',
 ('Ken Sugimori','SM6',104):'지가르데 GX',('Ken Sugimori','SM6',105):'이벨타르 GX',
 ('Kouki Saitou','SV4a',285):'콜로솔트',('Kouki Saitou','SV4a',253):'캐이시',('Kouki Saitou','SV4a',234):'드니꽁',('Kouki Saitou','SV4a',208):'스코빌런',('Kouki Saitou','SV4a',305):'피죤',('Kouki Saitou','CP2',10):'데덴네',('Kouki Saitou','CP2',16):'오케이징',('Kouki Saitou','CP1',16):'아쿠아단의 포챠나',('Kouki Saitou','CP1',8):'아쿠아단의 질뻐기',
 ('Akira Komayama','S9',11):'나메일',('Akira Komayama','S9a',83):'아쿠스타 V',('Akira Komayama','SV4a',214):'춤추새',('Akira Komayama','SV4a',319):'꼬이밍고',('Akira Komayama','SV4a',315):'맛보돈',('Akira Komayama','CP2',11):'마자용',('Akira Komayama','CP2',13):'히포포타스',('Akira Komayama','CP1',1):'마그마단의 둔타',('Akira Komayama','CP1',12):'마그마단의 가보리',
 ('Masakazu Fukuda','S10D',2):'',('Masakazu Fukuda','SV4a',312):'패리퍼',('Masakazu Fukuda','SV4a',300):'부르롱',('Masakazu Fukuda','SV4a',239):'붐볼',('Masakazu Fukuda','SV4a',217):'카르본',('Masakazu Fukuda','CP2',7):'개굴반장',('Masakazu Fukuda','CP2',6):'개구마르',('Masakazu Fukuda','CP1',11):'마그마단의 점토도리',('Masakazu Fukuda','CP1',13):'마그마단의 갱도라',
 ('Anesaki Dynamic','S10a',42):'골뱃',
 ('Hideki Ishikawa','S8',121):'회연',('Hideki Ishikawa','S8',112):'회연',('Hideki Ishikawa','SM6',103):'개굴닌자 GX',('Hideki Ishikawa','SV4a',216):'악뜨거',('Hideki Ishikawa','SV4a',342):'심판',('Hideki Ishikawa','SV4a',205):'올리르바',
 ('Shin Nagasawa','SV4a',275):'묘두기',('Shin Nagasawa','SV4a',294):'대도각참',('Shin Nagasawa','SV4a',281):'루카리오',('Shin Nagasawa','SV4a',229):'돌핀맨',('Shin Nagasawa','SV4a',244):'볼트로스',('Shin Nagasawa','SV4a',290):'포푸니라',('Shin Nagasawa','CP2',24):'아르세우스',('Shin Nagasawa','CP2',21):'화이트큐레무',('Shin Nagasawa','CP2',23):'레지기가스',('Shin Nagasawa','CP1',2):'마그마단의 폭타',('Shin Nagasawa','CP1',22):'마그마단의 쟝고',
 ('takuyoa','SV4a',335):'피죤투 ex',('takuyoa','SV4a',323):'클레스퍼트라 ex',
}
def urls(s,n):
 z=f'{n:03d}'; up=s.upper()
 if up.startswith('SV'): return [f'{BASE}/SV/{s}/{s}_{z}.png']
 if up.startswith('SM'): return list(dict.fromkeys([f'{BASE}/SM/{up}/{up}_{z}.png',f'{BASE}/SM/{s}/{s}_{z}.png']))
 if up.startswith('S'): return list(dict.fromkeys([f'{BASE}/S/{up}/{up}_{z}.png',f'{BASE}/S/{s}/{s}_{z}.png']))
 if up.startswith('CP'): return [f'{BASE}/XY/{up}/XY_{up}_{z}.jpg',f'{BASE}/XY/{up}/{up}_{z}.jpg']
 return []
def exists(u):
 try:
  req=Request(u,headers={'User-Agent':'Mozilla/5.0','Range':'bytes=0-31'})
  with urlopen(req,timeout=6) as r:
   b=r.read(32); ct=str(r.headers.get('Content-Type') or '')
  return r.status in (200,206) and ct.startswith('image/') and (b.startswith(b'\x89PNG') or b.startswith(b'\xff\xd8'))
 except Exception:return False
def first_existing(us):
 for u in us:
  if exists(u):return u
 return ''
def rarity(raw,s,n):
 mp={'Common':'C','Uncommon':'U','Rare':'R','Double rare':'RR','Ultra Rare':'SR','Hyper rare':'HR'}
 if s.casefold()=='sv4a' and n>190:return 'S'
 return mp.get(str(raw or ''),str(raw or ''))
def main():
 audit=json.loads(AUDIT.read_text(encoding='utf-8')); jobs=[]
 for artist,d in audit['artists'].items():
  for x in d.get('unresolved',[]): jobs.append((artist,x))
 with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
  found=list(ex.map(lambda j:first_existing(urls(j[1]['set'],j[1]['number'])),jobs))
 out={'artists':{},'totals':{'input':len(jobs),'found':0,'missing':0}}
 for (artist,x),img in zip(jobs,found):
  row={'artist':artist,'set':x['set'],'number':x['number'],'name':KO.get((artist,x['set'],x['number']),''),'rarity':rarity(x.get('rarity',''),x['set'],x['number']),'image':img,'exists':bool(img),'source':'https://pokemoncard.co.kr/cards'}
  out['artists'].setdefault(artist,[]).append(row); out['totals']['found' if img else 'missing']+=1
 OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(out['totals'],ensure_ascii=False))
 for a,rows in out['artists'].items(): print(a,[(r['set'],r['number'],r['name'],r['exists']) for r in rows])
if __name__=='__main__':main()
