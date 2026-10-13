import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const base="data/audits/";
const [coverage,region,nine,progress,themes,official]=await Promise.all([
 read(base+"theme-series-coverage.json"),
 read(base+"theme-classic-three-102-card-regional-print-checkpoint-20261013.json"),
 read(base+"theme-nine-sets-owned-image-20261013/summary.json"),
 read(base+"theme-series-review-status.json"),read("data/art-themes.json"),
 read(base+"sv-p-official-detail-audit.json")
]);
const codeList=["M-P","SVAM","SVEL","SVEM","SVG","SV-P","CLL","CLK","CLF"];
const done=["M-P","SVAM","SVEL","SVEM","SVG","SV-P"];
const held=["CLL","CLK","CLF"];
if(nine.totalExpectedCards!==540||nine.totalDecoded!==540||
 region.totals.expected!==102||region.totals.visiblyJapanese!==80||
 region.totals.languageNeutralStillNeedsRegionalProof!==6)
 throw Error("Nine-set original photo and regional image checkpoint changed");
const status={};
const groups=themes.groups||[];
const ownedHosts=["dcb-card-images-modern-2026.pages.dev","dcb-card-images-legacy-2026.pages.dev"];
const imageProblems=[];
for(const code of codeList){
 const set=coverage.sets.find(s=>s.code===code);
 if(!set||set.cardCount!==nine.sets[code]?.expected)throw Error("Korean card-count mismatch "+code);
 const old=progress.reviews?.[code]||progress.reviews?.[code.toLowerCase()];
 const themeCards=[];
 for(const g of groups)for(const card of g.cards||[])
  if(String(card.set||"").toUpperCase()===code||String(card.code||"").toUpperCase().startsWith(code+"_"))
   themeCards.push({theme:g.code,code:card.code,image:card.image});
 for(const row of themeCards){
  const im=String(row.image||"");
  let host;try{host=new URL(im).hostname;}catch{host="invalid";}
  if(done.includes(code)&&!ownedHosts.includes(host))
   imageProblems.push({set:code,card:row.code,theme:row.theme,image:im});
 }
 status[code]={
  expectedCards:set.cardCount,strictThemeStatus:set.status,
  reviewedCardCount:old?.reviewedCardCount??0,
  selfhostBinaryDecoded:nine.sets[code].decoded,
  imageArchiveMissing:nine.sets[code].missing,
  independentThemeSlots:themeCards.length,
  regionalImageGate:done.includes(code)?"Korean_owned_CDN_review_complete":"Korean_source_art_replacement_pending",
  KoreanImageAlreadyVerified:region.sets[code]?.verifiedKoreanPrintedCount??null,
  visiblyJapaneseSourceImages:region.sets[code]?.JapaneseImageReplacementsNeeded??0,
  languageNeutralEnergyProofHeld:region.sets[code]?.languageNeutralEnergyEvidenceStillNeeded??0,
  lastSafeCheckpoint:done.includes(code)?"set_complete":region.sets[code]?.wrongForeignPrintedImageMasterKeys?.[0]||"Korean image proof pending"
 };
 if(done.includes(code)&&set.status!=="complete")throw Error("Completed Korean set regression "+code);
 if(held.includes(code)&&set.status==="complete")throw Error("Japanese original illustration marked Korean complete "+code);
}
if(imageProblems.length)throw Error("Completed nine-set theme cards still direct-link external image assets: "+JSON.stringify(imageProblems.slice(0,8)));
const completeCount=done.reduce((n,c)=>n+status[c].expectedCards,0);
const heldCount=held.reduce((n,c)=>n+status[c].expectedCards,0);
if(completeCount!==438||heldCount!==102)throw Error("9-set card counts changed");
const report={
 schemaVersion:1,recordedAt:"2026-10-13",
 title:"Nine priority MEGA/SV Korean theme review completion and canonical restart checkpoint",
 repository:"digital-card-binder/digital-card-binder.github.io",branch:"main",
 scope:{setCount:9,totalCards:540,ownedCDNBinariesDecoded:540,newlyStrictCompletedSetCount:6,
 newlyStrictCompletedCards:438,heldKoreanClassicSetCount:3,heldClassicCards:102,
 visuallyKoreanClassicImages:16,visiblyJapaneseWrongClassicImages:80,classicEnergyProofPending:6},
 master:{masterSetCount:coverage.summary.masterSetCount,
  masterCardCount:coverage.summary.masterCardCount,
  themeStrictCompleteSetCount:coverage.summary.strictCompleteSetCount,
  remainingSetCount:coverage.summary.baselineRemainingSetCount},
 status,
 officialSVPCardDetailPendingOutsideArtworkReview:official.summary.pendingOfficialEvidenceCount,
 safety:{allCompletedThemeCardImageHostsOwned:true,
  directForeignImageReferenceCountOnNewlyCompletedThemeCards:0,
  oldOwnershipStatesUntouched:true,
  masterBaseCardKeysPreserved:true,
  oldThemePlacementsKept:true,
  JapaneseEditionNeverSubstitutedForKoreanProof:true,
  originalImageHostRequestsPerformedInNineCdnAudit:0,
  existingSourceProvenanceMayRetainForeignUrlButNeverUsedAsDisplayImage:true},
 pendingRepairSequence:[
  "CLL: preserve 9 Korean-language original images, replace 23 Japanese-language images with exact Korean prints, verify 2 energy print variants.",
  "CLK: preserve 7 Korean-language original images, replace 25 Japanese-language images with exact Korean prints, verify 2 energy print variants.",
  "CLF: replace 32 Japanese-language images with exact Korean prints, verify 2 energy print variants.",
  "Rerun owned CDN binary decode and visually inspect all 12 theme groups for each original Korean printed card only, with printed identity and preexisting theme placements preserved.",
  "Commit and mark complete only after npm run site:prepare, site:check, npm test succeed."
 ],
 supportingFiles:[
  base+"theme-nine-sets-owned-image-20261013/summary.json",
  base+"theme-classic-three-102-card-regional-print-checkpoint-20261013.json",
  base+"theme-classic-three-korean-region-gate-20261013.json",
  base+"theme-mp-strict-closure-20261013.json",
  base+"theme-four-m-sv-completion-20261013.json",
  base+"theme-svp-strict-completion-20261013.json"
 ]
};
await writeFile(base+"theme-nine-priority-completion-checkpoint-20261013.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({master:report.master,scope:report.scope,
 directForeignImageReferenceCount:imageProblems.length,
 status:Object.entries(status).map(([k,v])=>({code:k,status:v.strictThemeStatus,themeSlots:v.independentThemeSlots}))},null,2));
