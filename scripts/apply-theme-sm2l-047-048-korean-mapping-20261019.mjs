#!/usr/bin/env node
// Resolve the Korean-only SM2L 047/048 order, NOT the Japanese SM2L order.
// Catalogue and KOR-labelled Korean file inventory independently agree:
// SM2L_047 = 레스큐탱크, SM2L_048 = 아쿠아패치.
// Do not certify Korean physical photo pixels from a filename or web index.
import fs from "node:fs";
import assert from "node:assert/strict";
const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const themePath="data/art-themes.json";
const auditPath="data/audits/theme-sm2l-047-048-korean-number-resolution-20261019.json";
const testPath="tests/theme-card-identity.test.mjs";
const series=load("data/series.json");
const set=series.find(s=>String(s.code).toLowerCase()==="sm2l");
const themes=load(themePath);
assert.equal(set?.cards?.length,62,"Korean master SM2L unexpected card count");
assert.equal(themes.groups?.length,12);
const total=()=>themes.groups.reduce((n,g)=>n+g.cards.length,0);
const normalize=s=>String(s||"").replace(/\s+/g,"").toLowerCase();
const color=themes.groups.find(g=>g.code==="color");
assert.ok(color);
const existing=themes.groups.flatMap(g=>(g.cards||[]).filter(c=>String(c.set).toLowerCase()==="sm2l").map(c=>({code:c.code,group:g.code})));
const beforeCodes=[...new Set(existing.map(c=>c.code))].sort();
const allCards=Array.from({length:62},(_,i)=>"SM2L_"+String(i+1).padStart(3,"0"));
const finished60=allCards.filter(c=>!["SM2L_047","SM2L_048"].includes(c));
if(fs.existsSync(auditPath)){
  assert.equal(total(),18011);
  assert.deepEqual([...new Set(themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set).toLowerCase()==="sm2l").map(c=>c.code)))].sort(),allCards);
  console.log("SM2L Korean 047/048 mapping correction already applied; skipping");
  process.exit(0);
}
assert.equal(total(),18009,"Existing independent thematic entries unexpectedly changed");
assert.deepEqual(beforeCodes,finished60.sort(),"SM2L prior 60 art-screened cards unexpectedly altered");
for(const code of ["SM2L_047","SM2L_048"])
  assert.ok(!themes.groups.some(g=>g.cards.some(c=>c.code===code)),
    "047/048 theme row already added: requires manual reconciliation");
const records=[
  {number:"047",name:"레스큐탱크",rarity:"U",tone:"주황·노랑",scene:"주황·노란 섬광 배경에 펼쳐진 회색 구조용 들것과 빨간 몬스터볼 표시",
    koreanImageIndexFile:"레스큐탱크_SM2L_047_KOR.png",
    sameArtworkEnglishIndex:"Rescue Stretcher_SM2L_047_ENG.png",
    japanesePrintedNumber:"048/050",
    japanesePrintedArt:"https://okini.land/en/52860-pokemon-tcg-sm2l-048-050-u-rescue-stretcher-the-pokemon-company.html"},
  {number:"048",name:"아쿠아패치",rarity:"U",tone:"파랑·청록",scene:"푸른 물방울과 기포, 검은 물 에너지 문양이 강조된 아이템 일러스트",
    koreanImageIndexFile:"아쿠아패치_SM2L_048_KOR.png",
    sameArtworkEnglishIndex:"Aqua Patch_SM2L_048_ENG.png",
    japanesePrintedNumber:"047/050",
    japanesePrintedArt:"https://www.pokemon-card.com/card-search/"}
];
const afterDetails=[];
for(const r of records){
  const code="SM2L_"+r.number;
  const c=set.cards.find(x=>String(x.code).toUpperCase()===code+"/050");
  assert.ok(c,code+" missing from Korean master");
  assert.equal(normalize(c.name),normalize(r.name),code+" master KR identity");
  assert.ok(typeof c.image==="string"&&/^https:\/\//.test(c.image),code+" canonical image absent");
  const record={
    code,name:c.name,series:"SM",set:set.code,setName:set.displayName,
    cardNumber:r.number+"/050",rarity:r.rarity,category:r.tone,image:c.image,
    evidence:"SM2L "+r.number+"/050 한국판: 한국판 62장 체크리스트의 카드명·번호 "+
      "및 한국어/영어 카드 이미지 파일 인덱스에 명시된 한글판 고유 번호를 교차 검증. "+
      "일본판 SM2L은 047/048 두 카드의 번호 배정이 반대임. 색상은 해당 아이템 원화를 기준으로 확인: "+
      r.scene+". 한국어 카드 전면 사진의 번호를 직접 확대 판독한 검수는 여전히 보류. "+
      auditPath
  };
  color.cards.push(record);
  afterDetails.push({...r,code,canonicalImage:c.image,colorThemeAdded:true,printedKoreanPhotoIndependentlyInspected:false});
}
assert.equal(total(),18011);
const updatedExisting=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set).toLowerCase()==="sm2l"&&
  !["SM2L_047","SM2L_048"].includes(c.code)).map(c=>({code:c.code,group:g.code})));
assert.deepEqual(existing,updatedExisting,"Previously inserted themed cards changed");
const oldTest=fs.readFileSync(testPath,"utf8");
const oldAssertion="assert.equal(total,18009); // SM2L 031-062: all names screened, cross-language art holds logged";
assert.equal(oldTest.split(oldAssertion).length,2,"Existing test baseline no longer matches");
const newTest=oldTest.replace(oldAssertion,
  "assert.equal(total,18011); // SM2L 047-048 Korean-only numbering resolved; all 62 artworks screened");
const verifiedIds=["SM2L_001","SM2L_003","SM2L_004","SM2L_005","SM2L_007","SM2L_009","SM2L_011"];
const cards=set.cards.map(c=>{
  const n=Number(String(c.code).split("_").at(-1)?.split("/")[0]);
  assert.ok(n>=1&&n<=62,"Malformed canonical card code "+c.code);
  const id="SM2L_"+String(n).padStart(3,"0");
  const image=String(c.image||"");
  let storageClass;
  if(/cards\.image\.pokemonkorea\.co\.kr/i.test(image))storageClass="official_korean_card_art_cdn";
  else if(/k-tcgpanda\.com/i.test(image)&&/_KOR\.(?:jpg|jpeg|png)/i.test(decodeURI(image)))storageClass="kor_filename_index_reference";
  else if(/tcgbox\.co\.kr/i.test(image))storageClass="korean_retailer_image_url";
  else storageClass="other_existing_canonical_url";
  return {code:id,canonicalName:c.name,canonicalImage:image,providerClass:storageClass,
    imageURLInCanonical:true,cdnImageBytesDownloadedThisAudit:false,
    verifiedKoreanPhysicalPrintInPriorAudit:verifiedIds.includes(id),
    KoreanPhotoDirectlyDecodedThisAudit:false,
    requiresDirectKoreanImageVisualVerification:!verifiedIds.includes(id)};
});
assert.equal(cards.length,62);
assert.equal(cards.filter(c=>c.requiresDirectKoreanImageVisualVerification).length,55);
const report={
  schemaVersion:1,recordedAt:"2026-10-19",
  series:"sm2L",setName:set.displayName,
  previousCheckpoint:"data/audits/theme-sm2l-031-062-full-range-screen-20261019.json",
  resolution:"Korean-issued set index assigns 047=레스큐탱크, 048=아쿠아패치; Japanese printing swaps their numbers. Korean canonical identities preserved.",
  koreanNumberMappingHoldsRemaining:[],
  koreanNumberMappingResolved:["SM2L_047","SM2L_048"],
  KoreanCatalogueAndMatchingArtworkScreened:62,
  totalCards:62,
  addedNewCardsToColorTheme:2,oldThemeTotal:18009,newThemeTotal:18011,
  officialKoreanPhotoPrintVerifiedEarlier:7,
  newPrintedKoreanPhotoVerifiedThisAudit:0,
  KoreanPrintedPhotoVerificationStillPending:55,
  entireSetStrictPhotoComplete:false,
  noAdditionalCardsReexamined:true,
  matchingArtworkScreeningCompleted:true,
  statusForSeriesCoverage:"pending strict Korean image visual checks; do NOT promote to strict complete",
  evidence:{
    koreanSetChecklist:"https://setory.site/sets/sm-alola-moonlight-kr",
    koreanSetChecklistMirror:"https://www.namu.moe/w/%EC%95%8C%EB%A1%9C%EB%9D%BC%EC%9D%98%20%EB%8B%AC%EB%B9%9B",
    koreanEnglishSameNumberInventory:"https://k-tcgpanda.com/cardimg/SM/SM2L/",
    JapaneseRescueStretcher48:"https://okini.land/en/52860-pokemon-tcg-sm2l-048-050-u-rescue-stretcher-the-pokemon-company.html",
    KoreaOfficialExpansionAquaPatch:"https://pokemoncard.co.kr/card/106",
    caution:"Japanese-set numbering is not controlling for Korean card ID; filename listing and metadata are NOT independently visually decoded Korean physical-card images."
  },
  resolvedCardDetails:afterDetails,
  imageSourceInventory:{
    description:"Canonical URLs only; source categories help prioritize manual Korean print inspection, not evidence that photos were downloaded or Korean text verified.",
    expectedCardCount:62,
    cards
  },
  safeguards:{canonicalMasterEdited:0,existingThemedRowsModified:0,ownershipStateEdited:0,firestoreEdited:0,externalImagesReplaced:0}
};
themes.updatedAt="2026-10-19";
write(themePath,themes);
write(auditPath,report);
fs.writeFileSync(testPath,newTest);
console.log("SM2L_047_048_KOREAN_MAPPING_RESOLVED",JSON.stringify({
  cards:2,newThemeSlots:2,totalThemeSlots:total(),artScreened:62,
  KoreanNumberHoldsRemaining:0,strictKoreanPhotoHolds:55
}));
