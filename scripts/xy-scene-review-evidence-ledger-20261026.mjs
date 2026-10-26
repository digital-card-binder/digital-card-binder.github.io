#!/usr/bin/env node
// XY scene audit continuity: two photo-inspected scene memberships and an exact,
// replayable 37-set / 2,313-card 12-theme assessment manifest.
// The manifest distinguishes evidence-based selection from visual inspection
// and NEVER equates color pixels to 12-theme visual completion.
import fs from "node:fs";
import assert from "node:assert/strict";
const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+"\n");
const norm=x=>String(x??"").trim().toLowerCase();
const art=load("data/art-themes.json");
const master=[...load("data/series.json"),...load("data/series-legacy.json")].filter(s=>s.era==="XY");
const coverage=load("data/audits/theme-series-review-status.json");
const archived=load("data/audits/theme-xy-all37-image-color-proof-20261026.json");
const checkpointPath="data/audits/theme-xy-all-37-sets-review-checkpoint-20261026.json";
const checkpoint=load(checkpointPath);
const allCodes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const groups=Object.fromEntries(art.groups.map(g=>[g.code,g]));
const count=()=>art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.deepEqual(Object.keys(groups).sort(),[...allCodes].sort());
assert.equal(count(),24165);
assert.equal(master.length,37);
assert.equal(master.reduce((n,s)=>n+s.cards.length,0),2313);
assert.equal(archived.cards.length,2313);
assert.equal(archived.actualSourceImageColorReviewed,2117);
assert.equal(archived.held,196);
assert.equal(checkpoint.newArtworkFullyScreenedCount,5);
assert.equal(checkpoint.strictCompletedSetCount,0);
assert.equal(coverage.reviews.CP3.reviewedCardCount,5);
const cp3=master.find(s=>s.code==="CP3");
assert.equal(cp3.cards.length,32);
const candidates=[
 {
  n:"002",name:"버섯꼬",theme:"season",category:"꽃밭 · 연못",
  scene:"버섯꼬가 수련이 핀 연못 옆에서 알록달록한 꽃밭을 배경으로 있는 장면",
  source:"https://cdn.snkrdunk.com/uploads/media/pkmn-tcg-7322180-yu.jpg?size=l",
  proofScope:"Exact-number Japanese CP3 002 illustration, Korean CP3 canonical image source checked; Korean physical printed footer not separately certified"
 },
 {
  n:"029",name:"파비코리",theme:"cameo",category:"데덴네 · 님피아 카메오",
  scene:"파비코리와 함께 왼쪽에 데덴네, 오른쪽에 님피아가 등장하는 장면",
  source:"https://cdn.snkrdunk.com/uploads/media/pkmn-tcg-7322207-yu.jpg?size=l",
  proofScope:"Exact-number Japanese CP3 029 illustration, Korean CP3 canonical image source checked; Korean physical printed footer not separately certified"
 }
];
const setCodes=new Set(master.map(s=>norm(s.code)));
for(const c of candidates){
 const m=cp3.cards.find(x=>norm(x.code)==="cp3_"+c.n+"/032");
 assert.ok(m,"Korean exact-number CP3 card absent: "+c.n);
 assert.equal(m.name,c.name);
 assert.equal(m.image,"https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP3/CP3_"+c.n+".png");
 const group=groups[c.theme];
 const code="CP3_"+c.n;
 assert.ok(!group.cards.some(card=>norm(card.set)==="cp3"&&norm(card.code)===norm(code)),"Already classified "+code);
 group.cards.push({
   code,name:m.name,series:"XY",set:"CP3",
   setName:cp3.displayName||cp3.name||"포켓심쿵 컬렉션",
   cardNumber:c.n+"/032",rarity:m.rarity||"",
   category:c.category,image:m.image,
   evidence:"2026-10-26 그림 장면 직접 확인: "+c.scene+". 증거 URL: "+c.source+
     ". 검수 범위: "+c.proofScope+
     ". 해당 테마만 승인하며 남은 11개 테마 및 한국판 실물 하단 표기는 별도 보류."
 });
}
assert.equal(count(),24167);
const themesPerCard=new Map();
for(const group of art.groups){
 for(const card of group.cards){
  if(!setCodes.has(norm(card.set)))continue;
  const key=norm(card.set)+"|"+norm(card.code);
  const list=themesPerCard.get(key)||[];
  list.push({theme:group.code,category:card.category??"",evidence:card.evidence??""});
  themesPerCard.set(key,list);
 }
}
const nXY=[...themesPerCard.values()].reduce((a,arr)=>a+arr.length,0);
assert.equal(nXY,2143);
const evidenceById=new Map(archived.cards.map(r=>[norm(r.set)+"|"+norm(r.code),r]));
assert.equal(evidenceById.size,2313);
const alreadyFully=new Set(checkpoint.visualEvidence.map(e=>norm(e.code)));
assert.equal(alreadyFully.size,5);
const nextManifest={
 schemaVersion:1,
 recordedAt:"2026-10-26",
 policy:"An existing thematic membership does not certify absence from the other eleven themes. Archive pixel-color checking does not certify illustration story/cameos. Do not promote cards or sets to complete without actual visual evidence.",
 cardinality:{sets:37,cards:2313,individuallyAllTwelveScreened:5,remainingAllTwelveScreening:2308,archivalImageColorScreened:2117,archivalImageHeld:196,strictCompleteSets:0,independentXYThemeRows:2143,independentAllThemeRows:24167},
 classification:{
  manuallyFullyScreened:"Only five CP3 card IDs in the signed previous per-card visual checkpoint",
  scenePartial:"Has scene-specific independent themes but other themes not exhaustively checked",
  colorOnly:"Automated image pixel color reviewed, not a full visual scene review",
  held:"Archived image color unverified: source or image issue; requires Korean print confirmation",
 },
 registeredSceneAdditions:candidates.map(c=>({code:"CP3_"+c.n,theme:c.theme,category:c.category,observedScene:c.scene,source:c.source,allTwelveReviewed:false,printedFooterVerified:false})),
 sets:[]
};
let numFully=0,numColor=0,numHeld=0,numCards=0;
for(const set of master){
 const current=checkpoint.sets.find(x=>norm(x.code)===norm(set.code));
 assert.ok(current&&current.cards.length===set.cards.length);
 const manifestSet={set:set.code,name:set.displayName??set.name??set.code,count:set.cards.length,cards:[],fullyVisualReviewed:0,scenePartiallyReviewed:0,archiveColorReviewed:0,archiveHeld:0};
 let members=0;
 for(const c of set.cards){
  const key=norm(set.code)+"|"+norm(c.code);
  const source=evidenceById.get(key);
  assert.ok(source,"Missing image source evidence "+key);
  assert.equal(source.name,c.name);
  const cardCode=norm(c.code.split("/")[0]);
  const registered=themesPerCard.get(norm(set.code)+"|"+cardCode)||[];
  members+=registered.length;
  const fully=alreadyFully.has(cardCode);
  if(fully){manifestSet.fullyVisualReviewed++;numFully++;}
  if(source.status==="official-source-color-reviewed"){manifestSet.archiveColorReviewed++;numColor++;}
  else {assert.equal(source.status,"held");manifestSet.archiveHeld++;numHeld++;}
  const approved=new Set(registered.map(x=>x.theme));
  // Full twelve means every theme was checked, including those without a membership.
  const reviewState=Object.fromEntries(allCodes.map(t=>[
    t,
    fully ? (approved.has(t)?"screened-in":"screened-out") :
    approved.has(t) ? (t==="color"?"color-screened-only":"scene-evidence-partial") : "not-screened"
  ]));
  if(!fully && registered.some(x=>x.theme!=="color"))manifestSet.scenePartiallyReviewed++;
  const historical=current.cards.find(x=>x.code===c.code);
  assert.ok(historical,c.code+" missing previous checkpoint");
  historical.registeredThemes=[...approved].sort();
  historical.reviewStatus=fully?"artwork-screened-12-themes":approved.size?"partial-theme-evidence":"pending-visual-audit";
  manifestSet.cards.push({
    code:c.code,name:c.name,source:c.source,image:c.image,
    archiveColorStatus:source.status,
    colorImageProofSha256:source.sha256??null,
    imageHoldReason:source.status==="held"?(source.reason??"unknown"):null,
    allTwelveVisuallyScreened:fully,
    registeredThemes:[...approved].sort(),
    themeReview:reviewState
  });
  numCards++;
 }
 current.currentThemeRows=members;
 current.reviewStatus="partial";
 manifestSet.themeRows=members;
 nextManifest.sets.push(manifestSet);
}
assert.equal(numCards,2313);
assert.equal(numFully,5);
assert.equal(numColor,2117);
assert.equal(numHeld,196);
assert.equal(nextManifest.sets.reduce((n,s)=>n+s.themeRows,0),2143);
assert.equal(checkpoint.sets.reduce((n,s)=>n+s.currentThemeRows,0),2143);
checkpoint.currentXYThemeRows=2143;
checkpoint.newThemeRows=2143-checkpoint.originalThemeRows;
checkpoint.remainingArtworkNotFullyScreenedCount=2308;
checkpoint.newArtworkFullyScreenedCount=5;
checkpoint.strictCompletedSetCount=0;
coverage.reviews.CP3.note+="; 2026-10-26 번호 일치 CP3 002 버섯꼬 꽃밭 및 029 파비코리 데덴네/님피아 카메오 원본 그림 근거로 해당 단독 테마 2건 보강. 다른 테마 개별 검수 및 한국 실물 인쇄 표기는 미완료.";
coverage.updatedAt="2026-10-26";
art.updatedAt="2026-10-26";
save("data/art-themes.json",art);
save("data/audits/theme-series-review-status.json",coverage);
save(checkpointPath,checkpoint);
save("data/audits/theme-xy-scene-review-manifest-20261026.json",nextManifest);
const testPath="tests/theme-card-identity.test.mjs";
let text=fs.readFileSync(testPath,"utf8");
assert.equal(text.split("assert.equal(total,24165);").length,2);
fs.writeFileSync(testPath,text.replace("assert.equal(total,24165);","assert.equal(total,24167);"));
console.log("XY_SCENE_CHECKPOINT",JSON.stringify(nextManifest.cardinality));
