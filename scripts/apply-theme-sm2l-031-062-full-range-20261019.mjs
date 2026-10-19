#!/usr/bin/env node
// Guarded continuation of existing 30-card SM2L artwork-screening checkpoint.
// Korean card names/numbers from domestic lists and Korean image-file indices;
// matching same-set Japanese illustrations were used for composition screening.
// None of the 031-062 Korean physical fronts was independently decoded as Korean
// printed artwork in this audit. This is NOT full Korean print verification.
import fs from "node:fs";
import assert from "node:assert/strict";
const load = p => JSON.parse(fs.readFileSync(p,"utf8"));
const save = (p,x) => fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const themesPath="data/art-themes.json";
const auditPath="data/audits/theme-sm2l-031-062-full-range-screen-20261019.json";
const testPath="tests/theme-card-identity.test.mjs";
const set=load("data/series.json").find(x=>String(x.code).toLowerCase()==="sm2l");
const themes=load(themesPath);
assert.equal(set?.cards?.length,62);
assert.equal(themes.groups?.length,12);
const byTheme=Object.fromEntries(themes.groups.map(g=>[g.code,g]));
const count=()=>themes.groups.reduce((n,g)=>n+g.cards.length,0);
const normalize=x=>String(x??"").replace(/\s+/g,"").toLowerCase();
const batch=[[31,"깜까미","U",{"color":"보라·청록","season":"어두운 동굴 속 반짝이는 수정"},"수정이 반짝이는 바위 동굴 속 보라빛 깜까미"],[32,"부란다","U",{"color":"남색·회색","season":"보름달빛이 비치는 풀밭","night":"달이 뜬 밤의 넓은 풀밭"},"밝은 둥근 달이 떠 있는 밤, 바람에 흔들리는 풀밭에서 부란다가 주먹을 든다"],[33,"메탕","C",{"color":"군청·초록","season":"밝은 열대 잎사귀와 주황 꽃"},"큰 초록 잎과 주황빛 꽃 속 파란 메탕"],[34,"메탕구","C",{"color":"남색·회색"},"강철빛 남색 메탕구; 별도의 자연/배경 테마 판정은 보류"],[35,"메타그로스 GX","RR",{"color":"파랑·청록"},"푸른 메타그로스와 번개 같은 밝은 효과선"],[36,"소미안","C",{"color":"연두·갈색","season":"큰 초록 잎 그늘의 숲"},"초록 잎 그늘 아래 웅크린 연두빛 소미안"],[37,"엘풍","U",{"color":"크림·하늘","season":"맑은 하늘과 야자나무가 있는 열대 테라스"},"화창한 야자나무 해안과 난간 위를 떠다니는 엘풍"],[38,"미끄메라","C",{"color":"회보라·초록"},"뜨개 인형과 작은 풀/바위 미니어처; 실제 자연 환경으로 단정하지 않음"],[39,"미끄네일","C",{"color":"보라·노랑","season":"야생화가 피어난 푸른 풀숲"},"다양한 풀과 꽃이 피어난 밝은 풍경 속 보라빛 미끄네일"],[40,"미끄래곤","R",{"color":"보라·파랑"},"보라빛 미끄래곤과 푸른 충격선이 겹친 공격 장면"],[41,"캐스퐁","C",{"color":"하늘·갈색","season":"바닷물과 바위에 부딪치는 맑은 파도"},"푸른 물, 갈색 바위, 흰 포말 사이 캐스퐁"],[42,"보르쥐","C",{"color":"갈색·하늘","season":"푸른 해변을 따라 펼쳐진 밝은 모래사장"},"밝은 모래사장과 푸른 바다 앞에서 뛰는 보르쥐"],[43,"보르그","C",{"color":"갈색·하늘","season":"초록 나무와 하얀 구름이 있는 맑은 하늘"},"흰 구름과 초록 나무를 배경으로 몸을 돌린 보르그"],[44,"화살꼬빈","C",{"color":"주황·크림"},"주황 머리의 작은 새와 부드러운 파스텔 배경"],[45,"불화살빈","C",{"color":"회색·연두","season":"맑은 하늘 아래 우거진 나뭇가지"},"멀리 밝은 하늘과 초록 잎이 겹치는 숲에서 날아가는 불화살빈"],[46,"파이어로","U",{"color":"빨강·주황","season":"해 질 녘 빛나는 바다와 해안","sunset":"바다 위로 지는 해를 향해 나는 파이어로"},"해안선의 저녁 햇살과 바다 위를 질주하는 파이어로"],[47,"레스큐탱크","U",{},"한국판 047 레스큐탱크와 일본판 048 Rescue Stretcher 카드번호 차이; 동일 인쇄판 직접 판독 전까지 제외"],[48,"아쿠아패치","U",{},"한국판 048 아쿠아패치와 일본판 047 Aqua Patch 번호 차이; 동일 인쇄판 직접 판독 전까지 제외"],[49,"마오","U",{"color":"초록·분홍","season":"짙은 수풀과 버섯이 자란 숲"},"초록 숲과 여러 버섯, 나무 아래 선 마오"],[50,"잔잔한물가언덕","U",{"color":"파랑·초록","season":"폭포가 흐르는 푸른 호수와 잔디 언덕"},"작은 폭포와 호수·잔디 언덕·밝은 하늘을 그린 스타디움 카드"],[51,"약어리 GX","SR",{"color":"파랑·남색"},"물방울과 푸른 약어리 떼가 전면을 채운 풀아트"],[52,"카푸나비나 GX","SR",{"color":"분홍·자주"},"분홍·보라 기하학 패턴이 강조된 카푸나비나 풀아트"],[53,"루가루암 GX","SR",{"color":"주황·회색"},"주황 기하학 배경 앞 회색·적갈색 루가루암"],[54,"메타그로스 GX","SR",{"color":"파랑·은색"},"은색 십자와 푸른 강철 몸체가 화면을 채우는 메타그로스 풀아트"],[55,"마오","SR",{"color":"초록·분홍","food":"요리용 국자와 과일을 든 마오","work":"요리용 국자와 과일을 들고 요리를 준비하는 마오"},"국자와 파란 열매·노란 과일을 들고 있는 풀아트"],[56,"약어리 GX","HR",{"color":"무지개·홀로"},"무지개색 홀로 가공의 약어리 GX HR 변형"],[57,"카푸나비나 GX","HR",{"color":"무지개·홀로"},"무지개색 홀로 가공의 카푸나비나 GX HR 변형"],[58,"루가루암 GX","HR",{"color":"무지개·홀로"},"무지개색 홀로 가공의 루가루암 GX HR 변형"],[59,"메타그로스 GX","HR",{"color":"무지개·홀로"},"무지개색 홀로 가공의 메타그로스 GX HR 변형"],[60,"아쿠아패치","UR",{"color":"금색·청록"},"물 에너지 심볼의 황금색 UR 카드"],[61,"개조해머","UR",{"color":"금색·검정"},"검은 망치와 황금빛 반짝임의 UR 카드"],[62,"기본 격투 에너지","UR",{"color":"금색·주황"},"주황 격투 에너지 심볼과 금빛 광택의 UR 카드"]];
const codes=batch.map(([n])=>"SM2L_"+String(n).padStart(3,"0"));
const first=Array.from({length:30},(_,i)=>"SM2L_"+String(i+1).padStart(3,"0"));
const existing=themes.groups.flatMap(g=>g.cards
  .filter(c=>String(c.set).toLowerCase()==="sm2l")
  .map(c=>({code:c.code,group:g.code})));
const unique=[...new Set(existing.map(x=>x.code))].sort();
const increment=batch.reduce((n,row)=>n+Object.keys(row[3]).length,0);
assert.equal(batch.length,32);
assert.equal(increment,47);
const deltas=Object.fromEntries(themes.groups.map(g=>[g.code,0]));
for(const row of batch)for(const k of Object.keys(row[3])) {
  assert.ok(k in deltas,"Unknown theme "+k);
  deltas[k]++;
}
assert.deepEqual(Object.fromEntries(Object.entries(deltas).filter(([,v])=>v>0)),
  {night:1,season:13,color:30,sunset:1,food:1,work:1}
);
if(fs.existsSync(auditPath)){
  assert.equal(count(),18009,"Post-batch count changed unexpectedly");
  assert.deepEqual(unique,[...first,...codes].sort());
  console.log("SM2L 031-062 audit already applied; no duplicate changes");
  process.exit(0);
}
assert.equal(count(),17962,"Baseline theme count drift: stop");
assert.deepEqual(unique,first.sort(),"Existing SM2L 001-030 entries unexpectedly different");
const before=Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length]));
const inserted=[];
const checked=[];
for(const row of batch){
  const [n,expectedName,rarity,tags,scene]=row;
  const suffix=String(n).padStart(3,"0");
  const code="SM2L_"+suffix;
  const canonical=set.cards.find(c=>String(c.code).toUpperCase()===code+"/050");
  assert.ok(canonical,"Missing canonical card "+code);
  assert.equal(normalize(canonical.name),normalize(expectedName),code+" Korean identity mismatch");
  assert.match(String(canonical.image||""),new RegExp("/SM2L/SM2L_"+suffix+"\\.png$"),code+" canonical image path");
  checked.push({code,koreanName:canonical.name,printedNumber:suffix+"/050",rarity,scene,
    approvedThemes:tags,addedThemeCount:Object.keys(tags).length,
    koreanPrintedPhotoDecoded:false,
    artworkGrade:n===47||n===48?"cross_language_number_mapping_hold":"ko_catalogued_matching_jp_artwork",
    JapaneseReference:n<=50?"https://www.pokemon-card.com/card-search/details.php/card/"+(33416+n):
      "https://chasesociety.com/sets/pokemon-japan-sm2l-alolan-moonlight",
    specialEvidence:
      n===47||n===48?"https://kream.co.kr/products/865240":null});
  for(const [themeKey,category] of Object.entries(tags)){
    const target=byTheme[themeKey];
    assert.ok(!target.cards.some(c=>c.code===code),"Duplicate theme for "+code);
    target.cards.push({
      code,name:canonical.name,series:"SM",set:set.code,setName:set.displayName,
      cardNumber:suffix+"/050",rarity,category,image:canonical.image,
      evidence:"한국판 SM2L "+suffix+"/050 카드명·번호는 국내 목록·마스터와 대조. "+
        "그림 구도는 해당 원화가 동일한 일본판을 통해 확인했고 한국어 실물 하단/이미지는 직접 확대 검증 전. "+
        scene+". 배경이 불명확하면 분류하지 않고, 연결·진화 테마는 추측 추가하지 않음. "+auditPath
    });
    inserted.push({code,theme:themeKey,category});
  }
}
assert.equal(checked.length,32);
assert.equal(inserted.length,47);
assert.equal(count(),18009);
for(const g of themes.groups)assert.equal(g.cards.length,before[g.code]+deltas[g.code],g.code);
assert.equal(JSON.stringify(existing),JSON.stringify(themes.groups.flatMap(g=>g.cards
  .filter(c=>String(c.set).toLowerCase()==="sm2l" && Number(c.code.slice(-3))<=30)
  .map(c=>({code:c.code,group:g.code})))));
const oldTest=fs.readFileSync(testPath,"utf8");
const needle="assert.equal(total,17962); // SM2L 021-030: Korean names matched, artwork screened, print-photo holds";
assert.equal(oldTest.split(needle).length,2,"Previous test count contract changed");
const newTest=oldTest.replace(needle,
  "assert.equal(total,18009); // SM2L 031-062: all names screened, cross-language art holds logged");
const report={
  schemaVersion:1,recordedAt:"2026-10-19",sourceSet:set.code,setName:set.displayName,
  previous:"data/audits/theme-sm2l-021-030-artwork-screen-20261019.json",
  coverage:"Reviewed all 62 Korean canonical SM2L card identities, 12-theme screening from 001 through 062 over four resumable batches. Does NOT certify a strict Korean-language physical-photo audit.",
  allKoreanCardNumbersCatalogued:62,totalSetCards:62,
  previouslyScreenedArtworks:30,newlyScreenedMatchingArtworks:30,
  matchingArtworkScreenedCumulative:60,
  koreanNumberMappingHolds:["SM2L_047","SM2L_048"],
  KoreanVsJapaneseNumberMappingNotes:{
    KoreanCatalogue:"047 레스큐탱크, 048 아쿠아패치",
    JapaneseOriginal:"047 Aqua Patch, 048 Rescue Stretcher",
    KoreanEvidence:"https://setory.site/sets/sm-alola-moonlight-kr and https://kream.co.kr/products/865240",
    JapaneseEvidence:"https://www.pokemon-card.com/card-search/ and https://www.papermoonjapan-annex.com/diary-detail/80",
    disposition:"Korean canonical identity and image unchanged. Both artwork tags postponed pending direct Korean physical-card pixel validation."
  },
  newRange:"SM2L_031..062",newKoreanEntriesReviewed:32,
  newThemeRows:47,oldThemeTotal:17962,newThemeTotal:18009,
  themeDeltas:deltas,before,after:Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length])),
  noAdditionalThemeThisBatch:["SM2L_047","SM2L_048"],
  exactKoreanPrintedCardImagesVerifiedPreviously:7,
  exactKoreanPrintedCardImagesVerifiedThisBatch:0,
  exactKoreanPrintedCardImagesVerifiedCumulative:7,
  koreanPrintedImageProofPendingTotal:55,
  remainingKoreanNumberMappingHolds:2,
  pendingStrictKoreanPhotoAudit:true,
  strictComplete:false,
  importedForeignLanguagePrintIntoKoreanDB:false,
  nextWork:"Acquire/zoom 55 Korean-language printed card photos, resolve 047/048 mapping, then decide strict thematic complete state; SM2K five independent held cards remain separate.",
  sources:{
    koreanPrintCardNames:"https://setory.site/sets/sm-alola-moonlight-kr",
    KoreanSecretRareNames:"https://www.namu.moe/w/%EC%95%8C%EB%A1%9C%EB%9D%BC%EC%9D%98%20%EB%8B%AC%EB%B9%9B",
    koreanCardImgIndex:"https://k-tcgpanda.com/cardimg/SM/SM2L/",
    japaneseArtChecklist:"https://www.papermoonjapan-annex.com/diary-detail/80",
    graphicArtwork:"https://www.pokemon-card.com/card-search/"
  },
  reviewedCards:checked,inserted,
  safeguards:{previousThemeEntriesModified:0,canonicalMasterEdited:0,ownershipEdited:0,firestoreEdited:0,imageAssetsEdited:0}
};
themes.updatedAt="2026-10-19";
save(themesPath,themes);save(auditPath,report);
fs.writeFileSync(testPath,newTest);
console.log("SM2L_031_062_THEME_AUDIT",JSON.stringify({catalogued:62,matchedArtScreened:60,numberMappingHolds:2,added:47,final:count(),strictKoreanVerified:7,koreanImageHolds:55}));
