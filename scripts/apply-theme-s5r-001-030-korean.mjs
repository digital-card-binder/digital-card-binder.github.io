import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n","utf8");
const CODE="s5r",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const ART="data/audits/theme-s5r-001-030-Korean-art-review-20261016.json";
const PREFLIGHT="data/audits/theme-visual-evidence/s5r/001-030/visual-index.json";
const PROGRESS="data/audits/theme-s5r-001-030-progress-20261016.json";
const NEXT="s5r Korean base 031-060 visual review";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(ART),read(PREFLIGHT),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json")
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(matches.length!==1||matches[0].cards?.length!==91)throw Error("Expected original 91-slot Korean S5R catalog");
const set=matches[0],originalKeys=JSON.stringify(set.cards.map(c=>c.code));
const reviewKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE)||set.code;
const meta=status.reviews?.[reviewKey]||{};
if(meta.artworkReviewedCardCount===30&&meta.reviewedRanges?.includes("001-030")){
 console.log("S5R first 30 previously applied; idempotent exit");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="pending"||
 (meta.status&&!["pending","not_started","not-started"].includes(meta.status))||
 Number(meta.artworkReviewedCardCount||0)!==0||Number(meta.reviewedCardCount||0)!==0||
 Number(meta.newlyAddedThemeSlotCount||0)!==0)
 throw Error("Unknown prior S5R review checkpoint or global hold changed");
if(review.set!==CODE||review.range!=="001-030"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 !review.noMasterOrOwnershipChanges||review.themeAdditions!==47||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 JSON.stringify(review.preexistingKept)!==JSON.stringify(["S5R_006:season"])||
 review.items?.length!==30||review.globalHoldUnchanged!==GLOBAL||
 proof.set!==CODE||proof.range!=="001-030"||proof.checkedCardCount!==30||
 proof.ownedImageDecodedCount!==30||proof.ownedImageMissingCount!==0||
 proof.preExistingThemeMemberships!==1||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("S5R official Korean print visual inspection or own-image provenance incomplete");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing required theme "+t);
const existing=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
if(existing.length!==1)throw Error("S5R existing artwork total not one: "+existing.length);
const old006=groups.get("season").cards.filter(c=>String(c.code||"").toUpperCase()==="S5R_006");
if(old006.length!==1||old006[0].name!=="체리꼬")throw Error("Existing S5R Cherry blossom card must remain");
const old006json=JSON.stringify(old006[0]),existingCard=existing[0];
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=i+1,id=String(n).padStart(3,"0"),key="S5R_"+id,code="s5r_"+id+"/070";
 const row=review.items[i],pre=proof.cards[i],master=set.cards[n-1];
 if(!row||!pre||!master||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==key||
 row.name!==master.name||pre.name!==master.name||
 String(master.code||"").toLowerCase()!==code||String(pre.code||"").toLowerCase()!==code||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 pre.imageCheck?.status!=="decoded_region_unverified"||pre.imageCheck?.http!==200||
 pre.imageCheck?.format!=="WEBP"||
 !pre.sourceUrl?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5/")||
 !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S5/"))
 throw Error("Missing verified official Korean S5R 001-030 print "+id);
 const chosen=new Set(row.matchedThemes||[]);
 if(chosen.size!==row.matchedThemes?.length||!chosen.has("color")||
 [...chosen].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!chosen.has(t)))
 throw Error("Invalid independently classified artwork "+id);
 const present=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.code||"").toUpperCase()===key));
 if(n===6){
   if(present.length!==1||present[0]!==old006[0]||
    JSON.stringify(row.originalPreserved)!==JSON.stringify(["season"]))
    throw Error("S5R existing Cherry card ownership collision");
 }else if(present.length)throw Error("Refuse to overwrite previously recorded S5R "+id);
 for(const t of chosen){
   if(n===6&&t==="season")continue;
   groups.get(t).cards.push({
     code:key,name:master.name,series:"S",set:set.code,
     setName:set.displayName||"연격마스터",cardNumber:id+"/070",
     rarity:master.rarity||"",category:row.categories[t],
     image:pre.ownedUrl,
     evidence:"한국판 S5R "+id+"/070 12테마 실제 삽화 검수 및 DCB 자체 보관 정상 확인: "+
       row.artObservation+" ("+ART+")"
   });
   counts[t]=(counts[t]||0)+1;additions.push({number:n,theme:t});
 }
}
if(additions.length!==47||THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0)-(t==="season"?1:0))||
 JSON.stringify(set.cards.map(c=>c.code))!==originalKeys||
 JSON.stringify(old006[0])!==old006json||
 !groups.get("season").cards.includes(existingCard))
 throw Error("S5R theme counts or existing season membership changed");
meta.artworkReviewedCardCount=30;
meta.reviewedCardCount=30;
meta.verifiedKoreanPrintImageCount=30;
meta.verifiedSelfHostedImageCount=30;
meta.reviewedRanges=["001-030"];
meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=47;
meta.partialReviewEvidence=ART;
meta.imagePreflightEvidence=PREFLIGHT;
meta.nextStart=NEXT;
meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="S5R 연격마스터 한국어판 001~030번 공식 삽화 12개 독립 테마 직접 검수, 신규 분류 47개. 기존 S5R_006 체리꼬 시즌 테마와 모든 91장 보유 카드 키 보존. 031~091 아직 검수 전, 완료 처리 금지.";
status.reviews[reviewKey]=meta;
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global held Korean card source changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:91,
 KoreanPrintArtworksReviewed:30,sourceImagesSelfHostedDecoded:30,
 themeSlotsAdded:47,themeCounts:counts,existingPreserved:["S5R_006:season"],
 reviewedRanges:["001-030"],status:"in_progress",complete:false,nextStart:NEXT,
 globalCheckpointPreserved:GLOBAL,manualReview:ART,ownedImagePreflight:PREFLIGHT
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:30,total:91,added:47,preserved:"S5R_006:season",
 originalMasterCardKeysUnchanged:true,globalCheckpoint:GLOBAL}));
