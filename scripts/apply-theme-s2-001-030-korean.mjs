import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s2",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s2-001-030-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s2/001-030/visual-index.json";
const PROGRESS="data/audits/theme-s2-001-030-progress-20261017.json";
const NEXT="S2 한국판 031-060 카드 이미지 출처·실물·12테마 시각검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage,s3progress]=await Promise.all([
 read(REVIEW),read(PROOF),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const sets=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(sets.length!==1||sets[0].cards?.length!==115)
 throw Error("S2 canonical 115 cards changed");
const set=sets[0],initialCodes=JSON.stringify(set.cards.map(c=>c.code));
const oldKey=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(oldKey&&status.reviews[oldKey].artworkReviewedCardCount===30&&
 status.reviews[oldKey].newlyAddedThemeSlotCount===43&&
 status.reviews[oldKey].reviewedRanges?.includes("001-030")){
 console.log("S2 first30 already applied safely");process.exit(0);
}
if(oldKey||coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="pending"||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 s3progress.KoreanPrintArtworksReviewed!==110||s3progress.heldNonKoreanSourceCount!==9||
 s3progress.heldNonKoreanSourceCardCodes?.length!==9)
 throw Error("Initial S2 baseline, S3 Japanese image holds or global S6K checkpoint changed");
if(review.schemaVersion!==1||review.set!==CODE||review.range!=="001-030"||
 review.status!=="manual_Korean_art_12_theme_reviewed"||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.officialSourceCardsInRange!==30||review.existingThemesInThisRange!==0||
 review.themeAdditions!==43||review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.all12ThemesInspected||!review.noMasterOrOwnershipChanges||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||review.items?.length!==30||
 proof.set!==CODE||proof.range!=="001-030"||proof.masterCanonicalCards!==115||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S2 first 30 verified Korean print evidence missing or inconsistent");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("Twelve groups changed");
const previous=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
if(previous.length!==0)throw Error("Previously classified S2 artwork unexpected");
const add=[],count=Object.fromEntries(THEMES.map(t=>[t,0]));
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),id="S2_"+num;
 const card=set.cards[i],p=proof.cards[i],r=review.items[i];
 if(!card||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s2_"+num+"/096"||
 String(p.code||"").toLowerCase()!=="s2_"+num+"/096"||
 String(r.cardKey||"").toUpperCase()!==id||p.name!==card.name||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S2/S2_"+num+".png"||
 p.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S2/S2_"+num+".webp"||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[a-f0-9]{64}$/.test(p.imageCheck?.sha256||"")||
 p.preExistingThemeMemberships?.length!==0||r.preExistingThemeRecordsPreserved?.length!==0)
 throw Error("Original S2 Korean source/owned image mismatch "+num);
 const selected=new Set(r.matchedThemes||[]);
 if(selected.size!==r.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!selected.has(t)))
 throw Error("S2 invalid theme record "+num);
 for(const t of selected){
  const g=groups.get(t);
  if(g.cards.some(c=>String(c.code||"").toUpperCase().split("/")[0]===id))
   throw Error("Duplicate S2 "+id+"/"+t);
  g.cards.push({code:id,name:card.name,series:"S",set:set.code,
    setName:set.displayName||"반역크래시",cardNumber:num+"/096",
    rarity:card.rarity||"",category:r.categories[t],image:p.ownedUrl,
    evidence:"포켓몬코리아 한국어 인쇄 S2 "+num+"/096 및 DCB 자체보관 WebP 시각검수. "+
     r.artObservation+" ("+REVIEW+"). 원본 마스터의 공란 레어도는 추정해 보완하지 않음."});
  add.push({n,theme:t});count[t]++;
 }
}
if(add.length!==43||THEMES.some(t=>count[t]!==review.themeCounts?.[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==initialCodes)
 throw Error("S2 review counts or master identity modified");
status.reviews[CODE]={artworkReviewedCardCount:30,reviewedCardCount:30,
 verifiedKoreanPrintImageCount:30,verifiedSelfHostedImageCount:30,
 reviewedRanges:["001-030"],reviewedThemes:THEMES,newlyAddedThemeSlotCount:43,
 preservedExistingThemeSlotCount:0,partialReviewEvidence:REVIEW,imagePreflightEvidence:PROOF,
 nextStart:NEXT,reviewedAt:DATE,status:"in_progress",complete:false,
 note:"S2 반역크래시 115장 중 한국판 001-030 30장 자체보관 이미지와 12테마 육안검수 완료. 신규 테마 43건. 나머지 85장 전수검수 전 완료 금지. S3 일본어 소스 9장, S6K 별도 보류 유지. 카드 정체성·사용자 보유 키 변경 없음."};
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 s3progress.heldNonKoreanSourceCount!==9)
 throw Error("Historic held source evidence unexpectedly changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:115,
  KoreanPrintArtworksReviewed:30,sourceImagesSelfHostedDecoded:30,
  newlyAddedThemeSlotsThisBatch:43,newlyAddedThemeSlotsCumulative:43,
  existingThemeSlotsPreserved:0,reviewedRanges:["001-030"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:85})
]);
console.log(JSON.stringify({set:CODE,reviewed:30,total:115,newThemeSlots:43,
 masterAndOwnershipUntouched:true,S3HeldNinePreserved:true,S6KHeldFourPreserved:true}));
