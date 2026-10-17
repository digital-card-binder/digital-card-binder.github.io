import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s3",DATE="2026-10-17",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s3-001-030-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s3/001-030/visual-index.json";
const PROGRESS="data/audits/theme-s3-001-030-progress-20261017.json";
const NEXT="S3 한국판 031-060 카드 12테마 이미지 시각검수";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json")
]);
const entries=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(entries.length!==1||entries[0].cards?.length!==119)throw Error("Original S3 119-card master changed");
const set=entries[0],beforeKeys=JSON.stringify(set.cards.map(c=>c.code));
const existing=Object.entries(status.reviews||{}).find(([key])=>key.toLowerCase()===CODE);
if(existing?.[1]?.artworkReviewedCardCount===30&&existing[1].newlyAddedThemeSlotCount===51&&
 existing[1].reviewedRanges?.includes("001-030")){
 console.log("S3 first 30 already classified, safe no-op");process.exit(0);
}
if(existing||status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="pending")
 throw Error("S3 initial baseline or S6K global checkpoint no longer matches");
if(review.status!=="manual_Korean_art_12_theme_reviewed"||review.set!==CODE||
 review.range!=="001-030"||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.themeAdditions!==51||review.existingThemesInThisRange!==0||
 !review.noMasterOrOwnershipChanges||!review.all12ThemesInspected||review.items?.length!==30||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||review.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.range!=="001-030"||proof.masterCanonicalCards!==119||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Insufficient S3 Korean first30 visual audit evidence");
const groups=new Map(themes.groups.map(x=>[x.code,x]));
if(groups.size!==12||THEMES.some(t=>!groups.has(t)))throw Error("12 themes changed");
const original=themes.groups.flatMap(g=>g.cards.filter(x=>String(x.set||"").toLowerCase()===CODE||
 String(x.code||"").toLowerCase().startsWith(CODE+"_")));
const snapshot=original.map(x=>JSON.stringify(x));
if(original.length!==1||groups.get("reflections").cards.filter(c=>
 String(c.code||"").toUpperCase().split("/")[0]==="S3_079").length!==1)
 throw Error("S3_079 reflection theme missing or unexpected old S3 theme records");
if(original.some(x=>/^S3_0(?:0[1-9]|[12][0-9]|30)$/i.test(String(x.code||"").split("/")[0])))
 throw Error("Unexpected preexisting S3 theme record in 001-030");
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),id="S3_"+num,card=set.cards[i],p=proof.cards[i],r=review.items[i];
 if(!card||!p||!r||p.canonicalOrder!==n||r.canonicalOrder!==n||
 String(card.code||"").toLowerCase()!=="s3_"+num+"/100"||
 String(p.code||"").toLowerCase()!=="s3_"+num+"/100"||
 r.cardKey.toUpperCase()!==id||r.name!==card.name||p.name!==card.name||
 !r.koreanPrintImageVerified||!r.artObservation?.trim()||
 r.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !p.sourceAppearsPokemonKoreaOfficial||p.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 p.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S3/S3_"+num+".png"||
 p.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S3/S3_"+num+".webp"||
 p.imageCheck?.status!=="decoded_region_unverified"||p.imageCheck?.http!==200||
 p.imageCheck?.format!=="WEBP"||p.imageCheck?.dimensions?.[0]!==420||
 p.imageCheck?.dimensions?.[1]!==586||!/^[0-9a-f]{64}$/.test(p.imageCheck?.sha256||"")||
 !["C","U","R","RR","RRR"].includes(r.rarity)||
 r.preExistingThemeRecordsPreserved?.length!==0||p.preExistingThemeMemberships?.length!==0)
 throw Error("S3 001-030 Korean printed identity or selfhosted source invalid "+num);
 const selected=new Set(r.matchedThemes||[]);
 if(selected.size!==r.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!r.categories?.[t]?.trim())||
 Object.keys(r.categories||{}).some(t=>!selected.has(t)))throw Error("Invalid 12-theme classification "+num);
 for(const theme of selected){
  const group=groups.get(theme);
  if(group.cards.some(c=>String(c.code||"").toUpperCase().split("/")[0]===id))
   throw Error("Unexpected duplicate S3 theme "+id+"/"+theme);
  group.cards.push({code:id,name:card.name,series:"S",set:set.code,
    setName:set.displayName||"무한존",cardNumber:num+"/100",
    rarity:card.rarity||r.rarity,category:r.categories[theme],
    image:p.ownedUrl,evidence:"포켓몬코리아 한국판 S3 "+num+
     "/100 및 DCB 자체보관 WebP 시각검수. "+r.artObservation+" ("+REVIEW+")"});
  additions.push({n,theme});counts[theme]=(counts[theme]||0)+1;
 }
}
if(additions.length!==51||THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==beforeKeys||
 original.some((x,i)=>JSON.stringify(x)!==snapshot[i]))
 throw Error("S3 001-030 artwork classification totals or old reflection record changed");
status.reviews[CODE]={artworkReviewedCardCount:30,reviewedCardCount:30,
 verifiedKoreanPrintImageCount:30,verifiedSelfHostedImageCount:30,
 reviewedRanges:["001-030"],reviewedThemes:THEMES,newlyAddedThemeSlotCount:51,
 preservedExistingThemeSlotCount:1,partialReviewEvidence:REVIEW,imagePreflightEvidence:PROOF,
 nextStart:NEXT,reviewedAt:DATE,status:"in_progress",complete:false,
 note:"S3 119장 중 한국판 001-030번 30장 자체보관 이미지와 12개 테마 육안검수 완료. 신규 51개 테마 슬롯. 기존 S3_079 반사 테마 보존. 나머지 89장 전수검수 전 complete 금지."};
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)throw Error("S6K global hold altered");
await Promise.all([
 save("data/art-themes.json",themes),save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:119,
  KoreanPrintArtworksReviewed:30,sourceImagesSelfHostedDecoded:30,
  newlyAddedThemeSlotsThisBatch:51,newlyAddedThemeSlotsCumulative:51,
  existingThemeSlotsPreserved:1,reviewedRanges:["001-030"],
  status:"in_progress",complete:false,nextStart:NEXT,globalCheckpointPreserved:GLOBAL,
  manualReview:REVIEW,ownedImagePreflight:PROOF,remainingImageAndArtworkCount:89})
]);
console.log(JSON.stringify({set:CODE,reviewed:30,total:119,addedThemeSlots:51,
 existingReflectionRecordPreserved:true,canonicalKeysAndOwnershipUnchanged:true}));
