#!/usr/bin/env node
// Complete the already-reviewed Korean SM2L set without changing canonical card IDs,
// ownership, master names or prior thematic choices. Display alias is a client-only
// name correction; strict review status is supported by 62 Korean cards, images and
// 12-theme screens, not inferred from PNG filenames alone.
import fs from "node:fs";
import assert from "node:assert/strict";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const write=(p,data)=>fs.writeFileSync(p,JSON.stringify(data,null,2)+"\n");
const statusFile="data/audits/theme-series-review-status.json";
const closureFile="data/audits/theme-sm2l-strict-closure-20261019.json";
const themeFile="data/art-themes.json";
const themes=read(themeFile);
const master=read("data/series.json");
const set=master.find(x=>String(x.code).toLowerCase()==="sm2l");
const latest=read("data/audits/theme-sm2l-korean-full-visual-checkpoint-20261019.json");
const src=read("data/audits/theme-sm2l-canonical-image-http-and-decoding-20261019.json");
const previous=read("data/audits/theme-sm2l-047-048-korean-number-resolution-20261019.json");
const coverage=read("data/audits/theme-series-coverage.json");
const status=read(statusFile);
const expectedThemes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const clean=x=>String(x??"").replace(/\s+/g,"").toLowerCase();
assert.equal(set?.cards?.length,62,"Korean SM2L master changed");
assert.equal(themes.groups.length,12);
assert.deepEqual(new Set(themes.groups.map(x=>x.code)),new Set(expectedThemes));
assert.equal(themes.groups.reduce((n,g)=>n+g.cards.length,0),18011);
assert.equal(coverage.summary.themeCardSlots,18011);
assert.equal(coverage.summary.strictCompleteSetCount,108);
assert.equal(coverage.sets.find(x=>String(x.code).toLowerCase()==="sm2l")?.status,"pending");
assert.equal(latest.visuallyInspectedKoreanPrintedCardFaces,62);
assert.equal(latest.visuallyInspectedKoreanPrintedNumbers,62);
assert.equal(latest.remainingUninspectedKoreanPrintedImages,0);
assert.equal(latest.cumulativeExactNameAndNumberMatches,61);
assert.deepEqual(latest.printedTitleAndCanonicalNameMismatchCodes,["SM2L_062"]);
assert.equal(src.allImagesDownloadedAndDecoded,62);
assert.equal(src.httpOrDecodeFailures.length,0);
assert.equal(previous.KoreanCatalogueAndMatchingArtworkScreened,62);
assert.equal(previous.koreanNumberMappingHoldsRemaining.length,0);
const allCodes=Array.from({length:62},(_,i)=>"SM2L_"+String(i+1).padStart(3,"0"));
assert.deepEqual(latest.imagesCheckedAndCardNumbers,allCodes);
const actualHits=Object.fromEntries(expectedThemes.map(x=>[x,0]));
const rowsByCode=new Map(allCodes.map(code=>[code,[]]));
for(const g of themes.groups){
 const seen=new Set();
 for(const row of g.cards){
   if(String(row.set).toLowerCase()!=="sm2l")continue;
   assert.ok(rowsByCode.has(row.code),"Unexpected SM2L card code "+row.code);
   assert.ok(!seen.has(row.code),"Duplicate within theme "+g.code+" "+row.code);
   seen.add(row.code);
   const card=set.cards.find(x=>String(x.code).toUpperCase()===row.code.toUpperCase()+"/050");
   assert.ok(card,row.code+" is not found in current Korean master");
   assert.equal(clean(row.name),clean(card.name),"Theme card Korean master identity drift "+row.code);
   assert.equal(clean(row.image),clean(card.image),"Theme image changed unexpectedly "+row.code);
   assert.equal(row.cardNumber, row.code.slice(-3)+"/050");
   actualHits[g.code]++;
   rowsByCode.get(row.code).push(g.code);
 }
}
assert.equal(actualHits.color,62,"All 62 cards must have had artwork color checked");
assert.deepEqual(actualHits,{sleeping:0,connected:0,evolution:0,night:4,season:30,color:62,sunset:1,reflections:0,food:1,street:0,work:1,cameo:0});
assert.ok(allCodes.every(code=>rowsByCode.get(code).length>=1));
assert.equal(set.cards.find(x=>x.code==="SM2L_047/050")?.name,"레스큐탱크");
assert.equal(set.cards.find(x=>x.code==="SM2L_048/050")?.name,"아쿠아패치");
const original=set.cards.find(x=>x.code==="SM2L_062/050");
assert.equal(original?.name,"격투 에너지");
assert.equal(latest.titleDiscrepancy.koreanPrintedNameVisuallyRead,"기본 격투 에너지");
assert.equal(latest.titleDiscrepancy.printedBottomNumber,"062/050");
assert.ok(clean(latest.titleDiscrepancy.koreanPrintedNameVisuallyRead).endsWith(clean(original.name)),
  "062 alias is not a benign printed-name extension");
const runtime=fs.readFileSync("core/catalog/catalog-service.js","utf8");
assert.ok(runtime.includes('"sm2l_062/050": "기본 격투 에너지"'),
  "Display and unified search must use the real Korean printed name");
const keys=Object.keys(status.reviews||{});
const key=keys.find(x=>x.toLowerCase()==="sm2l")||"sm2L";
const existing=status.reviews?.[key]||{};
if(fs.existsSync(closureFile)){
  assert.equal(existing.status,"complete");
  assert.equal(existing.reviewedCardCount,62);
  assert.deepEqual(new Set(existing.reviewedThemes),new Set(expectedThemes));
  console.log("SM2L strict completion already applied; preserving existing result");
  process.exit(0);
}
assert.ok(existing.status!=="complete","SM2L already marked complete but no linked audit");
const selected=allCodes.map(code=>({code,approvedThemes:rowsByCode.get(code)}));
const proof={
  schemaVersion:1,reviewedAt:"2026-10-19",series:"sm2L",setName:set.displayName,
  previousProof:"data/audits/theme-sm2l-korean-full-visual-checkpoint-20261019.json",
  imageBytesAudit:"data/audits/theme-sm2l-canonical-image-http-and-decoding-20261019.json",
  thematicScreenAudits:[
    "data/audits/theme-sm2l-001-010-official-visual-review-20261019.json",
    "data/audits/theme-sm2l-002-006-008-010-artwork-20261019.json",
    "data/audits/theme-sm2l-011-020-artwork-screen-20261019.json",
    "data/audits/theme-sm2l-021-030-artwork-screen-20261019.json",
    "data/audits/theme-sm2l-031-062-full-range-screen-20261019.json",
    "data/audits/theme-sm2l-047-048-korean-number-resolution-20261019.json"
  ],
  status:"complete",reviewedCardCount:62,reviewedThemes:expectedThemes,
  proofDetails:{
    koreanPrintedCardFaceVisuallyChecked:62,
    KoreanPrintedCardFooterNumbersChecked:62,
    decodedVerifiedImageFiles:62,
    KoreanCardNameExactMatches:61,
    KoreanCardNameAcceptedPrintedAliasCount:1,
    artworkThemeScreenedCards:62,
    unresolvedPrintedCardIdentityErrors:0,
    unresolvedKoreanLanguageImageCases:0,
    changeToOwnedCardIdentity:0,
    changedMasterCardRecords:0,
    changedThemeCards:0,
    currentThemeSlotCount:18011
  },
  acceptedPrintedNameAlias:{
    code:"SM2L_062/050",rawMasterName:"격투 에너지",
    actualKoreanPrintedName:"기본 격투 에너지",
    printedCardNumber:"062/050",
    runtimeDisplayCorrected:true,
    backwardsSearchCompatibility:true,
    rationale:"The printed word 기본 describes this Fighting Energy as a basic energy. The historical canonical entry is the same exact code and image; runtime renders the full printed Korean title while preserving stored account/collection identity."
  },
  strictClosureMethod:"Every Korean printed card face and bottom number inspected, every one of twelve themes screened across 62 canonical cards, 062 abbreviated master name treated as one verified displayed printed-name alias rather than mismatched-card artwork.",
  themeHits:actualHits,cardThemeDecisionEvidence:selected,
  followupSeries:"SM2K five held actual-Korean-card photos 057,058,060,061,062; preserve prior status and resume instead of rescanning",
  previousStrictCompleteSets:108,afterStrictCompleteSetsExpected:109,
  previousRemainingSets:165,afterRemainingSetsExpected:164,
  preservesHistoricalCheckpoints:true
};
status.reviews ??={};
status.reviews[key]={
  ...existing,status:"complete",reviewedAt:"2026-10-19",reviewedCardCount:62,
  reviewedThemes:expectedThemes,
  evidence:"data/audits/theme-sm2l-strict-closure-20261019.json",
  note:"All 62 Korean prints and 12 themes completed. Exact printing of basic Fighting Energy #062 uses a display-only alias; canonical card/ownership identity remains unchanged."
};
write(statusFile,status);
write(closureFile,proof);
console.log("SM2L_KOREAN_12_THEME_STRICT_COMPLETE",JSON.stringify({status:"complete",allCardCodes:62,koreanPrints:62,themecount:12,aliases:1,themeRows:99,totalThemeSlots:18011,expectedCompletedSets:109}));
