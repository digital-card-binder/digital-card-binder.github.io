import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n","utf8");
const CODE="sm1m",DATE="2026-10-17";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-sm1m-061-073-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/sm1m/061-073/visual-index.json";
const PREVIOUS="data/audits/theme-sm1m-031-060-progress-20261017.json";
const PROGRESS="data/audits/theme-sm1m-061-073-approved9-held4-progress-20261017.json";
const NEXT="SM1M 문 컬렉션 067,069,071,073 자체 한국판 이미지 4건 복구·검증 전 보류";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset",
"reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage,
 s1w,s1h,s1a,sm1s,s2a,s2,s3]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s1w-061-075-approved8-held7-progress-20261017.json"),
 read("data/audits/theme-s1h-061-075-approved8-held7-progress-20261017.json"),
 read("data/audits/theme-s1a-061-086-approved18-held8-progress-20261017.json"),
 read("data/audits/theme-sm1s-061-073-approved9-held4-progress-20261017.json"),
 read("data/audits/theme-s2a-061-086-approved18-held8-progress-20261017.json"),
 read("data/audits/theme-s2-091-115-approved16-held9-progress-20261017.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const setRows=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(setRows.length!==1||setRows[0].cards?.length!==73)
 throw Error("SM1M canonical 73-card master is not intact");
const set=setRows[0], masterBefore=JSON.stringify(set.cards);
const metaKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
const meta=status.reviews?.[metaKey];
if(!meta)throw Error("SM1M earlier review metadata missing");
if(meta.artworkReviewedCardCount===69&&meta.newlyAddedThemeSlotCount===107&&
 meta.heldArchiveMissingCount===4&&meta.reviewedRanges?.includes("061-066")&&meta.reviewedRanges?.includes("068")&&meta.reviewedRanges?.includes("070")&&meta.reviewedRanges?.includes("072")){
 console.log("SM1M 061-069 already Korean-art reviewed; four missing archives held: no-op");
 process.exit(0);
}
if(meta.artworkReviewedCardCount!==60||meta.reviewedCardCount!==60||
 meta.newlyAddedThemeSlotCount!==98||meta.preservedExistingThemeSlotCount!==0||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 meta.status!=="in_progress"||meta.complete!==false||
 previous.totalMasterCards!==73||previous.KoreanPrintArtworksReviewed!==60||
 previous.newlyAddedThemeSlotsCumulative!==98||previous.remainingImageAndArtworkCount!==13||
 previous.globalCheckpointPreserved!==GLOBAL||
 coverage.sets.find(s=>String(s.code||"").toLowerCase()===CODE)?.status!=="in_progress"||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 s1w.KoreanPrintArtworksReviewed!==68||s1w.heldJapanesePrintImages!==7||
 s1h.KoreanPrintArtworksReviewed!==68||s1h.heldJapanesePrintImages!==7||
 s1a.KoreanPrintArtworksReviewed!==78||s1a.heldJapanesePrintImages!==8||
 sm1s.KoreanPrintArtworksReviewed!==69||sm1s.heldArchiveMissingCount!==4||
 s2a.KoreanPrintArtworksReviewed!==78||s2a.heldJapanesePrintImages!==8||
 s2.KoreanPrintArtworksReviewed!==106||s2.heldNonKoreanSourceCount!==9||
 s3.KoreanPrintArtworksReviewed!==110||s3.heldNonKoreanSourceCount!==9)
 throw Error("SM1M previous review or protected held-source checkpoint changed");
if(review.schemaVersion!==1||review.set!==CODE||review.range!=="061-073"||
 review.status!=="partial_Korean_9_held_archive_missing_4"||
 !review.all12ThemesInspectedForApproved||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.canonicalCardsInRange!==13||review.artworksReviewed!==9||
 review.verifiedKoreanPrintImagesInRange!==9||review.ownedCDNImagesDecoded!==9||
 review.officialSourceCardsInRange!==6||review.thirdPartyKoreanPrintCardsInRange!==3||
 review.heldArchiveMissingCount!==4||review.existingThemesInThisRange!==0||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.noMasterOrOwnershipChanges||review.globalCheckpointPreserved!==GLOBAL||
 review.imagePreflight!==PROOF||review.themeAdditions!==9||
 review.items?.length!==9||review.held?.length!==4||
 proof.set!==CODE||proof.range!=="061-073"||proof.masterCanonicalCards!==73||
 proof.checkedCardCount!==13||proof.ownedImageDecodedCount!==9||
 proof.ownedImageMissingCount!==4||proof.preExistingThemeMemberships!==0||
 proof.sourceHostCounts?.["cards.image.pokemonkorea.co.kr"]!==6||
 proof.sourceHostCounts?.["k-tcgpanda.com"]!==3||
 proof.sourceHostCounts?.["tcgbox.co.kr"]!==4||
 proof.cards?.length!==13||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("SM1M last 13 artwork review or archive source evidence invalid");
const groups=new Map(themes.groups.map(x=>[x.code,x]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("Theme registry changed");
const previousEntries=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const oldSnapshots=previousEntries.map(x=>JSON.stringify(x));
if(previousEntries.length!==98||previousEntries.some(c=>{
 const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);
 return n>=61&&n<=73;
}))throw Error("Original 100 SM1M theme memberships changed");
const counts=Object.fromEntries(THEMES.map(t=>[t,0]));
let added=0;
const approvedNumbers=[61,62,63,64,65,66,68,70,72];
const heldNumbers=[67,69,71,73];
if(JSON.stringify(review.heldCanonicalOrders)!==JSON.stringify(heldNumbers))
 throw Error("SM1M held sparse indices no longer match review");
for(let i=0;i<approvedNumbers.length;i++){
 const n=approvedNumbers[i],num=String(n).padStart(3,"0"),key="SM1M_"+num;
 const c=set.cards[n-1],p=proof.cards[n-61],rv=review.items[i];
 const official=n<=66,host=official?"cards.image.pokemonkorea.co.kr":"k-tcgpanda.com";
 const sourceEvidence=official?"pokemonkorea-catalogue-url-and-dcb-owned-decoded-image":
   "k-tcgpanda-korean-printed-card-and-dcb-owned-decoded-image";
 const officialSource="https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM1M/SM1M_"+num+".png";
 const officialOwned="https://dcb-card-images-legacy-2026.pages.dev/data/wmimages/SM/SM1M/SM1M_"+num+".webp";
 if(!c||!p||!rv||p.canonicalOrder!==n||rv.canonicalOrder!==n||
 String(c.code||"").toLowerCase()!=="sm1m_"+num+"/060"||
 String(p.code||"").toLowerCase()!=="sm1m_"+num+"/060"||
 rv.cardKey!==key||p.name!==c.name||!rv.koreanPrintImageVerified||
 !rv.artObservation?.trim()||rv.sourceEvidence!==sourceEvidence||
 p.sourceHost!==host||p.sourceAppearsPokemonKoreaOfficial!==official||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||!/^[0-9a-f]{64}$/.test(p.imageCheck?.sha256||"")||
 p.preExistingThemeMemberships?.length!==0||
 rv.preExistingThemeRecordsPreserved?.length!==0)
 throw Error("SM1M selected card print or image origin mismatch "+key);
 if(official){
  if(p.sourceUrl!==officialSource||p.ownedUrl!==officialOwned||
    p.imageCheck.dimensions?.[0]!==420||p.imageCheck.dimensions?.[1]!==586)
   throw Error("Official Korean image identity invalid "+key);
 }else{
  if(!p.sourceUrl.includes("_KOR.jpg")||
   !p.ownedUrl.startsWith("https://dcb-card-images-legacy-2026.pages.dev/external/k-tcgpanda.com/")||
   p.imageCheck.dimensions?.[1]!==400||
   ![280,283,300].includes(p.imageCheck.dimensions?.[0]))
   throw Error("Third-party Korean-printed owned image identity invalid "+key);
 }
 const selected=rv.matchedThemes||[];
 if(new Set(selected).size!==selected.length||!selected.includes("color")||
  selected.some(t=>!THEMES.includes(t)||!rv.categories?.[t]?.trim())||
  Object.keys(rv.categories||{}).length!==selected.length)
  throw Error("SM1M incorrect 12-theme selection "+key);
 for(const t of selected){
  const g=groups.get(t);
  if(g.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===key))
   throw Error("SM1M duplicate theme "+key+"/"+t);
  g.cards.push({code:key,name:c.name,series:"SM",set:set.code,
   setName:set.displayName||"문 컬렉션",cardNumber:num+"/060",
   rarity:c.rarity||"",category:rv.categories[t],image:p.ownedUrl,
   evidence:"SM1M 한글 인쇄 "+num+"/060 "+(official?"포켓몬코리아 공식":"K-TCG판다 한국어 인쇄")+
    " 원본 및 DCB 자체 보관 WebP 육안 확인. "+rv.artObservation+" ("+REVIEW+")."});
  counts[t]++;added++;
 }
}
if(added!==9||THEMES.some(t=>counts[t]!==review.themeCounts?.[t]))
 throw Error("SM1M verified Korean print thematic membership count drift");
for(let i=0;i<4;i++){
 const n=heldNumbers[i],num=String(n).padStart(3,"0"),key="SM1M_"+num;
 const c=set.cards[n-1],p=proof.cards[n-61],h=review.held[i];
 if(!c||!p||!h||p.canonicalOrder!==n||h.canonicalOrder!==n||
 String(c.code||"").toLowerCase()!=="sm1m_"+num+"/060"||
 p.name!==c.name||h.name!==c.name||h.cardKey!==key||
 p.sourceHost!=="tcgbox.co.kr"||p.sourceAppearsPokemonKoreaOfficial||
 h.sourceHost!==p.sourceHost||h.ownedUrl!==p.ownedUrl||
 !p.ownedUrl.startsWith("https://dcb-card-images-legacy-2026.pages.dev/external/tcgbox.co.kr/")||
 p.imageCheck?.status!=="owned_archive_missing"||
 h.printedLanguage!=="unverified"||h.koreanPrintImageVerified!==false||
 h.artworkThemesReviewed!==false||!h.holdReason?.trim()||
 p.preExistingThemeMemberships?.length!==0)
 throw Error("SM1M owned archive missing must remain held "+key);
}
if(JSON.stringify(set.cards)!==masterBefore||
 previousEntries.some((x,i)=>JSON.stringify(x)!==oldSnapshots[i]))
 throw Error("SM1M canonical card or prior theme record unexpectedly changed");
meta.artworkReviewedCardCount=69;meta.reviewedCardCount=69;
meta.verifiedKoreanPrintImageCount=69;meta.verifiedSelfHostedImageCount=69;
meta.reviewedRanges=["001-030","031-060","061-066","068","070","072"];
meta.reviewedThemes=THEMES;meta.newlyAddedThemeSlotCount=107;
meta.preservedExistingThemeSlotCount=0;meta.heldArchiveMissingCount=4;
meta.heldRange="067,069,071,073";meta.partialReviewEvidence=REVIEW;
meta.imagePreflightEvidence=PROOF;meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="SM1M 문 컬렉션 69/73장 한글 인쇄 시각검수, 테마 신규 107건. 061-066 공식 6장과 068,070,072 제3자 한글 원본 자체보관 3장 승인. 067,069,071,073 자체 CDN 이미지 파일 미확보/디코드 실패 4건 보류, 언어 미판정. 전체 완료 선언 금지. 마스터/보유 및 다른 일본어판 이미지 보류 보호.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global source hold state changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:73,
  KoreanPrintArtworksReviewed:69,verifiedKoreanPrintImagesCumulative:69,
  verifiedOfficialKoreanInLastRange:6,verifiedThirdPartyKoreanInLastRange:3,
  ownedImageCandidatesDecodedInLastRange:9,heldArchiveMissingCount:4,
  heldRange:"067,069,071,073",newlyAddedThemeSlotsThisBatch:9,
  newlyAddedThemeSlotsCumulative:107,existingThemeSlotsPreserved:0,
  reviewedRanges:["001-030","031-060","061-066","068","070","072"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:4})
]);
console.log(JSON.stringify({set:CODE,koreanReviewed:69,total:73,
 lastRangeOfficialKorean:6,lastRangeThirdPartyKorean:3,heldArchiveMissing:4,
 cumulativeThemeAdditions:107,masterAndOwnershipUnchanged:true}));
