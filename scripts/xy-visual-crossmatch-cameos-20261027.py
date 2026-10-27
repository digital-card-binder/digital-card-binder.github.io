#!/usr/bin/env python3
"""Evidence-constrained XY cameo recovery, not a false 12-theme completion.

Cross-correlate 2014-2016 English scan scenes individually reviewed on Elite Fourum
with Korean master-card image pixel identities, and register only strong matches.
No assumed numeric English->Korean mapping. Existing Korean held images excluded.
Run on GitHub Actions runner with outbound image access.
"""
import os, io, json, hashlib, time, re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image
import imagehash

ROOT='data/audits/'
RESULT=ROOT+'theme-xy-verified-cameo-image-match-20261027.json'
CHECKPOINT=ROOT+'theme-xy-all-37-sets-review-checkpoint-20261026.json'
MANIFEST=ROOT+'theme-xy-scene-review-manifest-20261026.json'
REVIEW=ROOT+'theme-series-review-status.json'
UA={'User-Agent':'Mozilla/5.0 (XYIllustrationResearch/2026; Pokemon card catalog audit)'}
SRC='https://www.elitefourum.com/t/list-of-all-pokemon-tcg-cameos-english/31105'
SET_DATA=[
 # English expansion code, numbered card: background Pokemon cameos, as independently inspected.
 ('xy3',[(11,'Electivire'),(14,'Dragonite'),(30,'Slaking, Magmortar'),(31,'Breloom'),(32,'Mienshao'),(37,'Machamp'),(47,'Machoke'),(49,'Electabuzz'),(67,'Minun, Plusle'),(76,'Hariyama'),(88,'Patrat'),(109,'Patrat'),(110,'Amaura')]),
 ('xy4',[(108,'Zoroark')]),
 ('dc1',[(6,'Sharpedo, Seviper, Walrein'),(8,'Numel'),(9,'Zangoose'),(15,'Claydol, Camerupt, Zangoose'),(22,'Camerupt, Baltoy, Aggron, Claydol, Mightyena')]),
 ('xy6',[(1,'Spearow'),(2,'Spearow'),(20,'Fletchling'),(41,'Meowth'),(67,'Inkay')]),
 ('xy7',[(12,'Wingull'),(22,'Remoraid, Mantine'),(41,'Gligar'),(60,'Sliggoo')]),
 ('xy8',[(9,'Snorlax'),(27,'Lumineon, Horsea'),(46,'Frogadier'),(47,'Froakie'),(57,'Pancham, Chespin'),(69,'Mr. Mime, Starmie'),(77,'Pikachu'),(78,'Mega Mewtwo'),(96,'Hariyama, Ponyta'),(99,'Stunfisk'),(101,'Mewtwo'),(102,'Snubbull, Meloetta'),(118,'Chespin'),(143,'Pikachu'),(163,'Zoroark, Meloetta, Haxorus'),(165,'Chesnaught, Cresselia, Magnezone')]),
 ('xy9',[(1,'Fennekin'),(19,'Ducklett, Shellder'),(51,'Clefairy'),(54,'Espeon'),(67,'Trevenant'),(81,'Hypno'),(96,'Cresselia, Crawdaunt, Umbreon, Weavile, Crobat'),(107,'Yamask, Petilil, Sigilyph'),(123,'Greninja, Manaphy')]),
 ('g1',[(36,'Machamp'),(40,'Geodude'),(47,'Machoke'),(68,'Pikachu'),(69,'Pancham, Flabebe, Sableye, Banette, Skitty'),('RC1','Pikachu'),('RC7','Pikachu'),('RC20','Swirlix'),('RC21','Eevee'),('RC22','Floette'),('RC24','Dedenne, Sylveon'),('RC27','Ralts'),('RC28','Vaporeon, Jolteon'),('RC30','Ralts, Kirlia'),('RC32','Eevee')]),
 ('xy10',[(10,'Chikorita'),(31,'Exploud, Minccino, Wigglytuff'),(33,'Shellder'),(36,'Zubat'),(63,'Alakazam'),(65,'Snivy, Spoink'),(71,'Pikachu'),(103,'Roselia'),(105,'Zorua'),(107,'Pancham, Flabebe, Sableye, Banette, Skitty'),(108,'Zygarde'),(125,'Umbreon')]),
 ('xy11',[(23,'Braviary'),(27,'Remoraid'),(37,'Bergmite'),(45,'Nidoran'),(53,'Mankey'),(89,'Flabebe'),(114,'Pikachu, Chespin'),(115,'Xerneas'),(116,'Yveltal')]),
 ('xy12',[(82,'Dugtrio'),(88,'Magnemite, Kakuna'),(113,'Meowth')]),
 ('xy2',[(88,'Emboar')]),
 # Special XY promo reprints can match by art only, not by promotional numbers.
 ('xyp',[(27,'Vivillon, Psyduck, Froakie, Gogoat, Pikachu, Braviary'),(75,'Latios'),(76,'Palkia, Latios'),(78,'Braviary, Noibat'),(79,'Palkia'),(91,'Ducklett, Psyduck, Pikachu, Rapidash, Swanna'),(95,'Chespin, Sylveon'),(113,'Luvdisc, Phione'),(121,'Magmar, Flareon'),(122,'Gyarados, Vaporeon'),(123,'Vileplume, Scyther'),(124,'Jolteon, Electabuzz'),(139,'Spritzee, Kirlia'),(177,'Umbreon')])
]
KRN={
'Pikachu':'피카츄','Charizard':'리자몽','Charmander':'파이리','Chespin':'도치마론',
'Sylveon':'님피아','Eevee':'이브이','Flareon':'부스터','Vaporeon':'샤미드','Jolteon':'쥬피썬더',
'Latios':'라티오스','Palkia':'펄기아','Braviary':'워글','Noibat':'음뱃',
'Froakie':'개구마르','Gogoat':'고고트','Ducklett':'꼬지보리','Psyduck':'고라파덕',
'Rapidash':'날쌩마','Swanna':'스완나','Machamp':'괴력몬','Machoke':'근육몬',
'Zoroark':'조로아크','Zorua':'조로아','Dugtrio':'닥트리오','Magnemite':'코일',
'Meowth':'나옹','Starmie':'아쿠스타','Alakazam':'후딘','Umbreon':'블래키',
'Ralts':'랄토스','Kirlia':'킬리아','Fennekin':'푸호꼬','Snorlax':'잠만보',
'Hypno':'슬리퍼','Mewtwo':'뮤츠','Gligar':'글라이거','Zygarde':'지가르데',
'Manaphy':'마나피','Cresselia':'크레세리아','Dedenne':'데덴네','Meloetta':'메로엣타',
'Minun':'마이농','Plusle':'플러시','Spearow':'깨비참','Stunfisk':'메더',
'Electivire':'에레키블','Remoraid':'총어','Shellder':'셀러','Geodude':'꼬마돌',
'Raichu':'라이츄','Lumineon':'네오라이트','Horsea':'쏘드라',
'Breloom':'버섯모','Magmortar':'마그마번','Electabuzz':'에레브','Hariyama':'하리뭉',
'Wigglytuff':'푸크린','Trevenant':'대로트','Fletchling':'화살꼬빈',
'Zubat':'주뱃','Frogadier':'개굴반장','Inkay':'오케이징','Sableye':'깜까미',
'Banette':'다크펫','Skitty':'에나비','Flabebe':'플라베베'
}
def read(p):
 with open(p,'r',encoding='utf8') as f:return json.load(f)
def save(p,v):
 os.makedirs(os.path.dirname(p),exist_ok=True)
 with open(p,'w',encoding='utf8') as f:json.dump(v,f,indent=2,ensure_ascii=False);f.write('\n')
def norm(s):return str(s or '').lower()
def scanim(u):
 req=urllib.request.Request(u,headers=UA)
 with urllib.request.urlopen(req,timeout=24) as r:
  raw=r.read(1_200_000)
  if len(raw)<4000:raise ValueError('image too small')
  return Image.open(io.BytesIO(raw)).convert('RGB'),hashlib.sha256(raw).hexdigest()
def hashes(im):
 w,h=im.size
 crops={
  'f':im,
  'a':im.crop((round(w*.10),round(h*.13),round(w*.89),round(h*.52))),
  'i':im.crop((round(w*.13),round(h*.16),round(w*.85),round(h*.49)))
 }
 return {k:{'p':str(imagehash.phash(v)),'d':str(imagehash.dhash(v))} for k,v in crops.items()}
def item_process(item):
 try:
  image,sha=scanim(item['image'])
  return item,{'imageSha256':sha,'hashes':hashes(image),'status':'downloaded','width':image.width,'height':image.height}
 except Exception as e:
  return item,{'status':'download-failed','error':str(e)[:230]}
def dist(h1,h2,k,t):
 return int(imagehash.hex_to_hash(h1[k][t])-imagehash.hex_to_hash(h2[k][t]))
def comparison(k,e):
 a,b=k['hashes'],e['hashes']
 return {key:dist(a,b,key,t) for key,t in [('f','p'),('a','p'),('a','d'),('i','d')]}
def confidence(v):
 # Conservative exact-art gate calibrated against XY8 Axew 108/109:
 # correct whole-card distances 4/6; corresponding cropped-art phash 8;
 # wrong Axew alternative artwork 8/full and 18/cropped.
 return (v['f']<=6 and v['a']<=10 and v['ad']<=10 and v['id']<=11) or (
         v['f']<=4 and v['a']<=12 and v['ad']<=9 and v['id']<=10)
def score(v):return 2*v['f']+v['a']+v['ad']+v['id']
art=read('data/art-themes.json')
checkpoint=read(CHECKPOINT)
manifest=read(MANIFEST)
reviews=read(REVIEW)
sources=[s for s in (read('data/series.json')+read('data/series-legacy.json')) if s.get('era')=='XY']
assert len(sources)==37 and sum(len(s['cards']) for s in sources)==2313
assert sum(len(g['cards']) for g in art['groups'])==24186
assert checkpoint['currentXYThemeRows']==2162
assert manifest['cardinality']['independentXYThemeRows']==2162
assert manifest['cardinality']['individuallyAllTwelveScreened']==5
flat=[{'set':s['code'],'code':c['code'],'name':c['name'],'image':c.get('image',''),
       'source':c.get('source',''),'setName':s.get('displayName',''),'rarity':c.get('rarity',''),
       'ordinal':idx+1} for idx,(s,c) in enumerate((s,c) for s in sources for c in s['cards'])]
eligible=[x for x in flat if x['image'].startswith('https://cards.image.pokemonkorea.co.kr/')]
print('SOURCE_CARDS',len(flat),'OFFICIAL_KOREAN_IMAGE_CANDIDATES',len(eligible),flush=True)
results={}
with ThreadPoolExecutor(max_workers=22) as pool:
 futs=[pool.submit(item_process,x) for x in eligible]
 for i,fu in enumerate(as_completed(futs),1):
  x,v=fu.result()
  results[norm(x['set'])+'|'+norm(x['code'])]={'card':x,**v}
  if i%200==0:print('KOREAN_HASH_PROGRESS',i,'/',len(eligible),flush=True)
english=[{'set':code,'n':str(num),'image':f'https://images.pokemontcg.io/{code}/{num}.png','cameos':cameos}
        for code,nums in SET_DATA for num,cameos in nums]
er={}
with ThreadPoolExecutor(max_workers=14) as pool:
 futs=[pool.submit(item_process,x) for x in english]
 for f in as_completed(futs):
  x,v=f.result()
  er[x['set']+'|'+x['n']]={'card':x,**v}
print('IMAGE_DOWNLOADS',json.dumps({'koreanOk':sum(v['status']=='downloaded' for v in results.values()),'koreanFail':sum(v['status']!='downloaded' for v in results.values()),
'EnglishOk':sum(v['status']=='downloaded' for v in er.values()),'EnglishFail':sum(v['status']!='downloaded' for v in er.values())}),flush=True)
kos=[v for v in results.values() if v['status']=='downloaded']
matched=[];unmatched=[];uncertain=[]
for k,e in er.items():
 if e['status']!='downloaded':unmatched.append({'english':k,'reason':'download failed'});continue
 distances=[(score(v),v['card'],v) for v in (
  {'f':comparison(c,e)['f'],'a':comparison(c,e)['a'],
   'ad':comparison(c,e)['a'],'id':comparison(c,e)['i']}
   for c in kos)]
 # NOTE: corrected art distance metrics are calculated below for accepted shortlists.
 shortlist=[]
 for c in kos:
  ko=c['card']
  # Prefer matching expansion timing, but do not assume Korean numbering.
  v={'f':dist(c['hashes'],e['hashes'],'f','p'),
     'a':dist(c['hashes'],e['hashes'],'a','p'),
     'ad':dist(c['hashes'],e['hashes'],'a','d'),
     'id':dist(c['hashes'],e['hashes'],'i','d')}
  if confidence(v):shortlist.append((score(v),ko,v))
 shortlist.sort(key=lambda x:x[0])
 if not shortlist:
  unmatched.append({'english':k,'reason':'no strong artwork image match'});continue
 if len(shortlist)>4:
  uncertain.append({'english':k,'reason':'too many visually plausible duplicates','candidates':[{ 'card':z[1]['set']+'|'+z[1]['code'],'distance':z[2]} for z in shortlist[:8]]})
  continue
 for scoreVal,ko,v in shortlist:
  matched.append({'englishSet':e['card']['set'],'englishCardNumber':e['card']['n'],
   'originalArtworkSource':e['card']['image'],'koreanSet':ko['set'],
   'koreanPrintedNumber':ko['code'].split('_')[-1],'koreanCardCode':ko['code'],
   'koreanName':ko['name'],'koreanImage':ko['image'],'koreanCardDetail':ko['source'],
   'koreanOrdinal':ko['ordinal'],'otherPokemonEnglish':e['card']['cameos'],
   'otherPokemonKorean':', '.join(KRN.get(x.strip(),x.strip()) for x in e['card']['cameos'].split(',')),
   'imageHashProof':v,'matchScore':scoreVal,'sourceForCameos':SRC,
   'fullTwelveThemeScreened':False,'humanKoreanCardVisuallyCertified':False})
print('SCENE_MATCH_CANDIDATES',len(matched),'UNCERTAIN',len(uncertain),'UNMATCHED',len(unmatched),flush=True)
for v in matched[:45]:
 print('MATCH',json.dumps({k:v[k] for k in ['englishSet','englishCardNumber','koreanSet','koreanCardCode','koreanName','otherPokemonEnglish','matchScore','imageHashProof']},ensure_ascii=False),flush=True)
# Preserve data unless both visual identity and original English cameo classification
# are supported. Images are cropped and hashed, so these remain PARTIAL scene proofs,
# not a full 12-category manual screen of Korean cards.
registered=[];existing=[];failed=[]
cameo=next(g for g in art['groups'] if g['code']=='cameo')
cardByKey={(norm(s['code']),norm(c['code'].split('/')[0])):(s,c) for s in sources for c in s['cards']}
existingIds={(norm(x.get('set')),norm(x.get('code'))) for x in cameo['cards']}
for entry in matched:
 cid=entry['koreanCardCode'].split('/')[0]
 key=(norm(entry['koreanSet']),norm(cid))
 pair=cardByKey.get(key)
 if not pair:
  failed.append({'why':'missing-master-card','entry':entry});continue
 if key in existingIds:
  existing.append(entry);continue
 s,c=pair
 if not entry['koreanCardDetail'].startswith('https://pokemoncard.co.kr/cards/detail/'):
  failed.append({'why':'no-Korean-official-detail','entry':entry});continue
 name=entry['otherPokemonKorean']
 cameo['cards'].append({
  'code':cid.upper(),'name':c['name'],'series':'XY','set':s['code'],
  'setName':s.get('displayName',''),'cardNumber':c['code'].split('_')[1],
  'rarity':c.get('rarity',''),'category':'카메오 · '+name,'image':c['image'],
  'evidence':'영문판 원화의 다른 포켓몬 등장 수작업 목록과 한국판 카드 이미지 지각 해시를 교차 확인. 등장: '+name+
   '. 독립 출처: '+SRC+' ; 영문 원화: '+entry['originalArtworkSource']+
   ' ; 한국 공식 카드: '+c['source']+' ; 크롭 해시거리: '+json.dumps(entry['imageHashProof'])+
   '. 동일 일러스트에 대한 카메오 테마만 부분 승인; 나머지 11개 테마 미검수.'
 })
 existingIds.add(key)
 registered.append(entry)
print('SCENE_INSERTED',len(registered),'ALREADY_REGISTERED',len(existing),'REJECTED',len(failed),flush=True)
# Mutations apply only to verified artwork-same cards, without changing 5 full approvals.
inc={};
for e in registered:
 inc.setdefault(norm(e['koreanSet']),{}).setdefault(norm(e['koreanCardCode'].split('/')[0]),[]).append('cameo')
for setrow in checkpoint['sets']:
 s=norm(setrow['code'])
 if s not in inc:continue
 for c in setrow['cards']:
  adds=inc[s].get(norm(c['code'].split('/')[0]),[])
  if adds:
   assert c['reviewStatus']!='artwork-screened-12-themes'
   c['registeredThemes']=sorted(set(c['registeredThemes']+adds))
   c['reviewStatus']='partial-theme-evidence'
 setrow['currentThemeRows']+=sum(len(v) for v in inc[s].values())
for setrow in manifest['sets']:
 s=norm(setrow['set'])
 if s not in inc:continue
 for c in setrow['cards']:
  adds=inc[s].get(norm(c['code'].split('/')[0]),[])
  for t in adds:
   assert c['themeReview'][t]=='not-screened'
   c['themeReview'][t]='scene-evidence-partial'
  if adds:
   assert c['allTwelveVisuallyScreened'] is False
   c['registeredThemes']=sorted(set(c['registeredThemes']+adds))
 setrow['themeRows']+=sum(len(v) for v in inc[s].values())
 setrow['scenePartiallyReviewed']=sum(1 for c in setrow['cards'] if not c['allTwelveVisuallyScreened'] and any(t!='color' for t in c['registeredThemes']))
for code in inc:
 k=next((x for x in reviews['reviews'] if norm(x)==code),None)
 if k:
  assert reviews['reviews'][k].get('status')!='complete'
  reviews['reviews'][k]['status']='partial'
  reviews['reviews'][k]['sceneEvidenceBatch']=RESULT
rowsNow=sum(len(x['cards']) for x in art['groups'])
xyNow=sum(s['currentThemeRows'] for s in checkpoint['sets'])
assert rowsNow==24186+len(registered)
assert xyNow==2162+len(registered)
assert sum(s['themeRows'] for s in manifest['sets'])==xyNow
assert checkpoint['newArtworkFullyScreenedCount']==5
assert manifest['cardinality']['individuallyAllTwelveScreened']==5
checkpoint['currentXYThemeRows']=xyNow
checkpoint['newThemeRows']=xyNow-checkpoint['originalThemeRows']
manifest['cardinality']['independentXYThemeRows']=xyNow
manifest['cardinality']['independentAllThemeRows']=rowsNow
art['updatedAt']='2026-10-27'
reviews['updatedAt']='2026-10-27'
# Evidence summary excludes image URLs with exceptions from output logs; no user state changed.
summary={
 'schemaVersion':1,'date':'2026-10-27','era':'XY',
 'phase':'English-illustration-and-Korean-image-hash-crossmatched-cameo-review',
 'sourceForManuallyObservedEnglishCameos':SRC,
 'EnglishArtworkExamined':len(english),
 'KoreanOfficialArtworkURLsExamined':len(eligible),
 'KoreanArtworkSuccessfullyDownloaded':len(kos),
 'KoreanArtworkUnreachable':len(eligible)-len(kos),
 'EnglishArtworkSuccessfullyDownloaded':sum(x['status']=='downloaded' for x in er.values()),
 'artworkIdentityMatches':len(matched),
 'sceneThemeRowsNew':len(registered),
 'alreadyRegisteredCameos':len(existing),
 'newEntries':registered,
 'existingEntriesNotChanged':len(existing),
 'uncertainArtworkCandidatesHeld':uncertain,
 'unmatchedEnglishArt':unmatched,
 'newStandaloneXYRows':xyNow,
 'newAllThemeRows':rowsNow,
 'full12ScreenedPreviously':5,
 'full12ScreenedNow':5,
 'remaining12ThemeCardReviews':2308,
 'imageHeldExisting':196,
 'reviewPolicy':'Only cameo from manually visually screened English art and robust Korean-vs-English identity match is approved; 12-theme manual certification remains open.'
}
save(RESULT,summary)
save('data/art-themes.json',art)
save(CHECKPOINT,checkpoint)
save(MANIFEST,manifest)
save(REVIEW,reviews)
testPath='tests/theme-card-identity.test.mjs'
s=open(testPath,encoding='utf8').read()
old='assert.equal(total,24186);'
assert s.count(old)==1,'Unexpected test baseline, reconcile main first'
with open(testPath,'w',encoding='utf8') as f:f.write(s.replace(old,'assert.equal(total,'+str(rowsNow)+');'))
print('RESULT_SUMMARY',json.dumps({k:summary[k] for k in ['EnglishArtworkExamined','KoreanOfficialArtworkURLsExamined','artworkIdentityMatches','sceneThemeRowsNew','newStandaloneXYRows','newAllThemeRows','remaining12ThemeCardReviews']},ensure_ascii=False),flush=True)
