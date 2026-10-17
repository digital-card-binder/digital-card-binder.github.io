import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s3",DATE="2026-10-17";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s3-091-119-approved20-held9-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s3/091-119/visual-index.json";
const PREVIOUS="data/audits/theme-s3-061-090-progress-20261017.json";
const PROGRESS="data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json";
const NEXT="S3 111-119 Korean-printed source images required before final strict completion";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),
 read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json")
]);
const matches=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(matches.length!==1||matches[0].cards?.length!==119)throw Error("S3 canonical 119 cards altered");
const set=matches[0],keysBefore=JSON.stringify(set.cards.map(c=>c.code));
const metaKey=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(!metaKey)throw Error("S3 checkpoint absent");
const meta=status.reviews[metaKey];
if(meta.artworkReviewedCardCount===110&&meta.newlyAddedThemeSlotCount===161&&
 meta.reviewedRanges?.includes("091-110")){
 console.log("S3 approved20 + held9 already recorded: safe no-op");process.exit(0);
}
if(meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==90||meta.reviewedCardCount!==90||
 meta.newlyAddedThemeSlotCount!==136||meta.preservedExistingThemeSlotCount!==1||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060","061-090"])||
 previous.totalMasterCards!==119||previous.KoreanPrintArtworksReviewed!==90||
 previous.newlyAddedThemeSlotsCumulative!==136||previous.remainingImageAndArtworkCount!==29||
 previous.existingThemeSlotsPreserved!==1||previous.globalCheckpointPreserved!==GLOBAL||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="in_progress")
 throw Error("S3 090/119 baseline or global S6K held sources changed");
if(review.status!=="partial_manual_Korean_art_12_theme_reviewed_hold_9"||
 review.set!==CODE||review.range!=="091-119"||review.approvedRange!=="091-110"||
 review.heldRange!=="111-119"||review.approvedKoreanArtworkCount!==20||
 review.heldNonKoreanPrintCount!==9||review.ownedCDNImagesDecodedInFullRange!==29||
 review.officialKoreanSourcesApproved!==20||review.nonOfficialJapaneseSourcesHeld!==9||
 review.existingThemesInFullRange!==0||review.themeAdditions!==25||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.all12ThemesInspectedForApprovedItems||!review.noMasterOrOwnershipChanges||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 review.items?.length!==20||review.heldCards?.length!==9||
 proof.set!==CODE||proof.range!=="091-119"||proof.masterCanonicalCards!==119||
 proof.checkedCardCount!==29||proof.ownedImageDecodedCount!==29||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==29||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S3 Korean20, Japanese9 visual evidence mismatch");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("Theme taxonomy altered");
const old=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const snapshots=old.map(c=>JSON.stringify(c));
if(old.length!==137||
 groups.get("reflections").cards.filter(c=>
 String(c.code||"").toUpperCase().split("/")[0]==="S3_079").length!==1)
 throw Error("Existing 136+1 theme baseline or reflection changed");
if(old.some(c=>{const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);
 return Number.isFinite(n)&&n>=91&&n<=119;}))
 throw Error("Unexpected S3 091-119 prior theme cards");

const additions=[],count=Object.fromEntries(THEMES.map(t=>[t,0]));
for(let i=0;i<20;i++){
 const n=i+91,num=String(n).padStart(3,"0"),id="S3_"+num;
 const card=set.cards[n-1],p=proof.cards[i],r=review.items[i];
 if(!card||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s3_"+num+"/100"||
 String(p.code||"").toLowerCase()!=="s3_"+num+"/100"||
 String(r.cardKey||"").toUpperCase()!==id||card.name!==p.name||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S3/S3_"+num+".png"||
 p.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S3/S3_"+num+".webp"||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[0-9a-f]{64}$/.test(p.imageCheck?.sha256||"")||
 p.preExistingThemeMemberships?.length!==0||r.preExistingThemeRecordsPreserved?.length!==0)
 throw Error("Korean S3 091-110 identity or owned-source invalid "+num);
 const chosen=new Set(r.matchedThemes||[]);
 if(chosen.size!==r.matchedThemes?.length||!chosen.has("color")||
 [...chosen].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!chosen.has(t)))
 throw Error("Invalid 12-theme subset "+num);
 for(const theme of chosen){
  const g=groups.get(theme);
  if(g.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===id))
   throw Error("S3 091-110 duplicate "+id+"/"+theme);
  g.cards.push({code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"무한존",cardNumber:num+"/100",
   rarity:card.rarity||"",category:r.categories[theme],image:p.ownedUrl,
   evidence:"S3 한국판 "+num+"/100 포켓몬코리아 등록 원본 및 DCB 자체보관 WebP 이미지 시각검수. "+
    r.artObservation+" ("+REVIEW+")."});
  additions.push({n,theme});count[theme]++;
 }
}
for(let i=0;i<9;i++){
 const n=i+111,num=String(n).padStart(3,"0"),card=set.cards[n-1];
 const p=proof.cards[i+20],held=review.heldCards[i];
 if(!card||!p||!held||p.canonicalOrder!==n||held.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s3_"+num+"/100"||
 String(p.code||"").toLowerCase()!=="s3_"+num+"/100"||
 p.name!==card.name||held.name!==card.name||
 held.cardKey.toUpperCase()!=="S3_"+num||
 p.sourceHost!=="static.tcgexchange.kr"||
 p.sourceAppearsPokemonKoreaOfficial!==false||
 p.imageCheck?.status!=="decoded_region_unverified"||
 held.status!=="hold_nonKorean_print_source"||
 held.observedPrintLanguage!=="Japanese"||p.preExistingThemeMemberships?.length!==0)
 throw Error("Japanese source card incorrectly approved / hold invalid "+num);
}
if(additions.length!==25||THEMES.some(t=>count[t]!==review.themeCounts?.[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==keysBefore||
 old.some((c,i)=>JSON.stringify(c)!==snapshots[i]))
 throw Error("Wrong S3 091-110 additions or overwritten earlier records");
meta.artworkReviewedCardCount=110;meta.reviewedCardCount=110;
meta.verifiedKoreanPrintImageCount=110;meta.verifiedSelfHostedImageCount=110;
meta.reviewedRanges=["001-030","031-060","061-090","091-110"];
meta.reviewedThemes=THEMES;meta.newlyAddedThemeSlotCount=161;
meta.preservedExistingThemeSlotCount=1;meta.partialReviewEvidence=REVIEW;
meta.imagePreflightEvidence=PROOF;meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.heldKoreanPrintImageCardCodes=review.heldCards.map(c=>c.cardKey);
meta.note="S3 119장 중 한국어 인쇄 카드 110장 12테마 완료. 마지막 111-119 9장은 DCB 자체 CDN에 저장됐지만 일본판 원본이므로 한국판 시각 검수 미완료 보류. 신규 테마 누적 161건, 기존 S3_079 반사 1건 보존. 해당 한국판 확인 전 set complete 절대 금지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global S6K held evidence altered");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:119,
  KoreanPrintArtworksReviewed:110,sourceImagesSelfHostedDecodedAndKoreanVerified:110,
  newlyAddedThemeSlotsThisBatch:25,newlyAddedThemeSlotsCumulative:161,
  existingThemeSlotsPreserved:1,reviewedRanges:["001-030","031-060","061-090","091-110"],
  status:"in_progress",complete:false,nextStart:NEXT,
  heldNonKoreanSourceCardCodes:review.heldCards.map(c=>c.cardKey),
  heldNonKoreanSourceCount:9,globalCheckpointPreserved:GLOBAL,
  manualReview:REVIEW,ownedImagePreflight:PROOF,remainingImageAndArtworkCount:9})
]);
console.log(JSON.stringify({set:CODE,reviewedKorean:110,total:119,newSlots:25,
 cumulativeNewSlots:161,heldJapanesePrintSources:9,complete:false,
 allCanonicalAndOwnershipKeysUntouched:true,existingReflectionPreserved:true}));
