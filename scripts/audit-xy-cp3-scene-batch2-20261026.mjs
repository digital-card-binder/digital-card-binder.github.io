#!/usr/bin/env node
// 9 CP3 Korean card slots: manual scene evidence cross-referenced with
// the numbered Japanese original print, classified only for observed scenes.
// The Korean physical footer and other themes remain non-certified.
import fs from "node:fs";
import assert from "node:assert/strict";
const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+"\n");
const lower=s=>String(s??"").toLowerCase();
const art=load("data/art-themes.json");
const series=[...load("data/series.json"),...load("data/series-legacy.json")];
const xy=series.filter(s=>s.era==="XY");
const cp3=xy.find(s=>s.code==="CP3");
const status=load("data/audits/theme-series-review-status.json");
const path="data/audits/theme-xy-all-37-sets-review-checkpoint-20261026.json";
const checkpoint=load(path);
const themeRows=()=>art.groups.reduce((a,g)=>a+g.cards.length,0);
assert.equal(themeRows(),24156);
assert.equal(xy.length,37);
assert.equal(xy.reduce((a,s)=>a+s.cards.length,0),2313);
assert.equal(cp3.cards.length,32);
assert.equal(checkpoint.newArtworkFullyScreenedCount,5);
assert.equal(checkpoint.currentXYThemeRows,2132);
const entries=[
 {n:"007",name:"부스터 EX",theme:"cameo",cat:"샤미드·쥬피썬더 카메오",scene:"부스터 EX 옆에 샤미드와 쥬피썬더가 나란히 등장",url:"https://media.okini.land/119748-large_default/pokemon-tcg-cp3-007-032-kira-rr-flareon-ex.jpg"},
 {n:"008",name:"눈꼬마",theme:"season",cat:"겨울 · 눈사람",scene:"눈꼬마 두 마리가 눈사람 옆에 있는 설경",url:"https://www.pokemon-card.com/assets/images/card_images/large/CP3/031608_P_YUKIWARASHI.jpg"},
 {n:"009",name:"눈여아",theme:"season",cat:"봄 · 꽃잎",scene:"눈여아 주변으로 분홍색 봄꽃 잎이 흩날리는 장면",url:"https://hobibinet-pokemon.com/cdn/shop/files/kwyLWzcQ68jVqGUfiAZKp0iy0g7KuNF1PUniE1gB.jpg?v=1769742517"},
 {n:"011",name:"라이츄",theme:"season",cat:"봄 · 꽃밭",scene:"라이츄가 알록달록한 꽃들이 핀 초원에서 쉬는 장면",url:"https://cardotaku.com/cdn/shop/products/IMG_4786.png?v=1655774507&width=800"},
 {n:"023",name:"나룸퍼프",theme:"food",cat:"디저트 · 마카롱",scene:"마카롱과 과자들 가운데 있는 나룸퍼프",url:"https://assets.st-note.com/img/1732064342-LMV7gcaBSdo4bYTyOWjC51xh.jpg?width=1200"},
 {n:"024",name:"나루림",theme:"food",cat:"디저트 · 팬케이크",scene:"나루림과 나룸퍼프들이 팬케이크 앞에 모인 장면",url:"https://media.okini.land/119765-large_default/pokemon-tcg-cp3-024-032-kira-u-slurpuff.jpg"},
 {n:"025",name:"님피아 EX",theme:"cameo",cat:"이브이 카메오",scene:"님피아 EX 일러스트 배경의 이브이",url:"https://den-cards.pokellector.com/186/Sylveon-EX.CP3.25.png"},
 {n:"026",name:"님피아 EX",theme:"cameo",cat:"이브이 카메오",scene:"님피아 EX 옆에 웃는 이브이가 등장",url:"https://media.okini.land/119767-large_default/pokemon-tcg-cp3-026-032-kira-rr-sylveon-ex.jpg"},
 {n:"030",name:"화살꼬빈",theme:"work",cat:"머리손질 돕기",scene:"화살꼬빈들이 소녀의 머리를 땋는 일을 돕는 모습",url:"https://cdn.snkrdunk.com/upload_bg_removed/pkmn-tcg-7322208-yu.webp"}
];
const grp=Object.fromEntries(art.groups.map(g=>[g.code,g]));
for(const e of entries){
 const c=cp3.cards.find(x=>lower(x.code)==="cp3_"+e.n+"/032");
 assert.ok(c,e.n+" missing from Korean XY master");
 assert.equal(c.name,e.name);
 assert.equal(c.image,"https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP3/CP3_"+e.n+".png");
 const code="CP3_"+e.n;
 assert.ok(!grp[e.theme].cards.some(x=>lower(x.set)==="cp3"&&lower(x.code)===lower(code)),"preexisting "+e.theme+" "+code);
 grp[e.theme].cards.push({
   code,name:e.name,series:"XY",set:"CP3",setName:cp3.displayName||cp3.name||"포켓심쿵 컬렉션",
   cardNumber:e.n+"/032",rarity:c.rarity||"",category:e.cat,image:c.image,
   evidence:"2026-10-26 CP3 동일 번호의 원본 일본 일러스트 시각 대조: "+e.scene+
    ". 참조: "+e.url+
    ". 한국 마스터 이미지 경로와 자체 보관 원본 색상 분석을 별도 확인. 한글판 실물 하단 표기와 나머지 11개 테마는 아직 전수 인증하지 않음."
 });
}
assert.equal(themeRows(),24165);
const xySetKeys=new Set(xy.map(s=>lower(s.code)));
const cardsWithThemes=new Map();
for(const g of art.groups){
 for(const c of g.cards){
   if(!xySetKeys.has(lower(c.set)))continue;
   const k=lower(c.set)+":"+lower(c.code);
   if(!cardsWithThemes.has(k))cardsWithThemes.set(k,[]);
   cardsWithThemes.get(k).push(g.code);
 }
}
const rows=art.groups.flatMap(g=>g.cards.filter(c=>xySetKeys.has(lower(c.set))));
assert.equal(rows.length,2141);
const fullCodes=new Set(checkpoint.visualEvidence.map(x=>lower(x.code)));
assert.equal(fullCodes.size,5);
checkpoint.originalThemeRows=8;
checkpoint.newThemeRows=2141-8;
checkpoint.currentXYThemeRows=2141;
checkpoint.newArtworkFullyScreenedCount=5;
checkpoint.remainingArtworkNotFullyScreenedCount=2308;
checkpoint.strictCompletedSetCount=0;
checkpoint.visuallyScreenedSetCount=0;
for(const set of checkpoint.sets){
 set.currentThemeRows=rows.filter(r=>lower(r.set)===lower(set.code)).length;
 for(const c of set.cards){
   const k=lower(set.code)+":"+lower(c.code.split("/")[0]);
   c.registeredThemes=[...new Set(cardsWithThemes.get(k)||[])].sort();
   c.reviewStatus=fullCodes.has(lower(c.code.split("/")[0]))?"artwork-screened-12-themes":
     c.registeredThemes.length?"partial-theme-evidence":"pending-visual-audit";
 }
}
assert.equal(checkpoint.sets.reduce((a,s)=>a+s.currentThemeRows,0),2141);
assert.equal(checkpoint.sets.reduce((a,s)=>a+s.cards.length,0),2313);
assert.equal(status.reviews.CP3.reviewedCardCount,5);
status.reviews.CP3.note+="; CP3 007,008,009,011,023,024,025,026,030 그림 장면에 근거한 추가 테마 9건. 일본판 그림 대조로 한국판 실물 인쇄번호 미인증; 완전 검수 수량은 그대로 5장.";
status.updatedAt="2026-10-26";
art.updatedAt="2026-10-26";
save("data/art-themes.json",art);
save("data/audits/theme-series-review-status.json",status);
save(path,checkpoint);
save("data/audits/theme-xy-cp3-additional-illustration-scenes-20261026.json",{
 schemaVersion:1,recordedAt:"2026-10-26",set:"CP3",addedThemeRows:entries.length,
 totalXYThemeRows:2141,totalThemeRows:24165,
 manuallyScreenedOriginalArtworkScenes:entries.map(e=>({
   card:"CP3_"+e.n,name:e.name,theme:e.theme,category:e.cat,scene:e.scene,
   visualReference:e.url,proofType:"Japanese original CP3 printing, canonical Korean master identity corroborated",
   certifiedKoreanPrintedFooter:false,allTwelveThemesFullyScreened:false
 })),
 completeXYTwelveThemeCards:5,incompleteXYTwelveThemeCards:2308,
 archivalColorAnalyzed:2117,archivalColorHeld:196,strictlyCompletedXYSets:0
});
const testPath="tests/theme-card-identity.test.mjs";
let test=fs.readFileSync(testPath,"utf8");
assert.equal(test.split("assert.equal(total,24156);").length,2);
fs.writeFileSync(testPath,test.replace("assert.equal(total,24156);","assert.equal(total,24165);"));
console.log("XY_CP3_VISUAL_SCENES_APPROVED",JSON.stringify({added:entries.length,total:themeRows(),xyRows:2141,full12:5}));
