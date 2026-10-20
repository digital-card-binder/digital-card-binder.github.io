#!/usr/bin/env node
// Continue SM4A Korean artwork screening without touching its two existing sleep records.
// 59/62 original Korean card-face images were decoded and visually inspected.
// 057,061,062 current canonical images HTTP 404 and MUST remain held.
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const themePath="data/art-themes.json",statusPath="data/audits/theme-series-review-status.json";
const evidencePath="data/audits/theme-sm4a-001-062-korean-image-preflight-20261020.json";
const auditPath="data/audits/theme-sm4a-001-062-korean-artwork-screen-20261020.json";
const testPath="tests/theme-card-identity.test.mjs";
const data=read(themePath),statuses=read(statusPath),proof=read(evidencePath);
const coverage=read("data/audits/theme-series-coverage.json");
const master=[...read("data/series.json"),...read("data/series-legacy.json")]
 .find(x=>String(x.code).toLowerCase()==="sm4a");
const allThemes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const clean=x=>String(x??"").replace(/\s+/g,"").toLowerCase();
const slotCount=()=>data.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(master?.cards?.length,62);
assert.equal(proof.masterCards,62);
assert.equal(proof.sourceImagesDecoded,59);
assert.equal(coverage.summary.themeCardSlots,18515);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.equal(coverage.sets.find(x=>x.code.toLowerCase()==="sm4a")?.status,"pending");
assert.equal(slotCount(),18515,"Concurrent theme edits: rebase before write");
assert.deepEqual(new Set(data.groups.map(g=>g.code)),new Set(allThemes));
assert.ok(!fs.existsSync(auditPath),"An SM4A art review already exists");
const prior=data.groups.flatMap(g=>g.cards.filter(c=>String(c.set??"").toLowerCase()==="sm4a")
    .map(c=>({theme:g.code,id:c.code,name:c.name,cardNumber:c.cardNumber,image:c.image})));
const expected=proof.alreadyRegisteredIndependentThemes;
assert.equal(prior.length,2);
assert.deepEqual(new Set(prior.map(x=>x.theme)),new Set(["sleeping"]));
assert.deepEqual(new Set(prior.map(x=>x.id)),new Set(["SM4A_041","SM4A_045"]));
assert.deepEqual(new Set(expected.map(x=>x.code)),new Set(["SM4A_041","SM4A_045"]));
assert.ok(prior.every(p=>expected.some(x=>x.theme===p.theme&&x.code===p.id&&x.image===p.image)),
  "Preexisting sleeping cards must remain unmodified");

// Names / color palettes read from actual Korean card fronts in seven contact sheets.
// Do not add spurious sleeping, evolution or connection links based on the species.
const catalog=[
[1,"뿔충이","황토·초록"],
[2,"딱충이","초록·노랑"],
[3,"독침붕","노랑·하늘"],
[4,"아라리","분홍·하늘"],
[5,"쪼마리","갈색·연두"],
[6,"어지리더","청록·초록"],
[7,"잉어킹","주황·하늘"],
[8,"갸라도스 GX","파랑·검정"],
[9,"꾸꾸리","갈색·하늘"],
[10,"메꾸리","회색·흰색"],
[11,"맘모꾸리","갈색·남색"],
[12,"빈티나","청록·황토"],
[13,"밀로틱","노랑·분홍"],
[14,"레지아이스","하늘·파랑"],
[15,"피카츄","노랑·초록"],
[16,"알로라라이츄","황토·초록"],
[17,"무우마","자주·검정"],
[18,"무우마직","보라·회색"],
[19,"피그점프","연두·하늘"],
[20,"피그킹","하늘·보라"],
[21,"하랑우탄","초록·보라"],
[22,"텅비드 GX","하늘·검정"],
[23,"망키","황토·하늘"],
[24,"성원숭","초록·갈색"],
[25,"레지락","황토·회색"],
[26,"포곰곰","분홍·연두"],
[27,"이븐곰","회색·분홍"],
[28,"델빌","갈색·회색"],
[29,"헬가","남색·주황"],
[30,"모노두","청록·하늘"],
[31,"디헤드","검정·연두"],
[32,"삼삼드래","회색·하늘"],
[33,"악식킹 GX","검정·노랑"],
[34,"푸린","분홍·하늘"],
[35,"푸크린","분홍·초록"],
[36,"제르네아스","하늘·금색"],
[37,"알로라 나시 GX","초록·주황"],
[38,"짜랑꼬","연두·황토"],
[39,"짜랑고우","초록·회색"],
[40,"짜랑고우거","회색·하늘"],
[41,"밀탱크","분홍·초록"],
[42,"파비코","하늘·흰색"],
[43,"파비코리","하늘·분홍"],
[44,"파르빗","갈색·연두"],
[45,"파르토","갈색·초록"],
[46,"대시파우치","남색·하늘"],
[47,"루자미네","크림·회색"],
[48,"잠식된 벌판","황토·갈색"],
[49,"텅빈 바다","청록·검정"],
[50,"카운터 에너지","검정·무지개"],
[51,"갸라도스 GX","파랑·하늘"],
[52,"텅비드 GX","분홍·하늘"],
[53,"악식킹 GX","검정·빨강"],
[54,"알로라 나시 GX","노랑·초록"],
[55,"루자미네","크림·노랑"],
[56,"갸라도스 GX","무지개·홀로"],
[58,"악식킹 GX","무지개·홀로"],
[59,"알로라 나시 GX","무지개·홀로"],
[60,"소원의 바통","금색·은색"]
];
const heldNums=[57,61,62];
assert.equal(catalog.length,59);
assert.deepEqual(new Set(catalog.map(c=>c[0])),
 new Set(Array.from({length:62},(_,i)=>i+1).filter(n=>!heldNums.includes(n))));
// Specific scenery only; naturally colored Pokémon alone is NOT seasonal proof.
const landscapes={
1:"마른 흙과 풀잎이 보이는 화창한 들판",
2:"넓은 잎과 나무줄기가 우거진 녹색 숲",
3:"나무 사이로 푸른 하늘이 보이는 숲",
4:"야자나무와 하늘·물결이 보이는 열대 해변",
5:"큰 나무와 작은 풀들이 있는 녹색 숲",
6:"바위와 수풀이 가득한 울창한 숲",
7:"시원한 강물과 물보라가 있는 풍경",
9:"눈이 남아 있는 겨울 숲의 나무",
10:"하얀 눈밭과 회색 나무가 있는 설원",
11:"눈이 흩날리는 겨울 산악지대",
12:"푸른 물살을 따라 떠내려가는 통나무",
13:"물결과 빛이 섞인 푸른 바닷속",
14:"푸른 얼음결정과 빙설지형",
15:"작은 섬의 야자나무·꽃과 밝은 바닷가",
19:"푸른 풀이 빽빽한 밝은 숲",
20:"하늘과 물결이 보이는 해변",
21:"울창한 숲과 커다란 나무줄기",
23:"잔디밭과 작은 강이 있는 맑은 언덕",
24:"녹색 나뭇잎으로 가득한 숲",
25:"바위와 흙이 부서지는 산악 지형",
26:"색색의 꽃이 가득한 들판",
28:"큰 암벽과 초록 초원이 있는 산기슭",
29:"거친 바위와 하늘이 있는 야외",
30:"푸른 하늘·나무와 삼각형 산이 있는 들판",
31:"초록 나뭇잎과 낮은 산이 있는 숲",
35:"꽃과 나무가 가득한 밝은 숲",
38:"열매가 달린 나무가 있는 녹색 숲",
39:"나무와 덤불이 무성한 숲",
40:"구름과 높은 산비탈",
41:"꽃과 푸른 언덕이 이어진 목초지",
42:"맑은 하늘과 마을 밖 잔디밭",
43:"넓은 하늘에 떠 있는 흰 구름",
44:"나무와 풀들이 빽빽한 숲",
45:"큰 바위와 덤불이 우거진 숲",
48:"모래와 풀잎이 드문 거친 벌판",
49:"어두운 물결과 나무·이끼가 있는 물가"
};
const extra={
18:{night:"밝은 둥근 달이 비치는 어두운 숲과 무우마직"},
49:{night:"달빛이 비치지 않는 어두운 밤의 연못"}
};
// The 49th artwork looks dark; nighttime is not proven by moon/stars, so
// omit this ambiguous nighttime classification rather than overclaim.
delete extra[49];
const byTheme=Object.fromEntries(data.groups.map(g=>[g.code,g]));
const before=Object.fromEntries(data.groups.map(g=>[g.code,g.cards.length]));
const approved=[];
for(const [n,name,palette] of catalog){
 const num=String(n).padStart(3,"0"),card=master.cards[n-1],source=proof.cards[n-1];
 assert.equal(clean(card.code),"sm4a_"+num+"/050","Master number changed "+num);
 assert.equal(clean(card.name),clean(name),"Korean title mismatch "+num);
 assert.equal(source.index,n);
 assert.equal(clean(source.code),clean(card.code));
 assert.equal(source.name,card.name);
 assert.equal(source.image,card.image);
 assert.equal(source.imageDecoded,true,"No decoded Korean image "+num);
 assert.match(source.sha256,/^[a-f0-9]{64}$/);
 const tags={color:palette,...(landscapes[n]?{season:landscapes[n]}:{}),...(extra[n]||{})};
 for(const [theme,category] of Object.entries(tags)){
   const group=byTheme[theme],id="SM4A_"+num;
   assert.ok(group,"Unknown independent theme "+theme);
   assert.ok(!group.cards.some(c=>c.code===id),"Duplicate existing theme row for "+id);
   group.cards.push({code:id,name:card.name,series:"SM",set:master.code,
     setName:master.displayName,cardNumber:num+"/050",rarity:card.rarity||"",
     category,image:card.image,
     evidence:"기존 잠자는도감 2건 보존. 한국어판 이미지의 카드명·그림 장면·사진 SHA256 확인 후 독립 테마 분류. "+
       "인쇄 하단 번호 확대는 별도 검증. 근거 없는 스토리·진화·연결은 추가하지 않음. "+auditPath});
 }
 approved.push({code:"SM4A_"+num,canonicalCard:card.code,
  koreanName:card.name,image:card.image,sourceSha256:source.sha256,
  originalPhotoDecoded:true,KoreanIllustrationSceneScreened:true,
  printedFooterMagnificationChecked:false,approvedIndependentThemes:tags,
  priorSleepThemeAlreadyRetained:n===41||n===45});
}
const held=heldNums.map(n=>{
 const source=proof.cards[n-1],card=master.cards[n-1],num=String(n).padStart(3,"0");
 assert.equal(source.index,n);
 assert.equal(source.imageDecoded,false);
 assert.equal(source.image,card.image);
 assert.ok(!data.groups.some(g=>g.cards.some(c=>c.code==="SM4A_"+num)));
 return {number:n,code:card.code,koreanName:card.name,
         image:card.image,sourceError:source.error,
         status:"hold_Korean_source_HTTP_404",newThemeRows:0};
});
assert.equal(data.groups.find(g=>g.code==="sleeping").cards.filter(c=>String(c.set).toLowerCase()==="sm4a").length,2);
const added=approved.reduce((n,c)=>n+Object.keys(c.approvedIndependentThemes).length,0);
assert.equal(slotCount(),18515+added);
for(const group of data.groups)
 assert.equal(group.cards.length,before[group.code]+approved.filter(c=>Object.hasOwn(c.approvedIndependentThemes,group.code)).length);
const rawTests=fs.readFileSync(testPath,"utf8");
const marker="assert.equal(total,18515); // SM4S 60 Korean artwork screens; source 058 and 061 held";
assert.equal(rawTests.split(marker).length,2,"Concurrent theme test edits require review");
fs.writeFileSync(testPath,rawTests.replace(marker,
  "assert.equal(total,"+slotCount()+"); // SM4A 59 artwork screens, 2 existing sleeps retained; 3 source holds"));
const reviewKey=Object.keys(statuses.reviews||{}).find(k=>k.toLowerCase()==="sm4a")||"sm4A";
const prev=statuses.reviews?.[reviewKey]||{};
assert.notEqual(prev.status,"complete");
statuses.reviews??={};
statuses.reviews[reviewKey]={...prev,status:"partial",reviewedAt:"2026-10-20",
  reviewedCardCount:59,reviewedThemes:allThemes,evidence:auditPath,
  note:"SM4A Korean art screens 59/62, preserve original 2 sleeping tags. SM4A_057,061,062 exact source image URLs HTTP 404; printed footer number enlargement pending."};
const audit={schemaVersion:1,recordedAt:"2026-10-20",series:master.code,
 setName:master.displayName,masterCardCount:62,
 sourceImagesDecoded:59,newlyScreenedArtworkCards:59,
 preservedSleepingThemeRows:2,sourceImageHolds:3,
 sourceEvidence:evidencePath,newIndependentThemeRows:added,
 totalThemeRowsBefore:18515,totalThemeRowsAfter:slotCount(),
 actualThemeDeltas:Object.fromEntries(data.groups.map(g=>[g.code,g.cards.length-before[g.code]])),
 strictSetComplete:false,printedFooterMagnificationPending:true,
 cards:approved,held,
 preservation:{existingSleepingRowsAltered:0,strict109CompletedSetsReopened:0,
  priorSM4SHoldsChanged:0,otherThemeRowsModified:0,
  masterCardRecordsAltered:0,userOwnershipOrFirestoreChanged:0,
  cardRadarFilesChanged:0},
 next:"Find exact Korean SM4A 057, 061, 062 images; check printed footer; resume SM4+ 125 cards without duplicating already vetted SM4A sleeping tags."};
data.updatedAt="2026-10-20";
save(themePath,data);save(statusPath,statuses);save(auditPath,audit);
console.log("SM4A_KOREAN_ARTWORK_REVIEW",JSON.stringify({
 reviewed:59,holds:3,sleepingPreserved:2,
 themeSlotsAdded:added,allThemeSlots:slotCount(),delta:audit.actualThemeDeltas}));
