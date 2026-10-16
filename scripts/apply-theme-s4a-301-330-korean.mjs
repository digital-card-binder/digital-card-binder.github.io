import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s4a",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s4a-301-330-Korean-art-review-20261016.json";
const PROOF="data/audits/theme-visual-evidence/s4a/301-330/visual-index.json";
const PREVIOUS="data/audits/theme-s4a-271-300-progress-20261016.json";
const PROGRESS="data/audits/theme-s4a-301-330-progress-20261016.json";
const NEXT="S4a 138 Korean source held; require genuine Korean print image to close set";
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
if(meta.artworkReviewedCardCount===329&&meta.reviewedRanges?.includes("301-330")){
 console.log("Already approved 329 Korean S4a artworks: safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(s=>String(s.code).toLowerCase()===CODE)?.status!=="in_progress"||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==299||meta.reviewedCardCount!==299||
 meta.verifiedKoreanPrintImageCount!==299||meta.verifiedSelfHostedImageCount!==299||
 meta.newlyAddedThemeSlotCount!==384||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060","061-090","091-120","121-137","139-150","151-180","181-210","211-240","241-270","271-300"])||
 previous.KoreanPrintArtworksReviewed!==299||previous.newlyAddedThemeSlotsCumulative!==384||
 previous.globalCheckpointPreserved!==GLOBAL||previous.totalMasterCards!==330)
 throw Error("Previous S4a 299-card approved state / historic S6K holds altered");
if(JSON.stringify(meta.heldCardNumbers)!==JSON.stringify([138])||
 JSON.stringify(previous.unverifiedCardNumbers)!==JSON.stringify([138])||
 review.priorHeldS4aCardNumbers?.length!==1||review.priorHeldS4aCardNumbers[0]!==138)
 throw Error("Previous missing S4a 138 Korean print hold was lost");
if(review.set!==CODE||review.range!=="301-330"||
 review.status!=="manual_Korean_shiny_print_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.existingThemesInThisRange!==0||review.themeAdditions!==30||
 !review.noMasterOrOwnershipChanges||review.items?.length!==30||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.range!=="301-330"||proof.masterCanonicalCards!==330||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Source manifest or visual evidence incomplete for Korean S4a 211-240");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))
 throw Error("One of twelve independent artwork themes missing: "+t);
const before=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
const beforeJson=before.map(c=>JSON.stringify(c));
if(before.length!==384)throw Error("Previous 384 S4a entries missing: "+before.length);
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=301+i,num=String(n).padStart(3,"0"),id="S4a_"+num,canon="s4a_"+num+"/190";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[n-1];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==id.toUpperCase()||
 row.name!==card.name||pre.name!==card.name||
 String(pre.code||"").toLowerCase()!==canon||
 String(card.code||"").toLowerCase()!==canon||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 !(n<=326?
   (pre.sourceAppearsPokemonKoreaOfficial&&pre.sourceHost==="cards.image.pokemonkorea.co.kr"&&
    pre.sourceUrl==="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S4a/S4a_"+num+".png"&&
    pre.ownedUrl==="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S4a/S4a_"+num+".webp"&&
    row.sourceEvidence==="pokemonkorea-official-image-and-dcb-modern-mirror"):
   (!pre.sourceAppearsPokemonKoreaOfficial&&pre.sourceHost==="static.tcgexchange.kr"&&
    /^https:\/\/static\.tcgexchange\.kr\/[0-9a-f]{32}\.(png|jpg)$/.test(pre.sourceUrl||"")&&
    /^https:\/\/dcb-card-images-legacy-2026\.pages\.dev\/external\/static\.tcgexchange\.kr\/[0-9a-f]{16}\.webp$/.test(pre.ownedUrl||"")&&
    row.sourceEvidence==="thirdparty-korean-card-image-and-dcb-legacy-mirror-not-official"))||
 !pre.imageCheck?.sha256||!/^([0-9a-f]{64})$/.test(pre.imageCheck.sha256)||
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
   evidence:(n<=326?"포켓몬코리아 공식 이미지 출처와 DCB 자체 CDN 한국판 S4a ":"한국어 인쇄본(외부 자료 static.tcgexchange.kr 및 DCB 자체 레거시 CDN; 공식 원본 출처는 미확인) S4a ")+num+"/190 실물 삽화 12테마 시각검수. "+
    row.artObservation+" ("+REVIEW+")"
  });
  counts[theme]=(counts[theme]||0)+1;
  additions.push({number:n,theme});
 }
}
if(additions.length!==30||
 THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==oldIDs||
 before.some((c,i)=>JSON.stringify(c)!==beforeJson[i]||
 !themes.groups.some(g=>g.cards.includes(c))))
 throw Error("New entries would corrupt previous themes or original Korean card keys");
meta.artworkReviewedCardCount=329;meta.reviewedCardCount=329;
meta.verifiedKoreanPrintImageCount=329;meta.verifiedSelfHostedImageCount=329;
meta.reviewedRanges=["001-030","031-060","061-090","091-120","121-137","139-150","151-180","181-210","211-240","241-270","271-300","301-330"];meta.reviewedThemes=THEMES;
meta.heldCardNumbers=[138];meta.heldImageEvidence="data/audits/theme-visual-evidence/s4a/121-150/s4a-138-source-diagnostics.json";
meta.newlyAddedThemeSlotCount=414;meta.partialReviewEvidence=REVIEW;
meta.imagePreflightEvidence=PROOF;meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="S4a 전체 330장 중 329장 한국판 인쇄 카드 이미지와 12테마 검수 완료. 301~330번 30장 신규 색상 테마 등록, 누적 신규 슬롯 414개. 327~330번은 외부 자료 기반 한국어 인쇄본(자체 CDN 저장)이므로 공식 이미지 출처로 단정하지 않음. 138번 자마젠타는 한국판 원본 이미지 결함으로 보류. 전체 완료 처리 금지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global S6K Korean rare held checkpoint changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:330,
 KoreanPrintArtworksReviewed:329,sourceImagesSelfHostedDecoded:329,
 newlyAddedThemeSlotsThisBatch:30,newlyAddedThemeSlotsCumulative:414,
 existingThemesPreserved:before.length,unverifiedCardNumbers:[138],reviewedRanges:["001-030","031-060","061-090","091-120","121-137","139-150","151-180","181-210","211-240","241-270","271-300","301-330"],
 status:"in_progress",complete:false,nextStart:NEXT,
 globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
 ownedImagePreflight:PROOF,remainingImageAndArtworkCount:1
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:329,total:330,newThemeSlotsThisBatch:30,
 newlyAddedThemeSlotsCumulative:414,allExistingPreserved:true,cardKeysUnchanged:true}));
