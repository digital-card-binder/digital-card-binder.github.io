#!/usr/bin/env node
// Resume evidence-based XY CP3 scene review. Never certify unseen artwork.
import fs from "node:fs";
import assert from "node:assert/strict";
const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+"\n");
const n=s=>String(s||"").toLowerCase();
const themes=load("data/art-themes.json");
const series=[...load("data/series.json"),...load("data/series-legacy.json")];
const xy=series.filter(s=>s.era==="XY");
const cp3=xy.find(s=>s.code==="CP3");
const status=load("data/audits/theme-series-review-status.json");
const checkpointPath="data/audits/theme-xy-all-37-sets-review-checkpoint-20261026.json";
const checkpoint=load(checkpointPath);
const masterCount=xy.reduce((count,set)=>count+set.cards.length,0);
const count=()=>themes.groups.reduce((a,g)=>a+g.cards.length,0);
assert.equal(xy.length,37);
assert.equal(masterCount,2313);
assert.equal(cp3.cards.length,32);
assert.equal(count(),24154);
assert.equal(checkpoint.newArtworkFullyScreenedCount,4);
assert.equal(status.reviews.CP3.reviewedCardCount,4);
const allSetKeys=new Set(xy.map(s=>n(s.code)));
const themeRows=()=>themes.groups.flatMap(g=>g.cards.filter(c=>allSetKeys.has(n(c.set))).map(c=>({theme:g.code,set:c.set,code:c.code})));
assert.equal(themeRows().length,2130,"XY color checkpoint unexpectedly changed");
const details=[
 {
   suffix:"001",
   pokemon:"치코리타",
   theme:"cameo",
   category:"피카츄 카메오 · 계단",
   scene:"목조 계단을 오르는 치코리타 뒤로 피카츄가 등장함",
   visualSource:"https://cimg.cowave.kr/image/vendor_inventory/59d1/841644136b7eb1fce6be4f6830baf87e86272edc43f9bffac9fae4e69509.jpg",
   supportingSource:"https://m.bunjang.co.kr/products/436823201",
   evidenceType:"Korean-language physical card photo, 001/032 C CP3 legible",
   twelveThemesScreened:true
 },
 {
   suffix:"014",
   pokemon:"꼴깍몬",
   theme:"food",
   category:"식탁 · 식사",
   scene:"소년과 꼴깍몬이 접시가 놓인 식탁에서 함께 식사하는 일러스트",
   visualSource:"https://www.yoyakunow.com/101113-large_default/pokemon-trading-card-game-cp3-014032-c-gulpin-rank-a.jpg",
   supportingSource:"https://pokemoncard.co.kr/cards/detail/BS2016003014",
   evidenceType:"Japanese CP3 014/032 illustration visually screened; Korean CP3 014 canonical archive color verified but Korean card footer not independently visualized",
   twelveThemesScreened:false
 }
];
for(const d of details){
 const card=cp3.cards.find(c=>n(c.code)==="cp3_"+d.suffix+"/032");
 assert.ok(card,"CP3 Korean master card not found "+d.suffix);
 assert.equal(card.name,d.pokemon);
 assert.equal(card.image,"https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP3/CP3_"+d.suffix+".png");
 const g=themes.groups.find(t=>t.code===d.theme);
 assert.ok(g,"theme not found "+d.theme);
 const code="CP3_"+d.suffix;
 assert.ok(!g.cards.some(c=>n(c.set)==="cp3"&&n(c.code)===n(code)),code+" duplicated");
 g.cards.push({
   code,name:card.name,series:"XY",set:"CP3",
   setName:cp3.displayName||cp3.name||"포켓심쿵 컬렉션",
   cardNumber:d.suffix+"/032",rarity:card.rarity||"",
   category:d.category,image:card.image,
   evidence:"2026-10-26 실제 일러스트 검토: "+d.scene+". 증거방식: "+
    d.evidenceType+". 시각자료: "+d.visualSource+
    " ; 부가 참조: "+d.supportingSource+
    ". 카드번호 일치 및 테마 근거를 확인했으나 37세트 전체 육안검수 완료를 뜻하지 않음."
 });
}
assert.equal(count(),24156);
assert.equal(themeRows().length,2132);
const cp3Set=checkpoint.sets.find(s=>s.code==="CP3");
assert.ok(cp3Set);
assert.equal(cp3Set.reviewedArtworkCount,4);
const cp3One=cp3Set.cards.find(c=>n(c.code)==="cp3_001/032");
assert.ok(cp3One);
const cp3Fourteen=cp3Set.cards.find(c=>n(c.code)==="cp3_014/032");
assert.ok(cp3Fourteen);
const list=themeRows();
const entriesByCard=new Map();
for(const row of list){
  const k=n(row.set)+":"+n(row.code);
  if(!entriesByCard.has(k))entriesByCard.set(k,[]);
  entriesByCard.get(k).push(row.theme);
}
const fullCards=new Set(checkpoint.visualEvidence.map(c=>n(c.code)));
assert.equal(fullCards.size,4);
fullCards.add("cp3_001");
checkpoint.visualEvidence.push({
  code:"CP3_001",printedNumber:"001/032",name:"치코리타",
  sourceMaster:cp3One.source,canonicalImage:cp3One.image,
  photoEvidence:details[0].visualSource,
  illustrationScene:details[0].scene,
  approvedThemes:{cameo:details[0].category},
  allTwelveThemesScreenedForThisCard:true
});
checkpoint.newArtworkFullyScreenedCount=5;
checkpoint.remainingArtworkNotFullyScreenedCount=2308;
checkpoint.originalThemeRows=8;
checkpoint.newThemeRows=2132-8;
checkpoint.currentXYThemeRows=2132;
checkpoint.visuallyScreenedSetCount=0;
checkpoint.strictCompletedSetCount=0;
for(const s of checkpoint.sets){
 const m=xy.find(x=>n(x.code)===n(s.code));
 assert.ok(m);
 s.reviewStatus="partial";
 s.reviewedArtworkCount=s.code==="CP3"?5:0;
 s.currentThemeRows=list.filter(x=>n(x.set)===n(s.code)).length;
 for(const card of s.cards){
   const k=n(s.code)+":"+n(card.code.split("/",1)[0]);
   card.registeredThemes=[...new Set(entriesByCard.get(k)||[])].sort();
   card.reviewStatus=fullCards.has(n(card.code.split("/",1)[0]))
     ?"artwork-screened-12-themes":
       card.registeredThemes.length>0?"partial-theme-evidence":"pending-visual-audit";
 }
}
assert.equal(checkpoint.sets.reduce((z,s)=>z+s.cards.length,0),2313);
assert.equal(checkpoint.sets.reduce((z,s)=>z+s.currentThemeRows,0),2132);
assert.equal(checkpoint.sets.find(s=>s.code==="CP3").cards.find(c=>n(c.code)==="cp3_001/032").reviewStatus,"artwork-screened-12-themes");
assert.equal(checkpoint.sets.find(s=>s.code==="CP3").cards.find(c=>n(c.code)==="cp3_014/032").reviewStatus,"partial-theme-evidence");
status.reviews.CP3.reviewedCardCount=5;
status.reviews.CP3.note+="; CP3 001 치코리타의 피카츄 카메오를 한국어 실물 사진으로 확인. CP3 014 음식 테마는 일본판 동일 원화 대조를 통한 부분 승인(한국판 실물 번호 시각 인증은 별도).";
status.updatedAt="2026-10-26";
themes.updatedAt="2026-10-26";
save("data/art-themes.json",themes);
save("data/audits/theme-series-review-status.json",status);
save(checkpointPath,checkpoint);
const review={
 schemaVersion:1,recordedAt:"2026-10-26",
 masterXYSets:37,masterXYCards:2313,
 independentlyArtworkScreenedCards:5,
 remainingNotAllThemeScreened:2308,
 previouslyColorScreened:2117,
 colorHeld:196,
 newSceneThemeRows:2,
 newSceneEntries:details.map(d=>({code:"CP3_"+d.suffix,theme:d.theme,name:d.pokemon,description:d.scene,evidenceType:d.evidenceType,reference:d.visualSource,allTwelveThemesScreened:d.twelveThemesScreened})),
 totalAllThemeRows:24156,
 totalXYThemeRows:2132,
 allXYSetsComplete:false,
 strictCompletedXYSets:0,
 nextQueue:"CP3 002, 006-009, 011-013, 015-032 and the rest of XY; require image-by-image semantic inspection. Photo mismatch/held 196 must be sourced separately."
};
save("data/audits/theme-xy-cp3-new-scene-evidence-20261026.json",review);
const testPath="tests/theme-card-identity.test.mjs";
let test=fs.readFileSync(testPath,"utf8");
const before="assert.equal(total,24154);";
assert.equal(test.split(before).length,2);
test=test.replace(before,"assert.equal(total,24156);");
fs.writeFileSync(testPath,test);
console.log("XY_CP3_SCENES",JSON.stringify(review));
