import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s4a",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s4a-061-090-Korean-art-review-20261016.json";
const PROOF="data/audits/theme-visual-evidence/s4a/061-090/visual-index.json";
const PREVIOUS="data/audits/theme-s4a-031-060-progress-20261016.json";
const PROGRESS="data/audits/theme-s4a-061-090-progress-20261016.json";
const NEXT="s4a Korean 091-120 12-theme artwork review";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json")
]);
const matches=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(matches.length!==1||matches[0].cards?.length!==330)
 throw Error("Original 330-card S4a master absent");
const set=matches[0],oldIDs=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!key)throw Error("Previous S4a review state missing");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===90&&meta.reviewedRanges?.includes("061-090")){
 console.log("Already approved 90 Korean S4a artworks: safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(s=>String(s.code).toLowerCase()===CODE)?.status!=="in_progress"||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==60||meta.reviewedCardCount!==60||
 meta.verifiedKoreanPrintImageCount!==60||meta.verifiedSelfHostedImageCount!==60||
 meta.newlyAddedThemeSlotCount!==92||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 previous.KoreanPrintArtworksReviewed!==60||previous.newlyAddedThemeSlotsCumulative!==92||
 previous.globalCheckpointPreserved!==GLOBAL||previous.totalMasterCards!==330)
 throw Error("Previous S4a 001-060 approval state / historic S6K holds altered");
if(review.set!==CODE||review.range!=="061-090"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.existingThemesInThisRange!==0||review.themeAdditions!==44||
 !review.noMasterOrOwnershipChanges||review.items?.length!==30||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.range!=="061-090"||proof.masterCanonicalCards!==330||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Source manifest or visual evidence incomplete for Korean S4a 061-090");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))
 throw Error("One of twelve independent artwork themes missing: "+t);
const before=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
const beforeJson=before.map(c=>JSON.stringify(c));
if(before.length!==92)throw Error("Previous 92 S4a first-sixty theme entries missing: "+before.length);
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=61+i,num=String(n).padStart(3,"0"),id="S4a_"+num,canon="s4a_"+num+"/190";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[n-1];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==id.toUpperCase()||
 row.name!==card.name||pre.name!==card.name||
 String(pre.code||"").toLowerCase()!==canon||
 String(card.code||"").toLowerCase()!==canon||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 !pre.sourceAppearsPokemonKoreaOfficial||
 !pre.sourceUrl?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S4a/S4a_")||
 !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S4a/S4a_")||
 pre.imageCheck?.status!=="decoded_region_unverified"||
 pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP")
 throw Error("S4a official Korean source identity or owned image missing: "+num);
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("S4a 12-theme classification invalid for "+num);
 if(themes.groups.some(g=>g.cards.some(c=>
  String(c.code||"").toUpperCase()===id.toUpperCase()||
  (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/190"))))
 throw Error("Do not overwrite existing S4a theme member: "+num);
 for(const theme of selected){
  groups.get(theme).cards.push({
   code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"샤이니스타 V",cardNumber:num+"/190",
   rarity:card.rarity||"",category:row.categories[theme],image:pre.ownedUrl,
   evidence:"포켓몬코리아 한국판 S4a "+num+"/190 실물 삽화 12테마 시각검수 및 DCB 자체 CDN 확인. "+
    row.artObservation+" ("+REVIEW+")"
  });
  counts[theme]=(counts[theme]||0)+1;
  additions.push({number:n,theme});
 }
}
if(additions.length!==44||
 THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==oldIDs||
 before.some((c,i)=>JSON.stringify(c)!==beforeJson[i]||
 !themes.groups.some(g=>g.cards.includes(c))))
 throw Error("New entries would corrupt previous themes or original Korean card keys");
meta.artworkReviewedCardCount=90;meta.reviewedCardCount=90;
meta.verifiedKoreanPrintImageCount=90;meta.verifiedSelfHostedImageCount=90;
meta.reviewedRanges=["001-030","031-060","061-090"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=136;meta.partialReviewEvidence=REVIEW;
meta.imagePreflightEvidence=PROOF;meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="S4a 샤이니스타 V 한국어판 90/330장 12개 테마 시각검수. 기존 첫 60장 92개 신규 테마 분류 보존, 061-090번 44개 추가하여 누적 136개. 마스터 카드 키와 이전 보유 상태 보호, 091-330번 아직 검수 전.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global S6K Korean rare held checkpoint changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:330,
 KoreanPrintArtworksReviewed:90,sourceImagesSelfHostedDecoded:90,
 newlyAddedThemeSlotsThisBatch:44,newlyAddedThemeSlotsCumulative:136,
 existingThemesPreserved:before.length,reviewedRanges:["001-030","031-060","061-090"],
 status:"in_progress",complete:false,nextStart:NEXT,
 globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
 ownedImagePreflight:PROOF,remainingImageAndArtworkCount:240
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:90,total:330,newThemeSlotsThisBatch:44,
 newlyAddedThemeSlotsCumulative:136,allExistingPreserved:true,cardKeysUnchanged:true}));
