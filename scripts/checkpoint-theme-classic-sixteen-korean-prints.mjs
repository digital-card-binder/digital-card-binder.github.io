import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async x=>JSON.parse(await readFile(path.join(root,x),"utf8"));
const write=async(x,v)=>writeFile(path.join(root,x),JSON.stringify(v,null,2)+"\n");
const base="data/audits/";
const regionPath=base+"theme-classic-three-102-card-regional-print-checkpoint-20261013.json";
const manifestPath=base+"theme-classic-three-16-korean-print-artwork-20261013.json";
const [state,region,series,legacy,theme]=await Promise.all([
 read(base+"theme-series-review-status.json"),read(regionPath),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json")
]);
const sets=["CLL","CLK","CLF"],count={CLL:9,CLK:7,CLF:0};
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const allowed=new Set(themes12);
const report={schemaVersion:1,recordedAt:"2026-10-13",
 title:"Already locally available Korean printed Pokémon TCG Classic illustrations; set-scoped verified artwork evidence",
 policy:{
  neverClassifyJapaneseArtworkAsKoreanPrint:true,doNotOverwritePreviousArtThemes:true,
  doNotMarkEntireClassicSetsComplete:true,doNotChangeOwnershipStates:true,
  onlyOwnedCloudflareImageEvidence:true,allowNoInventedThemeAssignments:true},
 next:"CLL_004 exact Korean printed image; 80 JP archived artwork replacements and 6 neutral energy region proofs still pending",
 sets:{},source:regionPath};
for(const code of sets){
 const master=[...series,...legacy].filter(s=>String(s.code||"").toUpperCase()===code);
 if(master.length!==1||master[0].cards?.length!==34)throw Error("Korean classic 34-slot canonical master missing "+code);
 const old=state.reviews?.[code];
 if(!old||old.status!=="in_progress")throw Error("Classic checkpoint is no longer pending "+code);
 const known=region.sets[code],local=await read(base+"theme-nine-sets-owned-image-20261013/"+code+"/visual-index.json");
 if(local.expectedCanonicalCards!==34||local.ownedCdnBinaryDecoded!==34||
 known.verifiedKoreanPrintedCount!==count[code]||
 known.JapaneseImageReplacementsNeeded!== (code==="CLL"?23:code==="CLK"?25:32)||
 known.languageNeutralEnergyEvidenceStillNeeded!==2)
 throw Error("Original-language evidence changed "+code);
 const cards=[];
 for(const identity of known.koreanVerifiedMasterCardKeys){
  const item=known.cards.find(x=>x.cardKey===identity);
  const order=item?.canonicalOrder,masterCard=master[0].cards[order-1],archived=local.cards[order-1];
  if(!item||!masterCard||!archived||String(archived.masterCode).toLowerCase()!==String(masterCard.code).toLowerCase()||
   String(masterCard.name||"").trim()!==String(item.koreanName||"").trim()||
   archived.imageCheck?.status!=="decoded"||archived.imageCheck?.http!==200||
   item.visualPrintLanguageStatus!=="Korean_language_print_visually_verified")
   throw Error("Korean original image canonical mismatch for "+identity);
  const ours=archived.ownedCdnUrl;
  if(!/^https:\/\/dcb-card-images-(?:modern|legacy)-2026\.pages\.dev\//.test(ours))
   throw Error("Not self-hosted "+identity);
  const assignedThemes=theme.groups.filter(g=>(g.cards||[]).some(x=>String(x.code||"").toUpperCase()===identity))
   .map(g=>g.code);
  if(assignedThemes.some(t=>!allowed.has(t)))throw Error("Bad theme tag "+identity);
  cards.push({cardKey:identity,canonicalOrder:order,koreanName:masterCard.name,
   visualProof:"Korean printed original artwork seen on own CDN contact sheets. Every card read as Korean, not Japanese.",
   imageArchiveUrl:ours,imageArchiveBinaryStatus:"verified-decoded",
   sourceAttribution:archived.archivedSourceProvenance,
   preservedExistingThemeAssignments:assignedThemes,
   cardImageEvidence:item.evidenceSheet,
   strictKoreanPrintVerified:true});
 }
 if(cards.length!==count[code])throw Error("Verified Korean original count mismatch "+code);
 // Additional metadata only. Preserve reviewedCardCount, held cards, all prior theme definitions and owner counts.
 state.reviews[code]={
  ...old,regionalArtworkGate:"Korean_original_artwork_pending_80_image_replacements_and_6_energy_proofs",
  koreanPrintedCardsVisuallyVerified:count[code],
  koreanPrintedCanonicalKeys:cards.map(c=>c.cardKey),
  japanesePrintedAssetsNeedReplacement:known.JapaneseImageReplacementsNeeded,
  languageNeutralEnergyPrintedVariantEvidencePending:2,
  KoreanPrintArtworkEvidence:manifestPath,
  lastRegionAuditAt:"2026-10-13",
  regionalGateNote:"기존 일본어판 자가 CDN 이미지 80장 및 에너지 6장 한국판 증거 확보 전에는 세트 complete 금지. 한국어 인쇄가 확인된 16장만 지역판 원본 검증으로 집계. 기존 카드/소유 상태와 테마 소속 유지."
 };
 report.sets[code]={status:"in_progress",canonicalCardCount:34,
  KoreanOriginalVerified:cards.length,JapaneseImageReplacementPending:known.JapaneseImageReplacementsNeeded,
  energyEditionProofPending:2,verifiedKoreanPrintedCards:cards,
  nextUnsafeCard:known.wrongForeignPrintedImageMasterKeys[0],
  note:"Do not infer original Korean region status from the archived image's source host or catalog Korean name alone."};
}
if(Object.values(report.sets).reduce((n,s)=>n+s.KoreanOriginalVerified,0)!==16)
 throw Error("Expected sixteen physically Korean-printed originals");
await Promise.all([
 write(manifestPath,report),
 write(base+"theme-series-review-status.json",state)
]);
console.log(JSON.stringify({source:regionPath,
 KoreanOriginals:Object.fromEntries(Object.entries(report.sets).map(([code,x])=>[code,x.KoreanOriginalVerified])),
 pendingForeignAssets:Object.values(report.sets).reduce((n,x)=>n+x.JapaneseImageReplacementPending,0),
 pendingEnergies:6,nextSafeStart:"CLL_004",
 originalReviewCountsPreserved:true,existingThemeMembershipUnchanged:true},null,2));
