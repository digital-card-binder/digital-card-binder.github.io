#!/usr/bin/env node
// Korean SM3+ actual card-art audit: 001-086 reviewed, ambiguous 087-091 held.
import fs from "node:fs";
import assert from "node:assert/strict";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const artPath="data/art-themes.json",statusPath="data/audits/theme-series-review-status.json";
const auditPath="data/audits/theme-sm3plus-001-091-visual-and-duplicate-holds-20261020.json";
const evidencePath="data/audits/theme-sm3plus-001-091-korean-image-preflight-20261020.json";
const testsPath="tests/theme-card-identity.test.mjs";
const themeData=read(artPath),status=read(statusPath),evidence=read(evidencePath);
const coverage=read("data/audits/theme-series-coverage.json");
const master=[...read("data/series.json"),...read("data/series-legacy.json")].find(x=>String(x.code).toLowerCase()==="sm3+");
const types=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const norm=s=>String(s??"").replace(/\s+/g,"").toLowerCase();
const count=()=>themeData.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(master?.cards?.length,91);
assert.equal(evidence.currentMasterCardCount,91);
assert.equal(evidence.originalImagesDownloadedAndDecoded,91);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(coverage.summary.themeCardSlots,18298);
assert.equal(coverage.sets.find(x=>x.code.toLowerCase()==="sm3+")?.status,"pending");
assert.equal(count(),18298);
assert.deepEqual(new Set(themeData.groups.map(g=>g.code)),new Set(types));
assert.equal(themeData.groups.flatMap(g=>g.cards.filter(c=>String(c.set??"").toLowerCase()==="sm3+")).length,0);
assert.ok(!fs.existsSync(auditPath),"Previous approved SM3+ audit must not repeat");

// Direct, conservatively chosen palette from the 91 Korean-face contact sheets.
const palettes=[
"초록·하늘","연두·주황","초록·갈색","분홍·주황","연두·초록",
"연두·노랑","초록·보라","하늘·분홍","초록·황토","빨강·회색",
"빨강·황토","회색·하늘","주황·회색","주황·검정","하늘·남색",
"검정·초록","주황·하늘","갈색·주황","하늘·초록","파랑·청록",
"파랑·하늘","초록·검정","황토·하늘","파랑·황토","보라·하늘",
"하늘·금색","파랑·황토","하늘·주황","노랑·하늘","노랑·검정",
"빨강·주황","빨강·노랑","남색·회색","분홍·청록","크림·연두",
"회색·검정","보라·연두","보라·황토","자주·연두","보라·검정",
"하늘·금색","하늘·회색","노랑·남색","청록·황토","회색·주황",
"검정·주황","하늘·황토","보라·검정","보라·회색","자주·남색",
"노랑·연두","주황·분홍","남색·빨강","빨강·검정","빨강·검정",
"보라·주황","검정·금색","하늘·보라","금색·보라","갈색·주황",
"청록·검정","파랑·은색","노랑·검정","보라·흰색","분홍·청록",
"검정·금색","보라·크림","노랑·하늘","갈색·하늘","연두·하늘",
"검정·흰색","초록·은색","빨강·하늘","노랑·파랑","분홍·보라",
"자주·남색","노랑·황토","초록·연두","빨강·주황","파랑·하늘",
"노랑·금색","보라·자주","황토·갈색","청록·검정","은색·회색",
"분홍·자주"
];
assert.equal(palettes.length,86,"Palette index count must match actual Korean screen count");
const nature={
1:"투명한 물방울과 나무가 있는 푸른 숲",
2:"석양빛 나무와 풀 언덕",
5:"큰 나무와 녹색 버섯이 있는 숲",
6:"밝은 꽃밭과 하늘",
9:"빛이 들어오는 초록 숲과 나뭇가지",
12:"구름 낀 하늘과 회색 마른 언덕",
13:"낙엽과 바위가 많은 산기슭",
16:"푸른 풀이 무성한 초원",
17:"하얀 구름이 떠 있는 초록 언덕",
19:"나무와 바위가 있는 야외",
20:"나무가 울창한 물가",
21:"푸른 바다의 요동치는 물결",
22:"해초가 있는 물속",
23:"풀밭과 시냇물이 있는 숲",
24:"물결이 치는 강과 풀 언덕",
29:"무지개 뜬 하늘과 초록 들판",
31:"붉은 석양의 태양과 황토 바위 언덕",
34:"꽃과 나무가 있는 초원",
35:"푸른 나무와 풀밭이 있는 숲",
37:"나무와 풀이 있는 야외",
38:"모래 언덕과 푸른 하늘",
39:"잔디와 작은 꽃이 있는 풀밭",
47:"푸른 바다와 모래사장",
49:"건물 난간에서 내려다보는 마을 거리",
50:"낙엽과 나무가 있는 숲",
51:"작은 집과 초원·나무가 있는 시골 풍경",
53:"달빛이 비치는 푸른 숲",
58:"구름과 푸른 하늘을 가로지르는 루기아",
67:"바다 옆 흰 담장과 야외 계단",
69:"농장 건물과 구름 낀 하늘",
70:"푸른 언덕이 펼쳐진 마을 공원"
};
const extras={
31:{sunset:"붉은 태양이 지평선에 걸린 바위 언덕의 석양"},
43:{night:"별이 뜬 어두운 밤하늘의 빛나는 지라치"},
49:{street:"마을 건물의 난간과 창틀 위 쌔비냥"},
53:{night:"달이 뜬 숲의 어두운 밤하늘"},
67:{street:"바다 옆 건물 난간과 산책길에 선 릴리에"},
69:{street:"집과 울타리 앞의 포켓몬 브리더"},
70:{street:"마을 건축물과 산책길 앞의 하우"}
};
const byTheme=Object.fromEntries(themeData.groups.map(g=>[g.code,g]));
const before=Object.fromEntries(themeData.groups.map(g=>[g.code,g.cards.length]));
const audited=[];
for(let n=1;n<=86;n++){
 const suffix=String(n).padStart(3,"0"),card=master.cards[n-1],source=evidence.cards[n-1];
 assert.equal(norm(card.code),"sm3plus_"+suffix+"/072");
 assert.equal(norm(source.code),norm(card.code));
 assert.equal(norm(source.name),norm(card.name));
 assert.equal(source.image,card.image);
 assert.equal(source.imageDecoded,true);
 assert.match(source.sha256,/^[a-f0-9]{64}$/);
 const selected={color:palettes[n-1],...(nature[n]?{season:nature[n]}:{}),...(extras[n]||{})};
 for(const [theme,category] of Object.entries(selected)){
  const group=byTheme[theme];assert.ok(group,theme);
  const id="SM3PLUS_"+suffix;
  assert.ok(!group.cards.some(c=>c.code===id),"SM3+ theme record already exists: "+id);
  group.cards.push({
    code:id,name:card.name,series:"SM",set:master.code,setName:master.displayName,
    cardNumber:suffix+"/072",rarity:card.rarity||"",category,image:card.image,
    evidence:"한국어판 실제 카드 전면 사진의 이름·일러스트를 육안 대조하고 원본 이미지 SHA256 확인. " +
      "근거 없는 진화·연결·스토리 테마 미추가. 하단 인쇄번호 개별 확대 검증은 미완료. " + auditPath
  });
 }
 audited.push({code:"SM3PLUS_"+suffix,name:card.name,masterCode:card.code,
  sha256:source.sha256,KoreanCardFaceArtVisuallyScreened:true,
  printedFooterEnlargedIndependently:false,approvedThemes:selected});
}
const dupMap={87:82,88:83,89:84,90:85,91:86};
const held=Object.entries(dupMap).map(([s,num])=>{
 const n=Number(s),source=evidence.cards[n-1],card=master.cards[n-1],earlier=evidence.cards[num-1];
 assert.equal(source.slotIndex,n);
 assert.equal(source.imageDecoded,true);
 assert.equal(source.image,card.image);
 assert.ok(card.name.endsWith("No."));
 assert.equal(source.name,card.name);
 assert.ok(!themeData.groups.some(g=>g.cards.some(c=>c.code==="SM3PLUS_"+String(n).padStart(3,"0"))));
 return {n,masterCode:card.code,masterName:card.name,currentImage:card.image,
  imageSha256:source.sha256,previousArtworkLookalike:earlier.code,
  previousArtworkName:earlier.name,status:"hold_distinct_Korean_print_unverified",
  reason:"Identical-looking earlier basic energy image; 'No.' suffix is absent from the printed card title. Need physical Korean print/variant verification before duplicate catalogue inclusion."};
});
const added=audited.reduce((n,r)=>n+Object.keys(r.approvedThemes).length,0);
assert.equal(count(),18298+added);
for(const g of themeData.groups)assert.equal(g.cards.length,before[g.code]+audited.filter(x=>Object.hasOwn(x.approvedThemes,g.code)).length);
const tests=fs.readFileSync(testsPath,"utf8");
const marker="assert.equal(total,18298); // SM3N 62 Korean artworks; 058/062 image-source holds";
assert.equal(tests.split(marker).length,2);
fs.writeFileSync(testsPath,tests.replace(marker,"assert.equal(total,"+count()+"); // SM3+ 86 Korean art reviews, five duplicate-energy holds"));
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()==="sm3+")||"sm3+";
const previous=status.reviews?.[key]||{};
assert.notEqual(previous.status,"complete");
status.reviews??={};
status.reviews[key]={...previous,status:"partial",reviewedAt:"2026-10-20",
 reviewedCardCount:86,reviewedThemes:types,evidence:auditPath,
 note:"SM3+ Korean art checked 001-086; energy copies 087-091 lack separately confirmed Korean print identity and remain on hold. Footer enlargement remains pending."};
const audit={schemaVersion:1,recordedAt:"2026-10-20",set:"sm3+",setName:master.displayName,
 masterEntries:91,decodedImages:91,visuallyScreenedKoreanArtwork:86,identityHolds:5,
 sourceEvidence:evidencePath,themeRowsBefore:18298,newIndependentThemeRows:added,
 themeRowsAfter:count(),themeDeltas:Object.fromEntries(themeData.groups.map(g=>[g.code,g.cards.length-before[g.code]])),
 strictSetComplete:false,footerNumberMagnificationOutstanding:true,
 screenedCards:audited,heldExtraIdentity:held,
 preservation:{prior109StrictCompleteSetsReopened:0,priorSM3N2HoldsChanged:0,
 priorSM3H2HoldsChanged:0,priorSM2Plus9HoldsChanged:0,priorThemeRowsChanged:0,
 masterRowsChanged:0,FireStoreOrOwnershipChanged:0,CardRadarChanged:0},
 next:"Verify Korean printed distinct identity/printVariants for 087-091. Then proceed to SM4S without repeating 001-086."
};
themeData.updatedAt="2026-10-20";
write(artPath,themeData);write(statusPath,status);write(auditPath,audit);
console.log("SM3PLUS_KOREAN_ART_REVIEW",JSON.stringify({reviewed:86,held:5,newThemes:added,themeRows:count(),deltas:audit.themeDeltas}));
