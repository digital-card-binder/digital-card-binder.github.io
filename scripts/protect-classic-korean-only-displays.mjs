import {readFile,writeFile,stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,o)=>writeFile(path.join(root,p),JSON.stringify(o,null,2)+"\n");
const audit="data/audits/";
const checkpointPath=audit+"theme-classic-latest-safe-restart-20261013.json";
const visibilityPath=audit+"theme-classic-korean-only-display-protection-20261013.json";
const placeholders="/assets/cards/classic-korean-original-pending.svg";
const [checkpoint,modern,legacy,overrides,themes,review,coverage,meta]=await Promise.all([
 read(checkpointPath),read("data/series.json"),read("data/series-legacy.json"),
 read("data/series-image-overrides.json"),read("data/art-themes.json"),
 read(audit+"theme-series-review-status.json"),read(audit+"theme-series-coverage.json"),
 read(audit+"theme-classic-dogam-public-image-reuse-gate-20261013.json")
]);
if(checkpoint.summary.expected!==102||checkpoint.summary.verifiedExisting!==16||
 checkpoint.summary.verifiedNew!==15||checkpoint.summary.JapaneseReplacementPending!==65||
 checkpoint.summary.neutralEnergyHeld!==6||coverage.summary.strictCompleteSetCount!==64||
 meta.tosKeyConstraints?.thirdPartyImageHost!=="static.tcgexchange.kr")
 throw Error("Current 102-card original Korean region gate changed: do not overwrite");
const placeholderFile=path.join(root,placeholders.slice(1));
if((await stat(placeholderFile)).size<300)throw Error("Local Korean placeholder missing");
const oldQueues=checkpoint.remainingOriginalKoreanImageQueue.filter(c=>c.status==="wrong_language_Japanese_image");
if(oldQueues.length!==65)throw Error("Exact wrong-print source count changed");
const sets=["CLL","CLK","CLF"],resolved={},keys=new Set();
for(const set of sets){
 const canonical=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()===set);
 if(canonical.length!==1||canonical[0].cards?.length!==34||review.reviews?.[set]?.status!=="in_progress")
  throw Error("Korean Classic canonical master or incomplete review moved: "+set);
 resolved[set]={master:canonical[0],changedKeys:[],themesProtected:0,previousImagesRetainedAsProvenance:0};
 if(!overrides.sets?.[set.toLowerCase()])overrides.sets[set.toLowerCase()]={};
}
let oldThemeSlots=0,sourcePreserved=0;
for(const c of oldQueues){
 if(keys.has(c.cardKey))throw Error("Repeated wrong print key "+c.cardKey);
 keys.add(c.cardKey);
 const [set,num]=c.cardKey.split("_"),n=Number(num);
 const master=resolved[set]?.master,card=master?.cards[n-1];
 if(!master||!card||String(card.code||"").toUpperCase()!==c.cardKey+"/032"||String(card.name)!==c.koreanName)
  throw Error("Wrong master slot or Korean name at "+c.cardKey);
 if(card.image===placeholders)continue;
 if(String(card.image||"").startsWith("/assets/cards/classic-korean-official-2023/"))
  throw Error("Do not obscure first-party already verified Korean print "+c.cardKey);
 const oldImage=String(card.image||"");
 if(!oldImage || oldImage===placeholders)throw Error("Missing original image data "+c.cardKey);
 if(!card.sourceImage)card.sourceImage=oldImage;
 card.image=placeholders;
 overrides.sets[set.toLowerCase()][String(card.code).toLowerCase()]=placeholders;
 resolved[set].changedKeys.push(c.cardKey);
 resolved[set].previousImagesRetainedAsProvenance++;
 sourcePreserved++;
 for(const group of themes.groups){
  for(const themeCard of group.cards||[]){
   if(String(themeCard.code||"").toUpperCase()!==c.cardKey)continue;
   if(!themeCard.sourceImage&&themeCard.image)themeCard.sourceImage=themeCard.image;
   themeCard.image=placeholders;
   oldThemeSlots++;resolved[set].themesProtected++;
  }
 }
}
const total=Object.values(resolved).reduce((n,x)=>n+x.changedKeys.length,0);
if(total!==65||sourcePreserved!==65||
 resolved.CLL.changedKeys.length!==20||
 resolved.CLK.changedKeys.length!==20||
 resolved.CLF.changedKeys.length!==25)
 throw Error("65 wrong-language source protection incomplete: "+total);
const metaSets={};
for(const code of sets){
 const r=resolved[code];
 metaSets[code]={cardsInKoreanMaster:34,
  wrongLanguageImagesRemovedFromLiveDisplay:r.changedKeys.length,
  sourceImageProvenancePreserved:r.previousImagesRetainedAsProvenance,
  oldThemeSlotImagesProtected:r.themesProtected,
  printVerificationStillPending:r.changedKeys.slice(),
  actualSetCompletionStatus:"in_progress"};
 review.reviews[code]={
  ...review.reviews[code],
  KoreanOnlyDisplayProtectedAt:"2026-10-13",
  JapanesePrintedImagesSuppressedCount:r.changedKeys.length,
  KoreanOriginalPendingImage:placeholders,
  imageRegionStatus:"pending_Korean_original_while_wrong_language_images_not_displayed",
  manualResumeProof:checkpointPath,
  note:(review.reviews[code].note||"").slice(0,900)+
   " | Japanese-language images removed from live Korean Classic display, original URL preserved only as provenance. Does not clear Korean printed card verification."
 };
}
checkpoint.KoreanOnlyDisplayProtection={
 active:true,appliedAt:"2026-10-13",safeLocalImage:placeholders,
  JapanesePrintedArtStillUnverified:65,JapaneseArtDisplayedInKoreanCatalog:0,
  preservedMasterAndThemeOwnership:true,
  status:"wrong_language_images_hidden_until_firstparty_or_authorized_Korean_originals_available",
  sourceNamesNeverRenamed:true,
  perSet:Object.fromEntries(sets.map(code=>[code,metaSets[code].wrongLanguageImagesRemovedFromLiveDisplay]))
};
const report={schemaVersion:1,recordedAt:"2026-10-13",
 title:"Korean-only Classic card display guard against incorrect Japanese scans",
 totalCards:102,properKoreanImagesRetained:31,
 foreignLanguageDisplayImagesReplacedWithLocalPlaceholder:65,
 neutralEnergyVariantsAwaitingEditionProof:6,
 newThirdPartyHotlinks:0,
 graphic:placeholders,
 setResults:metaSets,
 originalCardIdentityEdited:false,
 originalCardOwnedEdited:false,
 previousThemeSlotsRemoved:false,
 localImagesOverrideConfigured:true,
 imageEvidenceSource:"data/audits/theme-classic-latest-safe-restart-20261013.json",
 note:"Only erroneous image presentation changed. Do not claim 65 Korean card images newly recovered or three Classic decks complete."};
await Promise.all([
 write("data/series.json",modern),write("data/series-legacy.json",legacy),
 write("data/series-image-overrides.json",overrides),
 write("data/art-themes.json",themes),
 write(audit+"theme-series-review-status.json",review),
 write(checkpointPath,checkpoint),
 write(visibilityPath,report)
]);
console.log(JSON.stringify({cardsProtected:65,oldThemeSlots,verifiedKoreanImagesKept:31,
 undecidedEnergies:6,sets:Object.fromEntries(sets.map(s=>[s,metaSets[s].wrongLanguageImagesRemovedFromLiveDisplay])),
 foreignImageRequests:0},null,2));
