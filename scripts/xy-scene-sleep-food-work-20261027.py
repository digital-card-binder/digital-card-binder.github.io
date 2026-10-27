#!/usr/bin/env python3
"""Cross-language image-verifiable XY sleep, food and work curated scenes.

The target art has been classified by external card-illustration curators.
Registration requires a matching English original and a Korean official image,
not a guessed translated name. Certificates for the other 11 themes stay open.
"""
import io,os,json,urllib.request,hashlib
from PIL import Image
import imagehash
from concurrent.futures import ThreadPoolExecutor,as_completed
UA={'User-Agent':'Mozilla/5.0 (XY Art Scene Audit/1.0)'}
P='data/audits/'
OUT=P+'theme-xy-sleep-food-work-source-20261027.json'
CHECK=P+'theme-xy-all-37-sets-review-checkpoint-20261026.json'
MANIFEST=P+'theme-xy-scene-review-manifest-20261026.json'
REVIEW=P+'theme-series-review-status.json'
SLEEP='https://ninthpocket.com/sets/sleepy-pokemon'
FOOD='https://ninthpocket.com/sets/pokemon-with-food'
WORK='https://ninthpocket.com/sets/pokemon-at-work'
# Original English print IDs as printed on the independently curated card lists.
SCENES=[
 ('xy7','55','소미안','sleeping','잠들거나 쉬는 소미안',SLEEP),
 ('xy8','18','브케인','sleeping','졸거나 쉬는 브케인',SLEEP),
 ('g1','RC10','데덴네','sleeping','휴식을 취하는 데덴네',SLEEP),
 ('xy10','57','벌차이','sleeping','잠들거나 쉬는 벌차이',SLEEP),
 ('xy10','66','푸크린','sleeping','졸거나 쉬는 푸크린',SLEEP),
 ('xy10','71','엘풍','sleeping','잠들거나 쉬는 엘풍',SLEEP),
 ('xyp','56','해피너스','sleeping','휴식을 취하는 해피너스',SLEEP),
 ('kss','27','밀탱크','sleeping','잠들거나 쉬는 밀탱크',SLEEP),
 ('g1','RC12','꼴깍몬','food','먹거리와 함께 있는 꼴깍몬',FOOD),
 ('g1','RC20','나루림','food','디저트와 함께 있는 나루림',FOOD),
 ('xy8','99','그랑블루','work','일하는 그랑블루',WORK),
 ('g1','52','마임맨','work','일하는 마임맨',WORK)
]
def read(p):
 with open(p,encoding='utf8') as f:return json.load(f)
def save(p,v):
 os.makedirs(os.path.dirname(p),exist_ok=True)
 with open(p,'w',encoding='utf8') as f:json.dump(v,f,ensure_ascii=False,indent=2);f.write('\n')
def getimg(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=25) as r:b=r.read(1_200_000)
 if len(b)<3000:raise ValueError('small image')
 im=Image.open(io.BytesIO(b)).convert('RGB')
 return im,hashlib.sha256(b).hexdigest()
def fp(im):
 w,h=im.size
 art=im.crop((round(w*.10),round(h*.13),round(w*.89),round(h*.52)))
 return {'f':str(imagehash.phash(im)),'a':str(imagehash.phash(art)),
         'ad':str(imagehash.dhash(art))}
def distances(a,b):
 return {'f':imagehash.hex_to_hash(a['f'])-imagehash.hex_to_hash(b['f']),
         'a':imagehash.hex_to_hash(a['a'])-imagehash.hex_to_hash(b['a']),
         'ad':imagehash.hex_to_hash(a['ad'])-imagehash.hex_to_hash(b['ad'])}
def safe(v):return v['f']<=6 and v['a']<=10 and v['ad']<=10
def canon(s):return str(s).lower()
art=read('data/art-themes.json'); checkpoint=read(CHECK); manifest=read(MANIFEST); reviews=read(REVIEW)
sources=[s for s in read('data/series.json')+read('data/series-legacy.json') if s.get('era')=='XY']
assert len(sources)==37 and sum(len(s['cards']) for s in sources)==2313
assert sum(len(g['cards']) for g in art['groups'])==24230
assert checkpoint['currentXYThemeRows']==2206
assert manifest['cardinality']['individuallyAllTwelveScreened']==5
assert checkpoint['remainingArtworkNotFullyScreenedCount']==2308
themes={g['code']:g for g in art['groups']}
flat=[(s,c) for s in sources for c in s['cards']]
holdStatus={(canon(s['set']),canon(c['code'].split('/')[0])):c.get('archiveColorStatus') for s in manifest['sets'] for c in s['cards']}
jobs=[]
for setcode,num,name,theme,scene,url in SCENES:
 expected='https://images.pokemontcg.io/'+setcode+'/'+num+'.png'
 names=[(s,c) for s,c in flat if c.get('name')==name and c.get('image','').startswith('https://cards.image.pokemonkorea.co.kr/') and
     holdStatus.get((canon(s['code']),canon(c['code'].split('/')[0])))=='official-source-color-reviewed']
 jobs.append((setcode,num,name,theme,scene,url,expected,names))
def fetch(job):
 setcode,num,name,theme,scene,url,expected,names=job
 try:
  img,sha=getimg(expected); efp=fp(img)
 except Exception as e:return (job,None,[],str(e))
 matches=[];unverified=[]
 for s,c in names:
  try:
   kim,kh=getimg(c['image'])
   d=distances(fp(kim),efp)
   if safe(d):matches.append({'set':s,'card':c,'distance':d,'englishSha':sha,'koreanSha':kh})
   else:unverified.append({'card':s['code']+'|'+c['code'],'distance':d})
  except Exception as e:unverified.append({'card':s['code']+'|'+c['code'],'error':str(e)[:130]})
 return (job,matches,unverified,None)
results=[]
with ThreadPoolExecutor(max_workers=9) as ex:
 for future in as_completed([ex.submit(fetch,j) for j in jobs]):
  results.append(future.result())
adding=[];errors=[];unchanged=[];attempted=[]
for job,matches,unverified,error in results:
 sc,num,name,theme,scene,src,original,names=job
 attempted.append({'EnglishCard':sc+'/'+num,'koreanName':name,'candidateKoreanCards':len(names),'sameArtworkMatches':len(matches or []),
                   'unmatched':unverified,'downloadError':error})
 if error:
  errors.append({'EnglishCard':sc+'/'+num,'error':error});continue
 for match in matches:
  s,c=match['set'],match['card'];key=(canon(s['code']),canon(c['code'].split('/')[0]))
  if any(canon(x['set'])==key[0] and canon(x['code'])==key[1] for x in themes[theme]['cards']):
   unchanged.append(s['code']+'|'+c['code']+'|'+theme);continue
  if not c.get('source','').startswith('https://pokemoncard.co.kr/cards/detail/'):continue
  row={
   'code':c['code'].split('/')[0].upper(),'name':c['name'],'series':'XY',
   'set':s['code'],'setName':s.get('displayName',''),'cardNumber':c['code'].split('_')[1],
   'rarity':c.get('rarity',''),'category':scene,'image':c['image'],
   'evidence':'영문 카드 일러스트 검수 명단과 한국 공식 이미지의 일러스트 해시 일치 증명. 큐레이션: '+src+
    ' ; 원화: '+original+' ; 공식 한국판 카드: '+c['source']+
    ' ; 해시 거리: '+json.dumps(match['distance'])+
    '. 해당 장면 테마에 한하여 부분 승인. 나머지 전체 12테마 판정은 미완료.'
  }
  themes[theme]['cards'].append(row)
  adding.append({'set':s['code'],'code':c['code'],'name':c['name'],'theme':theme,
      'evidence':src,'englishOriginal':original,'koreanOfficial':c['source'],
      'koreanImage':c['image'],'artHashDistance':match['distance'],
      'originalSha256':match['englishSha'],'KoreanSha256':match['koreanSha'],
      'allTwelveScreened':False})
assert len(adding)<=len(SCENES)*3
inc={}
for x in adding:
 inc.setdefault(canon(x['set']),{}).setdefault(canon(x['code'].split('/')[0]),[]).append(x['theme'])
for s in checkpoint['sets']:
 code=canon(s['code'])
 if code not in inc:continue
 for c in s['cards']:
  added=inc[code].get(canon(c['code'].split('/')[0]),[])
  if added:
   assert c['reviewStatus']!='artwork-screened-12-themes'
   c['registeredThemes']=sorted(set(c['registeredThemes']+added))
   c['reviewStatus']='partial-theme-evidence'
 s['currentThemeRows']+=sum(len(t) for t in inc[code].values())
for s in manifest['sets']:
 code=canon(s['set'])
 if code not in inc:continue
 for c in s['cards']:
  added=inc[code].get(canon(c['code'].split('/')[0]),[])
  if added:
   assert c['allTwelveVisuallyScreened'] is False
   for theme in added:
    assert c['themeReview'][theme]=='not-screened'
    c['themeReview'][theme]='scene-evidence-partial'
   c['registeredThemes']=sorted(set(c['registeredThemes']+added))
 s['themeRows']+=sum(len(t) for t in inc[code].values())
 s['scenePartiallyReviewed']=sum(1 for c in s['cards'] if not c['allTwelveVisuallyScreened'] and any(t!='color' for t in c['registeredThemes']))
for code in inc:
 for key in reviews['reviews']:
  if canon(key)==code:
   assert reviews['reviews'][key].get('status')!='complete'
   reviews['reviews'][key]['status']='partial'
   reviews['reviews'][key]['sceneEvidenceBatch']=OUT
allRows=sum(len(g['cards']) for g in art['groups'])
xyRows=sum(s['currentThemeRows'] for s in checkpoint['sets'])
assert allRows==24230+len(adding) and xyRows==2206+len(adding)
assert sum(s['themeRows'] for s in manifest['sets'])==xyRows
assert checkpoint['newArtworkFullyScreenedCount']==5
checkpoint['currentXYThemeRows']=xyRows
checkpoint['newThemeRows']=xyRows-checkpoint['originalThemeRows']
manifest['cardinality']['independentXYThemeRows']=xyRows
manifest['cardinality']['independentAllThemeRows']=allRows
assert manifest['cardinality']['individuallyAllTwelveScreened']==5
art['updatedAt']='2026-10-27';reviews['updatedAt']='2026-10-27'
save('data/art-themes.json',art);save(CHECK,checkpoint);save(MANIFEST,manifest);save(REVIEW,reviews)
save(OUT,{'schemaVersion':1,'date':'2026-10-27','method':'visually-curated-English-and-Korean-original-art-hash-confirmation',
          'triedEnglishSourceArtwork':len(SCENES),'newPartialThemeRows':len(adding),'approvedEntries':adding,
          'previousMembershipsPreserved':unchanged,'attempted':attempted,'unavailableSource':errors,
          'currentXYThemeRows':xyRows,'allThemeRows':allRows,'allTwelveScreened':5,'remainingFullTwelve':2308,
          'held196RemainHeld':True,'previous24SourceCheckpointsPreserved':True})
testPath='tests/theme-card-identity.test.mjs'
s=open(testPath,encoding='utf8').read()
assert s.count('assert.equal(total,24230);')==1
with open(testPath,'w',encoding='utf8') as f:f.write(s.replace('assert.equal(total,24230);','assert.equal(total,'+str(allRows)+');'))
print('XY_SLEEP_FOOD_WORK_RESULT',json.dumps({'sourceEnglishCards':len(SCENES),'newSceneRows':len(adding),'previouslyPresent':len(unchanged),'XYRows':xyRows,'allRows':allRows,'errors':errors},ensure_ascii=False),flush=True)
