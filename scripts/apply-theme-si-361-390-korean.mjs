import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async (p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides,preflight]=await Promise.all([
 read(A+"theme-si-361-390-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SI/361-390/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
 read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json"),
 read(A+"theme-si-361-390-preflight-20261014.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()==="SI");
if(sets.length!==1||sets[0].cards?.length!==430)throw Error("Korean SI master must have exactly 430 card slots");
const master=sets[0],prior=state.reviews?.SI;
if(prior?.reviewedCardCount>=390&&prior.reviewedRanges?.includes("361-390")){
 console.log("SI 361-390 already applied; skip and preserve prior work");process.exit(0);
}
if(prior?.status!=="in_progress"||prior.reviewedCardCount!==360||
 prior.reviewedRanges?.at(-1)!=="331-360"||prior.nextStart!=="SI canonical 361"||
 images.nextStart!=="SI canonical 361"||
 preflight.range!=="canonical-order 361-390"||
 ev.range!=="canonical-order 361-390"||ev.expectedCanonicalCards!==430||
 ev.KoreanArtworkVisualReview!==true||ev.physicallyNumberedCardsReviewed!==30||
 ev.ownedCdnImagesDecoded!==30||ev.originImageRequests!==0||
 ev.all12ThemesInspectedForThisRange!==true||ev.items?.length!==30||
 index.masterSetCardCount!==430||index.canonicalRange!=="361-390"||
 index.cardCount!==30||index.cards?.length!==30||
 index.verificationCounts?.verified!==30||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)
 throw Error("SI 361-390 preflight / exact Korean art evidence / prior checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing thematic group "+t);
for(const g of art.groups)for(const c of g.cards||[]){
 const m=/^SI_(\d{3})$/.exec(String(c.code||"").toUpperCase());
 if(m&&+m[1]>=361&&+m[1]<=390)throw Error("Existing SI 361-390 theme; do not duplicate or overwrite "+c.code+"/"+g.code);
}
overrides.sets??={};overrides.sets.si??={};
let checked=0,addedCount=0;const added={};
for(let i=0;i<30;i++){
 const n=361+i,num=String(n).padStart(3,"0");
 const card=master.cards[n-1],proof=index.cards[i],row=ev.items[i];
 if(!card||!proof||!row||row.canonicalOrder!==n||proof.canonicalOrder!==n||
  card.code.toLowerCase()!=="si_"+num+"/414"||
  row.cardKey!=="SI_"+num||row.printedNumber!==num+"/414"||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  proof.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.koreanName!==card.name||proof.name!==card.name||
  row.ownedCDNUrl!==proof.cdnUrl||
  !row.imageInKorean||!row.all12ThemesInspected||!row.observation?.trim()||
  row.originalSourceRequests!==0||row.existingThemes?.length!==0||
  !Array.isArray(row.matchedThemes)||new Set(row.matchedThemes).size!==row.matchedThemes.length||
  row.proofImage!==A+"theme-visual-evidence/SI/361-390/SI-361-390-"+String(Math.ceil((i+1)/15)).padStart(2,"0")+".webp.b64"||
  proof.imageCheck?.status!=="decoded"||proof.imageCheck?.http!==200||
  proof.imageCheck?.format!=="WEBP"||proof.imageCheck?.dimensions?.join(",")!=="420,586"||
  !proof.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
  throw Error("Korean master / image proof mismatch for SI "+n);
 // Require explicit positive artwork grounds and do not classify trainer item-only drawings.
 if(n<=363){
  if(row.illustrationType!=="pokemon"||!row.matchedThemes.includes("color"))
   throw Error("Missing direct visual Pokémon theme review "+num);
 } else if(row.illustrationType==="pokemon"||row.matchedThemes.length)
  throw Error("Trainer/item incorrectly categorized as thematic Pokemon art "+num);
 if(card.image!==proof.cdnUrl){
  if(card.image&&!card.sourceImage)card.sourceImage=card.image;
  card.image=proof.cdnUrl;
 }
 overrides.sets.si[card.code.toLowerCase()]=proof.cdnUrl;
 checked++;
 for(const theme of row.matchedThemes){
  if(!T.includes(theme))throw Error("Unexpected theme "+theme);
  groups.get(theme).cards.push({
   code:row.cardKey,name:card.name,series:"S",set:"SI",setName:master.displayName,
   cardNumber:num+"/414",rarity:card.rarity||"",
   category:theme==="color"?row.colorCategory:theme==="night"?"밤하늘":theme==="season"?"계절·풍경":theme==="food"?"음식":theme==="work"?"일하는 포켓몬":"기타",
   image:proof.cdnUrl,
   evidence:"한국판 SI "+num+"/414 실제 일러스트 12테마 판독: "+row.observation+
    ". 이미지 증빙 "+row.proofImage+"; 사용자 소유 CDN 디코딩 완료, 원본 외부 핫링크 없음."
  });
  added[theme]=(added[theme]||0)+1;addedCount++;
 }
}
const expected={night:1,season:2,color:3,food:1,work:1};
if(checked!==30||addedCount!==8||
 JSON.stringify(Object.entries(added).sort())!==JSON.stringify(Object.entries(expected).sort())||
 JSON.stringify(Object.entries(ev.themeCounts).sort())!==JSON.stringify(Object.entries(expected).sort()))
 throw Error("30 Korean cards / 8 new theme slots count inconsistent");
state.reviews.SI={...prior,reviewedAt:"2026-10-14",reviewedCardCount:390,
 reviewedRanges:[...prior.reviewedRanges,"361-390"],
 verifiedSelfHostedImageCount:390,
 newlyAddedThemeSlotCount:prior.newlyAddedThemeSlotCount+addedCount,
 partialReviewEvidence:A+"theme-si-361-390-Korean-art-review-20261014.json",
 archiveVerificationStatus:"SI_001-390_390_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 nextStart:"SI canonical 391",
 note:"SI 한국판 001/414-390/414 이미지 390장 검증 및 12테마 판독. 361-363 포켓몬 관련 8개 테마 슬롯 추가, 364-390 도구/서포트 27장은 12테마 확인 후 비대상 처리. 외부 원본 트래픽 0, 수집 내역 보존."};
state.execution.currentEra="S";state.execution.currentSet="SI";
state.execution.lastSafeCheckpoint="SI canonical 001-390 (390/430) Korean artwork reviewed; previous 360 preserved";
state.execution.nextStart="SI canonical 391";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SI",range:"canonical 361-390 Korean Start Deck 100",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:added,excludedTrainerOrItemCardCount:27,nextStart:"SI canonical 391",
 note:"30 Korean printed SI artworks inspected; 3 Pokémon and 27 trainer/item cards. CDN ownership mapped without original-origin requests. No collected ownership changed."});
images.nextStart="SI canonical 391";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"SI",status:"in_progress",
 masterCards:430,reviewedCardCount:390,remainingUnreviewed:40,verifiedOwnCDNImages:390,
 newlyAddedThisBatch:addedCount,totalNewThemeSlots:state.reviews.SI.newlyAddedThemeSlotCount,
 themeAdditionsThisBatch:added,nonThematicTrainerOrItemCards:27,
 fullReviewEvidence:A+"theme-si-361-390-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SI canonical 391"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-si-361-390-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"SI",artReviewed:checked,themeSlotsAdded:addedCount,
 themes:added,excludedItems:27,totalVerified:390,next:images.nextStart,originRequests:0}));
