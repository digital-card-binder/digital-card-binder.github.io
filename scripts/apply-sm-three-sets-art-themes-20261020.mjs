#!/usr/bin/env node
// Apply exactly three Korean SM series as one evidence-guarded theme-audit batch.
// Completed cards, standalone dex membership, ownership, Firestore and radar are preserved.
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n");
const artPath="data/art-themes.json",statusPath="data/audits/theme-series-review-status.json";
const sourcePath="data/audits/theme-sm4plus-sm5s-sm5m-korean-image-preflight-20261020.json";
const palettePath="data/audits/theme-sm4plus-sm5s-sm5m-artwork-palette-evidence-20261020.json";
const scenePath="data/audits/theme-sm-three-sets-visual-scene-decisions-20261020.json";
const auditPath="data/audits/theme-sm4plus-sm5s-sm5m-artwork-screen-20261020.json";
const testPath="tests/theme-card-identity.test.mjs";
const master=[...read("data/series.json"),...read("data/series-legacy.json")];
const art=read(artPath),status=read(statusPath),source=read(sourcePath);
const palette=read(palettePath),scenes=read(scenePath),coverage=read("data/audits/theme-series-coverage.json");
const allThemes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const norm=x=>String(x??"").replace(/\s+/g,"").toLowerCase();
const count=()=>art.groups.reduce((n,g)=>n+g.cards.length,0);
assert.equal(count(),18611,"Concurrent theme changes, stop before any output");
assert.equal(coverage.summary.themeCardSlots,18611);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.deepEqual(new Set(art.groups.map(g=>g.code)),new Set(allThemes));
assert.equal(source.totalMasterCards,281);
assert.equal(palette.screenedCanonicalSourceCount,274);
assert.equal(palette.heldWithoutPalette,7);
assert.ok(!fs.existsSync(auditPath),"Never classify a reviewed set twice");
const plan={
 "sm4+":{prefix:"sm4plus",base:114,total:125,screened:120,hold:[121,122,123,124,125]},
 "sm5s":{prefix:"sm5s",base:66,total:78,screened:78,hold:[]},
 "sm5m":{prefix:"sm5m",base:66,total:78,screened:76,hold:[73,74]}
};
assert.deepEqual(new Set(source.sets.map(s=>s.code.toLowerCase())),new Set(Object.keys(plan)));
assert.deepEqual(new Set(Object.keys(scenes.seasons)),new Set(Object.keys(plan)));
const sourceBySet=Object.fromEntries(source.sets.map(x=>[x.code.toLowerCase(),x]));
const paletteByCard=new Map(palette.pixelEvidenceRows.map(x=>[x.set.toLowerCase()+"#"+x.number,x]));
assert.equal(paletteByCard.size,274);
const byTheme=Object.fromEntries(art.groups.map(g=>[g.code,g]));
const before=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]));
const reviewedSets=[];
for(const [code,cfg] of Object.entries(plan)){
 const set=master.find(x=>norm(x.code)===code);
 assert.ok(set&&set.cards.length===cfg.total,code+" changed master");
 assert.equal(coverage.sets.find(x=>x.code.toLowerCase()===code)?.status,"pending");
 assert.equal(art.groups.flatMap(g=>g.cards.filter(x=>norm(x.set)===code)).length,0,
   "Existing independent theme membership discovered. Never redo "+code);
 const photos=sourceBySet[code];
 assert.equal(photos.masterCards,cfg.total);
 const cards=[];
 for(let n=1;n<=cfg.total;n++){
  const num=String(n).padStart(3,"0"),card=set.cards[n-1],proof=photos.sourceRows[n-1];
  const expected=cfg.prefix+"_"+num+"/"+String(cfg.base).padStart(3,"0");
  assert.equal(norm(card.code),norm(expected),"Unexpected catalogue identity "+code+" "+n);
  assert.equal(norm(proof.code),norm(card.code));
  assert.equal(proof.name,card.name);
  assert.equal(proof.image,card.image);
  assert.equal(proof.index,n);
  if(cfg.hold.includes(n))continue;
  assert.equal(proof.imageDecoded,true,"Unverified image source "+code+" "+num);
  assert.match(proof.sha256,/^[a-f0-9]{64}$/);
  const colors=paletteByCard.get(code+"#"+n);
  assert.ok(colors,"Missing SHA-matched original artwork palette "+code+" "+n);
  assert.equal(norm(colors.code),norm(card.code));
  assert.equal(colors.KoreanName,card.name);
  assert.equal(colors.originalSha256,proof.sha256);
  assert.match(colors.pixelArtColorTag,/^[가-힣]+·[가-힣]+$/,"Color tag must be exact observed hue bins");
  const extra=scenes.extra?.[code]?.[n]||{};
  const tags={
   color:colors.pixelArtColorTag,
   ...(scenes.seasons[code][n]?{season:scenes.seasons[code][n]}:{}),
   ...extra
  };
  for(const [theme,category] of Object.entries(tags)){
   const dest=byTheme[theme],id=cfg.prefix.toUpperCase()+"_"+num;
   assert.ok(dest,"Unknown independent theme "+theme);
   assert.ok(!dest.cards.some(c=>c.code===id),"Existing art must not be duplicated "+id);
   dest.cards.push({
     code:id,name:card.name,series:"SM",set:set.code,setName:set.displayName,
     cardNumber:num+"/"+String(cfg.base).padStart(3,"0"),
     rarity:card.rarity||"",category,image:card.image,
     evidence:"SM 3개 세트 실제 한국어 카드 이미지(281장) 전면을 검토. 원본 SHA256을 재다운로드하여 대조. "+
       "색상은 원화 영역의 주된 색 픽셀값에서 산출하고 자연·거리·노을·야간은 직접 확인한 장면만 분류. "+
       "하단 인쇄번호는 확대 검증 전이며 기존 사용자의 보유 데이터는 수정하지 않음. "+auditPath
   });
  }
  cards.push({
   code:cfg.prefix.toUpperCase()+"_"+num,canonicalCode:card.code,koreanName:card.name,
   image:card.image,sourceSha256:proof.sha256,actualArtworkVisuallyScreened:true,
   sourceColorPixelsSHA256Verified:true,printedFooterNumberEnlarged:false,
   approvedThemes:tags
  });
 }
 assert.equal(cards.length,cfg.screened);
 const held=cfg.hold.map(n=>{
  const p=photos.sourceRows[n-1],c=set.cards[n-1],num=String(n).padStart(3,"0");
  assert.equal(p.index,n);assert.equal(p.image,c.image);
  assert.ok(!art.groups.some(g=>g.cards.some(row=>row.code===cfg.prefix.toUpperCase()+"_"+num)));
  return {
   number:n,code:c.code,koreanName:c.name,image:c.image,sha256:p.sha256||null,
   imageError:p.error||null,
   status:code==="sm4+"?"hold_unnumbered_Korean_energy_print_identity":"hold_Korean_card_image_HTTP_404",
   reason:code==="sm4+"?
    "기본 에너지 전면 이미지에 별도 121~125/114 인쇄번호 확인 불가. printVariants/중복 여부 검증 전까지 테마 추가 보류.":
    "등록한 한국판 이미지 주소가 HTTP 404이며 해당 카드번호 한국어 사진 교차확인 전까지 테마 추가 보류."
  };
 });
 const changed=cards.reduce((n,c)=>n+Object.keys(c.approvedThemes).length,0);
 const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===code)||set.code;
 assert.notEqual(status.reviews?.[key]?.status,"complete");
 status.reviews??={};
 status.reviews[key]={...(status.reviews[key]||{}),
  status:"partial",reviewedAt:"2026-10-20",reviewedCardCount:cards.length,
  reviewedThemes:allThemes,evidence:auditPath,
  note:code+" Korean artwork "+cards.length+"/"+cfg.total+
   " screen; "+held.length+" source/print identity holds; printed footer magnification pending."};
 reviewedSets.push({
  set:set.code,setName:set.displayName,masterCards:cfg.total,
  imagesSuccessfullyDecoded:photos.imagesDownloadedAndDecoded,
  artworkCardsScreened:cards.length,printedIdentityOrImageHolds:held.length,
  newIndependentThemeRows:changed,strictlyCompleted:false,
  footerMagnificationPending:true,cards,held
 });
}
assert.deepEqual(Object.fromEntries(reviewedSets.map(x=>[x.set.toLowerCase(),x.artworkCardsScreened])),
 {"sm4+":120,"sm5s":78,"sm5m":76});
const added=reviewedSets.reduce((n,s)=>n+s.newIndependentThemeRows,0);
assert.equal(count(),18611+added);
const deltas=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length-before[g.code]]));
assert.equal(Object.values(deltas).reduce((n,k)=>n+k,0),added);
const tests=fs.readFileSync(testPath,"utf8");
const token="assert.equal(total,18611); // SM4A 59 artwork screens, 2 existing sleeps retained; 3 source holds";
assert.equal(tests.split(token).length,2,"Regression baseline drift: stop");
fs.writeFileSync(testPath,tests.replace(token,
 "assert.equal(total,"+count()+"); // SM4+/SM5S/SM5M 274 Korean artworks screened; 7 holds"));
const record={
 schemaVersion:1,recordedAt:"2026-10-20",
 batch:"SM4+ GX 배틀부스트 / SM5S 울트라썬 / SM5M 울트라문",
 sourceCheckpoint:sourcePath,sourceColorEvidence:palettePath,sceneDecisions:scenePath,
 masterEntries:281,artworksVisuallyScreened:274,heldCardEntries:7,
 themeSlotsBefore:18611,themeSlotsAdded:added,themeSlotsAfter:count(),
 themeDeltas:deltas,strictCompleteMasterSetsAfterBatch:109,
 allTwelveStandaloneThemesConsideredForEachScreenedImage:true,
 trueKoreanPrintFooterVerificationPending:true,
 preserved:{
  previous109FullyCompleteSetsReopened:0,
  previousSM4A2SleepingTagsModified:0,
  previousSMSeriesHoldsAltered:0,
  priorThemeRowsModified:0,canonicalCardMasterChanges:0,
  ownerDataOrFirestoreChanges:0,CardRadarChanges:0
 },
 sets:reviewedSets,
 next:"First address SM4+ 121-125 unnumbered energies and SM5M 073-074 404 Korean-photo gaps; next three SM series SM5+, SM6, SM6a."
};
art.updatedAt="2026-10-20";
save(artPath,art);save(statusPath,status);save(auditPath,record);
console.log("THREE_KOREAN_SM_SERIES_REVIEW",JSON.stringify({
 screened:274,held:7,newThemeRows:added,totalThemeRows:count(),byTheme:deltas,
 perSet:reviewedSets.map(x=>({code:x.set,screened:x.artworkCardsScreened,
 held:x.printedIdentityOrImageHolds,added:x.newIndependentThemeRows}))
}));
