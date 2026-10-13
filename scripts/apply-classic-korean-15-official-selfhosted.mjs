import {readFile,writeFile,stat} from "node:fs/promises";
import path from "node:path";import{fileURLToPath}from"node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,j)=>writeFile(path.join(root,p),JSON.stringify(j,null,2)+"\n");
const auditDir="data/audits/",themeFile="data/art-themes.json",stateFile=auditDir+"theme-series-review-status.json";
const [prepared,region,series,legacy,overrides,themes,state,selfhost,coverage]=await Promise.all([
 read(auditDir+"theme-classic-15-interim-official-asset-preparation-20261013.json"),
 read(auditDir+"theme-classic-three-102-card-regional-print-checkpoint-20261013.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/series-image-overrides.json"),read(themeFile),read(stateFile),
 read(auditDir+"theme-image-selfhost-audit.json"),read(auditDir+"theme-series-coverage.json")
]);
const input={CLL:3,CLK:5,CLF:7};
const tags=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const themeByCode=new Map(themes.groups.map(g=>[g.code,g]));
const scenic=new Set(["CLK_014","CLK_015","CLF_003","CLF_010","CLF_015","CLF_025"]);
for(const k of ["season","color"])if(!themeByCode.get(k)?.cards)throw Error("Expected independent theme "+k);
if(prepared.count!==15||prepared.assets?.length!==15||
 !prepared.safety?.newImagesSelfHostedInRepo||
 prepared.safety?.remainingJapanesePrintedMasterImages!==65||
 prepared.safety?.ambiguousEnergyPrintsStillHeld!==6||
 coverage.summary.strictCompleteSetCount!==64)
 throw Error("Outdated 15-card Korean quality/provenance checkpoint");
const bySet={};for(const [code,n] of Object.entries(input))bySet[code]={expected:34,priorKoreanVerified:region.sets[code].verifiedKoreanPrintedCount,previousWrong:region.sets[code].JapaneseImageReplacementsNeeded,expectedReplacements:n,updated:0,themeDisplayImageReplacements:0,newArtThemeSlots:0,previousThemeMembershipsPreserved:0,remainingJapaneseWrong:0,energyRegionHolds:2};
const previousAssigned=new Map();
for(const g of themes.groups)for(const c of g.cards||[]){
 const k=String(c.code||"").toUpperCase();
 if(!(k.startsWith("CLL_")||k.startsWith("CLK_")||k.startsWith("CLF_")))continue;
 const x=previousAssigned.get(k)||[];x.push(g.code);previousAssigned.set(k,x);
}
const unique=new Set(),seen=new Set();
for(const a of prepared.assets){
 const [code,no]=a.cardKey.split("_");
 if(!(code in input)||!/^0\d\d$/.test(no)||unique.has(a.cardKey))
  throw Error("Unexpected or duplicate Korean Classic Korean artwork key "+a.cardKey);
 unique.add(a.cardKey);
 const exact=region.sets[code].cards.find(c=>c.cardKey===a.cardKey);
 if(!exact||exact.visualPrintLanguageStatus!=="Japanese_language_image_wrong_for_Korean_master"||
  a.previousDisplayedImage!=="Japanese"||a.verifiedPrintLanguage!=="Korean"||
  a.sourceFirstPartyProduct!=="https://pokemoncard.co.kr/card/590"||
  a.quality!=="low_resolution_official_Korean_marketing_card_photo"||
  a.notYetWiredToLiveCard!==true||
  !/^\/assets\/cards\/classic-korean-official-2023\/(?:CLL|CLK|CLF)_\d{3}\.webp$/.test(a.selfHostedAsset))
   throw Error("Official Korean marketing + region evidence mismatch "+a.cardKey);
 const file=path.join(root,a.selfHostedAsset.replace(/^\//,""));
 const assetStat=await stat(file);
 if(!assetStat.isFile()||assetStat.size<1600)throw Error("Local Korean image missing/invalid "+a.cardKey);
 const matches=[...series,...legacy].filter(g=>String(g.code||"").toUpperCase()===code);
 if(matches.length!==1||matches[0].cards?.length!==34)throw Error("Set cardinality moved "+code);
 const group=matches[0],card=group.cards[exact.canonicalOrder-1];
 if(!card||String(card.code||"").toUpperCase()!==a.cardKey+"/032"||
    String(card.name||"").trim()!==a.koreanMasterName||
    card.code!==region.sets[code].cards[exact.canonicalOrder-1].masterCode)
  throw Error("Wrong Korean master canonical identity "+a.cardKey);
 const newLocal=a.selfHostedAsset;
 if(!card.image)throw Error("Original image provenance missing for "+a.cardKey);
 const priorImg=card.image;
 if(priorImg!==newLocal){
  if(!card.sourceImage)card.sourceImage=priorImg;
  card.image=newLocal;
 }
 overrides.sets[code.toLowerCase()]??={};
 overrides.sets[code.toLowerCase()][card.code.toLowerCase()]=newLocal;
 // Keep all earlier theme memberships; replace only those cards' wrong-print displayed image.
 const oldTags=previousAssigned.get(a.cardKey)||[];
 bySet[code].previousThemeMembershipsPreserved+=oldTags.length;
 for(const g of themes.groups)for(const v of g.cards||[]){
  if(String(v.code||"").toUpperCase()!==a.cardKey)continue;
  if(v.image!==newLocal){
   if(v.image&&!v.sourceImage)v.sourceImage=v.image;
   v.image=newLocal;bySet[code].themeDisplayImageReplacements++;
  }
 }
 const visualTags=["color",...(scenic.has(a.cardKey)?["season"]:[])];
 for(const tag of visualTags){
  if(oldTags.includes(tag))continue;
  const dest=themeByCode.get(tag);
  dest.cards.push({code:a.cardKey,name:card.name,series:"SV",set:group.code,setName:group.name,
   cardNumber:card.code.split("_")[1],rarity:card.rarity||"",
   category:dest.cards[0]?.category||dest.name,
   image:newLocal,
   evidence:"포켓몬코리아 공식 한국어판 Classic 제품 상세 사진 "+a.sourceFirstPartyProduct+
    "; 한국판 단일 카드 컷 "+newLocal+" (저해상도 임시 복구, 고화질 원본 후속 교체)."});
  bySet[code].newArtThemeSlots++;
 }
 bySet[code].updated++;
 seen.add(a.cardKey);
}
if(seen.size!==15)throw Error("Failed to bind exactly 15 verified KOR artworks");
for(const [code,stat] of Object.entries(bySet)){
 if(stat.updated!==stat.expectedReplacements)throw Error("Korean replacements incomplete "+code);
 const p=state.reviews?.[code];
 if(!p||p.status!=="in_progress")throw Error("Do not overwrite completed/unknown Korean Classic checkpoint "+code);
 stat.remainingJapaneseWrong=stat.previousWrong-stat.updated;
 state.reviews[code]={
  ...p,regionProofUpdatedAt:"2026-10-13",
  regionProofSource:"data/audits/theme-classic-15-interim-official-asset-preparation-20261013.json",
  selfHostedOfficialKoreanPrintCount:stat.priorKoreanVerified+stat.updated,
  firstPartyKoreanMarketingReplacementsApplied:stat.updated,
  JapanesePrintedSourcesStillPending:stat.remainingJapaneseWrong,
  unnumberedEnergyEditionProofStillPending:2,
  regionalGate:"in_progress_official_Korean_low_res_replacements_require_later_hi_res",
  note:(p.note||"").slice(0,1600)+" | 2026-10-13 official first-party product image crop: "+stat.updated+
  " genuine Korean-printed cards now served from own GitHub Pages. "+stat.remainingJapaneseWrong+
  " Japanese scans and 2 neutral-energy printed identifications remain; do not mark set complete."
 };
 selfhost.batches.push({
  task:6,set:code,range:"exact Korean printed official product art cropped for "+stat.updated+" formerly wrong-language master image slots",
  canonicalCardCount:34,artworkPendingCount:stat.remainingJapaneseWrong+2,
  officialKoreanLowResolutionImageReplacements:stat.updated,
  verifiedImageCount:stat.priorKoreanVerified+stat.updated,
  foreignLanguageImagesStillPresent:stat.remainingJapaneseWrong,
  languageNeutralEnergyHolds:2,
  previouslySavedSelfHostedImagesPreserved:34,
  directExternalImageHotlinksAdded:0,
  nextStart:code==="CLL"?"CLL_004 Korean full resolution source pending":code==="CLK"?"CLK_004 Korean full resolution source pending":"CLF_004 Korean full resolution source pending",
  evidence:"data/audits/theme-classic-15-interim-official-asset-preparation-20261013.json",
  note:"Fifteen cards are first-party Korean product illustration crops; less sharp than standalone scans, clearly flagged for high-res followup. No master ownership flags or card IDs changed."
 });
}
if(Object.values(bySet).reduce((s,x)=>s+x.remainingJapaneseWrong,0)!==65)
 throw Error("Wrong remaining Japanese card image count after first-party replacement");
const report={
 schemaVersion:1,recordedAt:"2026-10-13",
 setScope:["CLL","CLK","CLF"],status:"15_real_Korean_firstparty_card_art_rehosted_as_interim_low_resolution",
 imagesChanged:15,priorGenuineKoreanOwnedAssets:16,currentGenuineKoreanOwnedAssets:31,
 remainingVisiblyJapaneseWrongImages:65,printedEditionEnergyProofStillPending:6,
 firstpartyProductSource:"https://pokemoncard.co.kr/card/590",
 artworkSourceQuality:"860px-wide marketing original; cropped images ~185-267 pixels wide; lower resolution than individual original 420px scan",
 nextPriority:"CLL_004 Korean full-resolution print; then remaining 65 Japanese scans and 6 energy identity verifications",
 archiveRef:"data/audits/theme-classic-15-interim-official-asset-preparation-20261013.json",
 bySet,
 safety:{masterCardIdsChanged:false,ownershipChanged:false,priorThemeMembershipsRemoved:false,
  newThirdPartyHotlinkCount:0,priorArtRecordsPreserved:true,noFalseEntireSetCompletion:true,
  productDesignNotClaimedAsFullHighResolutionScan:true}
};
selfhost.updatedAt="2026-10-13";
await Promise.all([
 write("data/series.json",series),write("data/series-legacy.json",legacy),
 write("data/series-image-overrides.json",overrides),
 write(themeFile,themes),write(stateFile,state),
 write(auditDir+"theme-image-selfhost-audit.json",selfhost),
 write(auditDir+"theme-classic-15-firstparty-korean-display-recovery-20261013.json",report)
]);
console.log(JSON.stringify({mapped:seen.size,priorKorean:16,currentKorean:31,
 remainingJapanese:65,neutralEnergyHeld:6,bySet},null,2));
