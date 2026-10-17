import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n","utf8");
const CODE="sm1m",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-sm1m-031-060-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/sm1m/031-060/visual-index.json";
const PREVIOUS="data/audits/theme-sm1m-001-030-progress-20261017.json";
const PROGRESS="data/audits/theme-sm1m-031-060-progress-20261017.json";
const NEXT="SM1M 문 컬렉션 061-073 한국판 자체 이미지 및 12테마 검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage,s1w,s1h,s1a,sm1s,s2a,s2,s3]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s1w-061-075-approved8-held7-progress-20261017.json"),
 read("data/audits/theme-s1h-061-075-approved8-held7-progress-20261017.json"),
 read("data/audits/theme-s1a-061-086-approved18-held8-progress-20261017.json"),
 read("data/audits/theme-sm1s-061-073-approved9-held4-progress-20261017.json"),
 read("data/audits/theme-s2a-061-086-approved18-held8-progress-20261017.json"),
 read("data/audits/theme-s2-091-115-approved16-held9-progress-20261017.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const matched=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(matched.length!==1||matched[0].cards?.length!==73)
 throw Error("Original SM1M Moon Collection 73-card master changed");
const set=matched[0],masterBefore=JSON.stringify(set.cards);
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(!key)throw Error("SM1M 001-030 progress metadata not found");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===60&&meta.newlyAddedThemeSlotCount===98&&
 meta.reviewedRanges?.includes("031-060")){
 console.log("SM1M 031-060 already safely applied");process.exit(0);
}
if(meta.artworkReviewedCardCount!==30||meta.reviewedCardCount!==30||
 meta.newlyAddedThemeSlotCount!==49||meta.preservedExistingThemeSlotCount!==0||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030"])||
 meta.status!=="in_progress"||meta.complete!==false||
 previous.totalMasterCards!==73||previous.KoreanPrintArtworksReviewed!==30||
 previous.newlyAddedThemeSlotsCumulative!==49||previous.remainingImageAndArtworkCount!==43||
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
 throw Error("SM1M earlier 30 or global Japanese source hold baseline changed");
if(review.schemaVersion!==1||review.set!==CODE||review.range!=="031-060"||
 review.status!=="manual_Korean_art_12_theme_reviewed"||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.officialSourceCardsInRange!==30||review.existingThemesInThisRange!==0||
 !review.preExistingThemesOutsideRangeProtected||review.themeAdditions!==49||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.noMasterOrOwnershipChanges||!review.all12ThemesInspected||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||review.items?.length!==30||
 proof.set!==CODE||proof.range!=="031-060"||proof.masterCanonicalCards!==73||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("SM1M second 30 Korean art visual/owned source proof invalid");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("Theme groups changed");
const old=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const oldSnapshots=old.map(x=>JSON.stringify(x));
if(old.length!==49)
 throw Error("Earlier SM1M 49 theme slots not intact");
const counts=Object.fromEntries(THEMES.map(t=>[t,0]));
let additions=0;
for(let i=0;i<30;i++){
 const n=i+31,num=String(n).padStart(3,"0"),cardKey="SM1M_"+num;
 const c=set.cards[n-1],p=proof.cards[i],r=review.items[i];
 const official="https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM1M/SM1M_"+num+".png";
 const owned="https://dcb-card-images-legacy-2026.pages.dev/data/wmimages/SM/SM1M/SM1M_"+num+".webp";
 if(!c||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(c.code||"").toLowerCase()!=="sm1m_"+num+"/060"||
 String(p.code||"").toLowerCase()!=="sm1m_"+num+"/060"||
 String(r.cardKey||"").toUpperCase()!==cardKey.toUpperCase()||p.name!==c.name||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!==official||p.ownedUrl!==owned||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[0-9a-f]{64}$/.test(p.imageCheck?.sha256||"")||
 JSON.stringify(r.preExistingThemeRecordsPreserved)!==JSON.stringify(p.preExistingThemeMemberships))
 throw Error("Unverified Korean printed card/archive "+cardKey);
 const selected=r.matchedThemes||[];
 if(new Set(selected).size!==selected.length||!selected.includes("color")||
 selected.some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).length!==selected.length)
 throw Error("SM1M invalid thematic selection "+cardKey);
 for(const t of selected){
  const g=groups.get(t);
  if(g.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===cardKey.toUpperCase()))
   throw Error("Duplicate SM1M pre-existing theme "+cardKey+"/"+t);
  g.cards.push({code:cardKey,name:c.name,series:"S",set:set.code,
   setName:set.displayName||"문 컬렉션",cardNumber:num+"/060",rarity:c.rarity||"",
   category:r.categories[t],image:p.ownedUrl,
   evidence:"포켓몬코리아 SM1M 한국어 인쇄 "+num+"/060 및 DCB 자체 보관 WebP 육안 확인. "+
    r.artObservation+" ("+REVIEW+")."});
  additions++;counts[t]++;
 }
}
if(additions!==49||THEMES.some(t=>counts[t]!==review.themeCounts?.[t])||
 old.some((c,i)=>JSON.stringify(c)!==oldSnapshots[i])||
 JSON.stringify(set.cards)!==masterBefore)throw Error("Old SM1M themes or canonical cards mutated");
meta.artworkReviewedCardCount=60;meta.reviewedCardCount=60;
meta.verifiedKoreanPrintImageCount=60;meta.verifiedSelfHostedImageCount=60;
meta.reviewedRanges=["001-030","031-060"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=98;meta.preservedExistingThemeSlotCount=0;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.note="SM1M 문 컬렉션 001-060 60장 한국어 카드 이미지와 12테마 시각검수. 신규 테마 누적 98건, 기존 문 컬렉션 테마 0건. 마지막 13장 검수 전 완료 아님. S2a/S2/S3/S6K 보류·원본 카드 및 유저 보유 상태 유지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)throw Error("S6K global hold changed");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:73,
  KoreanPrintArtworksReviewed:60,sourceImagesSelfHostedDecoded:60,
  newlyAddedThemeSlotsThisBatch:49,newlyAddedThemeSlotsCumulative:98,
  existingThemeSlotsPreserved:0,reviewedRanges:["001-030","031-060"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,ownedImagePreflight:PROOF,
  remainingImageAndArtworkCount:13})
]);
console.log(JSON.stringify({set:CODE,reviewed:60,total:73,addedThemeSlots:49,
 cumulativeNewThemeSlots:98,preservedOldThemes:0,canonicalAndOwnershipUnchanged:true}));
