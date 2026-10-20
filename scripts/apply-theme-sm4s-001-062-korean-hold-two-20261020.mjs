#!/usr/bin/env node
// Continue Korean SM4S card illustration audit after completed SM3+ artwork screen.
// Apply only 60 cards actually decoded and visually reviewed; hold 058/061 HTTP 404.
// Twelve stand-alone theme dexes: no implicit dedup or ownership changes.
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n");
const artPath="data/art-themes.json",statusPath="data/audits/theme-series-review-status.json";
const imagePath="data/audits/theme-sm4s-001-062-korean-image-preflight-20261020.json";
const auditPath="data/audits/theme-sm4s-001-062-korean-artwork-screen-20261020.json";
const testsPath="tests/theme-card-identity.test.mjs";
const groups=[...read("data/series.json"),...read("data/series-legacy.json")];
const set=groups.find(s=>String(s.code).toLowerCase()==="sm4s");
const art=read(artPath),status=read(statusPath),proof=read(imagePath);
const coverage=read("data/audits/theme-series-coverage.json");
const themeCodes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const normalize=x=>String(x??"").replace(/\s+/g,"").toLowerCase();
const slots=()=>art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(set?.cards?.length,62);
assert.equal(proof.totalMasterCards,62);
assert.equal(proof.imagesDownloadedDecoded,60);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(coverage.summary.themeCardSlots,18422);
assert.equal(coverage.sets.find(s=>s.code.toLowerCase()==="sm4s")?.status,"pending");
assert.deepEqual(new Set(art.groups.map(g=>g.code)),new Set(themeCodes));
assert.equal(slots(),18422);
assert.equal(art.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()==="sm4s")).length,0);
assert.ok(!fs.existsSync(auditPath),"Previously reviewed SM4S art cannot be repeated");

// Explicit Korean printed title and the palette visible in the contact sheets.
const screened=[
[1,"선인왕","연두·하늘"],
[2,"밤선인","연두·황토"],
[3,"딱정곤","하늘·초록"],
[4,"메이클","갈색·초록"],
[5,"고고트","갈색·남색"],
[6,"알로라 텅구리","회색·초록"],
[7,"둔타","노랑·황토"],
[8,"폭타","황토·하늘"],
[9,"별가사리","하늘·청록"],
[10,"아쿠스타","보라·회색"],
[11,"총어","청록·초록"],
[12,"대포무노","주황·청록"],
[13,"가재군","빨강·파랑"],
[14,"가재장군","빨강·청록"],
[15,"깝질무","분홍·하늘"],
[16,"알로라 꼬마돌","회색·갈색"],
[17,"알로라 데구리","회색·하늘"],
[18,"알로라 딱구리 GX","검정·노랑"],
[19,"에몽가","노랑·초록"],
[20,"고오스","보라·자주"],
[21,"고우스트","보라·갈색"],
[22,"팬텀","보라·검정"],
[23,"치렁","하늘·크림"],
[24,"호바귀","황토·초록"],
[25,"펌킨인","갈색·보라"],
[26,"야도뇽","청록·주황"],
[27,"염뉴트","검정·초록"],
[28,"탕구리","황토·갈색"],
[29,"트리토돈","갈색·하늘"],
[30,"매시붕 GX","빨강·검정"],
[31,"입치트","검정·황토"],
[32,"가보리","은색·회색"],
[33,"갱도라","은색·주황"],
[34,"보스로라","회색·황토"],
[35,"레지스틸","회색·하늘"],
[36,"슈바르고","빨강·회색"],
[37,"종이신도 GX","노랑·검정"],
[38,"찌르꼬","초록·황토"],
[39,"찌르버드","회색·갈색"],
[40,"찌르호크","회색·초록"],
[41,"레지기가스","크림·황토"],
[42,"치라미","회색·초록"],
[43,"치라치노","크림·황토"],
[44,"타입:널","회색·청록"],
[45,"실버디 GX","은색·검정"],
[46,"엿보기 레드카드","빨강·보라"],
[47,"카운터 캐처","회색·주황"],
[48,"사이킥메모리","분홍·보라"],
[49,"파이팅메모리","황토·주황"],
[50,"글라디오","검정·황토"],
[51,"알로라 딱구리 GX","파랑·노랑"],
[52,"매시붕 GX","빨강·검정"],
[53,"종이신도 GX","빨강·은색"],
[54,"실버디 GX","하늘·회색"],
[55,"글라디오","황토·검정"],
[56,"알로라 딱구리 GX","무지개·홀로"],
[57,"매시붕 GX","무지개·홀로"],
[59,"실버디 GX","무지개·홀로"],
[60,"카운터 캐처","금색·검정"],
[62,"강철 에너지","은색·하늘"]
];
assert.equal(screened.length,60);
assert.deepEqual(new Set(screened.map(x=>x[0])),
 new Set(Array.from({length:62},(_,i)=>i+1).filter(n=>n!==58&&n!==61)));

// Independent themes only where visual scenery actually identifies the theme.
const season={
  1:"모래와 바위가 보이는 넓은 사막의 푸른 하늘",
  2:"선인장과 모래가 많은 건조한 사막",
  3:"구름과 나무가 그려진 풀밭",
  4:"나무와 잎이 우거진 숲",
  7:"황토빛 모래바닥과 맑은 구름 낀 사막",
  8:"큰 바위산과 푸른 하늘",
  9:"푸른 바다와 물결이 보이는 맑은 해변",
  10:"돌과 모래가 드러난 바닷가",
  11:"초록 물풀과 빛이 반사되는 연못",
  12:"해초와 바닷물이 보이는 물속",
  13:"풀잎 사이 푸른 강가의 물가",
  14:"파도와 물보라가 있는 바다",
  15:"흐린 구름과 해안 바위가 보이는 해변",
  16:"큰 바위와 조약돌이 놓인 바위 지형",
  17:"돌이 부딪히는 바위 산기슭",
  19:"나무줄기와 숲이 있는 야외",
  21:"큰 나무와 숲 바닥",
  24:"낙엽과 나무뿌리가 있는 가을 느낌의 숲",
  26:"푸른 하늘 아래 붉은 바위와 작은 화산",
  28:"바위 절벽이 이어진 계곡",
  29:"큰 바위와 파도가 부서지는 해안",
  31:"가파른 암벽과 흙이 있는 거친 계곡",
  36:"나무줄기가 쓰러진 초록 숲",
  38:"푸른 나무와 붉은 꽃이 있는 작은 숲",
  39:"바위와 산맥 아래 초록빛 풍경",
  40:"잎과 풀로 가득한 울창한 숲",
  41:"바위 숲과 녹색 이끼가 있는 야외",
  42:"햇살과 작은 꽃들이 피어난 푸른 정원"
};
const streets={
  23:"골목의 계단과 주택이 이어지는 마을 거리의 치렁",
  25:"벽돌 건물 사이의 도시 건축물",
  32:"높은 도시 건물과 인도를 따라 걷는 가보리",
  35:"보행자용 철제 난간과 건물이 보이는 거리",
  43:"목재 난간과 창문이 있는 집 주변"
};
const before=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]));
const groupByCode=Object.fromEntries(art.groups.map(g=>[g.code,g]));
const cards=[];
for(const [n,printedName,palette] of screened){
  const number=String(n).padStart(3,"0");
  const card=set.cards[n-1],image=proof.cards[n-1];
  assert.equal(normalize(card.code),"sm4s_"+number+"/050");
  assert.equal(normalize(card.name),normalize(printedName),
   "Korean printed title mismatch at SM4S "+number);
  assert.equal(image.index,n);
  assert.equal(normalize(image.code),normalize(card.code));
  assert.equal(normalize(image.name),normalize(printedName));
  assert.equal(image.image,card.image);
  assert.equal(image.imageDecoded,true);
  assert.match(image.sha256,/^[a-f0-9]{64}$/);
  const tags={color:palette,...(season[n]?{season:season[n]}:{}),
   ...(streets[n]?{street:streets[n]}:{})};
  for(const [type,category] of Object.entries(tags)){
    const group=groupByCode[type];
    assert.ok(group,"Unknown theme "+type);
    const code="SM4S_"+number;
    assert.ok(!group.cards.some(c=>c.code===code),"Do not double-register SM4S "+number);
    group.cards.push({
      code,name:card.name,series:"SM",set:set.code,setName:set.displayName,
      cardNumber:number+"/050",rarity:card.rarity||"",category,image:card.image,
      evidence:"한국어판 카드 전면을 직접 확인한 일러스트 테마. 번호·한국명·사진 출처 SHA256 대응. " +
       "실제 연결·진화·스토리 근거가 없는 테마는 제외. " +
       "하단 인쇄번호 확대 검증은 별도 진행. "+auditPath
    });
  }
  cards.push({code:"SM4S_"+number,canonicalCode:card.code,koreanName:card.name,
   image:card.image,imageSha256:image.sha256,
   originalImageDecoded:true,artworkAndKoreanFaceVisuallyScreened:true,
   printedFooterIndependentlyEnlarged:false,approvedThemes:tags});
}
const held=[58,61].map(n=>{
  const image=proof.cards[n-1],card=set.cards[n-1],number=String(n).padStart(3,"0");
  assert.equal(image.index,n);
  assert.equal(image.imageDecoded,false);
  assert.equal(image.image,card.image);
  assert.ok(!art.groups.some(g=>g.cards.some(c=>c.code==="SM4S_"+number)));
  return {number:n,masterCode:card.code,koreanName:card.name,image:card.image,
    urlError:image.error,status:"hold_korean_photo_not_accessible",
    artworkThemesApproved:0,canNotClaimUnreleased:true};
});
const added=cards.reduce((n,x)=>n+Object.keys(x.approvedThemes).length,0);
assert.equal(slots(),18422+added);
for(const g of art.groups){
  const n=cards.filter(c=>Object.hasOwn(c.approvedThemes,g.code)).length;
  assert.equal(g.cards.length,before[g.code]+n);
}
const tests=fs.readFileSync(testsPath,"utf8");
const marker="assert.equal(total,18422); // SM3+ 86 Korean art reviews, five duplicate-energy holds";
assert.equal(tests.split(marker).length,2,"Unexpected theme test baseline");
fs.writeFileSync(testsPath,tests.replace(marker,
  "assert.equal(total,"+slots()+"); // SM4S 60 Korean artwork screens; source 058 and 061 held"));
const statusKey=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()==="sm4s")||"sm4S";
const previous=status.reviews?.[statusKey]||{};
assert.notEqual(previous.status,"complete");
status.reviews??={};
status.reviews[statusKey]={...previous,status:"partial",reviewedAt:"2026-10-20",
  reviewedCardCount:60,reviewedThemes:themeCodes,evidence:auditPath,
  note:"SM4S 60/62 Korean image/art screen. #058 종이신도 GX and #061 워프 에너지 original URLs 404; exact printed footer magnification remains pending."};
const audit={schemaVersion:1,recordedAt:"2026-10-20",set:set.code,setName:set.displayName,
  totalMasterCards:62,imageSourcesDecoded:60,visuallyReviewedKoreanArtwork:60,
  sourceImageHolds:2,originalThemeSlots:18422,addedIndependentThemeSlots:added,
  currentThemeSlots:slots(),perThemeAdditions:Object.fromEntries(
    art.groups.map(g=>[g.code,g.cards.length-before[g.code]])),
  sourceEvidence:imagePath,allTwelveIndependentThemesScreenedForDecodedCards:true,
  strictSetCompleted:false,enlargedPrintedFooterVerificationPending:true,
  cards,held,
  preservation:{priorCompletedSets:109,priorSM3PlusFiveHoldsPreserved:true,
    priorSM3NHoldsPreserved:true,priorSM3HHoldsPreserved:true,
    priorThemeRowsModified:0,masterDataChanged:0,
    firestoreOrOwnershipChanged:0,cardRadarChanged:0},
  next:"Find real Korean print photos for SM4S #058 and #061, enlarge and verify card footer. Then continue independent SM4A incomplete audit without redoing existing SM4A sleeping memberships."
};
art.updatedAt="2026-10-20";
write(artPath,art);write(statusPath,status);write(auditPath,audit);
console.log("SM4S_60_KOREAN_ARTWORK_REVIEW",JSON.stringify({
  reviewed:60,sourceHolds:2,slotsAdded:added,slotsTotal:slots(),
  perTheme:audit.perThemeAdditions}));
