#!/usr/bin/env node
// One guarded Korean-only 3-series art audit, preserving independent dexes and ownership.
import assert from "node:assert/strict";
import fs from "node:fs";
const load=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n","utf8");
const master=[...load("data/series.json"),...load("data/series-legacy.json")];
const artPath="data/art-themes.json";
const statusPath="data/audits/theme-series-review-status.json";
const sourcePath="data/audits/theme-sm5plus-sm6-sm6a-korean-image-preflight-20261020.json";
const palettePath="data/audits/theme-sm5plus-sm6-sm6a-artwork-palette-evidence-20261020.json";
const scenePath="data/audits/theme-sm5plus-sm6-sm6a-visual-scene-decisions-20261020.json";
const auditPath="data/audits/theme-sm5plus-sm6-sm6a-artwork-screen-20261020.json";
const testPath="tests/theme-card-identity.test.mjs";
const art=load(artPath),status=load(statusPath),source=load(sourcePath),
      palette=load(palettePath),scenes=load(scenePath),
      coverage=load("data/audits/theme-series-coverage.json");
const norm=x=>String(x??"").replace(/\s+/g,"").toLowerCase();
const allThemes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const count=()=>art.groups.reduce((total,g)=>total+g.cards.length,0);
assert.equal(count(),19035,"Concurrent theme audit changed baseline: stop");
assert.equal(coverage.summary.themeCardSlots,19035);
assert.equal(coverage.summary.strictCompleteSetCount,109);
assert.deepEqual(new Set(art.groups.map(g=>g.code)),new Set(allThemes));
assert.equal(source.totalMasterCards,257);
assert.ok(!fs.existsSync(auditPath),"Do not reclassify previously completed cards");
const plan={
  "sm5+":{prefix:"sm5plus",base:50,total:72},
  "sm6":{prefix:"sm6",base:94,total:110},
  "sm6a":{prefix:"sm6a",base:53,total:75}
};
assert.deepEqual(new Set(source.sets.map(x=>x.code.toLowerCase())),new Set(Object.keys(plan)));
assert.deepEqual(new Set(Object.keys(scenes.seasons)),new Set(Object.keys(plan)));
assert.equal(palette.screenedCanonicalSourceCount+palette.heldWithoutPalette,257);
assert.ok(palette.heldWithoutPalette>=13);
const paletteByKey=new Map(palette.pixelEvidenceRows.map(r=>[r.set.toLowerCase()+"#"+r.number,r]));
const heldByKey=new Map(palette.held.map(r=>[r.set.toLowerCase()+"#"+r.index,r]));
assert.equal(paletteByKey.size,palette.screenedCanonicalSourceCount);
assert.equal(heldByKey.size,palette.heldWithoutPalette);
const groups=Object.fromEntries(art.groups.map(g=>[g.code,g]));
const before=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length]));
const sourceBySet=Object.fromEntries(source.sets.map(s=>[s.code.toLowerCase(),s]));
const reviewedSets=[];
for(const [code,cfg] of Object.entries(plan)){
  const candidates=master.filter(s=>norm(s.code)===code);
  assert.equal(candidates.length,1,"Missing or repeated Korean master set "+code);
  const set=candidates[0];
  assert.equal(set.cards.length,cfg.total,"Master changed "+code);
  assert.equal(coverage.sets.find(x=>norm(x.code)===code)?.status,"pending");
  assert.equal(art.groups.flatMap(g=>g.cards.filter(c=>norm(c.set)===code)).length,0,
    "Existing artwork membership encountered: do not redo "+code);
  const photos=sourceBySet[code];
  assert.equal(photos.masterCards,cfg.total);
  const screened=[],held=[];
  for(let n=1;n<=cfg.total;n++){
    const num=String(n).padStart(3,"0"),card=set.cards[n-1],proof=photos.sourceRows[n-1],
          key=code+"#"+n,id=cfg.prefix.toUpperCase()+"_"+num;
    assert.equal(proof.index,n);
    assert.equal(norm(proof.code),norm(card.code));
    assert.equal(proof.image,card.image);
    assert.equal(proof.name,card.name);
    const bad=heldByKey.get(key);
    if(bad){
      assert.ok(!paletteByKey.has(key));
      held.push({
        number:n,code:card.code,koreanName:card.name,image:card.image,
        sha256:proof.sha256||null,error:proof.error||null,
        reason:bad.reason,classification:"held",
        note:"출처·번호 검증 전 테마도감에 임의 등록하지 않음."
      });
      continue;
    }
    const wanted=cfg.prefix+"_"+num+"/"+String(cfg.base).padStart(3,"0");
    assert.equal(norm(card.code),norm(wanted),"Unreviewed master ID discrepancy "+key);
    assert.equal(proof.imageDecoded,true);
    const paletteRow=paletteByKey.get(key);
    assert.ok(paletteRow,"Missing source image SHA-based pixel observation "+key);
    assert.equal(norm(paletteRow.code),norm(card.code));
    assert.equal(paletteRow.KoreanName,card.name);
    assert.equal(paletteRow.originalSha256,proof.sha256);
    assert.match(paletteRow.pixelArtColorTag,/^[가-힣]+·[가-힣]+$/);
    const tags={
      color:paletteRow.pixelArtColorTag,
      ...(scenes.seasons[code]?.[n]?{season:scenes.seasons[code][n]}:{}),
      ...(scenes.extra?.[code]?.[n]||{})
    };
    for(const [theme,category] of Object.entries(tags)){
      assert.ok(groups[theme],"Unexpected thematic dex "+theme);
      assert.ok(!groups[theme].cards.some(x=>x.code===id),"Duplicate independent dex entry "+id);
      groups[theme].cards.push({
        code:id,name:card.name,series:"SM",set:set.code,setName:set.displayName,
        cardNumber:num+"/"+String(cfg.base).padStart(3,"0"),
        rarity:card.rarity||"",category,image:card.image,
        evidence:"한국판 실물 전면을 18개 이미지 시트(GH Actions 39379925218)에서 직접 검토; "+
          "이미지 원본 SHA256 재확인; 색상은 그림 픽셀 색 비중, 풍경/거리/밤/노을은 개별 원화에서 직접 확인. "+
          "인쇄번호 하단 확대·기본 에너지 번호 증빙은 별도 보류. 기존 사용자 도감 불변. "+auditPath
      });
    }
    screened.push({
      code:id,canonicalCode:card.code,koreanName:card.name,image:card.image,
      sourceSha256:proof.sha256,actualArtworkVisuallyScreened:true,
      sourceColorPixelsSHA256Verified:true,
      printedFooterNumberEnlarged:false,approvedThemes:tags
    });
  }
  const reviewKey=Object.keys(status.reviews||{}).find(k=>norm(k)===code)||set.code;
  assert.notEqual(status.reviews?.[reviewKey]?.status,"complete");
  status.reviews??={};
  status.reviews[reviewKey]={
    ...(status.reviews[reviewKey]||{}),
    status:"partial",reviewedAt:"2026-10-20",reviewedCardCount:screened.length,
    reviewedThemes:allThemes,evidence:auditPath,
    note:code+" Korean original artworks "+screened.length+"/"+cfg.total+
      " screened; "+held.length+" source/printed-identity holds; enlarged footer proof pending."
  };
  reviewedSets.push({
    set:set.code,setName:set.displayName,masterCards:cfg.total,
    imagesDecoded:photos.imagesDownloadedAndDecoded,
    artworksScreened:screened.length,heldCards:held.length,
    newIndependentThemeSlots:screened.reduce((n,r)=>n+Object.keys(r.approvedThemes).length,0),
    strictlyComplete:false,enlargedPrintFooterPending:true,cards:screened,held
  });
}
const screenedTotal=reviewedSets.reduce((n,x)=>n+x.artworksScreened,0);
const heldTotal=reviewedSets.reduce((n,x)=>n+x.heldCards,0);
assert.equal(screenedTotal,palette.screenedCanonicalSourceCount);
assert.equal(heldTotal,palette.heldWithoutPalette);
assert.equal(screenedTotal+heldTotal,257);
const added=reviewedSets.reduce((n,x)=>n+x.newIndependentThemeSlots,0);
assert.equal(count(),19035+added);
const deltas=Object.fromEntries(art.groups.map(g=>[g.code,g.cards.length-before[g.code]]));
assert.equal(Object.values(deltas).reduce((a,b)=>a+b,0),added);
const tests=fs.readFileSync(testPath,"utf8");
const oldTest="assert.equal(total,19035); // SM4+/SM5S/SM5M 273 Korean artworks screened; 8 holds";
assert.equal(tests.split(oldTest).length,2,"Regression baseline changed");
fs.writeFileSync(testPath,tests.replace(oldTest,
  "assert.equal(total,"+count()+"); // SM5+/SM6/SM6a "+screenedTotal+" Korean artwork screens; "+heldTotal+" holds"));
const record={
  schemaVersion:1,recordedAt:"2026-10-20",
  batch:"SM5+ 울트라포스 / SM6 금단의 빛 / SM6a 드래곤스톰",
  visualProofGithubRunId:39379925218,sourceCheckpoint:sourcePath,
  sourceColorEvidence:palettePath,sceneDecisions:scenePath,
  masterEntries:257,artworksVisuallyScreened:screenedTotal,
  heldCardEntries:heldTotal,themeSlotsBefore:19035,themeSlotsAdded:added,
  themeSlotsAfter:count(),themeDeltas:deltas,
  strictCompleteMasterSetsAfterBatch:109,allTwelveStandaloneThemesConsidered:true,
  trueKoreanPrintFooterVerificationPending:true,
  preserved:{priorThemeRowsModified:0,previous109StrictSetsReopened:0,
    canonicalMasterChanged:0,userOwnershipOrFirestoreChanged:0,CardRadarChanged:0},
  sets:reviewedSets,
  next:"Resolve broken SM6 105-108 source URLs, SM6a 060-068 basic energy print-number identity, then proceed to next three pending Korean SM sets."
};
art.updatedAt="2026-10-20";
save(artPath,art);save(statusPath,status);save(auditPath,record);
console.log("NEXT_SM_THREE_ART_THEMES",JSON.stringify({
  screened:screenedTotal,holds:heldTotal,added,totalThemeRows:count(),
  byTheme:deltas,perSet:reviewedSets.map(x=>({
    code:x.set,screened:x.artworksScreened,held:x.heldCards,added:x.newIndependentThemeSlots
  }))
}));
