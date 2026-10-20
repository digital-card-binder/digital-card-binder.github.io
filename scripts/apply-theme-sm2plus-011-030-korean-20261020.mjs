#!/usr/bin/env node
// Korean SM2+ 011-030 image-based illustration theme continuation.
// Screened all twelve independent themes for the 20 decoded Korean card faces.
// Footer printed numerals still need a separate enlarged provenance proof.
import fs from "node:fs";
import assert from "node:assert/strict";
const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n");
const artPath="data/art-themes.json";
const auditPath="data/audits/theme-sm2plus-011-030-korean-art-screen-20261020.json";
const priorPath="data/audits/theme-sm2plus-001-010-korean-art-screen-20261020.json";
const preflightPath="data/audits/theme-sm2plus-011-030-image-preflight-20261020.json";
const statusPath="data/audits/theme-series-review-status.json";
const testsPath="tests/theme-card-identity.test.mjs";
const fullThemes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const master=[...load("data/series.json"),...load("data/series-legacy.json")].find(x=>String(x.code).toLowerCase()==="sm2+");
const doc=load(artPath), status=load(statusPath), pre=load(preflightPath), prior=load(priorPath), coverage=load("data/audits/theme-series-coverage.json");
const total=()=>doc.groups.reduce((n,g)=>n+g.cards.length,0);
const clean=x=>String(x??"").replace(/\s+/g,"").toLowerCase();
assert.equal(master?.cards?.length,75);
assert.equal(prior.reviewedArtworkCount,10);
assert.equal(prior.newIndependentThemeRows,16);
assert.equal(pre.imagesDownloadedDecoded,20);
assert.equal(pre.cards.length,20);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(coverage.summary.themeCardSlots,18027);
assert.equal(coverage.sets.find(x=>x.code.toLowerCase()==="sm2+")?.status,"partial");
assert.equal(total(),18027,"The theme master changed concurrently; stop before any edits");
assert.deepEqual(new Set(doc.groups.map(g=>g.code)),new Set(fullThemes));
assert.ok(!fs.existsSync(auditPath));
const existing=doc.groups.flatMap(g=>g.cards
  .filter(c=>String(c.set??"").toLowerCase()==="sm2+")
  .map(c=>({theme:g.code,code:c.code})));
const priorIds=new Set(Array.from({length:10},(_,i)=>"SM2PLUS_"+String(i+1).padStart(3,"0")));
assert.deepEqual(new Set(existing.map(x=>x.code)),priorIds);
assert.equal(existing.length,16);

const data=[
  [11,"알로라모래두지","눈이 흩날리는 하얀 설원과 얼음 나무 곁의 알로라모래두지",{color:"흰색·하늘",season:"눈이 내리는 겨울 설원"}],
  [12,"알로라고지","푸른 얼음 결정과 회색 바위의 차가운 산기슭에 선 알로라고지",{color:"하늘·회색",season:"얼음 결정이 가득한 산악 빙설지형"}],
  [13,"알로라식스테일","눈송이와 얼어붙은 나뭇가지 사이의 흰 알로라식스테일",{color:"흰색·연보라",season:"눈 내리는 침엽수 숲"}],
  [14,"알로라나인테일","눈 덮인 바위산 앞 연청색 알로라나인테일과 맑은 먼 하늘",{color:"하늘·흰색",season:"눈 쌓인 산과 얼음 언덕"}],
  [15,"고래왕자","푸른 물결의 바다와 작은 초록 섬 앞에서 솟아오르는 고래왕자",{color:"파랑·청록",season:"맑은 날의 바다와 작은 섬"}],
  [16,"고래왕","야자나무가 있는 열대 섬 바닷가 위로 고래왕이 뛰어오르는 밝은 만화풍 그림",{color:"파랑·크림",season:"햇볕이 비치는 열대 해변과 야자나무"}],
  [17,"약어리","물방울과 물결 속에서 헤엄치는 물고기 떼의 푸른 바닷속",{color:"파랑·흰색",season:"푸른 바닷속과 움직이는 물고기 떼"}],
  [18,"카푸느지느 GX","검은 몸체의 카푸느지느 GX와 푸른 물보라·전투 움직임",{color:"검정·청록"}],
  [19,"에레브","푸른 하늘과 초록 잔디가 뒤에 보이는 언덕 앞의 노란 에레브",{color:"노랑·초록",season:"푸른 하늘과 밝은 풀이 있는 초원"}],
  [20,"에레키블","강한 번개가 번쩍이는 짙은 바위 배경의 에레키블",{color:"노랑·회색"}],
  [21,"카푸꼬꼬꼭","짙은 노랑과 주황빛 번개 사이의 카푸꼬꼬꼭",{color:"노랑·주황"}],
  [22,"야돈","꽃과 잎이 우거진 초록 풀밭에 눈을 감고 길게 누운 분홍 야돈",{sleeping:"꽃밭에서 눈을 감고 누워 쉬는 야돈",color:"분홍·초록",season:"다양한 꽃이 피어난 따뜻한 풀밭"}],
  [23,"야도킹","열대 섬의 야자나무와 노란 모래사장 앞에서 앉아 있는 야도킹",{color:"분홍·황토",season:"밝은 모래 해변과 야자나무"}],
  [24,"깨봉이","갈색 쓰레기 더미와 탁한 배경 앞의 초록 깨봉이",{color:"청록·갈색"}],
  [25,"더스트나","보랏빛 안개가 낀 쓰레기 더미와 회색 더스트나",{color:"보라·회색"}],
  [26,"카푸나비나","분홍빛 카푸나비나와 꽃잎·초록 식물이 섞인 화려한 꽃밭",{color:"분홍·연두",season:"꽃잎과 초록 잎이 무성한 화사한 정원"}],
  [27,"알통몬","파란 하늘과 초록 언덕·꽃밭을 배경으로 운동하는 알통몬",{color:"회색·연두",season:"화창한 하늘 아래 초록 언덕과 들꽃"}],
  [28,"근육몬","흰 눈과 차가운 회색 산악 절벽 옆에서 움직이는 근육몬",{color:"회색·하늘",season:"눈과 바위가 뒤섞인 산악 절벽"}],
  [29,"괴력몬 GX","주황색 빛과 검은 전투 효과선이 휘몰아치는 괴력몬 GX",{color:"회색·주황"}],
  [30,"루나톤","분홍빛 우주 배경 앞의 황토색 초승달 형상 루나톤",{color:"황토·분홍"}]
];
assert.equal(data.length,20);
const byTheme=Object.fromEntries(doc.groups.map(g=>[g.code,g]));
const before=Object.fromEntries(doc.groups.map(g=>[g.code,g.cards.length]));
const added=data.reduce((n,r)=>n+Object.keys(r[3]).length,0);
assert.equal(added,34);
const audited=[];
for (const [n,name,scene,tags] of data) {
  const id=String(n).padStart(3,"0"),full="SM2PLUS_"+id;
  const original=master.cards.find(c=>clean(c.code)==="sm2plus_"+id+"/049");
  assert.ok(original,"Unknown canonical card "+id);
  assert.equal(clean(original.name),clean(name),"Korean printed identity mismatch at "+id);
  const photo=pre.cards[n-11];
  assert.equal(photo.number,n);
  assert.equal(clean(photo.code),clean(original.code));
  assert.equal(photo.name,original.name);
  assert.equal(photo.imageDecoded,true,"Not proven decoded: "+id);
  assert.match(photo.sha256,/^[a-f0-9]{64}$/);
  assert.equal(photo.image,original.image);
  for(const [t,category] of Object.entries(tags)) {
    const group=byTheme[t];assert.ok(group,"Unrecognized theme "+t);
    assert.ok(!group.cards.some(c=>c.code===full),"Theme duplicated: "+full);
    group.cards.push({
      code:full,name:original.name,series:"SM",set:master.code,
      setName:master.displayName,cardNumber:id+"/049",
      rarity:original.rarity||"",category,image:original.image,
      evidence:"한국어 원본 이미지 011-030 실제 디코딩 및 일러스트 눈검수, " +
        "카드 이름과 마스터 번호 대응·이미지 SHA256 기록. " + scene +
        ". 불확실한 테마는 제외; 인쇄 하단 상세 확대는 별도 검증 보류. " + auditPath
    });
  }
  audited.push({code:full,name,canonical:original.code,artworkScene:scene,
     sha256:photo.sha256,faceKoreanAndArtVisuallyInspected:true,
     exactPrintedFooterEnlargementReviewed:false,approvedIndependentThemes:tags});
}
assert.equal(total(),18061);
for(const group of doc.groups)assert.equal(group.cards.length,before[group.code]+data.filter(r=>Object.hasOwn(r[3],group.code)).length);
const rawTests=fs.readFileSync(testsPath,"utf8");
const expected="assert.equal(total,18027); // Korean SM2+ 001-010 artwork-screened: color 10 and landscape 6";
assert.ok(rawTests.includes(expected)&&rawTests.split(expected).length===2,"Theme test baseline drift");
const newTests=rawTests.replace(expected,"assert.equal(total,18061); // SM2+ Korean art screened through 030: 34 new visual placements");
const k=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()==="sm2+")||"sm2+";
assert.equal(status.reviews?.[k]?.status,"partial");
assert.equal(status.reviews[k].reviewedCardCount,10);
status.reviews[k]={...status.reviews[k],status:"partial",reviewedAt:"2026-10-20",
 reviewedCardCount:30,reviewedThemes:fullThemes,evidence:auditPath,
 note:"30/75 Korean SM2+ artworks screened against 12 themes; 001-010 remain unchanged; 011-030 add 34 independent slots. Footer enlargement, 031-075 still pending."};
const report={
 schemaVersion:1,recordedAt:"2026-10-20",set:master.code,
 setName:master.displayName,range:"011-030",priorReviewed:10,newlyReviewed:20,
 cumulativeReviewed:30,totalMasterCards:75,remainingUnscreened:45,
 KoreanImagesDecoded:20,newIndependentThemeSlots:34,
 themeRowsBefore:18027,themeRowsAfter:18061,
 perThemeAdditions:Object.fromEntries(doc.groups.map(g=>[g.code,g.cards.length-before[g.code]])),
 pictureEvidence:preflightPath,priorAudit:priorPath,cards:audited,
 strictSetComplete:false,unfinishedPrintedFooterEnlargement:true,
 safety:{priorThemeCardsChanged:0,prior109CompletedSetsReopened:0,
         masterDatabaseChanged:0,FireStoreOrOwnershipChanged:0,cardRadarChanged:0},
 next:"SM2+ 031-050 image and artwork screen, then 051-075; separately hold SM2K five Korean-photo gaps."
};
doc.updatedAt="2026-10-20";
save(artPath,doc);save(statusPath,status);save(auditPath,report);
fs.writeFileSync(testsPath,newTests);
console.log("SM2PLUS_011_030_12THEME_REVIEW",JSON.stringify({newCards:20,slotsAdded:34,totalSlots:total(),cumulativeReviewed:30,remaining:45}));
