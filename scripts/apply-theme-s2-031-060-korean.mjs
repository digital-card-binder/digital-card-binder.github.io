import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s2",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s2-031-060-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s2/031-060/visual-index.json";
const PREVIOUS="data/audits/theme-s2-001-030-progress-20261017.json";
const PROGRESS="data/audits/theme-s2-031-060-progress-20261017.json";
const NEXT="S2 한국판 061–090 12테마 원본 이미지 시각검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage,s3progress]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),
 read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
]);
const sets=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(sets.length!==1||sets[0].cards?.length!==115)
 throw Error("Original S2 115-card canonical source changed");
const set=sets[0],masterCodes=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()===CODE);
if(!key)throw Error("Previous S2 first 30 classification not found");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===60&&meta.newlyAddedThemeSlotCount===90&&
 meta.reviewedRanges?.includes("031-060")){
 console.log("S2 031-060 already applied: safe no-op");process.exit(0);
}
if(meta.artworkReviewedCardCount!==30||meta.reviewedCardCount!==30||
 meta.newlyAddedThemeSlotCount!==43||meta.preservedExistingThemeSlotCount!==0||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030"])||
 meta.status!=="in_progress"||meta.complete!==false||
 previous.totalMasterCards!==115||previous.KoreanPrintArtworksReviewed!==30||
 previous.newlyAddedThemeSlotsCumulative!==43||previous.remainingImageAndArtworkCount!==85||
 previous.globalCheckpointPreserved!==GLOBAL||
 status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code||"").toLowerCase()===CODE)?.status!=="in_progress"||
 s3progress.KoreanPrintArtworksReviewed!==110||s3progress.heldNonKoreanSourceCount!==9)
 throw Error("S2 prior 30, S3 9-source hold, S6K global hold baseline changed");
if(review.schemaVersion!==1||review.set!==CODE||review.range!=="031-060"||
 review.status!=="manual_Korean_art_12_theme_reviewed"||
 review.artworksReviewed!==30||review.verifiedKoreanPrintImagesInRange!==30||
 review.ownedCDNImagesDecoded!==30||review.officialSourceCardsInRange!==30||
 review.existingThemesInThisRange!==0||review.themeAdditions!==47||
 review.rarityVerification!=="not_in_scope_canonical_rarity_blank"||
 !review.noMasterOrOwnershipChanges||!review.all12ThemesInspected||
 review.imagePreflight!==PROOF||review.globalCheckpointPreserved!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||review.items?.length!==30||
 proof.set!==CODE||proof.range!=="031-060"||proof.masterCanonicalCards!==115||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S2 second batch Korean image and 12 theme evidence insufficient");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("12 theme categories modified");
const old=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE||
 String(c.code||"").toLowerCase().startsWith(CODE+"_")));
const oldSnapshots=old.map(c=>JSON.stringify(c));
if(old.length!==43)throw Error("S2 first30 original 43 theme entries changed");
if(old.some(c=>{const n=Number(String(c.code||"").split("_")[1]?.split("/")[0]);
 return n>=31&&n<=60;}))throw Error("S2 031–060 already contains unaccounted theme");
const added=[],counts=Object.fromEntries(THEMES.map(t=>[t,0]));
for(let i=0;i<30;i++){
 const n=i+31,num=String(n).padStart(3,"0"),id="S2_"+num;
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
 throw Error("S2 second Korean printed card identity/own binary invalid "+num);
 const selected=new Set(r.matchedThemes||[]);
 if(selected.size!==r.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!selected.has(t)))
 throw Error("S2 unexpected theme classification "+num);
 for(const t of selected){
  const g=groups.get(t);
  if(g.cards.some(c=>String(c.code||"").toUpperCase().split("/")[0]===id))
   throw Error("S2 duplicate theme "+id+"/"+t);
  g.cards.push({code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"반역크래시",cardNumber:num+"/096",
   rarity:card.rarity||"",category:r.categories[t],image:p.ownedUrl,
   evidence:"포켓몬코리아 한국판 S2 "+num+"/096 및 DCB 자체 보관 WebP 확인. "+
    r.artObservation+" ("+REVIEW+")."});
  added.push({n,theme:t});counts[t]++;
 }
}
if(added.length!==47||THEMES.some(t=>counts[t]!==review.themeCounts?.[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==masterCodes||
 old.some((c,i)=>JSON.stringify(c)!==oldSnapshots[i]))
 throw Error("S2 031–060 theme addition totals or earlier 43 records changed");
meta.artworkReviewedCardCount=60;meta.reviewedCardCount=60;
meta.verifiedKoreanPrintImageCount=60;meta.verifiedSelfHostedImageCount=60;
meta.reviewedRanges=["001-030","031-060"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=90;meta.preservedExistingThemeSlotCount=0;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.note="S2 반역크래시 한국판 001-060 60장 12테마 육안 검수 완료, 이번 47건/누적 90건. 061-115 나머지 55장 완료 전 strict complete 금지. S3 일본어 보류 9장 및 S6K 보류 4장 유지, 전체 소유/카드키 변경 없음.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)throw Error("S6K global checkpoint drift");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:115,
  KoreanPrintArtworksReviewed:60,sourceImagesSelfHostedDecoded:60,
  newlyAddedThemeSlotsThisBatch:47,newlyAddedThemeSlotsCumulative:90,
  existingThemeSlotsPreserved:0,reviewedRanges:["001-030","031-060"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:55})
]);
console.log(JSON.stringify({set:CODE,reviewed:60,total:115,newThemeSlotsThisBatch:47,
 totalNewThemeSlots:90,olderThemeRowsPreserved:43,masterAndOwnershipUnchanged:true}));
