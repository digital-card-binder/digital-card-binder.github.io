import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-si-331-360-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SI/331-360/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
 read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const found=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()==="SI");
if(found.length!==1||found[0].cards?.length!==430)throw Error("Korean SI master no longer exactly 430 slots");
const master=found[0],prior=state.reviews?.SI;
if(prior?.reviewedCardCount>=360&&prior.reviewedRanges?.includes("331-360")){
 console.log("SI 331-360 already applied, no overwrite");process.exit(0);
}
if(prior?.status!=="in_progress"||prior.reviewedCardCount!==330||
 prior.reviewedRanges?.join(",")!=="001-030,031-060,061-090,091-120,121-150,151-180,181-210,211-240,241-270,271-300,301-330"||
 images.nextStart!=="SI canonical 331"||
 ev.set!=="SI"||ev.expectedCanonicalCards!==430||ev.range!=="canonical-order 331-360"||
 ev.physicallyNumberedCardsReviewed!==30||ev.items?.length!==30||
 ev.ownedCdnImagesDecoded!==30||ev.originImageRequests!==0||
 index.masterSetCardCount!==430||index.canonicalRange!=="331-360"||index.cardCount!==30||
 index.verificationCounts?.verified!==30||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)throw Error("SI 331-360 checkpoint or visual evidence not ready");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing theme "+t);
let protected342=0,originalSleeping342;
for(const g of art.groups)for(const c of g.cards||[]){
 const m=/^SI_(\d{3})$/.exec(String(c.code||"").toUpperCase());
 if(m&&+m[1]>=331&&+m[1]<=360){
  if(+m[1]===342&&g.code==="sleeping"){protected342++;originalSleeping342=c;}
  else throw Error("Prior SI 331-360 theme must not be overwritten: "+c.code+"/"+g.code);
 }
}
if(protected342!==1||!index.cards[11]?.existingThemes?.includes("sleeping")||
 !ev.preExistingThemeSlotsToPreserve?.some(x=>x.cardKey==="SI_342"&&x.theme==="sleeping"))
 throw Error("Original SI_342 Korean sleeping classification must exist exactly once");
overrides.sets??={};overrides.sets.si??={};
let checked=0,assignments=0;const added={};
for(let i=0;i<30;i++){
 const n=i+331,num=String(n).padStart(3,"0"),c=master.cards[n-1],p=index.cards[i],row=ev.items[i];
 if(!c||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
 c.code.toLowerCase()!=="si_"+num+"/414"||
 row.cardKey!=="SI_"+num||String(row.masterCode).toLowerCase()!==c.code.toLowerCase()||
 String(p.masterCode).toLowerCase()!==c.code.toLowerCase()||
 row.koreanName!==c.name||p.name!==c.name||
 row.ownedCDNUrl!==p.cdnUrl||row.physicalPrintedNumber!==num+"/414"||
 row.syntheticIdentifierOnly||!row.imageInKorean||!row.all12ThemesInspected||
 !row.artObservation?.trim()||
 !Array.isArray(row.matchedThemes)||new Set(row.matchedThemes).size!==row.matchedThemes.length||
 !row.matchedThemes.includes("color")||
 row.proofImage!=="data/audits/theme-visual-evidence/SI/331-360/SI-331-360-"+String(Math.ceil((i+1)/15)).padStart(2,"0")+".webp.b64"||
 p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
 p.imageCheck?.dimensions?.join(",")!=="420,586"||
 !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
 throw Error("SI 331-360 Korean printed identity or owned CDN mismatch "+n);
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage)c.sourceImage=c.image;c.image=p.cdnUrl;}
 overrides.sets.si[c.code.toLowerCase()]=p.cdnUrl;
 checked++;
 for(const t of row.matchedThemes){
  if(!T.includes(t))throw Error("Unknown theme: "+t);
  if(row.cardKey==="SI_342"&&t==="sleeping"){
   if(!row.preExistingThemes?.includes("sleeping"))throw Error("SI_342 preserved sleeping evidence mismatch");
   if(originalSleeping342.image!==p.cdnUrl)originalSleeping342.image=p.cdnUrl;
   continue;
  }
  groups.get(t).cards.push({code:row.cardKey,name:c.name,series:"S",set:"SI",setName:master.displayName,
   cardNumber:num+"/414",rarity:c.rarity||"",
   category:t==="color"?row.colorCategory:t==="sunset"?"노을·황혼":t==="street"?"거리·공원":t==="season"?"계절·풍경":t==="reflections"?"수면 반사":t==="night"?"밤하늘":t==="cameo"?"배경 포켓몬":t==="food"?"음식":t==="sleeping"?"잠자는 포켓몬":"기타",
   image:p.cdnUrl,
   evidence:"한국판 SI 실제 카드 그림을 12테마로 시각검수: "+row.artObservation+
   ". 증빙 "+row.proofImage+"; 사용자 소유 CDN에서 디코딩 완료. 외부 원본 핫링크 없음."});
  added[t]=(added[t]||0)+1;assignments++;
 }
}
if(checked!==30||assignments!==56||
 added.color!==30||added.season!==20||added.street!==2||added.sleeping!==1||added.food!==3||
 Object.keys(added).length!==5||
 JSON.stringify(Object.fromEntries(Object.entries(added).sort()))!==
 JSON.stringify(Object.fromEntries(Object.entries({...ev.themeCounts,sleeping:ev.themeCounts.sleeping-1}).sort())))
 throw Error("Verified 30 cards/56 new separate theme slots do not match actual Korean artwork evidence");
state.reviews.SI={...prior,reviewedAt:"2026-10-14",reviewedCardCount:360,
 reviewedRanges:[...prior.reviewedRanges,"331-360"],
 verifiedSelfHostedImageCount:360,
 newlyAddedThemeSlotCount:prior.newlyAddedThemeSlotCount+assignments,
 partialReviewEvidence:A+"theme-si-331-360-Korean-art-review-20261014.json",
 archiveVerificationStatus:"SI_001-360_360_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 nextStart:"SI canonical 361",
 note:"SI 한국판 001/414-360/414 시각검수 360장, 자체 CDN 360장 검증, 나머지 70장 미검수. 기존 SI_342 수면 분류와 수집 정보 유지. 기존 SI_342 수면 테마/수집 데이터 유지."};
state.execution.currentEra="S";state.execution.currentSet="SI";
state.execution.lastSafeCheckpoint="SI canonical 001-360 (360/430) Korean artwork checked; previous 330 and original SI_342 preserved";
state.execution.nextStart="SI canonical 361";
state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SI",range:"canonical 331-360 Korean Start Deck 100",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:added,nextStart:"SI canonical 361",
 note:"30 Korean printed SI images visually classified; 0 offsite image requests; master identity and ownership unchanged."});
images.nextStart="SI canonical 361";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const prog={schemaVersion:1,recordedAt:"2026-10-14",set:"SI",status:"in_progress",masterCards:430,
 reviewedCardCount:240,remainingUnreviewed:70,verifiedOwnCDNImages:360,
 newlyAddedThisBatch:assignments,totalNewThemeSlots:state.reviews.SI.newlyAddedThemeSlotCount,
 themeAdditionsThisBatch:added,
 fullReviewEvidence:A+"theme-si-331-360-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SI canonical 361"};
await Promise.all([save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-si-331-360-progress-20261014.json",prog)]);
console.log(JSON.stringify({set:"SI",artReviewed:checked,themeSlots:assignments,added,
 totalVerified:360,next:images.nextStart,originRequests:0}));
