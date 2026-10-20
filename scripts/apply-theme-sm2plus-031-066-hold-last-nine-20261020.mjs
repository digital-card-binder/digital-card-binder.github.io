#!/usr/bin/env node
// Continue Korean-print SM2+ theme audit after completed 001–030.
// This batch screens 031–066 Korean official-image artwork only.
// #067–075 are explicit source/name/number mismatches and MUST NOT be classified.
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n");
const themeFile="data/art-themes.json";
const auditFile="data/audits/theme-sm2plus-031-066-visual-and-067-075-holds-20261020.json";
const statusFile="data/audits/theme-series-review-status.json";
const testFile="tests/theme-card-identity.test.mjs";
const evidenceFile="data/audits/theme-sm2plus-031-075-korean-image-preflight-20261020.json";
const priorFile="data/audits/theme-sm2plus-011-030-korean-art-screen-20261020.json";
const themes=read(themeFile), proof=read(evidenceFile);
const prior=read(priorFile), status=read(statusFile);
const coverage=read("data/audits/theme-series-coverage.json");
const master=[...read("data/series.json"),...read("data/series-legacy.json")].find(g=>String(g.code).toLowerCase()==="sm2+");
const expectedThemes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const normalize=s=>String(s??"").replace(/\s+/g,"").toLowerCase();
const slots=()=>themes.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(master?.cards?.length,75);
assert.equal(prior.cumulativeReviewed,30);
assert.equal(prior.themeRowsAfter,18061);
assert.equal(proof.decodedImageCount,45);
assert.equal(proof.cards.length,45);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(coverage.summary.themeCardSlots,18061);
assert.equal(coverage.sets.find(s=>s.code.toLowerCase()==="sm2+")?.status,"partial");
assert.deepEqual(new Set(themes.groups.map(g=>g.code)),new Set(expectedThemes));
assert.equal(slots(),18061,"Concurrent art theme changes require rebase");
assert.ok(!fs.existsSync(auditFile));
const previous=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set??"").toLowerCase()==="sm2+").map(c=>({t:g.code,id:c.code})));
assert.equal(previous.length,50,"Existing SM2+ theme baseline drift");
assert.deepEqual(new Set(previous.map(c=>c.id)),new Set(Array.from({length:30},(_,i)=>"SM2PLUS_"+String(i+1).padStart(3,"0"))));

const screened=[
 [31,"솔록","햇빛 아래 푸른 호수와 녹색 섬·물가 상공의 솔록",{color:"노랑·청록",season:"호수와 녹색 섬이 펼쳐진 밝은 낮"}],
 [32,"암멍이","바람부는 회색 바위 언덕에서 달리는 갈색 암멍이",{color:"갈색·회색",season:"밝은 바위 언덕과 산비탈"}],
 [33,"루가루암","깎아지른 바위와 회색 빛줄기 사이에서 달려드는 루가루암",{color:"회색·빨강"}],
 [34,"루가루암 GX","밝은 번개 같은 전투 효과선 앞의 회갈색 루가루암 GX",{color:"회색·갈색"}],
 [35,"니로우","붉은 주황빛 꽃이 핀 들판과 파란 하늘 앞의 니로우",{color:"남색·주황",season:"색색의 꽃이 핀 들판과 맑은 하늘"}],
 [36,"돈크로우","큰 분홍빛 달처럼 둥글게 비치는 배경과 짙은 보라색 야경 속의 돈크로우",{color:"남색·분홍",night:"보랏빛 밤하늘과 분홍빛 둥근 달"}],
 [37,"포푸니","밝은 초록 숲과 굽은 나무줄기 위에 앉은 포푸니",{color:"초록·검정",season:"햇살이 들어오는 푸른 숲"}],
 [38,"포푸니라","하얀 바람·속도선이 휘도는 공격 장면의 포푸니라",{color:"회색·주황"}],
 [39,"깜까미","어두운 동굴과 빛나는 초록 바위 사이의 보라색 깜까미",{color:"보라·청록",season:"어둠 속 초록빛 광물이 있는 바위 동굴"}],
 [40,"다크라이 GX","남색과 회색, 붉은 전투 효과가 강조된 다크라이 GX",{color:"남색·검정"}],
 [41,"소미안","짙은 숲속 나무와 큰 녹색 잎 뒤에 숨은 소미안",{color:"연두·회색",season:"큰 잎이 우거진 그늘진 숲"}],
 [42,"엘풍","화창한 해안의 야자나무와 하늘을 배경으로 떠 있는 엘풍",{color:"크림·청록",season:"야자나무가 있는 밝은 열대 해변"}],
 [43,"자말라","눈을 감고 나무통을 끌어안은 자말라와 맑은 야자수 바닷가",{sleeping:"눈을 감고 나무통에 매달려 잠든 자말라",color:"파랑·크림",season:"야자나무·푸른 바다가 보이는 맑은 섬"}],
 [44,"동굴탈출로프","초록빛 원과 빛줄기 앞에 놓인 밧줄 아이템",{color:"갈색·초록"}],
 [45,"소원의 바통","주황빛 반짝임 속의 은색 원통과 작은 장식",{color:"주황·은색"}],
 [46,"약점보험","푸른 보랏빛 후광을 가진 종이형 보험 아이템",{color:"보라·하늘"}],
 [47,"라이치","푸른 하늘과 큰 바위 동굴·초록 잔디 앞의 라이치",{color:"갈색·연두",season:"바위 동굴과 푸른 잔디가 있는 야외"}],
 [48,"마마네","파란 기계·벽돌 건물의 실외 테이블에서 마마네가 물건을 다루는 장면",{color:"노랑·파랑"}],
 [49,"아세로라","밝은 하늘, 마을 건축물과 가로등 앞에 선 보라 머리 아세로라",{color:"보라·회색",street:"가로등과 낮은 건축물이 보이는 마을 거리"}],
 [50,"카푸브루루 GX","선명한 초록·청록·빨강의 기하학 패턴이 강조된 카푸브루루 GX 풀아트",{color:"청록·빨강"}],
 [51,"염뉴트 GX","밝은 빨강 배경에 검은 몸통과 강한 파란 선을 두른 염뉴트 GX 풀아트",{color:"빨강·검정"}],
 [52,"카푸느지느 GX","파란 물결 패턴을 배경으로 한 카푸느지느 GX 풀아트",{color:"파랑·검정"}],
 [53,"괴력몬 GX","주황 기하학 바탕 위에 푸른 회색 괴력몬 GX 풀아트",{color:"주황·하늘"}],
 [54,"루가루암 GX","주황·파랑 기하학 배경에 흰빛 회색 루가루암 GX",{color:"주황·하늘"}],
 [55,"다크라이 GX","짙은 회색 다크라이 GX를 감싸는 파란·붉은 기하학 화면",{color:"남색·회색"}],
 [56,"마마네","흰 셔츠와 귤빛 머리, 노랑 물건과 진한 파랑 패턴의 마마네 풀아트",{color:"주황·하늘"}],
 [57,"아세로라","보라색 긴 머리와 어두운 보랏빛 배경의 아세로라 풀아트",{color:"보라·회색"}],
 [58,"기본 풀 에너지","초록 배경의 풀 타입 에너지 심볼",{color:"초록·연두"}],
 [59,"기본 불꽃 에너지","붉은 주황 배경의 불꽃 타입 에너지 심볼",{color:"빨강·주황"}],
 [60,"기본 물 에너지","맑은 파랑 배경의 물 타입 에너지 심볼",{color:"파랑·하늘"}],
 [61,"기본 번개 에너지","노란 배경의 번개 타입 에너지 심볼",{color:"노랑·금색"}],
 [62,"기본 초 에너지","보라 배경의 초 타입 에너지 심볼",{color:"보라·자주"}],
 [63,"기본 격투 에너지","주황·갈색 배경의 격투 타입 에너지 심볼",{color:"주황·갈색"}],
 [64,"기본 악 에너지","검은 원과 짙푸른 배경의 악 타입 에너지 심볼",{color:"검정·청록"}],
 [65,"기본 강철 에너지","회색·은색 배경의 강철 타입 에너지 심볼",{color:"은색·회색"}],
 [66,"기본 페어리 에너지","분홍 배경의 페어리 타입 에너지 심볼",{color:"분홍·자주"}]
];
assert.equal(screened.length,36);
assert.equal(screened.reduce((n,r)=>n+Object.keys(r[3]).length,0),48);
const byTheme=Object.fromEntries(themes.groups.map(g=>[g.code,g]));
const before=Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length]));
const verified=[];
for(const [n,koreanName,artworkScene,tags] of screened){
 const suffix=String(n).padStart(3,"0"),identity="sm2plus_"+suffix+"/049";
 const card=master.cards[n-1],p=proof.cards[n-31];
 assert.equal(normalize(card.code),identity);
 assert.equal(normalize(card.name),normalize(koreanName),"Korean name mismatch "+n);
 assert.equal(p.number,n);
 assert.equal(normalize(p.name),normalize(card.name));
 assert.equal(p.decoded,true);
 assert.equal(p.image,card.image,"Canon source changed "+n);
 assert.match(p.sha256,/^[a-f0-9]{64}$/);
 for(const [theme,category] of Object.entries(tags)){
  const group=byTheme[theme];assert.ok(group,"Unknown independent theme "+theme);
  assert.ok(!group.cards.some(c=>c.code==="SM2PLUS_"+suffix));
  group.cards.push({
   code:"SM2PLUS_"+suffix,name:card.name,series:"SM",set:master.code,
   setName:master.displayName,cardNumber:suffix+"/049",rarity:card.rarity||"",
   category,image:card.image,
   evidence:"한국 공식 카드 이미지 실물 한국어 표제·일러스트를 시각검토하고 원본 SHA256을 확인. "+
     artworkScene+". 불확실한 테마는 추가하지 않음. 하단 인쇄번호 세부 확대는 별도 확인. "+auditFile
  });
 }
 verified.push({number:n,canonicalCode:identity,koreanName,image:card.image,
  imageSha256:p.sha256,artworkScene,approvedThemes:tags,
  originalImageDecoded:true,KoreanCardFaceArtVisuallyScreened:true,
  printedFooterIndependentlyEnlarged:false});
}
assert.equal(slots(),18109);
for(const g of themes.groups)assert.equal(g.cards.length,
 before[g.code]+screened.filter(s=>Object.hasOwn(s[3],g.code)).length);

// The nine catalog items below MUST NOT be categorized by their invented
// image filename. Actual decoded faces show unrelated earlier numbered cards.
// #067–#074 are NOT energy card photos; #075 is the earlier Alolan Sandshrew.
const mismatch=[
 [67,"기본 물 에너지No.",1,"모다피"],
 [68,"기본 번개 에너지No.",2,"우츠동"],
 [69,"기본 격투 에너지No.",3,"우츠보트"],
 [70,"기본 악 에너지No.",4,"레디바"],
 [71,"기본 강철 에너지No.",5,"레디안"],
 [72,"기본 불꽃 에너지No.",6,"카푸브루루"],
 [73,"기본 풀 에너지No.",8,"야도뇽"],
 [74,"기본 페어리 에너지No.",9,"염뉴트"],
 [75,"알로라모래두지",11,"알로라모래두지"]
];
const holds=mismatch.map(([n,expectedName,observedEarlierCard,actualArtName])=>{
 const card=master.cards[n-1], p=proof.cards[n-31];
 assert.equal(p.number,n);assert.equal(p.name,card.name);assert.equal(p.decoded,true);
 assert.equal(card.name,expectedName,"Unexpected canonical identity, stop "+n);
 assert.equal(p.image,card.image);
 assert.ok(!themes.groups.some(g=>g.cards.some(c=>c.code==="SM2PLUS_"+String(n).padStart(3,"0"))));
 return {printedSlotInMaster:String(n).padStart(3,"0")+"/049",
  masterCode:card.code,masterName:card.name,currentImage:card.image,imageSha256:p.sha256,
  visuallyShownEarlierCardNumber:String(observedEarlierCard).padStart(3,"0")+"/049",
  visuallyShownEarlierCardName:actualArtName,
  blockingReason:"Source art shows a different earlier Korean card, not this master slot; No. energy labels are not pictured energies. Do not assert these are distinct Korean prints.",
  state:"hold_image_and_printed_identity_mismatch"};
});
const oldTest=fs.readFileSync(testFile,"utf8");
const needle="assert.equal(total,18061); // SM2+ Korean art screened through 030: 34 new visual placements";
assert.ok(oldTest.includes(needle)&&oldTest.split(needle).length===2);
const updatedTest=oldTest.replace(needle,
 "assert.equal(total,18109); // SM2+ 031-066 artwork +48; 067-075 invalid images held");
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()==="sm2+")||"sm2+";
assert.equal(status.reviews[key]?.status,"partial");
assert.equal(status.reviews[key]?.reviewedCardCount,30);
status.reviews[key]={...status.reviews[key],
 status:"partial",reviewedAt:"2026-10-20",reviewedCardCount:66,
 reviewedThemes:expectedThemes,evidence:auditFile,
 note:"Korean artwork screened on 001-066; 067-075 have nine mismapped source images showing 001-006,008-009,011, and remain unapproved. Real Korean issue identity and footer-number resolution required before strict completion."};
const doc={
 schemaVersion:1,recordedAt:"2026-10-20",series:"sm2+",setName:master.displayName,
 priorArtworkReviewed:30,thisArtworkReviewed:36,cumulativeArtworkScreened:66,
 masterSlots:75,independentlyHeldSlots:9,
 scope:"031-066 approved artwork themes; 067-075 visibly mismatched canonical source images",
 sourcePreflight:evidenceFile,previousCheckpoint:priorFile,
 addedIndependentThemeSlots:48,totalIndependentThemeSlots:18109,
 themeCountsBefore:before,
 themeCountsAfter:Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length])),
 addedCounts:Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length-before[g.code]])),
 allTwelveThemesConsideredFor031to066:true,
 strictSetComplete:false,
 printNumberFooterEnlargementOutstanding:true,
 koreanSetDiscrepancy:"Korean and Japanese SM2+ special prints/energy records must be independently enumerated; do not treat 75 master rows as 75 confirmed separate Korean prints.",
 referencePages:[
   "https://setory.site/sets/sm-new-trials-kr",
   "https://bulbapedia.bulbagarden.net/wiki/SM2%2B"
 ],
 approvedCards:verified,heldCards:holds,
 preservation:{original109StrictCompleteSetsReopened:0,
 existing50SM2PlusThemeRowsModified:0,
 masterOrCollectionIdentityChanged:0,
 firestoreOrOwnershipChanged:0,
 cardRadarFilesChanged:0},
 next:"Investigate true distinct SM2+ Korean printed variants and correct nine image/name/number mismatches with printVariants-safe ownership migration, without fabricating cards; then advance to the next unreviewed SM set."
};
themes.updatedAt="2026-10-20";
save(themeFile,themes);save(statusFile,status);save(auditFile,doc);
fs.writeFileSync(testFile,updatedTest);
console.log("SM2PLUS_031_066_APPROVED_067_075_HELD",JSON.stringify({artworksReviewed:36,themeSlotsAdded:48,total:slots(),cumulativeReviewed:66,held:holds.length}));
