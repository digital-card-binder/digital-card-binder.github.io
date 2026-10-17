import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,obj)=>writeFile(p,JSON.stringify(obj,null,2)+"\n","utf8");
const CODE="s1h",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s1h-061-075-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s1h/061-075/visual-index.json";
const PREVIOUS="data/audits/theme-s1h-031-060-progress-20261017.json";
const PROGRESS="data/audits/theme-s1h-061-075-approved8-held7-progress-20261017.json";
const NEXT="S1H 실드 한국어 인쇄 카드 069-075 확보 전 보류 (일본어 원본 7건)";
const THEMES=["sleeping","connected","evolution","night","season","color",
"sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage,s1w,s2a,s2,s3]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),
 read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s1w-061-075-approved8-held7-progress-20261017.json"),
 read("data/audits/theme-s2a-061-086-approved18-held8-progress-20261017.json"),
 read("data/audits/theme-s2-091-115-approved16-held9-progress-20261017.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const matched=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(matched.length!==1||matched[0].cards?.length!==75)throw Error("S1H master 75 card source changed");
const set=matched[0],masterBefore=JSON.stringify(set.cards);
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
const meta=status.reviews?.[key];
if(!meta)throw Error("Previous S1H 60-card checkpoint missing");
if(meta.artworkReviewedCardCount===68&&meta.newlyAddedThemeSlotCount===110&&
 meta.heldNonKoreanSourceCount===7&&meta.reviewedRanges?.includes("061-068")){
 console.log("S1H 061-068 Korean source reviewed; Japanese 069-075 held; safe no-op");
 process.exit(0);
}
if(meta.artworkReviewedCardCount!==60||meta.reviewedCardCount!==60||
 meta.newlyAddedThemeSlotCount!==101||meta.preservedExistingThemeSlotCount!==0||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 meta.status!=="in_progress"||meta.complete!==false||
 previous.totalMasterCards!==75||previous.KoreanPrintArtworksReviewed!==60||
 previous.newlyAddedThemeSlotsCumulative!==101||previous.remainingImageAndArtworkCount!==15||
 previous.globalCheckpointPreserved!==GLOBAL||
 coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="in_progress"||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 s1w.KoreanPrintArtworksReviewed!==68||s1w.heldJapanesePrintImages!==7||
 s2a.KoreanPrintArtworksReviewed!==78||s2a.heldJapanesePrintImages!==8||
 s2.KoreanPrintArtworksReviewed!==106||s2.heldNonKoreanSourceCount!==9||
 s3.KoreanPrintArtworksReviewed!==110||s3.heldNonKoreanSourceCount!==9)
 throw Error("S1H first60 or source holds changed");
if(review.schemaVersion!==1||review.set!==CODE||review.range!=="061-075"||
 review.status!=="partial_Korean_8_held_Japanese_7"||
 !review.all12ThemesInspectedForApproved||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.canonicalCardsInRange!==15||review.artworksReviewed!==8||
 review.verifiedKoreanPrintImagesInRange!==8||review.ownedCDNImagesDecoded!==15||
 review.officialSourceCardsInRange!==8||review.heldNonKoreanSourceCount!==7||
 review.existingThemesInThisRange!==0||review.themeAdditions!==9||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.noMasterOrOwnershipChanges||review.globalCheckpointPreserved!==GLOBAL||
 review.imagePreflight!==PROOF||review.items?.length!==8||review.held?.length!==7||
 proof.set!==CODE||proof.range!=="061-075"||proof.masterCanonicalCards!==75||
 proof.checkedCardCount!==15||proof.ownedImageDecodedCount!==15||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.sourceHostCounts?.["cards.image.pokemonkorea.co.kr"]!==8||
 proof.sourceHostCounts?.["static.tcgexchange.kr"]!==7||
 proof.cards?.length!==15||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S1H final eight Korean/seven Japanese image proof invalid");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("12-theme registry changed");
const old=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const snapshots=old.map(x=>JSON.stringify(x));
if(old.length!==101||old.some(c=>{
 const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);
 return n>=61&&n<=75;
}))throw Error("Prior 92+1 S1H theme entries changed");
const tally=Object.fromEntries(THEMES.map(t=>[t,0]));
let added=0;
for(let i=0;i<8;i++){
 const n=61+i,num=String(n).padStart(3,"0"),key="S1H_"+num;
 const c=set.cards[n-1],p=proof.cards[i],rv=review.items[i];
 const official="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S1H/S1H_"+num+".png";
 const owned="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S1H/S1H_"+num+".webp";
 if(!c||!p||!rv||p.canonicalOrder!==n||rv.canonicalOrder!==n||
 String(c.code||"").toLowerCase()!=="s1h_"+num+"/060"||
 String(p.code||"").toLowerCase()!=="s1h_"+num+"/060"||
 String(rv.cardKey||"").toUpperCase()!==key||
 p.name!==c.name||!rv.koreanPrintImageVerified||!rv.artObservation?.trim()||
 rv.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!==official||p.ownedUrl!==owned||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[0-9a-f]{64}$/.test(p.imageCheck?.sha256||"")||
 p.preExistingThemeMemberships?.length!==0||rv.preExistingThemeRecordsPreserved?.length!==0)
 throw Error("S1H Korean card image not verified "+key);
 const selected=rv.matchedThemes||[];
 if(new Set(selected).size!==selected.length||!selected.includes("color")||
 selected.some(t=>!THEMES.includes(t)||!rv.categories?.[t]?.trim())||
 Object.keys(rv.categories||{}).length!==selected.length)
 throw Error("Independent S1H theme category invalid "+key);
 for(const t of selected){
  const g=groups.get(t);
  if(g.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===key))
   throw Error("S1H duplicate theme "+key+"/"+t);
  g.cards.push({code:key,name:c.name,series:"S",set:set.code,
   setName:set.displayName||"실드",cardNumber:num+"/060",rarity:c.rarity||"",
   category:rv.categories[t],image:p.ownedUrl,
   evidence:"포켓몬코리아 S1H 한국어 인쇄 "+num+"/060 및 DCB 자체 보관 WebP 육안 확인. "+
    rv.artObservation+" ("+REVIEW+")."});
  added++;tally[t]++;
 }
}
if(added!==9||THEMES.some(t=>tally[t]!==review.themeCounts?.[t]))
 throw Error("S1H verified eight Korean themes count mismatch");
for(let i=0;i<7;i++){
 const n=i+69,num=String(n).padStart(3,"0"),key="S1H_"+num;
 const c=set.cards[n-1],p=proof.cards[i+8],h=review.held[i];
 if(!c||!p||!h||p.canonicalOrder!==n||h.canonicalOrder!==n||
 String(c.code||"").toLowerCase()!=="s1h_"+num+"/060"||
 p.name!==c.name||h.name!==c.name||h.cardKey!==key||
 p.sourceHost!=="static.tcgexchange.kr"||p.sourceAppearsPokemonKoreaOfficial||
 !p.ownedUrl.startsWith("https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/")||
 h.sourceHost!==p.sourceHost||h.ownedUrl!==p.ownedUrl||
 h.printedLanguage!=="Japanese"||h.koreanPrintImageVerified!==false||
 h.artworkThemesReviewed!==false||!h.holdReason?.trim()||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.preExistingThemeMemberships?.length!==0)
 throw Error("Japanese source must remain held "+key);
}
if(JSON.stringify(set.cards)!==masterBefore||
 old.some((c,i)=>JSON.stringify(c)!==snapshots[i]))
 throw Error("S1H original card records/previous themed slots changed");
meta.artworkReviewedCardCount=68;meta.reviewedCardCount=68;
meta.verifiedKoreanPrintImageCount=68;meta.verifiedSelfHostedImageCount=68;
meta.reviewedRanges=["001-030","031-060","061-068"];
meta.reviewedThemes=THEMES;meta.newlyAddedThemeSlotCount=110;
meta.preservedExistingThemeSlotCount=0;meta.heldNonKoreanSourceCount=7;
meta.heldRange="069-075";meta.partialReviewEvidence=REVIEW;
meta.imagePreflightEvidence=PROOF;meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="S1H 실드 한국어 인쇄 68/75장 12테마 검수, 신규 테마 누적 110건, 기존 테마 0건 확인. 일본어 원본 069-075 7건은 한국어 인쇄 확인 전 엄격 보류. 카드 DB·이미지·보유 상태와 S2a/S2/S3/S6K 보류 그대로 유지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global S6K evidence hold modified");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:75,
  KoreanPrintArtworksReviewed:68,verifiedKoreanPrintImagesCumulative:68,
  ownedImageCandidatesDecodedInLastRange:15,verifiedKoreanImagesLastRange:8,
  heldJapanesePrintImages:7,heldRange:"069-075",
  newlyAddedThemeSlotsThisBatch:9,newlyAddedThemeSlotsCumulative:110,
  existingThemeSlotsPreserved:0,
  reviewedRanges:["001-030","031-060","061-068"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,ownedImagePreflight:PROOF,
  remainingImageAndArtworkCount:7})
]);
console.log(JSON.stringify({set:CODE,KoreanPrintArtworksReviewed:68,total:75,
heldJapanesePrintCount:7,newlyAddedThemeSlotsThisBatch:9,
cumulativeNewThemeSlots:110,originalThemeSlotsPreserved:0,
canonicalAndOwnershipUnchanged:true}));
