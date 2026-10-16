import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n");
const CODE="s5a",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const ART="data/audits/theme-s5a-061-070-Korean-art-review-20261016.json";
const PREFLIGHT="data/audits/theme-visual-evidence/s5a/061-070/visual-index.json";
const PREVIOUS="data/audits/theme-s5a-031-060-progress-20261016.json";
const PROGRESS="data/audits/theme-s5a-061-070-progress-20261016.json";
const NEXT="s5a Korean rare print source verification pending: 071-096";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage,prev]=await Promise.all([
 read(ART),read(PREFLIGHT),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json"),read(PREVIOUS)
]);
const sets=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE);
if(sets.length!==1||sets[0].cards?.length!==96)throw Error("S5a canonical 96-slot database changed");
const set=sets[0],origCodes=set.cards.map(c=>c.code);
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!key)throw Error("Missing previous S5a review checkpoint");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===70&&meta.reviewedRanges?.includes("061-070")){
 console.log("S5a 061-070 already applied; safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 meta.status!=="in_progress"||meta.reviewedCardCount!==60||
 meta.artworkReviewedCardCount!==60||meta.verifiedKoreanPrintImageCount!==60||
 meta.verifiedSelfHostedImageCount!==60||meta.newlyAddedThemeSlotCount!==99||
 meta.nextStart!=="s5a canonical 061-096"||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030","031-060"])||
 prev.artworkReviewed!==60||prev.totalNewThemeSlots!==99||
 prev.globalCheckpointPreserved!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="in_progress")
 throw Error("Checkpoint changed; refuse unsafe S5a 061-070 mutation");
if(review.set!==CODE||review.range!=="061-070"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==10||
 review.verifiedKoreanPrintImagesInRange!==10||
 review.sourceImagesRequested!==0||review.globalHoldUnchanged!==GLOBAL||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 JSON.stringify(review.preexistingKept)!==JSON.stringify(["S5a_061:season"])||
 review.items?.length!==10||review.themeAdditions!==16||
 proof.set!==CODE||proof.range!=="061-070"||proof.checkedCardCount!==10||
 proof.ownedImageDecodedCount!==10||proof.ownedImageUnavailableCount!==0||
 proof.existingS5a061SeasonThemePreserve!==true||
 proof.foreignSourceRareCardsReviewHeldRange!=="071-096"||
 proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Korean official card photo preflight or review evidence changed");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of THEMES)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing 12-theme group "+t);
const existing=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
if(existing.length!==100)throw Error("Existing 99 new and one original S5a themes altered: "+existing.length);
const original061=groups.get("season").cards.filter(c=>String(c.code).toUpperCase()==="S5A_061");
if(original061.length!==1||original061[0].name!=="수리둥보"||
 original061[0].cardNumber!=="061/070")
 throw Error("Preserve original spring S5a 061 season membership");
const originalSeason061=JSON.stringify(original061[0]);
const additions=[],counts={};
for(let i=0;i<10;i++){
 const n=i+61,id=String(n).padStart(3,"0"),key="S5a_"+id,code="s5a_"+id+"/070";
 const row=review.items[i],pre=proof.cards[i],master=set.cards[n-1];
 if(!row||!pre||!master||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 row.cardKey!==key||row.name!==master.name||pre.name!==master.name||
 master.code?.toLowerCase()!==code||pre.code?.toLowerCase()!==code||
 pre.printedNumber!==id+"/070"||!row.koreanPrintImageVerified||
 !row.artObservation?.trim()||pre.imageCheck?.status!=="decoded"||
 pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP"||
 pre.imageCheck?.dimensions?.[0]!==420||pre.imageCheck?.dimensions?.[1]!==586||
 !pre.rawSource?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S5a/S5a_")||
 !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S5a/S5a_"))
 throw Error("Unverified official Korean card/photo "+id);
 const chosen=new Set(row.matchedThemes||[]);
 if(chosen.size!==row.matchedThemes?.length||!chosen.has("color")||
 [...chosen].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!chosen.has(t)))
 throw Error("Invalid visual 12-theme classification "+id);
 const priorForCard=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.code||"").toUpperCase()===key.toUpperCase()));
 if(n===61){
   if(priorForCard.length!==1||priorForCard[0]!==original061[0])
     throw Error("Unexpected preexisting S5a 061 artwork memberships");
 }else if(priorForCard.length)throw Error("Refuse to overwrite existing S5a artwork "+id);
 for(const t of chosen){
   if(n===61&&t==="season"){
     if(!groups.get(t).cards.includes(original061[0]))
       throw Error("Preserve S5a 061 spring artwork");
     continue;
   }
   groups.get(t).cards.push({
     code:key,name:master.name,series:"S",set:set.code,
     setName:set.displayName||"쌍벽의 파이터",
     cardNumber:id+"/070",rarity:master.rarity||"",
     category:row.categories[t],image:pre.ownedUrl,
     evidence:"한국어 인쇄 공식 S5a "+id+"/070 12개 테마 시각 검수: "+
       row.artObservation+" ("+ART+")"
   });
   counts[t]=(counts[t]||0)+1;additions.push({number:n,theme:t});
 }
}
if(additions.length!==16||THEMES.some(t=>(counts[t]||0)!==
 (review.themeCounts?.[t]||0)-(t==="season"?1:0))||
 JSON.stringify(set.cards.map(c=>c.code))!==JSON.stringify(origCodes)||
 JSON.stringify(original061[0])!==originalSeason061)
 throw Error("Theme counts or original IDs/season card changed");
meta.artworkReviewedCardCount=70;
meta.reviewedCardCount=70;
meta.verifiedKoreanPrintImageCount=70;
meta.verifiedSelfHostedImageCount=70;
meta.reviewedRanges=["001-030","031-060","061-070"];
meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=115;
meta.partialReviewEvidence=ART;
meta.imagePreflightEvidence=PREFLIGHT;
meta.nextStart=NEXT;
meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="쌍벽의 파이터 공식 한국판 001~070번 실제 이미지 12개 독립 테마 전수 검수, 신규 테마 항목 누적 115개. 기존 S5a_061 봄·벚꽃 시즌 테마 보존, 카드 원본 보유 키 96개 모두 그대로. 희귀 071~096 26장의 한국판 인쇄 이미지 불확실하여 완료 처리 금지. S6K 글로벌 보류 그대로.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global Korean source holds unexpectedly altered");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
   schemaVersion:1,recordedAt:DATE,set:set.code,totalMasterCards:96,
   artworkReviewed:70,verifiedKoreanPrints:70,reviewedRanges:["001-030","031-060","061-070"],
   existingThemePreserved:"S5a_061:season",newlyAddedThemeSlotsThisBatch:16,
   newlyAddedThemeSlotsCumulative:115,heldRareCardNumbers:Array.from({length:26},(_,i)=>71+i),
   rareImageStatus:"unverified_Korean_print_pending",status:"in_progress",complete:false,
   nextStart:NEXT,globalCheckpointPreserved:GLOBAL,manualReview:ART,
   verifiedOwnedImageEvidence:PREFLIGHT
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:70,total:96,newThemeSlots:16,
 cumulativeNewThemeSlots:115,unverifiedRares:26,next:NEXT,globalCheckpoint:GLOBAL}));
