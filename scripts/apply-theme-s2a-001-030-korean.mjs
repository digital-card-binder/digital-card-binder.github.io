import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s2a",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s2a-001-030-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s2a/001-030/visual-index.json";
const PROGRESS="data/audits/theme-s2a-001-030-progress-20261017.json";
const NEXT="S2a 한국판 031-060 자체호스팅 이미지 및 12테마 육안검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage,s2progress,s3progress]=await Promise.all([
 read(REVIEW),read(PROOF),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s2-091-115-approved16-held9-progress-20261017.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const matched=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(matched.length!==1||matched[0].cards?.length!==86)
 throw Error("Original S2a 86-card canonical set changed");
const set=matched[0],masterKeys=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(key&&status.reviews[key].artworkReviewedCardCount===30&&
 status.reviews[key].newlyAddedThemeSlotCount===46&&
 status.reviews[key].reviewedRanges?.includes("001-030")){
 console.log("S2a first 30 already classified; safe no-op");process.exit(0);
}
if(key||coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="pending"||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 s2progress.KoreanPrintArtworksReviewed!==106||s2progress.heldNonKoreanSourceCount!==9||
 s3progress.KoreanPrintArtworksReviewed!==110||s3progress.heldNonKoreanSourceCount!==9)
 throw Error("S2a first-review baseline or S2/S3/S6K held Korean sources changed");
if(review.schemaVersion!==1||review.set!==CODE||review.range!=="001-030"||
 review.status!=="manual_Korean_art_12_theme_reviewed"||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.officialSourceCardsInRange!==30||review.existingThemesInThisRange!==0||
 review.preExistingThemesOutsideRangeProtected!==true||review.themeAdditions!==46||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.all12ThemesInspected||!review.noMasterOrOwnershipChanges||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||review.items?.length!==30||
 proof.set!==CODE||proof.range!=="001-030"||proof.masterCanonicalCards!==86||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S2a first30 Korean artwork or 12-theme evidence invalid");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("Theme groups modified");
const previous=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const snapshots=previous.map(c=>JSON.stringify(c));
if(previous.length!==3)throw Error("Expected exactly three prior S2a theme memberships");
if(previous.some(c=>{const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);return n>=1&&n<=30;}))
 throw Error("Unexpected S2a prior theme slot in 001-030");
const counts=Object.fromEntries(THEMES.map(t=>[t,0])),added=[];
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),id="S2A_"+num;
 const card=set.cards[i],p=proof.cards[i],r=review.items[i];
 if(!card||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s2a_"+num+"/070"||
 String(p.code||"").toLowerCase()!=="s2a_"+num+"/070"||
 String(r.cardKey||"").toUpperCase()!==id||p.name!==card.name||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S2a/S2a_"+num+".png"||
 p.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S2a/S2a_"+num+".webp"||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[a-f0-9]{64}$/.test(p.imageCheck?.sha256||"")||
 p.preExistingThemeMemberships?.length!==0||r.preExistingThemeRecordsPreserved?.length!==0)
 throw Error("S2a first30 Korean print identity/CDN evidence missing "+num);
 const selected=new Set(r.matchedThemes||[]);
 if(selected.size!==r.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid S2a independent theme judgement "+num);
 for(const theme of selected){
  const group=groups.get(theme);
  if(group.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===id))
   throw Error("Duplicate existing S2a theme slot "+id+"/"+theme);
  group.cards.push({code:"S2a_"+num,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"폭염워커",cardNumber:num+"/070",
   rarity:card.rarity||"",category:r.categories[theme],image:p.ownedUrl,
   evidence:"포켓몬코리아 한국어 S2a "+num+"/070 공식 인쇄 이미지 및 DCB 자체 보관 WebP 검수. "+
    r.artObservation+" ("+REVIEW+")."});
  counts[theme]++;added.push({n,theme});
 }
}
if(added.length!==46||THEMES.some(t=>counts[t]!==review.themeCounts?.[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==masterKeys||
 previous.some((x,i)=>JSON.stringify(x)!==snapshots[i]))
 throw Error("S2a 46 new entries or old three thematic memberships altered");
status.reviews[CODE]={artworkReviewedCardCount:30,reviewedCardCount:30,
 verifiedKoreanPrintImageCount:30,verifiedSelfHostedImageCount:30,
 reviewedRanges:["001-030"],reviewedThemes:THEMES,newlyAddedThemeSlotCount:46,
 preservedExistingThemeSlotCount:3,partialReviewEvidence:REVIEW,imagePreflightEvidence:PROOF,
 nextStart:NEXT,reviewedAt:DATE,status:"in_progress",complete:false,
 note:"S2a 폭염워커 86장 중 001–030 한국어 인쇄 30장 시각검수, 신규 46 테마 항목 추가. 기존 S2a 3건 보호. 잔여 56장 완료 전 strict complete 금지. S2 9장/S3 9장/S6K 4장 이미지 보류·유저별 보유 기록 보존."};
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Historic S6K evidence hold modified");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:86,
  KoreanPrintArtworksReviewed:30,sourceImagesSelfHostedDecoded:30,
  newlyAddedThemeSlotsThisBatch:46,newlyAddedThemeSlotsCumulative:46,
  existingThemeSlotsPreserved:3,reviewedRanges:["001-030"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:56})
]);
console.log(JSON.stringify({set:CODE,reviewed:30,total:86,addedThemeSlots:46,
 existingThemeEntriesPreserved:3,masterAndOwnershipUnchanged:true}));
