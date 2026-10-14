import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/";
const T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,left,right,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-si-391-430-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SI/391-420/visual-index.json"),
 read(A+"theme-visual-evidence/SI/421-430/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
 read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SI");
if(matches.length!==1||matches[0].cards?.length!==430)throw Error("SI Korean master no longer has 430 cards");
const master=matches[0],prior=state.reviews?.SI;
if(prior?.status==="complete"&&prior.reviewedCardCount===430){
 console.log("SI Korean Start Deck 100 already complete, do not overwrite");process.exit(0);
}
if(prior?.status!=="in_progress"||prior.reviewedCardCount!==390||
 prior.reviewedRanges?.at(-1)!=="361-390"||prior.nextStart!=="SI canonical 391"||
 prior.verifiedSelfHostedImageCount!==390||
 images.nextStart!=="SI canonical 391"||
 ev.set!=="SI"||ev.range!=="canonical-order 391-430"||
 ev.KoreanArtworkVisualReview!==true||ev.expectedCanonicalCards!==430||
 ev.physicallyNumberedCardsReviewed!==40||ev.ownedCdnImagesDecoded!==40||
 ev.originImageRequests!==0||!ev.all12ThemesInspectedForThisRange||
 ev.items?.length!==40||
 left.masterSetCardCount!==430||left.canonicalRange!=="391-420"||
 left.cardCount!==30||left.cards?.length!==30||left.verificationCounts?.verified!==30||
 left.verificationCounts?.missing!==0||left.masterMissingKoreanNames!==0||
 right.masterSetCardCount!==430||right.canonicalRange!=="421-430"||
 right.cardCount!==10||right.cards?.length!==10||right.verificationCounts?.verified!==10||
 right.verificationCounts?.missing!==0||right.masterMissingKoreanNames!==0)
 throw Error("SI 391-430 exact Korean image proofs or previous safe checkpoint missing");
const records=[...left.cards,...right.cards];
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing thematic group "+t);
for(const g of art.groups)for(const c of g.cards||[]){
 const m=/^SI_(\d{3})$/.exec(String(c.code||"").toUpperCase());
 if(m&&+m[1]>=391&&+m[1]<=430)throw Error("Previous SI 391-430 theme must not be overwritten: "+c.code+"/"+g.code);
}
overrides.sets??={};overrides.sets.si??={};
const expectedColor=new Set([415,416,417,420,421,422]);
let checked=0,added=0,nonThematic=0;const themeAdditions={};
for(let i=0;i<40;i++){
 const n=391+i,num=String(n).padStart(3,"0"),card=master.cards[n-1],proof=records[i],row=ev.items[i];
 const range=n<=420?"391-420":"421-430";
 const sheet=String(n<=420?Math.ceil((n-390)/15):1).padStart(2,"0");
 if(!card||!proof||!row||row.canonicalOrder!==n||proof.canonicalOrder!==n||
  card.code.toLowerCase()!=="si_"+num+"/414"||
  row.cardKey!=="SI_"+num||row.printedNumber!==n+"/414"||
  row.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  proof.masterCode?.toLowerCase()!==card.code.toLowerCase()||
  row.koreanName!==card.name||proof.name!==card.name||
  row.ownedCDNUrl!==proof.cdnUrl||
  !row.imageInKorean||!row.all12ThemesInspected||!row.observation?.trim()||
  row.originalSourceRequests!==0||row.originalThemeRecords?.length!==0||
  !Array.isArray(row.matchedThemes)||new Set(row.matchedThemes).size!==row.matchedThemes.length||
  row.proofImage!==A+"theme-visual-evidence/SI/"+range+"/SI-"+range+"-"+sheet+".webp.b64"||
  proof.imageCheck?.status!=="decoded"||proof.imageCheck?.http!==200||
  proof.imageCheck?.format!=="WEBP"||proof.imageCheck?.dimensions?.join(",")!=="420,586"||
  !proof.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
  throw Error("Korean printed identity/visual archive mismatch at SI "+n);
 if(expectedColor.has(n)){
  if(row.illustrationType!=="pokemon"||row.matchedThemes?.join(",")!=="color"||!row.colorCategory)
   throw Error("Korean special art Pokémon expected only color at SI "+n);
 }else{
  if(row.illustrationType==="pokemon"||row.matchedThemes.length)
   throw Error("Non-Pokémon item/supporter/energy mistaken for Pokémon themed art at SI "+n);
  nonThematic++;
 }
 if(card.image!==proof.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=proof.cdnUrl;}
 overrides.sets.si[card.code.toLowerCase()]=proof.cdnUrl;
 checked++;
 for(const t of row.matchedThemes){
  if(!T.includes(t))throw Error("Unknown theme "+t);
  groups.get(t).cards.push({
   code:row.cardKey,name:card.name,series:"S",set:"SI",setName:master.displayName||master.name,
   cardNumber:num+"/414",rarity:card.rarity||"",
   category:row.colorCategory,image:proof.cdnUrl,
   evidence:"한국판 SI "+num+"/414 일러스트 12테마 실물 검수: "+row.observation+
     ". 소유 CDN 정상 디코딩: "+row.proofImage+". 외부 원본 이미지 핫링크 없음."
  });
  themeAdditions[t]=(themeAdditions[t]||0)+1;added++;
 }
}
if(checked!==40||added!==6||nonThematic!==34||themeAdditions.color!==6||
 Object.keys(themeAdditions).length!==1||ev.themeCounts?.color!==6)
 throw Error("SI last forty Korean art/theme count invariant failed");
state.reviews.SI={...prior,status:"complete",reviewedAt:"2026-10-14",reviewedCardCount:430,
 reviewedRanges:[...prior.reviewedRanges,"391-430"],
 reviewedThemes:T,heldCards:[],verifiedSelfHostedImageCount:430,
 newlyAddedThemeSlotCount:prior.newlyAddedThemeSlotCount+added,
 fullSetEvidence:A+"theme-si-391-430-Korean-art-review-20261014.json",
 partialReviewEvidence:A+"theme-si-391-430-Korean-art-review-20261014.json",
 archiveVerificationStatus:"SI_001-430_430_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 nextStart:"SLL canonical 001",
 note:"한국판 스타트 덱 100 SI 430/430 카드 12테마 일러스트 전수검수 및 자가 CDN 430장 디코딩 완료. 391-430 중 포켓몬 V 6장만 컬러 도감 반영하고 인물/에너지 34장 제외. 기존 390장 검수, 테마, 수집 정보 보존."};
state.execution.currentEra="S";state.execution.currentSet="SLL";
state.execution.lastSafeCheckpoint="SI canonical 001-430 (430/430) Korean artwork reviewed, all 430 owned CDN image binaries decoded";
state.execution.nextStart="SLL canonical 001";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SI",range:"canonical 391-430 Korean Start Deck 100 final 40",
 canonicalCardCount:40,artworkVisuallyVerifiedCount:40,artworkPendingCount:0,
 selfHostedReferenceCountAfter:40,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"40_Korean_owned_CDN_images_decoded",
 verifiedImageCount:40,unverifiedImageCount:0,brokenReferenceCount:0,
 trainerAndEnergyCardsWithoutPokemonTheme:34,themeAdditions,nextStart:"SLL canonical 001",
 note:"SI final 40 Korean printed images, including 6 Pokémon V, 23 supporter and 11 energy, decoded from DCB-owned CDN. No external-origin requests or ownership changes."});
images.nextStart="SLL canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"SI",status:"complete",
 masterCards:430,reviewedCardCount:430,remainingUnreviewed:0,
 verifiedOwnCDNImages:430,newlyAddedThisBatch:6,
 totalNewThemeSlots:state.reviews.SI.newlyAddedThemeSlotCount,
 themeAdditionsThisBatch:themeAdditions,nonThematicTrainerAndEnergyCards:34,
 fullReviewEvidence:A+"theme-si-391-430-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SLL canonical 001"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-si-391-430-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"SI",status:"complete",reviewed:430,ownedImages:430,
 last40ThemeSlots:added,themeAdditions,existingReviewPreserved:390,
 next:images.nextStart,originRequests:0,ownershipChanges:0}));
