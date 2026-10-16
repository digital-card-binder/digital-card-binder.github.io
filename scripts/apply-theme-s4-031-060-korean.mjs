import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n","utf8");
const CODE="s4",DATE="2026-10-17";
const GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s4-031-060-Korean-art-review-20261017.json";
const PROOF="data/audits/theme-visual-evidence/s4/031-060/visual-index.json";
const PREVIOUS="data/audits/theme-s4-001-030-progress-20261017.json";
const PROGRESS="data/audits/theme-s4-031-060-progress-20261017.json";
const NEXT="s4 Korean 061-090 printed artwork source and 12-theme visual review";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,previous,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read(PREVIOUS),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-series-coverage.json")
]);
const source=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(source.length!==1||source[0].cards?.length!==121)throw Error("Original S4 121-card master changed");
const set=source[0],originalKeys=JSON.stringify(set.cards.map(c=>c.code));
const key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE);
if(!key)throw Error("Previous S4 first 30 approved status missing");
const meta=status.reviews[key];
if(meta.artworkReviewedCardCount===60&&
 meta.reviewedRanges?.includes("031-060")&&
 meta.newlyAddedThemeSlotCount===103){
 console.log("S4 second 30 Korean visual audit already applied, safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(x=>String(x.code).toLowerCase()===CODE)?.status!=="in_progress"||
 meta.status!=="in_progress"||meta.complete!==false||
 meta.artworkReviewedCardCount!==30||meta.reviewedCardCount!==30||
 meta.verifiedKoreanPrintImageCount!==30||meta.verifiedSelfHostedImageCount!==30||
 meta.newlyAddedThemeSlotCount!==53||meta.preservedExistingThemeSlotCount!==1||
 JSON.stringify(meta.reviewedRanges)!==JSON.stringify(["001-030"])||
 previous.KoreanPrintArtworksReviewed!==30||
 previous.newlyAddedThemeSlotsThisBatch!==53||
 previous.existingThemeSlotsPreserved!==1||
 previous.globalCheckpointPreserved!==GLOBAL||previous.totalMasterCards!==121)
 throw Error("Approved S4 001-030 checkpoint or existing S6K held items changed; refusing write");
if(review.set!==CODE||review.range!=="031-060"||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.status!=="manual_Korean_art_12_theme_reviewed"||!review.all12ThemesInspected||
 review.existingThemesInThisRange!==0||review.themeAdditions!==50||
 !review.noMasterOrOwnershipChanges||review.items?.length!==30||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.range!=="031-060"||proof.masterCanonicalCards!==121||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Insufficient S4 031-060 Korean print or owned-image evidence");
const groupByCode=new Map(themes.groups.map(g=>[g.code,g]));
if(groupByCode.size!==12||THEMES.some(t=>!Array.isArray(groupByCode.get(t)?.cards)))
 throw Error("One or more of twelve independent themes missing");
const before=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
const beforeJson=before.map(c=>JSON.stringify(c));
const priorFood=groupByCode.get("food").cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE&&String(c.code||"").toUpperCase()==="S4_027");
if(priorFood.length!==1||before.length!==55)
 throw Error("Expected first approved S4 53 new and 2 pre-existing entries missing");
const inRange=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.set||"").toLowerCase()===CODE &&
 /^S4_0(?:3[1-9]|[4-5][0-9]|60)$/i.test(String(c.code||""))));
if(inRange.length!==0)throw Error("Existing S4 031-060 theme slot unexpectedly present");
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=i+31,num=String(n).padStart(3,"0"),id="S4_"+num,canonical="s4_"+num+"/100";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[n-1];
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
 !["C","U","R","RR","RRR"].includes(row.rarity)||
 JSON.stringify(row.preExistingThemeRecordsPreserved)!=="[]"||
 JSON.stringify(pre.preExistingThemeMemberships||[])!=="[]")
 throw Error("S4 source, artwork, print, or original theme mismatch "+num);
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("Invalid S4 12-theme review "+num);
 for(const theme of selected){
  const group=groupByCode.get(theme);
  if(group.cards.some(c=>String(c.code||"").toUpperCase()===id.toUpperCase()||
    (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/100")))
   throw Error("Duplicate theme member "+id+"/"+theme);
  group.cards.push({
   code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"앙천의 볼트태클",cardNumber:num+"/100",
   rarity:card.rarity||row.rarity,category:row.categories[theme],
   image:pre.ownedUrl,
   evidence:"포켓몬코리아 한국어 인쇄 S4 "+num+"/100 카드 및 DCB 자체 보관 WebP 시각 검수. "+row.artObservation+" ("+REVIEW+")"
  });
  additions.push({n,theme});
  counts[theme]=(counts[theme]||0)+1;
 }
}
if(additions.length!==50||
 THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==originalKeys||
 before.some((c,i)=>JSON.stringify(c)!==beforeJson[i]))
 throw Error("S4 theme additions differ from artwork review or alter earlier slots");
meta.artworkReviewedCardCount=60;meta.reviewedCardCount=60;
meta.verifiedKoreanPrintImageCount=60;meta.verifiedSelfHostedImageCount=60;
meta.reviewedRanges=["001-030","031-060"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=103;meta.preservedExistingThemeSlotCount=1;
meta.partialReviewEvidence=REVIEW;meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="S4 121장 중 001-060번 한국어 인쇄 카드 실물 및 자체 CDN 이미지의 12개 테마 시각검수 완료. 031-060 신규 50개, 누적 신규 103개 테마 슬롯. 최초 S4_027 음식 테마 및 모든 카드 보유 키 변경 금지. 061-121 검수 전 complete 금지.";
status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Global S6K printed image evidence holds lost");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
  schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:121,
  KoreanPrintArtworksReviewed:60,sourceImagesSelfHostedDecoded:60,
  newlyAddedThemeSlotsThisBatch:50,newlyAddedThemeSlotsCumulative:103,
  existingThemeSlotsPreserved:1,reviewedRanges:["001-030","031-060"],
  status:"in_progress",complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
  ownedImagePreflight:PROOF,remainingImageAndArtworkCount:61
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:60,total:121,newThemeSlotsThisBatch:50,cumulativeNewSlots:103,existingPreserved:true,masterUnchanged:true,globalHoldPreserved:true}));
