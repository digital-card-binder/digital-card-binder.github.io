import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s2",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s2-061-090-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s2/061-090/visual-index.json";
const PREVIOUS="data/audits/theme-s2-031-060-progress-20261017.json";
const PROGRESS="data/audits/theme-s2-061-090-progress-20261017.json";
const NEXT="S2 한국판 091–115 12테마 원본 이미지 검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage,s3progress]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const setRows=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(setRows.length!==1||setRows[0].cards?.length!==115)
 throw Error("Original S2 master set count 115 changed");
const set=setRows[0],masterCodes=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(!key)throw Error("Earlier S2 thematic checkpoint unavailable");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===90&&meta.newlyAddedThemeSlotCount===135&&
 meta.reviewedRanges?.includes("061-090")){
 console.log("S2 061-090 already applied safely");process.exit(0);
}
if(meta.artworkReviewedCardCount!==60||meta.reviewedCardCount!==60||
 meta.newlyAddedThemeSlotCount!==90||meta.preservedExistingThemeSlotCount!==0||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 meta.status!=="in_progress"||meta.complete!==false||
 previous.totalMasterCards!==115||previous.KoreanPrintArtworksReviewed!==60||
 previous.newlyAddedThemeSlotsCumulative!==90||previous.remainingImageAndArtworkCount!==55||
 previous.globalCheckpointPreserved!==GLOBAL||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="in_progress"||
 s3progress.KoreanPrintArtworksReviewed!==110||s3progress.heldNonKoreanSourceCount!==9)
 throw Error("S2 prior 60 artworks, S3 Korean-source hold or S6K global hold changed");
if(review.schemaVersion!==1||review.set!==CODE||review.range!=="061-090"||
 review.status!=="manual_Korean_art_12_theme_reviewed"||
 review.artworksReviewed!==30||review.verifiedKoreanPrintImagesInRange!==30||
 review.ownedCDNImagesDecoded!==30||review.officialSourceCardsInRange!==30||
 review.existingThemesInThisRange!==0||review.themeAdditions!==45||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.noMasterOrOwnershipChanges||!review.all12ThemesInspected||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||review.items?.length!==30||
 proof.set!==CODE||proof.range!=="061-090"||proof.masterCanonicalCards!==115||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S2 third-30 Korean print or 12-theme evidence unavailable");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("12 independent themes altered");
const old=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const oldEvidence=old.map(c=>JSON.stringify(c));
if(old.length!==90)throw Error("S2 prior 90 theme cards are not preserved");
if(old.some(c=>{const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);return n>=61&&n<=90;}))
 throw Error("S2 061-090 already has other unaccounted thematic entries");
const counts=Object.fromEntries(THEMES.map(t=>[t,0])),added=[];
for(let i=0;i<30;i++){
 const n=i+61,num=String(n).padStart(3,"0"),id="S2_"+num;
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
 throw Error("S2 third-30 original Korean card/owned image mismatch "+num);
 const selected=new Set(r.matchedThemes||[]);
 if(selected.size!==r.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!selected.has(t)))
 throw Error("Unexpected independent theme classification "+num);
 for(const t of selected){
  const g=groups.get(t);
  if(g.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===id))
   throw Error("Existing duplicate S2 theme "+id+"/"+t);
  g.cards.push({code:id,name:card.name,series:"S",set:set.code,
    setName:set.displayName||"반역크래시",cardNumber:num+"/096",
    rarity:card.rarity||"",category:r.categories[t],image:p.ownedUrl,
    evidence:"포켓몬코리아 한국어 인쇄 S2 "+num+"/096 원본·DCB 자체보관 WebP 시각검수. "+
     r.artObservation+" ("+REVIEW+")."});
  counts[t]++;added.push({n,theme:t});
 }
}
if(added.length!==45||THEMES.some(t=>counts[t]!==review.themeCounts?.[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==masterCodes||
 old.some((x,i)=>JSON.stringify(x)!==oldEvidence[i]))
 throw Error("S2 third batch aggregate count or previous 90 themes altered");
meta.artworkReviewedCardCount=90;meta.reviewedCardCount=90;
meta.verifiedKoreanPrintImageCount=90;meta.verifiedSelfHostedImageCount=90;
meta.reviewedRanges=["001-030","031-060","061-090"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=135;meta.preservedExistingThemeSlotCount=0;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.note="S2 반역크래시 115장 중 한국판 001–090 90장 자체보관 이미지 12테마 육안 검수. 이번 45건/신규 누적 135건. 나머지 25장 검증 전 strict complete 금지. S3 일본어 이미지 9장/S6K 보류 4장 유지, 모든 master/보유 키 불변.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("S6K held source checkpoint changed");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:115,
  KoreanPrintArtworksReviewed:90,sourceImagesSelfHostedDecoded:90,
  newlyAddedThemeSlotsThisBatch:45,newlyAddedThemeSlotsCumulative:135,
  existingThemeSlotsPreserved:0,reviewedRanges:["001-030","031-060","061-090"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:25})
]);
console.log(JSON.stringify({set:CODE,reviewed:90,total:115,newThemeSlotsThisBatch:45,
 totalNewThemeSlots:135,olderThemeRowsPreserved:90,masterAndOwnershipUnchanged:true}));
