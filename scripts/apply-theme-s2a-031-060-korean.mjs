import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s2a",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s2a-031-060-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s2a/031-060/visual-index.json";
const PREVIOUS="data/audits/theme-s2a-001-030-progress-20261017.json";
const PROGRESS="data/audits/theme-s2a-031-060-progress-20261017.json";
const NEXT="S2a 한국판 061-086 카드 원본 이미지 및 12테마 시각검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage,s2progress,s3progress]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s2-091-115-approved16-held9-progress-20261017.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const found=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(found.length!==1||found[0].cards?.length!==86)
 throw Error("S2a canonical 86 card records changed");
const set=found[0],unchangedKeys=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!key)throw Error("Initial S2a review checkpoint missing");
const state=status.reviews[key];
if(state.artworkReviewedCardCount===60&&state.newlyAddedThemeSlotCount===89&&
 state.reviewedRanges?.includes("031-060")){
 console.log("S2a 031-060 already applied; safe no-op");process.exit(0);
}
if(state.status!=="in_progress"||state.complete!==false||
 state.artworkReviewedCardCount!==30||state.reviewedCardCount!==30||
 state.newlyAddedThemeSlotCount!==46||state.preservedExistingThemeSlotCount!==3||
 JSON.stringify(state.reviewedRanges)!==JSON.stringify(["001-030"])||
 previous.totalMasterCards!==86||previous.KoreanPrintArtworksReviewed!==30||
 previous.newlyAddedThemeSlotsCumulative!==46||previous.existingThemeSlotsPreserved!==3||
 previous.remainingImageAndArtworkCount!==56||
 previous.globalCheckpointPreserved!==GLOBAL||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="in_progress"||
 s2progress.heldNonKoreanSourceCount!==9||s2progress.KoreanPrintArtworksReviewed!==106||
 s3progress.heldNonKoreanSourceCount!==9||s3progress.KoreanPrintArtworksReviewed!==110)
 throw Error("First S2a 30-card checkpoint or unrelated Korean source holds changed");
if(review.schemaVersion!==1||review.set!==CODE||review.range!=="031-060"||
 review.status!=="manual_Korean_art_12_theme_reviewed"||
 review.artworksReviewed!==30||review.verifiedKoreanPrintImagesInRange!==30||
 review.ownedCDNImagesDecoded!==30||review.officialSourceCardsInRange!==30||
 review.existingThemesInThisRange!==3||review.themeAdditions!==43||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.noMasterOrOwnershipChanges||!review.all12ThemesInspected||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||review.items?.length!==30||
 proof.set!==CODE||proof.range!=="031-060"||proof.masterCanonicalCards!==86||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==3||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S2a second30 Korean printed image evidence does not meet strict standard");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("12 independent theme groups changed");
const original=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const originalSnapshot=original.map(x=>JSON.stringify(x));
if(original.length!==49)throw Error("S2a previous 3+46 theme slots changed");
for(const [id,group] of [["S2A_049","sunset"],["S2A_049","street"],["S2A_059","season"]]){
 if(groups.get(group).cards.filter(c=>String(c.code||"").toUpperCase().split("/")[0]===id).length!==1)
  throw Error("Previously reviewed S2a Korean artwork theme unexpectedly missing "+id+"/"+group);
}
const oldWithin=themes.groups.flatMap(g=>g.cards.filter(c=>{
 const id=String(c.code||"").toUpperCase().split("/")[0];
 const n=Number(id.split("_")[1]);
 return id.startsWith("S2A_")&&n>=31&&n<=60;
}).map(c=>({id:String(c.code||"").toUpperCase().split("/")[0],theme:g.code})));
if(oldWithin.length!==3||
 oldWithin.some(x=>!(x.id==="S2A_049"&&["sunset","street"].includes(x.theme))&&
 !(x.id==="S2A_059"&&x.theme==="season")))
 throw Error("Unexpected legacy S2a 031-060 theme records");
const counts=Object.fromEntries(THEMES.map(t=>[t,0])),added=[];
for(let i=0;i<30;i++){
 const n=i+31,num=String(n).padStart(3,"0"),id="S2a_"+num;
 const card=set.cards[n-1],p=proof.cards[i],r=review.items[i];
 const preserved=n===49?["sunset","street"]:n===59?["season"]:[];
 if(!card||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s2a_"+num+"/070"||
 String(p.code||"").toLowerCase()!=="s2a_"+num+"/070"||
 String(r.cardKey||"").toUpperCase()!==id.toUpperCase()||p.name!==card.name||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S2a/S2a_"+num+".png"||
 p.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S2a/S2a_"+num+".webp"||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[a-f0-9]{64}$/.test(p.imageCheck?.sha256||"")||
 JSON.stringify(p.preExistingThemeMemberships||[])!==JSON.stringify(preserved)||
 JSON.stringify(r.preExistingThemeRecordsPreserved||[])!==JSON.stringify(preserved))
 throw Error("S2a second30 Korean print/canonical/old theme mismatch at "+num);
 const selected=new Set(r.matchedThemes||[]);
 if(selected.size!==r.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim()||preserved.includes(t))||
 Object.keys(r.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid new theme at "+num);
 for(const theme of selected){
  const group=groups.get(theme);
  if(group.cards.some(x=>String(x.code||"").toUpperCase().split("/")[0]===id.toUpperCase()))
   throw Error("Duplicate S2a theme detected "+num+"/"+theme);
  group.cards.push({code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"폭염워커",cardNumber:num+"/070",
   rarity:card.rarity||"",category:r.categories[theme],image:p.ownedUrl,
   evidence:"한국어 인쇄 S2a "+num+"/070 포켓몬코리아 공식 원본과 DCB 자체보관 WebP 대조. "+
    r.artObservation+" ("+REVIEW+")."});
  counts[theme]++;added.push({n,theme});
 }
}
if(added.length!==43||THEMES.some(t=>counts[t]!==review.themeCounts?.[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==unchangedKeys||
 original.some((x,i)=>JSON.stringify(x)!==originalSnapshot[i]))
 throw Error("S2a 43 new themes or protected older 49 records modified");
state.artworkReviewedCardCount=60;state.reviewedCardCount=60;
state.verifiedKoreanPrintImageCount=60;state.verifiedSelfHostedImageCount=60;
state.reviewedRanges=["001-030","031-060"];state.reviewedThemes=THEMES;
state.newlyAddedThemeSlotCount=89;state.preservedExistingThemeSlotCount=3;
state.partialReviewEvidence=REVIEW;state.imagePreflightEvidence=PROOF;
state.nextStart=NEXT;state.reviewedAt=DATE;state.status="in_progress";state.complete=false;
state.note="S2a 폭염워커 86장 중 001-060 60장 한국판 12테마 이미지 검수. 이번 신규 43개·누적 신규 89개·이전 분류 3개 정확히 보존. 마지막 26장 검수 전 complete 금지. S2/S3 일본어 대체 이미지 보류 9장씩·S6K 4장 보류 및 모든 canonical/보유 키 유지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Historical S6K source evidence hold unexpectedly changed");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:86,
  KoreanPrintArtworksReviewed:60,sourceImagesSelfHostedDecoded:60,
  newlyAddedThemeSlotsThisBatch:43,newlyAddedThemeSlotsCumulative:89,
  existingThemeSlotsPreserved:3,reviewedRanges:["001-030","031-060"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:26})
]);
console.log(JSON.stringify({set:CODE,reviewed:60,total:86,additions:43,
 totalNewThemeSlots:89,oldThemeSlotsPreserved:3,masterAndOwnershipUnchanged:true}));
