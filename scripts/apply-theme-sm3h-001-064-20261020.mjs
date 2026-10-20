#!/usr/bin/env node
// SM3H Korean illustration thematic screening continued from untouched SM2+.
// Visual inspected 7 decoded contact sheets of Korean 001-064. Exact Korean 060,
// 061 source photographs are HTTP 404, so leave both explicitly held.
// Keep the twelve theme dexes independent. Footer zoom not invented.
import assert from "node:assert/strict";
import fs from "node:fs";
const json=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const pTheme="data/art-themes.json",pStatus="data/audits/theme-series-review-status.json";
const pAudit="data/audits/theme-sm3h-001-064-artwork-visual-screen-20261020.json";
const pEvidence="data/audits/theme-sm3h-001-064-korean-image-preflight-20261020.json";
const pTest="tests/theme-card-identity.test.mjs";
const themes=json(pTheme),statuses=json(pStatus),proof=json(pEvidence);
const master=[...json("data/series.json"),...json("data/series-legacy.json")]
 .find(s=>String(s.code).toLowerCase()==="sm3h");
const coverage=json("data/audits/theme-series-coverage.json");
const palette=x=>String(x||"").replace(/\s+/g,"").toLowerCase();
const sum=()=>themes.groups.reduce((n,g)=>n+g.cards.length,0);
const themeCodes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
assert.equal(master?.cards?.length,64);
assert.equal(proof.totalMasterCards,64);
assert.equal(proof.imagesDownloadedDecoded,62);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(coverage.summary.themeCardSlots,18109);
assert.equal(coverage.sets.find(s=>s.code.toLowerCase()==="sm3h")?.status,"pending");
assert.equal(sum(),18109,"Theme data changed concurrently; do not overwrite");
assert.deepEqual(new Set(themes.groups.map(g=>g.code)),new Set(themeCodes));
assert.equal(themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()==="sm3h")).length,0,
 "SM3H already has placements; do not double review");
assert.ok(!fs.existsSync(pAudit));

const rows=[
[1,"뚜벅쵸","초록·보라",{season:"햇빛 아래 풀과 작은 꽃이 피어난 들판"}],
[2,"냄새꼬","파랑·분홍",{season:"붉은 꽃들이 핀 맑은 꽃밭"}],
[3,"라플레시아","빨강·초록",{season:"햇살이 드는 울창한 열대 숲"}],
[4,"헤라크로스","남색·회색",{season:"나무줄기와 수풀이 보이는 숲"}],
[5,"야나프","초록·하늘",{season:"구름과 잔디가 있는 밝은 풀밭"}],
[6,"야나키","초록·노랑",{season:"꽃과 초록 나뭇잎이 우거진 숲"}],
[7,"물거미","청록·회색",{}],
[8,"깨비물거미","남색·하늘",{}],
[9,"파이리","주황·청록",{season:"굵은 빗줄기가 내리는 숲"}],
[10,"리자드","주황·회색",{}],
[11,"리자몽 GX","주황·빨강",{}],
[12,"칠색조 GX","빨강·금색",{}],
[13,"바오프","주황·초록",{season:"나뭇가지와 초록 잎이 가득한 숲"}],
[14,"바오키","주황·회색",{}],
[15,"앤티골","갈색·주황",{}],
[16,"쏘드라","하늘·남색",{season:"푸른 바닷물과 포말이 보이는 바다"}],
[17,"시드라","하늘·회색",{season:"바닷속 난파선과 물결"}],
[18,"킹드라","파랑·청록",{season:"푸른 심해와 물속 흐름"}],
[19,"마릴","파랑·연두",{season:"구름과 푸른 언덕이 있는 풀밭"}],
[20,"마릴리","파랑·하늘",{season:"푸른 파도가 솟는 맑은 바다"}],
[21,"마자용","하늘·황토",{season:"햇빛 드는 바위산과 거친 지형"}],
[22,"마디네","빨강·초록",{season:"잎과 풀들이 가득한 열대 수풀"}],
[23,"휠구","회색·초록",{season:"나무 아래 풀이 우거진 숲"}],
[24,"펜드라","자주·초록",{season:"진한 녹색 덤불과 울창한 숲"}],
[25,"모래꿍","황토·주황",{season:"해변의 야자나무와 주황빛 하늘",sunset:"해 질 녘 주황빛 해가 비치는 모래 해변"}],
[26,"모래성이당","황토·갈색",{season:"햇살과 바위가 보이는 모래 언덕"}],
[27,"리오르","하늘·황토",{season:"푸른 바다와 모래사장이 펼쳐진 맑은 해변"}],
[28,"루카리오","남색·하늘",{}],
[29,"오기지게","보라·청록",{season:"해안가의 바위와 푸른 바닷물"}],
[30,"모단단게","하늘·회색",{season:"눈과 바위가 뒤섞인 얼어붙은 산악 지형"}],
[31,"내던숭이","갈색·주황",{}],
[32,"알로라질퍽이","청록·회색",{}],
[33,"알로라질뻐기 GX","보라·청록",{}],
[34,"다크라이","검정·보라",{}],
[35,"오케이징","자주·초록",{season:"잎과 나무가 있는 숲속 풀밭"}],
[36,"칼라마네로","보라·청록",{}],
[37,"디안시","분홍·자주",{}],
[38,"에블리","크림·하늘",{}],
[39,"에리본","크림·초록",{season:"꽃과 초록 잎이 있는 화사한 초원"}],
[40,"음번 GX","청록·검정",{}],
[41,"나옹","크림·하늘",{street:"건물과 난간이 있는 마을의 거리"}],
[42,"페르시온","크림·초록",{season:"햇살과 꽃이 있는 화사한 정원"}],
[43,"부우부","갈색·하늘",{season:"밝은 하늘과 녹색 초원이 있는 산자락"}],
[44,"야부엉","갈색·연두",{season:"푸른 바다와 하늘이 보이는 꽃 핀 해안"}],
[45,"버프론","갈색·하늘",{season:"눈과 거센 바람이 부는 겨울 산"}],
[46,"음뱃","보라·회색",{season:"흰빛 바위와 나무가 있는 동굴 입구"}],
[47,"로토무도감 포켓파인더 모드","빨강·청록",{}],
[48,"불끈불끈덤벨","초록·검정",{}],
[49,"키아웨","주황·갈색",{season:"용암과 불길이 있는 화산 바위 지대"}],
[50,"플루메리","분홍·초록",{season:"울창한 수풀과 흙길이 있는 숲"}],
[51,"라나키라마운틴","흰색·검정",{season:"하얀 눈이 덮인 밤빛 겨울 산"}],
[52,"리자몽 GX","빨강·주황",{}],
[53,"칠색조 GX","빨강·하늘",{}],
[54,"알로라질뻐기 GX","청록·남색",{}],
[55,"음번 GX","남색·보라",{}],
[56,"키아웨","주황·검정",{}],
[57,"플루메리","분홍·검정",{}],
[58,"리자몽 GX","무지개·홀로",{}],
[59,"칠색조 GX","무지개·홀로",{}],
[62,"동굴탈출로프","금색·검정",{}],
[63,"불끈불끈덤벨","금색·초록",{}],
[64,"불 에너지","금색·빨강",{}]
];
assert.equal(rows.length,62);
assert.deepEqual(new Set(rows.map(x=>x[0])),new Set(Array.from({length:64},(_,i)=>i+1).filter(n=>n!==60&&n!==61)));
const byTheme=Object.fromEntries(themes.groups.map(g=>[g.code,g]));
const before=Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length]));
const decisions=[];
for(const [n,name,colors,other] of rows){
 const suffix=String(n).padStart(3,"0");
 const src=proof.cards[n-1],card=master.cards[n-1],expected="sm3h_"+suffix+"/051";
 assert.equal(palette(src.code),expected,"Unexpected proof card code "+n);
 assert.equal(palette(card.code),expected,"Unexpected canonical card code "+n);
 assert.equal(palette(card.name),palette(name),"Korean print name drift "+n);
 assert.equal(palette(src.name),palette(name),"Proof Korean print name drift "+n);
 assert.equal(src.imageDecoded,true,"No decoded Korean image "+n);
 assert.equal(src.image,card.image,"Original image source changed "+n);
 assert.match(src.sha256,/^[a-f0-9]{64}$/);
 const selected={color:colors,...other};
 for(const [theme,category] of Object.entries(selected)){
  const g=byTheme[theme];assert.ok(g,"Unknown independently assessed theme "+theme);
  assert.ok(!g.cards.some(c=>c.code==="SM3H_"+suffix),"SM3H prior item cannot repeat "+n);
  g.cards.push({
    code:"SM3H_"+suffix,name:card.name,series:"SM",set:master.code,
    setName:master.displayName,cardNumber:suffix+"/051",
    rarity:card.rarity||"",category,image:card.image,
    evidence:"SM3H 한국판 전면 사진을 직접 살펴보고 이름·장면과 원본 SHA256 확인. " +
      "확인하지 못한 연결·진화·수면·야경은 임의로 추가하지 않음. " +
      "하단 번호 확대 판독은 개별 후속 검증. " + pAudit
  });
 }
 decisions.push({
   code:"SM3H_"+suffix,name:card.name,canonicalCode:expected,
   sourceImage:card.image,imageSha256:src.sha256,sourceDecoded:true,
   visuallyScreenedKoreanArt:true,printedFooterEnlargedSeparately:false,
   approvedIndependentThemes:selected
 });
}
const held=[60,61].map(n=>{
 const p=proof.cards[n-1],c=master.cards[n-1];
 assert.equal(p.n,n);assert.equal(p.imageDecoded,false);
 assert.ok(!themes.groups.some(g=>g.cards.some(row=>row.code==="SM3H_"+String(n).padStart(3,"0"))));
 return {number:n,code:c.code,expectedKoreanName:c.name,image:c.image,
   sourceError:p.failure,status:"hold_image_404_Korean_source_unverified",
   themePlacementsAdded:0};
});
const approvedSlots=decisions.reduce((n,c)=>n+Object.keys(c.approvedIndependentThemes).length,0);
assert.ok(approvedSlots>=80&&approvedSlots<=110);
assert.equal(sum(),18109+approvedSlots);
for(const g of themes.groups){
 const count=decisions.filter(x=>Object.hasOwn(x.approvedIndependentThemes,g.code)).length;
 assert.equal(g.cards.length,before[g.code]+count);
}
const oldTest=fs.readFileSync(pTest,"utf8");
const marker="assert.equal(total,18109); // SM2+ 031-066 artwork +48; 067-075 invalid images held";
assert.ok(oldTest.includes(marker)&&oldTest.split(marker).length===2);
fs.writeFileSync(pTest,oldTest.replace(marker,
 "assert.equal(total,"+sum()+"); // SM3H artwork screen 62/64; 060–061 source 404 held"));
const key=Object.keys(statuses.reviews||{}).find(k=>k.toLowerCase()==="sm3h")||"sm3H";
const prev=statuses.reviews?.[key]||{};
assert.notEqual(prev.status,"complete");
statuses.reviews??={};
statuses.reviews[key]={...prev,status:"partial",reviewedAt:"2026-10-20",
  reviewedCardCount:62,reviewedThemes:themeCodes,evidence:pAudit,
  note:"All 64 images probed; Korean artwork screens for 62/64; SM3H 060 and 061 have 404 source images; printed footer magnification remains outstanding."};
const audit={
 schemaVersion:1,recordedAt:"2026-10-20",set:"sm3H",
 setName:master.displayName,totalInMaster:64,sourceImagesDecoded:62,
 KoreanArtworksVisuallyScreened:62,sourceImageHolds:2,
 sourceImageHoldsCodes:["SM3H_060","SM3H_061"],
 allTwelveThemesIndependentlyScreenedForEachDecodedArtwork:true,
 totalThemeSlotsBefore:18109,addedThemeSlots:approvedSlots,totalThemeSlotsAfter:sum(),
 actualThemeDeltas:Object.fromEntries(themes.groups.map(g=>[g.code,g.cards.length-before[g.code]])),
 sourceEvidence:pEvidence,strictSetCompleted:false,
 cardDecisions:decisions,imageHolds:held,
 caveat:"The images were directly inspected for artwork and Korean names, but exact printed footer enlargement is pending. A URL decoding error is not proof a card is unissued.",
 preserve:{previous109CompletedSetsReopened:0,previousSM2PlusHeldSlotsAltered:0,
 oldThemeRowsChanged:0,masterOrOwnershipChanged:0,FirestoreChanged:0,CardRadarChanged:0},
 next:"Find and inspect valid Korean SM3H 060/061 print-image sources, validate footer numbers, then proceed to SM3N without redoing approved art."
};
themes.updatedAt="2026-10-20";
save(pTheme,themes);save(pStatus,statuses);save(pAudit,audit);
console.log("SM3H_62_KOREAN_ARTWORKS_2_SOURCE_HOLDS",JSON.stringify({reviewed:62,holds:2,newSlots:approvedSlots,totalSlots:sum()}));
