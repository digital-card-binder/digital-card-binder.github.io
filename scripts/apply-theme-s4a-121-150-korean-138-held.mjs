import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s4a",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s4a-121-150-Korean-art-review-20261016.json";
const PROOF="data/audits/theme-visual-evidence/s4a/121-150/visual-index.json";
const DIAGNOSTIC="data/audits/theme-visual-evidence/s4a/121-150/s4a-138-source-diagnostics.json";
const PREVIOUS="data/audits/theme-s4a-091-120-progress-20261016.json";
const PROGRESS="data/audits/theme-s4a-121-150-progress-20261016.json";
const NEXT="S4a 138 Korean image source held; inspect Korean 151-180";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,diagnostic,previous,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read(DIAGNOSTIC),read(PREVIOUS),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json")
]);
const found=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(found.length!==1||found[0].cards?.length!==330)throw Error("Canonical S4a master 330 cards changed");
const set=found[0],masterIDs=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!key)throw Error("Previous S4a review state missing");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===149&&meta.heldCardNumbers?.length===1&&meta.heldCardNumbers[0]===138){
 console.log("Already reviewed 149/330 S4a artwork with card 138 held, safe no-op");
 process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(s=>String(s.code).toLowerCase()===CODE)?.status!=="in_progress"||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==120||meta.reviewedCardCount!==120||
 meta.verifiedKoreanPrintImageCount!==120||meta.verifiedSelfHostedImageCount!==120||
 meta.newlyAddedThemeSlotCount!==177||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060","061-090","091-120"])||
 previous.KoreanPrintArtworksReviewed!==120||previous.newlyAddedThemeSlotsCumulative!==177||
 previous.totalMasterCards!==330||previous.globalCheckpointPreserved!==GLOBAL)
 throw Error("Previous approved S4a 120-card checkpoint or held S6K sources changed");
if(review.set!==CODE||review.range!=="121-150"||
 review.status!=="manual_Korean_artwork_review_partial_138_held"||
 !review.all12ThemesInspected||review.artworksReviewed!==29||
 review.verifiedKoreanPrintImagesInRange!==29||review.ownedCDNImagesDecoded!==29||
 review.existingThemesInThisRange!==0||review.themeAdditions!==42||
 !review.noMasterOrOwnershipChanges||review.items?.length!==29||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 JSON.stringify(review.unverifiedNumbers)!==JSON.stringify([138])||
 review.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.range!=="121-150"||proof.masterCanonicalCards!==330||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==29||proof.ownedImageMissingCount!==1||
 proof.preExistingThemeMemberships!==0||proof.cards?.length!==30||
 proof.globalCheckpointPreserved!==GLOBAL||
 diagnostic.card!=="s4a_138/190"||diagnostic.officialSourceConfirmed!==false||
 diagnostic.ownedArchiveConfirmed!==false||diagnostic.masterOrThemeMutation!==false)
 throw Error("Korean S4a 121-150 card image evidence incomplete or hold state altered");
const held=proof.cards[17];
if(held.canonicalOrder!==138||held.code!=="s4a_138/190"||
 held.imageCheck.status!=="owned_archive_missing"||
 review.items.some(row=>row.canonicalOrder===138))
 throw Error("Must not approve tiny non-card source S4a_138");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing theme "+t);
const existing=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
if(existing.length!==177)throw Error("Previously reviewed S4a 177 theme entries missing");
const snapshots=existing.map(x=>JSON.stringify(x));
const additions=[],counts={};
for(let i=0;i<review.items.length;i++){
 const row=review.items[i],n=row.canonicalOrder,num=String(n).padStart(3,"0"),id="S4a_"+num,code="s4a_"+num+"/190";
 if(n<121||n>150||n===138||i>0&&n<=review.items[i-1].canonicalOrder)
  throw Error("Artwork order/held card collision: "+n);
 const card=set.cards[n-1],pre=proof.cards[n-121];
 if(!card||!pre||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==id.toUpperCase()||
 row.name!==card.name||pre.name!==card.name||
 String(card.code||"").toLowerCase()!==code||String(pre.code||"").toLowerCase()!==code||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 !pre.sourceAppearsPokemonKoreaOfficial||
 !pre.sourceUrl?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S4a/S4a_")||
 !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S4a/S4a_")||
 pre.imageCheck?.status!=="decoded_region_unverified"||
 pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP")
 throw Error("Unverified Korean print, card ID or owned mirror: "+num);
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid 12-theme classification: "+num);
 if(themes.groups.some(g=>g.cards.some(c=>String(c.code||"").toUpperCase()===id.toUpperCase()||
 (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/190"))))
 throw Error("Existing theme key collision: "+num);
 for(const t of selected){
  groups.get(t).cards.push({
   code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"샤이니스타 V",cardNumber:num+"/190",
   rarity:card.rarity||"",category:row.categories[t],image:pre.ownedUrl,
   evidence:"포켓몬코리아 한국어 인쇄판 S4a "+num+"/190 12테마 실물 이미지 검수/당사 CDN 디코딩 완료: "+
    row.artObservation+" ("+REVIEW+")"
  });
  counts[t]=(counts[t]||0)+1;additions.push({number:n,theme:t});
 }
}
if(additions.length!==42||THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==masterIDs||
 existing.some((c,i)=>JSON.stringify(c)!==snapshots[i]||!themes.groups.some(g=>g.cards.includes(c)))||
 themes.groups.some(g=>g.cards.some(c=>String(c.code||"").toUpperCase()==="S4A_138")))
 throw Error("S4a partial audit mutated card IDs, old theme entries or held card 138");
meta.artworkReviewedCardCount=149;meta.reviewedCardCount=149;
meta.verifiedKoreanPrintImageCount=149;meta.verifiedSelfHostedImageCount=149;
meta.reviewedRanges=["001-030","031-060","061-090","091-120","121-137","139-150"];
meta.reviewedThemes=THEMES;meta.newlyAddedThemeSlotCount=219;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.heldCardNumbers=[138];meta.heldImageEvidence=DIAGNOSTIC;
meta.nextStart=NEXT;meta.reviewedAt=DATE;meta.status="in_progress";meta.complete=false;
meta.note="S4a 330장 중 149장 한국판 실물 12테마 검수. 121-150의 138번 자마젠타는 포켓몬코리아 1899바이트·자체 WebP 518바이트 플레이스홀더만 존재하므로 미검수 유지. 새 테마 항목 42개 추가, 누적 219개. 151-330 미검수.";
themes.updatedAt=DATE;status.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)throw Error("S6K Korean rare global hold mutated");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:330,
 KoreanPrintArtworksReviewed:149,sourceImagesSelfHostedDecoded:149,
 newlyAddedThemeSlotsThisBatch:42,newlyAddedThemeSlotsCumulative:219,
 reviewedRanges:meta.reviewedRanges,unverifiedCardNumbers:[138],
 previousArtworkMembershipsPreserved:177,status:"in_progress",complete:false,
 nextStart:NEXT,globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
 ownedImagePreflight:PROOF,heldImageEvidence:DIAGNOSTIC,
 remainingImageAndArtworkCount:181
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:149,total:330,added:42,cumulative:219,
 held:[138],originalCardKeysUnchanged:true,otherThemeEntriesPreserved:true}));
