#!/usr/bin/env node
/**
 * Restore XY 12-theme scene review with an evidence-backed, idempotent six-row tranche.
 * Critical: original art with Korean master-number identity is confirmed, but none of
 * the three cards is certified as 12/12 fully visually screened here.
 * Previous 100-card source checkpoints are immutable and their hashes preserved.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const norm=s=>String(s??'').toLowerCase();
const art=read('data/art-themes.json');
const sources=[...read('data/series.json'),...read('data/series-legacy.json')].filter(s=>s.era==='XY');
const reviews=read('data/audits/theme-series-review-status.json');
const checkpointPath='data/audits/theme-xy-all-37-sets-review-checkpoint-20261026.json';
const checkpoint=read(checkpointPath);
const manifestPath='data/audits/theme-xy-scene-review-manifest-20261026.json';
const manifest=read(manifestPath);
const sceneOutput='data/audits/theme-xy-original-art-scene-batch-002-20261027.json';
const tm=new Map(art.groups.map(g=>[g.code,g]));
const sm=new Map(sources.map(s=>[norm(s.code),s]));
const countRows=()=>art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(countRows(),24180);
assert.equal(checkpoint.currentXYThemeRows,2156);
assert.equal(manifest.cardinality.independentXYThemeRows,2156);
assert.equal(manifest.cardinality.individuallyAllTwelveScreened,5);
assert.equal(sources.length,37);
assert.equal(sources.reduce((n,s)=>n+s.cards.length,0),2313);
assert.deepEqual([...tm.keys()].sort(),['sleeping','connected','evolution','night','season','color','sunset','reflections','food','street','work','cameo'].sort());

const evidenceSource={
 blue:'https://www.illudex.com/card/xy8-108',
 red:'https://www.illudex.com/card/xy8-109',
 magnemite:'https://bulbapedia.bulbagarden.net/wiki/Magnemite_(BREAKthrough_51)',
 mappings:'https://bulbapedia.bulbagarden.net/wiki/BREAKthrough_(TCG)'
};
// The illustrations 108+109 form a sequential fruit scene, not a single continuous panorama.
const changes=[
 {set:'XY8-Bb',num:45,name:'터검니',theme:'connected',
  category:'터검니 · 과일 이야기 (야외에서 차내로)',scene:'숲에서 과일을 먹는 터검니와 차내에서 과일을 손질하는 터검니의 두 장면이 이어지는 이야기',
  original:'https://images.pokemontcg.io/xy8/108_hires.png',source:evidenceSource.blue,illustrator:'Kagemaru Himeno',connectionType:'sequential-story'},
 {set:'XY8-Br',num:48,name:'터검니',theme:'connected',
  category:'터검니 · 과일 이야기 (야외에서 차내로)',scene:'숲에서 과일을 먹는 터검니와 차내에서 과일을 손질하는 터검니의 두 장면이 이어지는 이야기',
  original:'https://s3.pokeos.com/pokeos-uploads/tcg/eng/src/xy8_en_109.png',source:evidenceSource.red,illustrator:'Kagemaru Himeno',connectionType:'sequential-story'},
 {set:'XY8-Bb',num:45,name:'터검니',theme:'food',
  category:'과일 · 열매 먹기',scene:'터검니가 과일을 먹고, 나무와 과일 및 사람들이 둘러싼 야외 장면',
  original:'https://images.pokemontcg.io/xy8/108_hires.png',source:evidenceSource.blue,illustrator:'Kagemaru Himeno'},
 {set:'XY8-Br',num:48,name:'터검니',theme:'food',
  category:'과일 · 손질과 식사',scene:'터검니가 차내 조리 공간에서 과일을 손질하고 접시에 담는 장면',
  original:'https://s3.pokeos.com/pokeos-uploads/tcg/eng/src/xy8_en_109.png',source:evidenceSource.red,illustrator:'Kagemaru Himeno'},
 {set:'XY8-Br',num:48,name:'터검니',theme:'work',
  category:'요리 · 음식 준비 돕기',scene:'터검니가 과일을 자르고 플레이팅하는 작업을 돕는 장면',
  original:'https://s3.pokeos.com/pokeos-uploads/tcg/eng/src/xy8_en_109.png',source:evidenceSource.red,illustrator:'Kagemaru Himeno'},
 {set:'XY8-Bb',num:21,name:'코일',theme:'night',
  category:'밤 · 어두운 숲',scene:'어두운 숲과 나무 사이에 빛나는 코일, 달빛처럼 보이는 배경 조명',
  original:'https://totalcards.net/cdn/shop/files/pkm-bkt-051.jpg?v=1711543707&width=535',source:evidenceSource.magnemite,illustrator:'Akira Komayama'}
];
const results=[];
const masterXY=new Map(sources.flatMap(s=>s.cards.map(c=>[norm(s.code)+'|'+norm(c.code.split('/')[0]),{s,c}])));
for(const item of changes){
 const code=item.set.toUpperCase()+'_'+String(item.num).padStart(3,'0');
 const row=masterXY.get(norm(item.set)+'|'+norm(code));
 assert(row,'Korean master set and printed number missing '+code);
 const {s,c}=row;
 assert.equal(c.name,item.name,'Korean card name differs: '+code);
 assert(c.source?.startsWith('https://pokemoncard.co.kr/cards/detail/'),'Missing official Korean card ID: '+code);
 assert(c.image?.startsWith('https://cards.image.pokemonkorea.co.kr/'),'Not a canonical Korean image: '+code);
 const theme=tm.get(item.theme);
 assert(theme,'Unknown theme '+item.theme);
 assert(!theme.cards.some(x=>norm(x.set)===norm(s.code)&&norm(x.code)===norm(code)),'Already registered '+code+' '+item.theme);
 theme.cards.push({
  code,name:c.name,series:'XY',set:s.code,setName:s.displayName,
  cardNumber:c.code.split('_')[1],rarity:c.rarity||'',
  category:item.category,image:c.image,
  evidence:'원본 XY8 그림과 한국판 공식 마스터 세트·이름·번호를 대조. '+item.scene+
   '. 원화: '+item.original+' ; 장면 자료: '+item.source+
   ' ; 인쇄판 식별: '+evidenceSource.mappings+
   '. 해당 장면 테마만 부분 승인; 한국판 실물 하단 인쇄와 12개 테마 전체 시각검수를 인증하지 않음.'
 });
 results.push({
  set:s.code,code,printedNumber:c.code.split('_')[1],name:c.name,theme:item.theme,
  category:item.category,scene:item.scene,illustrator:item.illustrator,
  sceneType:item.connectionType||'single-card-scene',
  koreanOfficialCardDetail:c.source,canonicalKoreanArtwork:c.image,
  originalArtworkReference:item.original,originalIllustrationSource:item.source,
  printingMappingSource:evidenceSource.mappings,
  KoreanPhysicalFooterVisuallyCertified:false,
  allTwelveThemesScreened:false,
  reviewStatus:'scene-specific-partial'
 });
}
assert.equal(results.length,6);
assert.equal(countRows(),24186);
const xyRows=art.groups.flatMap(g=>g.cards.filter(c=>sm.has(norm(c.set))).map(c=>({set:c.set,code:c.code,theme:g.code})));
assert.equal(xyRows.length,2162);
const addMap=new Map();
for(const x of results){
 const k=norm(x.set)+'|'+norm(x.code);
 if(!addMap.has(k)) addMap.set(k,[]);
 addMap.get(k).push(x.theme);
}
assert.equal(addMap.size,3);
const masterOrdinals=new Map(sources.flatMap(s=>s.cards.map(c=>({set:s.code,code:c.code}))).map((c,i)=>[norm(c.set)+'|'+norm(c.code.split('/')[0]),i+1]));
for(const x of results) x.masterOrdinal=masterOrdinals.get(norm(x.set)+'|'+norm(x.code));
assert.deepEqual([...new Set(results.map(x=>x.masterOrdinal))].sort((a,b)=>a-b),[962,986,1092]);
for(const group of checkpoint.sets){
 if(!['xy8-bb','xy8-br'].includes(norm(group.code)))continue;
 group.currentThemeRows=xyRows.filter(x=>norm(x.set)===norm(group.code)).length;
 for(const c of group.cards){
  const adds=addMap.get(norm(group.code)+'|'+norm(c.code.split('/')[0]))||[];
  if(!adds.length) continue;
  assert.notEqual(c.reviewStatus,'artwork-screened-12-themes');
  c.registeredThemes=[...new Set([...c.registeredThemes,...adds])].sort();
  c.reviewStatus='partial-theme-evidence';
 }
}
checkpoint.currentXYThemeRows=2162;
checkpoint.newThemeRows=2162-checkpoint.originalThemeRows;
assert.equal(checkpoint.newArtworkFullyScreenedCount,5);
assert.equal(checkpoint.remainingArtworkNotFullyScreenedCount,2308);
assert.equal(checkpoint.strictCompletedSetCount,0);
assert.equal(checkpoint.sets.reduce((n,s)=>n+s.currentThemeRows,0),2162);
for(const set of manifest.sets){
 const addsForSet=results.filter(x=>norm(x.set)===norm(set.set));
 if(!addsForSet.length)continue;
 for(const c of set.cards){
  const adds=addMap.get(norm(set.set)+'|'+norm(c.code.split('/')[0]))||[];
  for(const theme of adds){
   assert.equal(c.themeReview[theme],'not-screened');
   c.themeReview[theme]='scene-evidence-partial';
  }
  if(adds.length){
   assert.equal(c.allTwelveVisuallyScreened,false);
   c.registeredThemes=[...new Set([...c.registeredThemes,...adds])].sort();
  }
 }
 set.themeRows+=addsForSet.length;
 set.scenePartiallyReviewed=set.cards.filter(c=>!c.allTwelveVisuallyScreened&&c.registeredThemes.some(t=>t!=='color')).length;
}
manifest.cardinality.independentXYThemeRows=2162;
manifest.cardinality.independentAllThemeRows=24186;
assert.equal(manifest.sets.reduce((n,s)=>n+s.themeRows,0),2162);
for(const setName of ['XY8-Bb','XY8-Br']){
 const key=Object.keys(reviews.reviews).find(x=>norm(x)===norm(setName))||setName;
 const prev=reviews.reviews[key]??{};
 assert.notEqual(prev.status,'complete');
 reviews.reviews[key]={...prev,status:'partial',sceneEvidenceBatch:sceneOutput,
  sceneThemeProofNote:'2026-10-27 원본 일러스트 3장/6개 부분 테마 근거. 12개 테마 전체 미완료'};
}
art.updatedAt='2026-10-27';
reviews.updatedAt='2026-10-27';
write('data/art-themes.json',art);
write('data/audits/theme-series-review-status.json',reviews);
write(checkpointPath,checkpoint);
write(manifestPath,manifest);
write(sceneOutput,{
 schemaVersion:1,recordedAt:'2026-10-27',era:'XY',
 phase:'individual-original-art-scene-proof',
 baseMainCommit:'1dbed00a6f22fadd0eebdb5a97564e44b498eda0',
 batchNumber:2,reviewedUniqueOriginalIllustrations:3,approvedPartialThemeMemberships:6,
 entries:results,sceneStoryGroup:'터검니 · 과일 이야기 (야외에서 차내로)',
 nextArtworksStillNotFullyScreened:2308,
 previousFullTwelveComplete:5,nowFullTwelveComplete:5,
 imageColorVerifiedPrior:2117,imageHeldPrior:196,
 lastSourceCheckpoint:'data/audits/theme-xy-100-card-progress-20261026.json',
 legacy100CardCheckpointsModified:false,
 notes:'독립된 장면 증거 추가. 위의 3장도 전체 12테마를 끝까지 검사한 것으로 처리하지 않음. 기존 100장 단위 출처 검수 기록은 보존.'
});
const testPath='tests/theme-card-identity.test.mjs';
let test=fs.readFileSync(testPath,'utf8');
assert.equal(test.split('assert.equal(total,24180);').length,2,'Theme test baseline differs; reconcile first');
fs.writeFileSync(testPath,test.replace('assert.equal(total,24180);','assert.equal(total,24186);'));
console.log('XY_RESUMED_SCENE_PROOFS',JSON.stringify({originalIllustrations:3,partialThemeRows:6,independentThemeRows:24186,XYRows:2162,fullyScreened12:5,remaining:2308}));
