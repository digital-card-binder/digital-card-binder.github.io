#!/usr/bin/env node
/**
 * Add verified XY-illustration pair/group narratives as a resumable scene batch.
 * Evidence: two independent illustrated-card collection sources, Pokémon card
 * images, and current Korean master set identity. Do not certify missing themes.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const get=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const put=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const norm=s=>String(s??'').toLowerCase();
const art=get('data/art-themes.json');
const sets=[...get('data/series.json'),...get('data/series-legacy.json')].filter(s=>s.era==='XY');
const review=get('data/audits/theme-series-review-status.json');
const cp='data/audits/theme-xy-all-37-sets-review-checkpoint-20261026.json';
const checkpoint=get(cp);
const manifestPath='data/audits/theme-xy-scene-review-manifest-20261026.json';
const manifest=get(manifestPath);
const expected=['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'];
const tm=new Map(art.groups.map(g=>[g.code,g]));
const sm=new Map(sets.map(s=>[norm(s.code),s]));
const total=()=>art.groups.reduce((a,g)=>a+g.cards.length,0);
assert.equal(total(),24167);
assert.equal(checkpoint.currentXYThemeRows,2143);
assert.equal(manifest.cardinality.independentXYThemeRows,2143);
assert.equal(sets.length,37);
assert.equal(sets.reduce((a,s)=>a+s.cards.length,0),2313);
assert.deepEqual([...tm.keys()].sort(),expected.sort());
const grouping=[
 {set:'XY9',nums:[34,61],names:['슬리퍼','삐삐'],theme:'connected',label:'슬리퍼와 삐삐 · 최면 속 두 세계',reason:'슬리퍼가 가리키는 다른 세계와 삐삐가 최면에 빠져 들어가는 서로 이어지는 장면'},
 {set:'CP2',nums:[21,23,24],names:['화이트큐레무','레지기가스','아르세우스'],theme:'connected',label:'전설의 빛 · 3장 연작',reason:'세 전설 카드가 같은 성스러운 광휘와 공간 구도를 공유하는 3장 연작'},
 {set:'CP2',nums:[2,20],names:['레시라무','블랙큐레무'],theme:'connected',label:'전설의 빛 · 레시라무와 블랙큐레무',reason:'Mitsuhiro Arita가 그린 전설 컬렉션의 2장 연결 일러스트'},
 {set:'XY5-Bg',nums:[9,10],names:['볼비트','네오비트'],theme:'connected',label:'볼비트와 네오비트 · 빛나는 숲',reason:'같은 숲과 창의 구도가 양쪽 카드에 이어지는 Tomokazu Komiya 작품'},
 {set:'XY3',nums:[29,30],names:['플러시','마이농'],theme:'connected',label:'플러시와 마이농 · 짝꿍 그림',reason:'Akira Komayama의 2장 연결 일러스트'}
];
const sources=[
 'https://pokecahack.com/illust-connection/',
 'https://pokekarte.com/blogs/collection/connected-illustrations'
];
const result=[];
for(const g of grouping){
 const s=sm.get(norm(g.set));
 assert.ok(s,'XY set missing: '+g.set);
 assert.equal(g.nums.length,g.names.length);
 for(let i=0;i<g.nums.length;i++){
  const suffix=String(g.nums[i]).padStart(3,'0');
  const card=s.cards.find(c=>norm(c.code).startsWith(norm(g.set)+'_'+suffix+'/'));
  assert.ok(card,'Korean master number absent '+g.set+' '+suffix);
  assert.equal(card.name,g.names[i],g.set+' '+suffix+' Korean printed name mismatch');
  assert.ok(card.source?.startsWith('https://pokemoncard.co.kr/cards/detail/'));
  assert.ok(card.image?.startsWith('https://cards.image.pokemonkorea.co.kr/'));
  const code=g.set.toUpperCase()+'_'+suffix;
  const them=tm.get(g.theme);
  assert.ok(!them.cards.some(c=>norm(c.set)===norm(g.set)&&norm(c.code)===norm(code)),'Duplicate linked art card '+code);
  them.cards.push({
   code,name:card.name,series:'XY',set:s.code,setName:s.displayName,
   cardNumber:card.code.split('_')[1],rarity:card.rarity||'',
   category:g.label,image:card.image,
   evidence:'한국판 카드 번호·이름·공식 카드 상세 URL과 동일 원화 연결그림 자료를 교차 확인. 장면: '+g.reason+
    '. 자료: '+sources.join(' ; ')+
    '. 연결 테마만 부분 승인; 개별 카드의 12테마 전항목 및 실물 한글 하단 인쇄는 전수 인증하지 않음.'
  });
  result.push({set:s.code,code,printedNumber:card.code.split('_')[1],name:card.name,
   theme:g.theme,category:g.label,scene:g.reason,
   sourceKorean:card.source,canonicalImage:card.image,
   visualReferences:sources,allTwelveScreened:false,physicalKoreanFooterChecked:false});
 }
}
assert.equal(result.length,11);
// Two-way cameo interaction is independently visually corroborated by the art story.
for(const c of [
 {set:'XY9',num:34,name:'슬리퍼',other:'삐삐',cat:'삐삐 카메오 · 최면 세계'},
 {set:'XY9',num:61,name:'삐삐',other:'슬리퍼',cat:'슬리퍼 카메오 · 최면 세계'}
]){
 const s=sm.get(norm(c.set)), suffix=String(c.num).padStart(3,'0');
 const card=s.cards.find(x=>norm(x.code).startsWith(norm(c.set)+'_'+suffix+'/'));
 assert.ok(card&&card.name===c.name);
 const code=c.set+'_'+suffix, g=tm.get('cameo');
 assert.ok(!g.cards.some(x=>norm(x.set)===norm(c.set)&&norm(x.code)===norm(code)));
 g.cards.push({
  code,name:card.name,series:'XY',set:c.set,setName:s.displayName,
  cardNumber:card.code.split('_')[1],rarity:card.rarity||'',category:c.cat,image:card.image,
  evidence:c.name+' 카드의 배경 장면에 '+c.other+'가 묘사된 쌍방향 일러스트. 관련 장면과 번호: https://pokekarte.com/blogs/collection/connected-illustrations ; https://kotaku.com/pokemon-card-art-tcg-scarlet-violet-story-sword-shield-1850201705/6. 한국판 원본 테마 부분 분류이며 전체 12항목 확정 아님.'
 });
 result.push({set:c.set,code,printedNumber:card.code.split('_')[1],name:card.name,
 theme:'cameo',category:c.cat,scene:c.other+' 카메오',
 sourceKorean:card.source,canonicalImage:card.image,
 visualReferences:['https://pokekarte.com/blogs/collection/connected-illustrations','https://kotaku.com/pokemon-card-art-tcg-scarlet-violet-story-sword-shield-1850201705/6'],
 allTwelveScreened:false,physicalKoreanFooterChecked:false});
}
assert.equal(result.length,13);
assert.equal(total(),24180);
const identity=new Set(sets.map(s=>norm(s.code)));
const allRows=art.groups.flatMap(g=>g.cards.filter(c=>identity.has(norm(c.set))).map(c=>({set:c.set,code:c.code,theme:g.code})));
assert.equal(allRows.length,2156);
const conn=tm.get('connected').cards.filter(c=>c.series==='XY');
assert.equal(conn.length,11);
const addMap=new Map();
for(const entry of result){
 const k=norm(entry.set)+'|'+norm(entry.code);
 if(!addMap.has(k))addMap.set(k,[]);
 addMap.get(k).push(entry.theme);
}
assert.equal(addMap.size,11);
for(const s of checkpoint.sets){
 const entries=allRows.filter(row=>norm(row.set)===norm(s.code));
 s.currentThemeRows=entries.length;
 for(const c of s.cards){
  const key=norm(s.code)+'|'+norm(c.code.split('/')[0]);
  const adds=addMap.get(key)||[];
  if(adds.length){
   assert.notEqual(c.reviewStatus,'artwork-screened-12-themes');
   c.registeredThemes=[...new Set([...c.registeredThemes,...adds])].sort();
   c.reviewStatus='partial-theme-evidence';
  }
 }
}
checkpoint.newThemeRows=2156-checkpoint.originalThemeRows;
checkpoint.currentXYThemeRows=2156;
assert.equal(checkpoint.newArtworkFullyScreenedCount,5);
assert.equal(checkpoint.remainingArtworkNotFullyScreenedCount,2308);
assert.equal(checkpoint.sets.reduce((n,s)=>n+s.currentThemeRows,0),2156);
assert.equal(checkpoint.strictCompletedSetCount,0);
for(const s of manifest.sets){
 let addedCount=0;
 for(const c of s.cards){
  const key=norm(s.set)+'|'+norm(c.code.split('/')[0]);
  const adds=addMap.get(key)||[];
  if(!adds.length)continue;
  for(const theme of adds){
   assert.equal(c.themeReview[theme],'not-screened','Unexpected previous theme evidence');
   c.themeReview[theme]='scene-evidence-partial';
  }
  c.registeredThemes=[...new Set([...c.registeredThemes,...adds])].sort();
  assert.equal(c.allTwelveVisuallyScreened,false);
  addedCount+=adds.length;
 }
 s.themeRows+=addedCount;
 s.scenePartiallyReviewed=s.cards.filter(c=>!c.allTwelveVisuallyScreened&&c.registeredThemes.some(t=>t!=='color')).length;
}
manifest.cardinality.independentXYThemeRows=2156;
manifest.cardinality.independentAllThemeRows=24180;
assert.equal(manifest.sets.reduce((n,s)=>n+s.themeRows,0),2156);
const at=review.reviews;
for(const code of ['CP2','XY9','XY3','XY5-Bg']){
 const key=Object.keys(at).find(x=>norm(x)===norm(code))||code;
 const obj=at[key]??{};
 assert.notEqual(obj.status,'complete');
 at[key]={...obj,status:'partial',sceneThemeProofNote:'원본 연결 일러스트 그룹과 한국판 세트·번호 확인(13개 테마 배치); 이미지 전체 12테마 검수는 미완료',sceneEvidenceBatch:'data/audits/theme-xy-connected-groups-batch-001-20261026.json'};
}
review.updatedAt='2026-10-26';
art.updatedAt='2026-10-26';
put('data/art-themes.json',art);
put('data/audits/theme-series-review-status.json',review);
put(cp,checkpoint);
put(manifestPath,manifest);
put('data/audits/theme-xy-connected-groups-batch-001-20261026.json',{
 schemaVersion:1,date:'2026-10-26',
 scope:'XY original-art illustrated connected scenes with master-verified Korean card identities',
 sceneBatch:1,independentRowsAdded:13,uniqueCardArtInThisBatch:11,linkedGroups:5,
 entries:result,
 allMasterCards:2313,fullTwelveCardsBefore:5,fullTwelveCardsAfter:5,fullTwelveRemaining:2308,
 sourceColorReviewedBefore:2117,sourceColorHeldBefore:196,
 reviewType:'scene-specific-partial-only',remainingIsNotCompleted:true,
 expectedThemeRowsAfter:24180,expectedXYRowsAfter:2156,
 previousSourceEvidenceCheckpoint:'data/audits/theme-xy-100-card-progress-20261026.json'
});
const testPath='tests/theme-card-identity.test.mjs';
let test=fs.readFileSync(testPath,'utf8');
assert.equal(test.split('assert.equal(total,24167);').length,2);
fs.writeFileSync(testPath,test.replace('assert.equal(total,24167);','assert.equal(total,24180);'));
console.log('XY_SCENE_GROUPS',JSON.stringify({groups:5,uniqueImages:11,sceneThemeMemberships:13,independentXYRows:2156,remainingFullTwelve:2308}));
