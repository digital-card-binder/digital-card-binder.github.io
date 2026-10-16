import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s4",DATE="2026-10-17";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s4-001-030-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s4/001-030/visual-index.json";
const PROGRESS="data/audits/theme-s4-001-030-progress-20261017.json";
const NEXT="s4 Korean 031-060 printed artwork source and 12-theme visual review";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json")
]);
const source=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(source.length!==1||source[0].cards?.length!==121)throw Error("Original S4 121-card master changed");
const set=source[0],originalKeys=JSON.stringify(set.cards.map(c=>c.code));
const existingStatus=Object.entries(status.reviews||{}).find(([k])=>k.toLowerCase()===CODE);
if(existingStatus?.[1]?.artworkReviewedCardCount===30&&
 existingStatus[1].reviewedRanges?.includes("001-030")&&
 existingStatus[1].newlyAddedThemeSlotCount===53){
 console.log("S4 first 30 Korean visual audit already applied, safe no-op");process.exit(0);
}
if(existingStatus||status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="pending")
 throw Error("S4 initial checkpoint or global s6K holds changed; stop instead of overwriting");
if(review.set!==CODE||review.range!=="001-030"||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.status!=="manual_Korean_art_12_theme_reviewed"||!review.all12ThemesInspected||
 review.existingThemesInThisRange!==1||review.themeAdditions!==53||
 !review.noMasterOrOwnershipChanges||review.items?.length!==30||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.range!=="001-030"||proof.masterCanonicalCards!==121||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==1||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Insufficient S4 Korean review or owned image evidence");
const groupByCode=new Map(themes.groups.map(g=>[g.code,g]));
if(groupByCode.size!==12||THEMES.some(t=>!Array.isArray(groupByCode.get(t)?.cards)))
 throw Error("Twelve independent theme groups changed");
const before=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
const beforeJson=before.map(c=>JSON.stringify(c));
const inRange=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE&&
 /^S4_0(?:0[1-9]|[12][0-9]|30)$/i.test(String(c.code||"")))
 .map(c=>({group:g.code,id:c.code})));
if(inRange.length!==1||inRange[0].group!=="food"||
 String(inRange[0].id).toUpperCase()!=="S4_027")
 throw Error("Existing S4 artwork group membership does not match preserved food entry");
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),id="S4_"+num,canonical="s4_"+num+"/100";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[i];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==id.toUpperCase()||
 row.name!==card.name||pre.name!==card.name||
 String(pre.code||"").toLowerCase()!==canonical||
 String(card.code||"").toLowerCase()!==canonical||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 row.sourceEvidence!=="pokemonkorea-catalogue-url-and-dcb-owned-decoded-image"||
 !pre.sourceAppearsPokemonKoreaOfficial||
 pre.sourceHost!=="cards.image.pokemonkorea.co.kr"||
 pre.sourceUrl!=="https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S4/S4_"+num+".png"||
 pre.ownedUrl!=="https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S4/S4_"+num+".webp"||
 pre.imageCheck?.status!=="decoded_region_unverified"||
 pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP"||
 !/^[0-9a-f]{64}$/.test(pre.imageCheck?.sha256||"")||
 pre.imageCheck?.dimensions?.[0]!==420||
 pre.imageCheck?.dimensions?.[1]!==586||
 !["C","U","R","RR","RRR"].includes(row.rarity))
 throw Error("S4 Korean printed artwork identity or source failed for "+num);
 const selection=new Set(row.matchedThemes||[]);
 if(selection.size!==row.matchedThemes?.length||!selection.has("color")||
 [...selection].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selection.has(t)))
 throw Error("Invalid S4 12-theme review at "+num);
 const expectedExisting=n===27?["food"]:[];
 if(JSON.stringify(row.preExistingThemeRecordsPreserved)!==JSON.stringify(expectedExisting)||
 JSON.stringify(pre.preExistingThemeMemberships||[])!==JSON.stringify(expectedExisting))
 throw Error("Existing S4_027 food slot not preserved");
 for(const theme of selection){
  if(expectedExisting.includes(theme))continue;
  const group=groupByCode.get(theme);
  if(group.cards.some(c=>String(c.code||"").toUpperCase()===id.toUpperCase()||
   (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/100")))
   throw Error("Duplicate S4 theme membership "+id+"/"+theme);
  group.cards.push({
   code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"앙천의 볼트태클",
   cardNumber:num+"/100",rarity:card.rarity||row.rarity,
   category:row.categories[theme],image:pre.ownedUrl,
   evidence:"포켓몬코리아 한국어 인쇄 S4 "+num+"/100 카드 및 DCB 자체 보관 WebP 시각 검수. "+row.artObservation+" ("+REVIEW+")"
  });
  additions.push({n,theme});
  counts[theme]=(counts[theme]||0)+1;
 }
}
const verifiedCounts=Object.fromEntries(THEMES.map(t=>[t,(review.themeCounts?.[t]||0)-(t==="food"?1:0)]));
if(additions.length!==53||THEMES.some(t=>(counts[t]||0)!==verifiedCounts[t])||
 JSON.stringify(set.cards.map(c=>c.code))!==originalKeys||
 before.some((c,i)=>JSON.stringify(c)!==beforeJson[i]))
 throw Error("Added S4 artwork classifications did not match approved review");
status.reviews[CODE]={
 artworkReviewedCardCount:30,reviewedCardCount:30,
 verifiedKoreanPrintImageCount:30,verifiedSelfHostedImageCount:30,
 reviewedRanges:["001-030"],reviewedThemes:THEMES,
 newlyAddedThemeSlotCount:53,preservedExistingThemeSlotCount:1,
 partialReviewEvidence:REVIEW,imagePreflightEvidence:PROOF,
 nextStart:NEXT,reviewedAt:DATE,status:"in_progress",complete:false,
 note:"S4 121장 중 한국어 인쇄 이미지 001-030번 30장과 자체 CDN 복제본 및 12테마 삽화 시각검수. 새로운 53개 테마 수록, 기존 S4_027 음식 테마 1개 무수정 유지. 031-121번 추가 검수 전 세트 complete 금지."
};
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global s6K Korean hold has changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
 schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:121,
 KoreanPrintArtworksReviewed:30,sourceImagesSelfHostedDecoded:30,
 newlyAddedThemeSlotsThisBatch:53,existingThemeSlotsPreserved:1,
 reviewedRanges:["001-030"],status:"in_progress",complete:false,
 nextStart:NEXT,globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
 ownedImagePreflight:PROOF,remainingImageAndArtworkCount:91
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:30,total:121,newThemeSlots:53,
existingThemeRecordsPreserved:true,cardKeysUnchanged:true,globalHoldPreserved:true}));
