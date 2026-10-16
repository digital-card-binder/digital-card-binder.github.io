import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n","utf8");
const CODE="s5i",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const ART="data/audits/theme-s5i-001-030-Korean-art-review-20261016.json";
const PREFLIGHT="data/audits/theme-visual-evidence/s5i/001-030/visual-index.json";
const PROGRESS="data/audits/theme-s5i-001-030-progress-20261016.json";
const NEXT="s5i Korean base 031-060 visual review";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(ART),read(PREFLIGHT),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json")
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(matches.length!==1||matches[0].cards?.length!==91)throw Error("Expected original 91-slot Korean S5I catalog");
const set=matches[0],originalCodes=JSON.stringify(set.cards.map(c=>c.code));
const reviewKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE)||set.code;
const meta=status.reviews?.[reviewKey]||{};
if(meta.artworkReviewedCardCount===30&&meta.reviewedRanges?.includes("001-030")){
 console.log("S5I 001-030 already applied; no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="pending"||
 (meta.status&&!["pending","not_started","not-started"].includes(meta.status))||
 Number(meta.artworkReviewedCardCount||0)!==0||Number(meta.reviewedCardCount||0)!==0||
 Number(meta.newlyAddedThemeSlotCount||0)!==0)
 throw Error("Unknown previous S5I review checkpoint or global hold changed");
if(review.set!==CODE||review.range!=="001-030"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 !review.noMasterOrOwnershipChanges||review.themeAdditions!==45||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 JSON.stringify(review.preexistingKept)!=="[]"||
 review.items?.length!==30||review.globalHoldUnchanged!==GLOBAL||
 proof.set!==CODE||proof.range!=="001-030"||proof.checkedCardCount!==30||
 proof.ownedImageDecodedCount!==30||proof.ownedImageMissingCount!==0||
 proof.preExistingThemeMemberships!==0||proof.cards?.length!==30||
 proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S5I Korean official image source or 12-theme review incomplete");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing required artwork theme "+t);
const existing=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
if(existing.length!==2)throw Error("Existing two S5I theme entries unexpectedly changed");
const preserved=existing.map(c=>JSON.stringify(c));
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),key="S5I_"+num,code="s5i_"+num+"/070";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[n-1];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==key||
 row.name!==card.name||pre.name!==card.name||
 String(card.code||"").toLowerCase()!==code||String(pre.code||"").toLowerCase()!==code||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 pre.imageCheck?.status!=="decoded_region_unverified"||pre.imageCheck?.http!==200||
 pre.imageCheck?.format!=="WEBP"||
 !pre.sourceUrl?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5/")||
 !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S5/"))
 throw Error("Korean S5I official number or owned source is not verified "+num);
 const chosen=new Set(row.matchedThemes||[]);
 if(chosen.size!==row.matchedThemes?.length||!chosen.has("color")||
 [...chosen].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!chosen.has(t)))
 throw Error("Artwork theme classification inconsistent "+num);
 if(themes.groups.some(g=>g.cards.some(c=>String(c.code||"").toUpperCase()===key||
 (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/070"))))
 throw Error("Refuse to overwrite S5I pre-existing membership "+num);
 for(const t of chosen){
  groups.get(t).cards.push({
    code:key,name:card.name,series:"S",set:set.code,
    setName:set.displayName||"일격마스터",cardNumber:num+"/070",
    rarity:card.rarity||"",category:row.categories[t],image:pre.ownedUrl,
    evidence:"한국판 S5I "+num+"/070 공식 삽화 12테마 검수 및 자체 DCB 이미지 확인: "+
      row.artObservation+" ("+ART+")"
  });
  counts[t]=(counts[t]||0)+1;additions.push({number:n,theme:t});
 }
}
if(additions.length!==45||
 THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==originalCodes||
 existing.some((c,i)=>JSON.stringify(c)!==preserved[i])||
 existing.some(c=>!themes.groups.some(g=>g.cards.includes(c))))
 throw Error("S5I theme count or prior membership changed");
meta.artworkReviewedCardCount=30;meta.reviewedCardCount=30;
meta.verifiedKoreanPrintImageCount=30;meta.verifiedSelfHostedImageCount=30;
meta.reviewedRanges=["001-030"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=45;meta.partialReviewEvidence=ART;
meta.imagePreflightEvidence=PREFLIGHT;meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="S5I 일격마스터 한국판 001~030 공식 삽화 12테마 직접 검수, 신규 테마 45개. 기존 세트 내 등록된 2개 테마 카드와 91장 마스터 보유키 유지. 031~091 검수 전이므로 완료 표시 금지.";
status.reviews[reviewKey]=meta;status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("S6K previous global held cards unexpectedly altered");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
  schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:91,
  KoreanPrintArtworksReviewed:30,sourceImagesSelfHostedDecoded:30,
  themeSlotsAdded:45,themeCounts:counts,existingThemeEntriesPreserved:2,
  reviewedRanges:["001-030"],status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:ART,ownedImagePreflight:PREFLIGHT
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:30,total:91,added:45,
 originalThemeEntriesPreserved:2,masterCardKeysUnchanged:true,globalCheckpoint:GLOBAL}));
