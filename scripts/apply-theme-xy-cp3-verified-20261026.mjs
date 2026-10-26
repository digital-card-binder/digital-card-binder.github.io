#!/usr/bin/env node
// XY 37-set review ledger + first Korean-image-verified CP3 artwork batch.
// A batch is NEVER a claim of completed XY-era full visual inspection.
import fs from "node:fs";
import assert from "node:assert/strict";

const load = p => JSON.parse(fs.readFileSync(p, "utf8"));
const save = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n");
const legacy = load("data/series-legacy.json");
const xy = legacy.filter(group => group.era === "XY");
const themeData = load("data/art-themes.json");
const status = load("data/audits/theme-series-review-status.json");
const story = load("data/art-theme-story-review.json");
const themePath = "data/art-themes.json";
const testPath = "tests/theme-card-identity.test.mjs";
const outputPath = "data/audits/theme-xy-all-37-sets-review-checkpoint-20261026.json";
const themeCodes = ["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const count = () => themeData.groups.reduce((n,g) => n + g.cards.length, 0);
const lower = value => String(value || "").toLowerCase();
const flatCards = xy.flatMap(set => set.cards.map(card => ({set,card})));
assert.equal(xy.length, 37);
assert.equal(flatCards.length, 2313);
assert.equal(count(), 22032, "Theme row baseline changed; audit before retrying.");
assert.deepEqual(new Set(themeData.groups.map(g=>g.code)),new Set(themeCodes));
assert.ok(!fs.existsSync(outputPath),"XY batch already applied.");
const themeByCode = Object.fromEntries(themeData.groups.map(g=>[g.code,g]));
const cp3 = xy.find(g => g.code === "CP3");
assert.equal(cp3?.cards?.length, 32);
const existingXY = themeData.groups.flatMap(g=>(g.cards||[]).filter(c=>xy.some(s=>lower(s.code)===lower(c.set))).map(c=>({set:c.set,code:c.code,theme:g.code,name:c.name})));
assert.equal(existingXY.length, 8, "Pre-existing XY theme placements changed; do not overwrite.");
assert.deepEqual(new Set(existingXY.map(x=>x.theme)),new Set(["sleeping"]));

const reviewed = [
 {n:3,name:"파이리",rarity:"C",story:"소년과 장난스럽게 뛰어노는 파이리",themes:{evolution:"파이리와 소년의 성장",color:"오렌지·따뜻한 색"},photo:"https://media.bunjang.co.kr/product/395905096_1_1773822125_w1200.jpg",evidence:"한국어 CP3 003 카드 사진과 한국판 수록 번호, 동일 인물의 성장 이야기"},
 {n:4,name:"리자드",rarity:"C",story:"소년과 나란히 앉은 리자드",themes:{evolution:"파이리와 소년의 성장",color:"주황·다홍"},photo:"https://www.ebay.com/itm/197787934962",evidence:"한국어 CP3 004/032 사진과 소년이 등장하는 연속 일러스트"},
 {n:5,name:"리자몽",rarity:"U",story:"눈 덮인 곳에서 성장한 소년과 함께하는 리자몽",themes:{evolution:"파이리와 소년의 성장",color:"주황·하양",season:"눈 내리는 겨울"},photo:"https://www.ebay.com/itm/197059933749",evidence:"한국어 CP3 005/032 사진 및 설경, 같은 소년과의 성장 이야기"},
 {n:10,name:"피카츄",rarity:"RR",story:"여러 피카츄와 꽃이 가득한 들판",themes:{color:"노랑·초록",season:"꽃밭과 초원"},photo:"https://www.ebay.com/itm/196481748929",evidence:"한국어 CP3 010/032 실물 이미지에서 여러 피카츄와 꽃밭 확인"}
];
const verifiedCodes=new Set(), proof=[];
const beforeThemeCounts=Object.fromEntries(themeData.groups.map(g=>[g.code,g.cards.length]));
for (const item of reviewed) {
  const suffix=String(item.n).padStart(3,"0");
  const master=cp3.cards.find(c=>lower(c.code)==="cp3_"+suffix+"/032");
  assert.ok(master,"CP3 catalog identity missing: "+suffix);
  assert.equal(master.name,item.name,"Korean card name changed.");
  assert.equal(master.image,"https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP3/CP3_"+suffix+".png");
  const code="CP3_"+suffix;
  verifiedCodes.add(lower(master.code));
  for(const [theme,category] of Object.entries(item.themes)){
    const group=themeByCode[theme];
    assert.ok(group);
    assert.ok(!group.cards.some(c=>lower(c.set)==="cp3"&&lower(c.code)===lower(code)),"Duplicate "+theme+" "+code);
    group.cards.push({
      code,name:master.name,series:"XY",set:"CP3",setName:cp3.displayName||cp3.name||"포켓심쿵 컬렉션",
      cardNumber:suffix+"/032",rarity:item.rarity,category,image:master.image,
      evidence:"한국판 CP3 "+suffix+"/032 카드 이미지와 실물 일러스트 대조. "+item.story+
        ". "+item.evidence+". 자료: "+item.photo+
        ". 나머지 12테마는 이 카드에서 시각 근거 미확보로 제외."
    });
  }
  proof.push({code,printedNumber:suffix+"/032",name:master.name,sourceMaster:master.source,
    canonicalImage:master.image,photoEvidence:item.photo,illustrationScene:item.story,
    approvedThemes:item.themes,allTwelveThemesScreenedForThisCard:true});
}
assert.equal(proof.length,4);
assert.equal(count(),22041,"Expected exactly nine new independent theme registrations");
for(const g of themeData.groups)assert.equal(g.cards.length,beforeThemeCounts[g.code]+reviewed.filter(x=>Object.hasOwn(x.themes,g.code)).length);
themeData.updatedAt="2026-10-26";

const evolution=story.groups.evolution;
assert.equal(evolution.summary.accepted,73,"Story review baseline changed.");
for(const item of reviewed.filter(x=>x.themes.evolution)){
  const code="CP3_"+String(item.n).padStart(3,"0");
  assert.ok(!evolution.cards[code],"Already reviewed: "+code);
  evolution.cards[code]={status:"accepted",title:"파이리와 소년의 성장",kind:"진화 스토리",
    imageMatch:"Korean-card-number-and-artwork-photo-reviewed"};
}
evolution.summary.accepted+=3;
story.reviewedOn="2026-10-26";
story.reviewNotes.push({date:"2026-10-26",scope:"CP3_003-005 evolution narrative",
  confirmed:["CP3_003","CP3_004","CP3_005"],confirmedCount:3,
  notes:"한국판 카드 사진과 CP3 원본 마스터 번호·그림 대조. 파이리에서 리자드·리자몽으로 이어지는 같은 소년과의 성장 연작. 파노라마형 연결그림으로 분류하지 않음."});

assert.ok(!status.reviews.CP3,"CP3 review checkpoint already exists");
status.reviews.CP3={
 status:"partial",reviewedAt:"2026-10-26",reviewedCardCount:4,reviewedThemes:themeCodes,
 evidence:outputPath,
 note:"CP3 003/004/005/010 한국판 카드 이미지 및 테마 장면 확인; 신규 독립 테마 등록 9건. CP3 나머지 28장의 12테마 검수는 미완료. XY 총 37세트의 전수 완료를 주장하지 않음."
};
status.updatedAt="2026-10-26";

const previousTests=fs.readFileSync(testPath,"utf8");
const needle="assert.equal(total,22032);";
assert.equal(previousTests.split(needle).length,2,"Theme card test baseline changed.");
const revisedTests=previousTests.replace(needle,"assert.equal(total,22041);");
const newEntries=themeData.groups.flatMap(g=>g.cards.filter(c=>lower(c.set)==="cp3"&&verifiedCodes.has("cp3_"+String(c.cardNumber).toLowerCase())).map(c=>({theme:g.code,code:c.code})));
assert.equal(newEntries.length,9);

const groupsBySet=new Map(xy.map(s=>[lower(s.code),s]));
const allAfter=themeData.groups.flatMap(g=>(g.cards||[]).filter(c=>groupsBySet.has(lower(c.set))).map(c=>({theme:g.code,code:c.code,set:c.set})));
const rowMap=new Map();
for(const row of allAfter){const key=lower(row.set);rowMap.set(key,[...(rowMap.get(key)||[]),row]);}
const report={
 schemaVersion:1,recordedAt:"2026-10-26",era:"XY",
 policy:"기존에 검수한 테마 배치는 보존. 한국판 이미지·번호·장면의 시각적 근거가 있는 카드만 신규 승인. 아티스트/카탈로그 메타데이터만으로 그림 테마 완료 처리 금지.",
 masterSetCount:37,masterCardCount:2313,
 originalThemeRows:8,newThemeRows:9,currentXYThemeRows:allAfter.length,
 newArtworkFullyScreenedCount:4,remainingArtworkNotFullyScreenedCount:2309,
 visuallyScreenedSetCount:0,strictCompletedSetCount:0,
 visualEvidence:proof,
 sets:xy.map(set=>{
   const existingForSet=(rowMap.get(lower(set.code))||[]);
   return {code:set.code,name:set.displayName||set.name||set.code,cardCount:set.cards.length,
     currentThemeRows:existingForSet.length,reviewStatus:set.code==="CP3"?"partial":"pending",
     reviewedArtworkCount:set.code==="CP3"?4:0,
     cards:set.cards.map(card=>{
       const arr=existingForSet.filter(x=>lower(x.code)===lower(card.code.split("/")[0]));
       const exact=proof.find(x=>lower(x.code)===lower(card.code.split("/")[0]));
       return {code:card.code,name:card.name,order:card.order,image:card.image,
         source:card.source,registeredThemes:arr.map(x=>x.theme),reviewStatus:exact?"artwork-screened-12-themes":"pending-visual-audit"};
     })};
 }),
 preservation:{existingThemeRowsChanged:0,priorCompleteSetsReopened:0,masterCardsChanged:0,
 userOwnershipChanged:0,firestoreChanged:0,cardRadarChanged:0},
 caveat:"XY 이미지 소스가 마스터에 존재한다는 것은 실제 이미지가 한글판이라는 시각적 증명이 아니다. 미검수 2309장을 완료 처리하지 않는다."
};
assert.equal(report.sets.reduce((x,set)=>x+set.cards.length,0),2313);
assert.equal(report.sets.reduce((x,set)=>x+set.currentThemeRows,0),17);
save(themePath,themeData);
save("data/art-theme-story-review.json",story);
save("data/audits/theme-series-review-status.json",status);
save(outputPath,report);
fs.writeFileSync(testPath,revisedTests);
console.log("XY_CP3_THEME_REVIEW",JSON.stringify({cardsReviewed:4,newThemeRows:9,remainingXYCards:2309,allXYSets:37,totalThemeRows:count()}));
