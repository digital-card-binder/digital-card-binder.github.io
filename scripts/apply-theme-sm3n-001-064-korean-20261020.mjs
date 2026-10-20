#!/usr/bin/env node
// Resume Korean art-theme master audit at SM3N. Screen only actual decoded
// Korean card faces 001-057,059-061,063-064, holding 058 and 062 HTTP 404.
// This does not prove exact printed footer numerals; do not mark set complete.
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+"\n");
const artPath="data/art-themes.json",statusPath="data/audits/theme-series-review-status.json";
const auditPath="data/audits/theme-sm3n-001-064-korean-artwork-screen-20261020.json";
const imagePath="data/audits/theme-sm3n-001-064-korean-image-preflight-20261020.json";
const testPath="tests/theme-card-identity.test.mjs";
const groups=[...read("data/series.json"),...read("data/series-legacy.json")];
const set=groups.find(s=>String(s.code).toLowerCase()==="sm3n");
const data=read(artPath),status=read(statusPath),evidence=read(imagePath);
const cv=read("data/audits/theme-series-coverage.json");
const codes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const normalized=x=>String(x??"").replace(/\s+/g,"").toLowerCase();
const count=()=>data.groups.reduce((sum,g)=>sum+g.cards.length,0);
assert.equal(set?.cards?.length,64);
assert.equal(evidence.totalMasterCards,64);
assert.equal(evidence.imagesSuccessfullyDecoded,62);
assert.equal(cv.summary.themeCardSlots,18205);
assert.equal(cv.summary.strictCompleteSetCount,109);
assert.equal(cv.sets.find(s=>s.code.toLowerCase()==="sm3n")?.status,"pending");
assert.equal(count(),18205);
assert.deepEqual(new Set(data.groups.map(g=>g.code)),new Set(codes));
assert.equal(data.groups.flatMap(g=>g.cards.filter(c=>String(c.set??"").toLowerCase()==="sm3n")).length,0);
assert.ok(!fs.existsSync(auditPath));
// Each row was read directly from the Korean card faces shown in the 7
// contact sheets generated from exact source bytes. No inferred scene tags.
const rows=[
[1,"캐터피","초록·노랑","꽃과 큰 녹색 잎이 가득한 정원"],
[2,"단데기","연두·회색","이슬 안개가 보이는 어두운 나무숲"],
[3,"버터플","주황·크림",null],
[4,"덩쿠리","파랑·초록","큰 열대 잎과 꽃이 있는 푸른 숲"],
[5,"덩쿠림보","청록·남색","바위와 푸른 식물이 보이는 야외"],
[6,"꼬시레","청록·보라","시냇물과 꽃·나무가 있는 물가"],
[7,"갑주무사 GX","은색·청록",null],
[8,"잉어킹","주황·하늘","먼 눈 덮인 산과 푸른 강물"],
[9,"갸라도스","남색·보라",null],
[10,"앗차프","파랑·초록","수풀이 빽빽한 나무숲"],
[11,"앗차키","파랑·갈색",null,{street:"가로등과 벽돌 건물이 있는 마을 거리"}],
[12,"치갈기","분홍·하늘","거품과 푸른 물이 보이는 바닷속"],
[13,"피카츄","노랑·하늘","얼음과 눈이 드러난 차가운 바위 지형"],
[14,"라이츄","노랑·검정",null],
[15,"저리어","흰색·남색","모래와 해초가 있는 해저"],
[16,"저리릴","파랑·청록",null],
[17,"저리더프","파랑·검정",null],
[18,"세비퍼","남색·회색",null],
[19,"해골몽","회색·보라","나무뿌리와 오래된 숲의 바위"],
[20,"미라몽","청록·회색","빛이 드는 동굴과 바위벽"],
[21,"야느와르몽","노랑·회색",null],
[22,"삐딱구리","파랑·회색",null,{street:"푸른 건물 벽과 창문이 있는 거리"}],
[23,"독개굴","남색·자주",null],
[24,"냐스퍼","회색·연두","구름과 풀밭이 보이는 작은 언덕"],
[25,"냐오닉스","하늘·회색","푸른 바다와 야외 바위길"],
[26,"네크로즈마 GX","검정·파랑",null],
[27,"뿔카노","하늘·회색","눈 덮인 산과 얼음 평원"],
[28,"코뿌리","회색·갈색",null],
[29,"거대코뿌리","갈색·노랑",null],
[30,"타격귀","하늘·회색","바위가 쌓인 거친 산악 지형"],
[31,"머드나기","갈색·하늘","밝은 하늘과 초록 잔디"],
[32,"만마드","갈색·청록","구름이 가득한 넓은 들판"],
[33,"마샤도 GX","초록·주황",null],
[34,"알로라꼬렛","검정·보라",null],
[35,"알로라레트라","회색·남색",null,{street:"가로등과 도시 건물들이 보이는 어두운 마을",night:"밤하늘 아래 건물 옆에 선 알로라레트라"}],
[36,"랄토스","하늘·연두","꽃이 피어 있는 정원과 나무"],
[37,"킬리아","하늘·분홍","꽃이 핀 풀밭과 밝은 숲"],
[38,"가디안 GX","초록·분홍",null],
[39,"자마슈","크림·보라","어두운 숲의 흙과 나무뿌리"],
[40,"마셰이드","연두·분홍","식물이 우거진 그늘진 숲"],
[41,"지가르데","검정·노랑",null],
[42,"폴리곤","빨강·하늘",null],
[43,"폴리곤2","분홍·파랑","빛이 드는 나무숲"],
[44,"폴리곤Z","파랑·분홍",null],
[45,"포곰곰","분홍·연두","연노랑 꽃이 핀 화사한 꽃밭"],
[46,"이븐곰","검정·분홍","야자나무가 있는 열대 바닷가"],
[47,"수퍼 포켓몬 회수","파랑·은색",null],
[48,"트집 스프레이","주황·검정",null],
[49,"구즈마","검정·초록",null],
[50,"비케","보라·연두",null,{street:"난간과 대형 창이 있는 건물 밖 공공 보행로"}],
[51,"포마을","연두·회색",null,{street:"건물·울타리·골목이 이어진 마을 풍경"}],
[52,"갑주무사 GX","은색·청록",null],
[53,"네크로즈마 GX","남색·검정",null],
[54,"마샤도 GX","주황·청록",null],
[55,"가디안 GX","분홍·연두",null],
[56,"구즈마","회색·분홍",null],
[57,"비케","분홍·주황",null],
[59,"네크로즈마 GX","무지개·홀로",null],
[60,"마샤도 GX","무지개·홀로",null],
[61,"가디안 GX","무지개·홀로",null],
[63,"수퍼 포켓몬 회수","금색·남색",null],
[64,"페어리 에너지","분홍·금색",null]
];
assert.equal(rows.length,62);
assert.deepEqual(new Set(rows.map(x=>x[0])),new Set(Array.from({length:64},(_,i)=>i+1).filter(n=>n!==58&&n!==62)));
const byGroup=Object.fromEntries(data.groups.map(g=>[g.code,g]));
const before=Object.fromEntries(data.groups.map(g=>[g.code,g.cards.length]));
let inspected=[];
for (const [n,name,color,season,extras={}] of rows){
 const idx=String(n).padStart(3,"0"),card=set.cards[n-1],src=evidence.cards[n-1];
 assert.equal(normalized(card.code),"sm3n_"+idx+"/051",idx+" canonical number");
 assert.equal(normalized(card.name),normalized(name),idx+" Korean master name");
 assert.equal(normalized(src.name),normalized(name),idx+" Korean proof name");
 assert.equal(src.image,card.image,idx+" image source identity");
 assert.equal(src.imageDecoded,true,idx+" image decode");
 assert.match(src.sha256,/^[a-f0-9]{64}$/);
 const approved={color,...(season?{season}:{}),...extras};
 for(const [theme,category] of Object.entries(approved)){
   const group=byGroup[theme];assert.ok(group,"Invalid theme "+theme);
   assert.ok(!group.cards.some(c=>c.code==="SM3N_"+idx),"Already classified "+idx);
   group.cards.push({
      code:"SM3N_"+idx,name:card.name,series:"SM",set:set.code,
      setName:set.displayName,cardNumber:idx+"/051",rarity:card.rarity||"",
      category,image:card.image,
      evidence:"SM3N 한국 카드 얼굴 사진의 실제 일러스트와 한글 표제를 대조하고 다운로드 이미지 SHA256 확인. " +
       "인쇄 하단 번호 확대 판독은 별도 보류; 근거가 없는 독립 테마 추가 없음. " + auditPath
   });
 }
 inspected.push({code:"SM3N_"+idx,canonicalCard:card.code,
    koreanName:card.name,image:card.image,sha256:src.sha256,
    KoreanCardFaceAndArtVisuallyScreened:true,
    independentlyEnlargedFooterNumberRead:false,
    approvedThemes:approved});
}
const held=[58,62].map(n=>{
 const proof=evidence.cards[n-1],card=set.cards[n-1],idx=String(n).padStart(3,"0");
 assert.equal(proof.n,n);assert.equal(proof.imageDecoded,false);
 assert.equal(proof.image,card.image);
 assert.ok(!data.groups.some(g=>g.cards.some(c=>c.code==="SM3N_"+idx)));
 return {number:n,code:card.code,koreanName:card.name,image:card.image,
   evidenceError:proof.error,state:"hold_source_404",themeRecordsAdded:0};
});
const added=inspected.reduce((n,x)=>n+Object.keys(x.approvedThemes).length,0);
assert.equal(count(),18205+added);
for (const g of data.groups) {
 const num=inspected.filter(x=>Object.hasOwn(x.approvedThemes,g.code)).length;
 assert.equal(g.cards.length,before[g.code]+num);
}
const tests=fs.readFileSync(testPath,"utf8");
const marker="assert.equal(total,18205); // SM3H artwork screen 62/64; 060–061 source 404 held";
assert.equal(tests.split(marker).length,2,"Theme regression baseline changed");
fs.writeFileSync(testPath,tests.replace(marker,"assert.equal(total,"+count()+"); // SM3N 62 Korean artworks; 058/062 image-source holds"));
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()==="sm3n")||"sm3N";
const prior=status.reviews?.[key]||{};
assert.notEqual(prior.status,"complete");
status.reviews??={};
status.reviews[key]={...prior,status:"partial",reviewedAt:"2026-10-20",
    reviewedCardCount:62,reviewedThemes:codes,evidence:auditPath,
    note:"62 of 64 current Korean SM3N images decoded and the artworks visually screened. #058 GX and #062 item 404 source links held; footer print verification outstanding."};
const audit={schemaVersion:1,recordedAt:"2026-10-20",series:set.code,
 setName:set.displayName,totalMasterCards:64,
 decodedKoreanArtworkImages:62,visuallyScreenedCards:62,heldCardCount:2,
 sourceEvidence:imagePath,
 independentThemeRowsBefore:18205,independentThemeRowsAdded:added,
 independentThemeRowsAfter:count(),
 deltas:Object.fromEntries(data.groups.map(g=>[g.code,g.cards.length-before[g.code]])),
 printedFooterProofRemaining:true,strictSetCompleted:false,
 cards:inspected,held,
 preserved:{previousCompleteSets:109,sm3hHoldCards:2,
   sm2plusHoldCards:9,masterCardChanges:0,
   userOwnershipChanges:0,firestoreChanges:0,radarChanges:0},
 next:"Secure printed Korean SM3N 058 and 062 scans and check footer numbers. Then continue next chronological SM3+ set, retaining approved art decisions."
};
data.updatedAt="2026-10-20";
write(artPath,data);write(statusPath,status);write(auditPath,audit);
console.log("SM3N_KOREAN_ARTWORK_CONTINUATION",JSON.stringify({reviewed:62,held:2,slotsAdded:added,totalSlots:count()}));
