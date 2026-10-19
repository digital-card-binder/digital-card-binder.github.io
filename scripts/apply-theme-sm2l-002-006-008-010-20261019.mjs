#!/usr/bin/env node
// Continuation of Korean SM2L thematic curation. Do not replay completed cards.
// Four Korean catalogue/number identities + their international identical-set artwork
// are cross-checked. This does NOT claim that Korean-language front-print pixels or
// bottom numbers were zoomed independently. The existing canonical Korean image
// paths are preserved and a distinct Korean-photo hold is kept in the audit.
import assert from "node:assert/strict";
import fs from "node:fs";

const load = p => JSON.parse(fs.readFileSync(p, "utf8"));
const save = (p, x) => fs.writeFileSync(p, JSON.stringify(x, null, 2) + "\n");
const themeFile="data/art-themes.json";
const auditFile="data/audits/theme-sm2l-002-006-008-010-artwork-20261019.json";
const identityTest="tests/theme-card-identity.test.mjs";
const themes=load(themeFile);
const master=load("data/series.json");
const set=master.find(s=>String(s.code).toLowerCase()==="sm2l");
assert.equal(set?.cards?.length,62);
assert.equal(themes.groups.length,12);
const total=()=>themes.groups.reduce((n,g)=>n+g.cards.length,0);
const groups=Object.fromEntries(themes.groups.map(g=>[g.code,g]));
const baseCodes=["SM2L_001","SM2L_003","SM2L_004","SM2L_005","SM2L_007","SM2L_009"];
const cases=[
  {
    n:2,name:"대로트",rarity:"U",
    observation:"갈라진 바위지형을 배경으로 자주빛 어두운 하늘 아래 서 있는 나무 포켓몬",
    themes:{color:"자주·회색"},
    artwork:"https://www.cartemagic.com/prodotto/trevenant-7-145-trevenant-poltergeist-horn-leech-7-145/",
    koreanCatalogue:"https://kream.co.kr/products/865195",
    koreanImageFilename:"대로트_SM2L_002_KOR.png"
  },
  {
    n:6,name:"야도뇽",rarity:"C",
    observation:"검은 화산암과 선명한 주황·노랑 용암 사이를 걷는 도마뱀 포켓몬",
    themes:{color:"주황·검정"},
    artwork:"https://www.gamenerdz.com/salandit-15-145-guardians-rising",
    koreanCatalogue:"https://setory.site/sets/sm-alola-moonlight-kr",
    koreanImageFilename:"야도뇽_SM2L_006_KOR.png"
  },
  {
    n:8,name:"왕눈해",rarity:"C",
    observation:"푸른 물속에서 청록색 해초와 다채로운 산호 사이를 떠다니는 왕눈해",
    themes:{color:"청록·분홍",season:"열대 바다의 해초와 산호초"},
    artwork:"https://store.shopping.yahoo.co.jp/lead-netstore/sm2lpmplay008.html",
    koreanCatalogue:"https://kream.co.kr/products/865201",
    koreanImageFilename:"왕눈해_SM2L_008_KOR.png"
  },
  {
    n:10,name:"고래왕자",rarity:"C",
    observation:"푸른 파도를 일으키며 떠오른 고래왕자, 뒤로 청록빛 바다와 초록 해안 언덕",
    themes:{color:"파랑·청록",season:"푸른 바다와 해안의 초록 언덕"},
    artwork:"https://okini.land/en/52822-pokemon-tcg-sm2l-010-050-c-wailmer-the-pokemon-company.html",
    koreanCatalogue:"https://setory.site/sets/sm-alola-moonlight-kr",
    koreanImageFilename:"고래왕자_SM2L_010_KOR.png"
  }
];
const newCodes=cases.map(x=>"SM2L_"+String(x.n).padStart(3,"0"));
const additions=cases.reduce((sum,x)=>sum+Object.keys(x.themes).length,0);
assert.equal(additions,6);
const existing=themes.groups.flatMap(g=>(g.cards||[])
    .filter(c=>String(c.set).toLowerCase()==="sm2l")
    .map(c=>({code:c.code,theme:g.code})));
const existingCodes=[...new Set(existing.map(x=>x.code))].sort();
const expectedBase=[...baseCodes].sort();
if(fs.existsSync(auditFile)){
  assert.equal(total(),17929,"Idempotency: unexpected post-review theme count");
  assert.deepEqual(existingCodes,[...baseCodes,...newCodes].sort());
  console.log("SM2L 002/006/008/010 already staged: no changes");
  process.exit(0);
}
assert.equal(total(),17923,"Baseline differs; don't clobber concurrent audit");
assert.deepEqual(existingCodes,expectedBase,"SM2L prior audit cards unexpectedly changed");
const previousCount=Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length]));
const previousEntries=JSON.stringify(existing);
const accepted=[];
for(const entry of cases){
  const suffix=String(entry.n).padStart(3,"0");
  const code="SM2L_"+suffix;
  const official=set.cards.find(c=>String(c.code).toUpperCase()===code+"/050");
  assert.equal(official?.name,entry.name,code+" Korean master");
  assert.match(official.image,new RegExp("/SM2L/SM2L_"+suffix+"\\.png$"),code+" master artwork");
  for(const [groupCode,category] of Object.entries(entry.themes)){
    const g=groups[groupCode];
    assert.ok(g,groupCode);
    assert.ok(!g.cards.some(c=>c.code===code),code+" duplicate theme");
    g.cards.push({
      code,
      name:official.name,
      series:"SM",
      set:set.code,
      setName:set.displayName,
      cardNumber:suffix+"/050",
      rarity:entry.rarity,
      category,
      image:official.image,
      evidence:"한국판 SM2L "+suffix+"/050 이름·수록 목록과 한국판 이미지 인덱스 확인; 동일 원화의 해외 인쇄판 그림을 보고 색상/배경만 보수적으로 분류. "+
         entry.observation+". 한국어 실물 카드 하단을 독립 확대 판독한 것은 아니므로 해당 확인은 보류. "+
         "참조: "+auditFile
    });
    accepted.push({code,theme:groupCode,category});
  }
}
assert.equal(total(),17929);
for(const g of themes.groups){
  const delta=cases.filter(e=>Object.hasOwn(e.themes,g.code)).length;
  assert.equal(g.cards.length,previousCount[g.code]+delta,g.code);
}
themes.updatedAt="2026-10-19";
const oldTest=fs.readFileSync(identityTest,"utf8");
const before="assert.equal(total,17923); // Korean SM2L 001,003,004,007,009 official-art continuation";
assert.equal(oldTest.split(before).length,2,"Unexpected theme count contract");
fs.writeFileSync(identityTest,oldTest.replace(before,
  "assert.equal(total,17929); // SM2L 002,006,008,010 cross-language artwork continuation"));
const audit={
  schemaVersion:1,recordedAt:"2026-10-19",
  project:"Korean illustration theme audit - continue without restarting",
  series:set.code,setName:set.displayName,
  prior:"data/audits/theme-sm2l-001-010-official-visual-review-20261019.json",
  method:"Korean printed set number/name in KR catalogues and named Korean image inventory. Corresponding numbered SM2L illustrations inspected using English/Japanese matching-print sources; Korean physical footer not enlarged/independently verified. No Korean image replacements attempted.",
  reviewTier:"cross_language_artwork_screened_Korean_catalogued_print_pending",
  koreanPrintedImageDirectlyDecoded:false,
  priorApprovedKoreanArtworkCards:baseCodes,
  newArtworkScreened:newCodes,
  artworkScreenedCumulative:10,
  strictKoreanArtworkPreviouslyVerified:6,
  KoreanExactPhotoUnverified:newCodes,
  strictKoreanPhotoUnverifiedCount:4,
  notArtworkScreened:52,
  newThemeRows:additions,
  cardThemesAdded:accepted,
  thematicScope:"color and environment only; no inferred evolution/connected/story/set scenes",
  inputBefore:17923,inputAfter:17929,
  themesBefore:previousCount,
  themesAfter:Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length])),
  KoreanImageFileIndex:"https://k-tcgpanda.com/cardimg/SM/SM2L/",
  cards:cases.map(x=>({
    code:"SM2L_"+String(x.n).padStart(3,"0"),
    name:x.name,printedNumber:String(x.n).padStart(3,"0")+"/050",
    koreanImageIndexName:x.koreanImageFilename,
    KoreanMembershipEvidence:x.koreanCatalogue,
    imageCompositionEvidence:x.artwork,
    artworkScene:x.observation,
    themes:x.themes,
    directKoreanPrintImageInspected:false,
    footerOnActualKoreanPhotoVerified:false
  })),
  next:{
    artworkRange:"SM2L_011..020, then onward; never rescan first ten unless contradictory evidence",
    koreanPrintImageQueue:newCodes,
    independentSm2kHolds:["SM2K_057","SM2K_058","SM2K_060","SM2K_061","SM2K_062"]
  },
  safeguards:{
    existingRowsEdited:0,previousSM2LRowsEdited:0,canonicalCardsChanged:0,
    ownershipStateChanged:0,firestoreChanged:0,imageFilesChanged:0
  }
};
assert.equal(JSON.stringify(existing),previousEntries);
save(themeFile,themes);save(auditFile,audit);
console.log("SM2L_CROSS_LANGUAGE_ARTWORK_SCREEN",JSON.stringify({cards:4,themeRows:6,before:17923,after:17929,strictKoreanPrintPending:4}));
