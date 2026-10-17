import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s2",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s2-091-115-approved16-held9-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s2/091-115/visual-index.json";
const PREVIOUS="data/audits/theme-s2-061-090-progress-20261017.json";
const PROGRESS="data/audits/theme-s2-091-115-approved16-held9-progress-20261017.json";
const NEXT="S2 107-115 Korean-printed HR/UR images required before strict complete";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage,s3progress]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const candidate=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(candidate.length!==1||candidate[0].cards?.length!==115)
 throw Error("Canonical S2 115 card identities changed");
const set=candidate[0],keysBefore=JSON.stringify(set.cards.map(c=>c.code));
const metaKey=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(!metaKey)throw Error("S2 earlier 90 card artwork checkpoint absent");
const meta=status.reviews[metaKey];
if(meta.artworkReviewedCardCount===106&&meta.newlyAddedThemeSlotCount===151&&
 meta.reviewedRanges?.includes("091-106")){
 console.log("S2 091-106 Korean artwork already applied: safe no-op");process.exit(0);
}
if(meta.artworkReviewedCardCount!==90||meta.reviewedCardCount!==90||
 meta.newlyAddedThemeSlotCount!==135||meta.preservedExistingThemeSlotCount!==0||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060","061-090"])||
 meta.status!=="in_progress"||meta.complete!==false||
 previous.totalMasterCards!==115||previous.KoreanPrintArtworksReviewed!==90||
 previous.newlyAddedThemeSlotsCumulative!==135||previous.remainingImageAndArtworkCount!==25||
 previous.globalCheckpointPreserved!==GLOBAL||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="in_progress"||
 s3progress.KoreanPrintArtworksReviewed!==110||s3progress.heldNonKoreanSourceCount!==9)
 throw Error("S2 90/115 prior checkpoint or S3/S6K image-hold baseline changed");
if(review.schemaVersion!==1||review.status!=="partial_manual_Korean_art_12_theme_reviewed_hold_9"||
 review.set!==CODE||review.range!=="091-115"||review.approvedRange!=="091-106"||
 review.heldRange!=="107-115"||review.approvedKoreanArtworkCount!==16||
 review.heldNonKoreanPrintCount!==9||review.ownedCDNImagesDecodedInFullRange!==25||
 review.officialKoreanSourcesApproved!==16||review.nonOfficialJapaneseSourcesHeld!==9||
 review.existingThemesInFullRange!==0||review.themeAdditions!==16||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.all12ThemesInspectedForApprovedItems||!review.noMasterOrOwnershipChanges||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 review.items?.length!==16||review.heldCards?.length!==9||
 proof.set!==CODE||proof.range!=="091-115"||proof.masterCanonicalCards!==115||
 proof.checkedCardCount!==25||proof.ownedImageDecodedCount!==25||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==25||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S2 Korean16/Japanese9 visual source evidence insufficient");
const groups=new Map(themes.groups.map(x=>[x.code,x]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("12 themes unexpectedly changed");
const previousEntries=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const snapshots=previousEntries.map(x=>JSON.stringify(x));
if(previousEntries.length!==135)throw Error("Earlier S2 135 thematic records changed");
if(previousEntries.some(c=>{const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);return n>=91&&n<=115;}))
 throw Error("Unexpected theme entries in S2 091–115 must be reconciled first");
const count=Object.fromEntries(THEMES.map(t=>[t,0])),added=[];
for(let i=0;i<16;i++){
 const n=i+91,num=String(n).padStart(3,"0"),id="S2_"+num;
 const card=set.cards[n-1],p=proof.cards[i],r=review.items[i];
 if(!card||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s2_"+num+"/096"||
 String(p.code||"").toLowerCase()!=="s2_"+num+"/096"||
 String(r.cardKey||"").toUpperCase()!==id||card.name!==p.name||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S2/S2_"+num+".png"||
 p.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S2/S2_"+num+".webp"||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[a-f0-9]{64}$/.test(p.imageCheck?.sha256||"")||
 p.preExistingThemeMemberships?.length!==0||r.preExistingThemeRecordsPreserved?.length!==0)
 throw Error("S2 final approved Korean print invalid at "+num);
 const selected=new Set(r.matchedThemes||[]);
 if(selected.size!==r.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!selected.has(t)))
 throw Error("Unsupported 12-theme category "+num);
 for(const t of selected){
  const group=groups.get(t);
  if(group.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===id))
   throw Error("Duplicate S2 final approved theme "+id+"/"+t);
  group.cards.push({code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"반역크래시",cardNumber:num+"/096",
   rarity:card.rarity||"",category:r.categories[t],image:p.ownedUrl,
   evidence:"한국어 인쇄 S2 "+num+"/096 공식 원본과 DCB 자체 보관 WebP 시각검수. "+
    r.artObservation+" ("+REVIEW+")."});
  count[t]++;added.push({n,theme:t});
 }
}
for(let i=0;i<9;i++){
 const n=107+i,num=String(n).padStart(3,"0"),card=set.cards[n-1],p=proof.cards[16+i],
 h=review.heldCards[i];
 if(!card||!p||!h||p.canonicalOrder!==n||h.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s2_"+num+"/096"||
 String(p.code||"").toLowerCase()!=="s2_"+num+"/096"||
 h.cardKey!=="S2_"+num||p.name!==card.name||h.name!==card.name||
 p.sourceHost!=="static.tcgexchange.kr"||p.sourceAppearsPokemonKoreaOfficial!==false||
 p.imageCheck?.status!=="decoded_region_unverified"||
 h.status!=="hold_nonKorean_print_source"||
 h.observedPrintLanguage!=="Japanese"||p.preExistingThemeMemberships?.length!==0)
 throw Error("S2 non-Korean image slot mistakenly approved at "+num);
}
if(added.length!==16||THEMES.some(t=>count[t]!==review.themeCounts?.[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==keysBefore||
 previousEntries.some((x,i)=>JSON.stringify(x)!==snapshots[i]))
 throw Error("Approved16 theme total or earlier135 artwork keys changed");
meta.artworkReviewedCardCount=106;meta.reviewedCardCount=106;
meta.verifiedKoreanPrintImageCount=106;meta.verifiedSelfHostedImageCount=106;
meta.reviewedRanges=["001-030","031-060","061-090","091-106"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=151;meta.preservedExistingThemeSlotCount=0;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.heldKoreanPrintImageCardCodes=review.heldCards.map(h=>h.cardKey);
meta.note="S2 반역크래시 115장 중 한국어 인쇄 106장 12테마 완료. 마지막 107-115 9장은 자체 CDN에 저장됐지만 원본에 일본어가 인쇄되어 한국판 미승인 보류. 총 신규 테마 151건. 한국판 9장 확보 이전 complete 금지; canonical 마스터와 사용자 보유 키 불변.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("S6K historical Korean print hold unexpectedly changed");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:115,
  KoreanPrintArtworksReviewed:106,sourceImagesSelfHostedDecodedAndKoreanVerified:106,
  newlyAddedThemeSlotsThisBatch:16,newlyAddedThemeSlotsCumulative:151,
  existingThemeSlotsPreserved:0,reviewedRanges:["001-030","031-060","061-090","091-106"],
  status:"in_progress",complete:false,nextStart:NEXT,
  heldNonKoreanSourceCardCodes:review.heldCards.map(h=>h.cardKey),
  heldNonKoreanSourceCount:9,globalCheckpointPreserved:GLOBAL,
  manualReview:REVIEW,ownedImagePreflight:PROOF,remainingImageAndArtworkCount:9})
]);
console.log(JSON.stringify({set:CODE,reviewedKorean:106,total:115,
 totalNewThemeSlots:151,heldJapanesePrintSources:9,complete:false,ownershipUnchanged:true}));
