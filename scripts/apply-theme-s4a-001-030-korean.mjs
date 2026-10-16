import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n","utf8");
const CODE="s4a",DATE="2026-10-16",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const REVIEW="data/audits/theme-s4a-001-030-Korean-art-review-20261016.json";
const PROOF="data/audits/theme-visual-evidence/s4a/001-030/visual-index.json";
const PROGRESS="data/audits/theme-s4a-001-030-progress-20261016.json";
const NEXT="s4a Korean 031-060 printed artwork source and 12-theme visual review";
const THEMES=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review,proof,modern,legacy,themes,status,hosting,coverage]=await Promise.all([
 read(REVIEW),read(PROOF),read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/audits/theme-series-coverage.json")
]);
const master=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(master.length!==1||master[0].cards?.length!==330)
 throw Error("Expected exactly one original 330-slot Korean S4a master");
const set=master[0],masterKeys=JSON.stringify(set.cards.map(c=>c.code));
const reviewKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE)||set.code;
const meta=status.reviews?.[reviewKey]||{};
if(meta.artworkReviewedCardCount===30&&meta.reviewedRanges?.includes("001-030")){
 console.log("S4a 001-030 already applied: safe no-op");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 coverage.sets.find(s=>String(s.code).toLowerCase()===CODE)?.status!=="pending"||
 Number(meta.artworkReviewedCardCount||0)!==0||
 Number(meta.reviewedCardCount||0)!==0||
 Number(meta.newlyAddedThemeSlotCount||0)!==0||
 (meta.status&&!["pending","not_started","not-started"].includes(meta.status)))
 throw Error("Previous Korean artwork progress / global S6K source hold changed");
if(review.set!==CODE||review.range!=="001-030"||
 review.status!=="manual_Korean_artwork_12_theme_reviewed"||
 !review.all12ThemesInspected||review.artworksReviewed!==30||
 review.verifiedKoreanPrintImagesInRange!==30||review.ownedCDNImagesDecoded!==30||
 review.existingThemesInThisRange!==0||review.themeAdditions!==48||
 !review.noMasterOrOwnershipChanges||review.items?.length!==30||
 JSON.stringify(review.reviewedThemes)!==JSON.stringify(THEMES)||
 review.globalCheckpointPreserved!==GLOBAL||
 proof.set!==CODE||proof.range!=="001-030"||proof.masterCanonicalCards!==330||
 proof.checkedCardCount!==30||proof.ownedImageDecodedCount!==30||
 proof.ownedImageMissingCount!==0||proof.preExistingThemeMemberships!==0||
 proof.cards?.length!==30||proof.globalCheckpointPreserved!==GLOBAL)
 throw Error("Source manifest or visual evidence incomplete for S4a 001-030");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const theme of THEMES)if(!Array.isArray(groups.get(theme)?.cards))
 throw Error("Missing one of 12 independent themes: "+theme);
const existing=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set||"").toLowerCase()===CODE));
const oldSnapshots=existing.map(x=>JSON.stringify(x));
const originalCount=existing.length;
const additions=[],counts={};
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),id="S4a_"+num,key="s4a_"+num+"/190";
 const row=review.items[i],pre=proof.cards[i],card=set.cards[i];
 if(!row||!pre||!card||row.canonicalOrder!==n||pre.canonicalOrder!==n||
 String(row.cardKey||"").toUpperCase()!==id.toUpperCase()||
 row.name!==card.name||pre.name!==card.name||
 String(pre.code||"").toLowerCase()!==key||
 String(card.code||"").toLowerCase()!==key||
 !row.koreanPrintImageVerified||!row.artObservation?.trim()||
 !pre.sourceAppearsPokemonKoreaOfficial||
 !pre.sourceUrl?.startsWith("https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S4a/S4a_")||
 !pre.ownedUrl?.startsWith("https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S4a/S4a_")||
 pre.imageCheck?.status!=="decoded_region_unverified"||
 pre.imageCheck?.http!==200||pre.imageCheck?.format!=="WEBP")
 throw Error("Canonical Korean source identity not validated: "+num);
 const selected=new Set(row.matchedThemes||[]);
 if(selected.size!==row.matchedThemes?.length||!selected.has("color")||
 [...selected].some(t=>!THEMES.includes(t)||!row.categories?.[t]?.trim())||
 Object.keys(row.categories||{}).some(t=>!selected.has(t)))
 throw Error("S4a visual theme taxonomy invalid: "+num);
 if(themes.groups.some(g=>g.cards.some(c=>
  String(c.code||"").toUpperCase()===id.toUpperCase()||
  (String(c.set||"").toLowerCase()===CODE&&c.cardNumber===num+"/190"))))
 throw Error("Would overwrite S4a existing art member: "+num);
 for(const theme of selected){
  groups.get(theme).cards.push({
   code:id,name:card.name,series:"S",set:set.code,
   setName:set.displayName||"샤이니스타 V",cardNumber:num+"/190",
   rarity:card.rarity||"",category:row.categories[theme],
   image:pre.ownedUrl,
   evidence:"포켓몬코리아 한국어 인쇄판 S4a "+num+"/190 실물 일러스트 12테마 시각 확인 및 DCB CDN 소장 검증. "+row.artObservation+" ("+REVIEW+")"
  });
  counts[theme]=(counts[theme]||0)+1;
  additions.push({number:n,theme});
 }
}
if(additions.length!==48||
 THEMES.some(t=>(counts[t]||0)!==(review.themeCounts?.[t]||0))||
 JSON.stringify(set.cards.map(c=>c.code))!==masterKeys||
 existing.length!==originalCount||
 existing.some((c,i)=>JSON.stringify(c)!==oldSnapshots[i]||
 !themes.groups.some(g=>g.cards.includes(c))))
 throw Error("Theme allocation corrupted previous collection or master keys");
meta.artworkReviewedCardCount=30;meta.reviewedCardCount=30;
meta.verifiedKoreanPrintImageCount=30;meta.verifiedSelfHostedImageCount=30;
meta.reviewedRanges=["001-030"];meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=48;meta.partialReviewEvidence=REVIEW;
meta.imagePreflightEvidence=PROOF;meta.nextStart=NEXT;meta.reviewedAt=DATE;
meta.status="in_progress";meta.complete=false;
meta.note="S4a 샤이니스타 V 총 330장 중 첫 30장 한국어판 실물 이미지 12개 테마 검수 완료. 테마 항목 48개 신규 추가, 기존 모든 테마/보유 카드 키 유지. 나머지 300장 아직 검수 전이며 완료로 표시하면 안 됨.";
status.reviews[reviewKey]=meta;status.updatedAt=DATE;themes.updatedAt=DATE;
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL)
 throw Error("Existing S6K Korean source hold changed");
await Promise.all([
 save("data/art-themes.json",themes),
 save("data/audits/theme-series-review-status.json",status),
 save(PROGRESS,{
  schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:330,
  KoreanPrintArtworksReviewed:30,sourceImagesSelfHostedDecoded:30,
  newlyAddedThemeSlots:48,priorThemeMembershipsPreserved:originalCount,
  reviewedRanges:["001-030"],status:"in_progress",complete:false,
  nextStart:NEXT,globalCheckpointPreserved:GLOBAL,
  manualReview:REVIEW,ownedImagePreflight:PROOF,
  remainingImageAndArtworkCount:300
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:30,total:330,addedThemeSlots:48,
 previouslyExistingPreserved:originalCount,cardIDsUnchanged:true,
 globalCheckpointPreserved:GLOBAL}));
