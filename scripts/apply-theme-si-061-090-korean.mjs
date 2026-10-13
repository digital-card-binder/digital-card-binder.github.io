import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
read(A+"theme-si-061-090-Korean-art-review-20261014.json"),
read(A+"theme-visual-evidence/SI/061-090/visual-index.json"),
read("data/series.json"),read("data/series-legacy.json"),
read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const masterList=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()==="SI");
if(masterList.length!==1||masterList[0].cards?.length!==430)throw Error("SI Korean master size unexpectedly changed");
const master=masterList[0],prior=state.reviews?.SI;
if(prior?.status==="in_progress"&&prior.reviewedCardCount>=90&&prior.reviewedRanges?.includes("061-090")){
 console.log("SI 061-090 already applied");process.exit(0);
}
if(prior?.status!=="in_progress"||prior.reviewedCardCount!==60||
 prior.reviewedRanges?.join(",")!=="001-030,031-060"||
 images.nextStart!=="SI canonical 061"||ev.set!=="SI"||ev.expectedCanonicalCards!==430||
 ev.physicallyNumberedCardsReviewed!==30||ev.items?.length!==30||ev.ownedCdnImagesDecoded!==30||
 index.masterSetCardCount!==430||index.canonicalRange!=="061-090"||index.cardCount!==30||
 index.verificationCounts?.verified!==30||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)throw Error("SI 061-090 start checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Theme missing "+t);
for(const g of art.groups)for(const c of g.cards||[]){
 const m=/^SI_(\d{3})$/.exec(String(c.code||"").toUpperCase());
 if(m&&+m[1]>=61&&+m[1]<=90)throw Error("Prior SI 061-090 theme must not be overwritten");
}
overrides.sets??={};overrides.sets.si??={};
let checked=0,assignments=0;const added={};
for(let i=0;i<30;i++){
 const n=i+61,num=String(n).padStart(3,"0"),c=master.cards[n-1],p=index.cards[i],row=ev.items[i];
 if(!c||!p||!row||p.canonicalOrder!==n||row.canonicalOrder!==n||
 c.code.toLowerCase()!=="si_"+num+"/414"||row.cardKey!=="SI_"+num||
 String(row.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
 String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
 row.koreanName!==c.name||p.name!==c.name||row.ownedCDNUrl!==p.cdnUrl||
 row.physicalPrintedNumber!==num+"/414"||row.syntheticIdentifierOnly||
 !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
 !Array.isArray(row.matchedThemes)||new Set(row.matchedThemes).size!==row.matchedThemes.length||
 !row.matchedThemes.includes("color")||
 row.proofImage!=="data/audits/theme-visual-evidence/SI/061-090/SI-061-090-"+String(Math.ceil((i+1)/15)).padStart(2,"0")+".webp.b64"||
 p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
 p.imageCheck?.dimensions?.join(",")!=="420,586"||
 !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
 throw Error("SI 061-090 Korean image/identity mismatch "+n);
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage)c.sourceImage=c.image;c.image=p.cdnUrl;}
 overrides.sets.si[c.code.toLowerCase()]=p.cdnUrl;checked++;
 for(const t of row.matchedThemes){
  if(!T.includes(t))throw Error("Unknown theme "+t);
  groups.get(t).cards.push({code:row.cardKey,name:c.name,series:"S",set:"SI",setName:master.displayName,
    cardNumber:num+"/414",rarity:c.rarity||"",
    category:t==="color"?row.colorCategory:t==="sunset"?"노을·황혼":"초원",
    image:p.cdnUrl,evidence:"한국판 SI 12테마 실제 카드 시각검수: "+row.artObservation+
      ". 이미지 시트 "+row.proofImage+"; 자체 CDN, 외부 원본 핫링크 없음."});
  added[t]=(added[t]||0)+1;assignments++;
 }
}
if(checked!==30||assignments!==57||added.color!==30||added.season!==24||added.sunset!==3)
 throw Error("SI 061-090 requires 30 verified Korean cards and 57 independent theme slots");
state.reviews.SI={...prior,reviewedAt:"2026-10-14",reviewedCardCount:90,
 reviewedRanges:[...prior.reviewedRanges,"061-090"],
 verifiedSelfHostedImageCount:90,newlyAddedThemeSlotCount:prior.newlyAddedThemeSlotCount+57,
 partialReviewEvidence:A+"theme-si-061-090-Korean-art-review-20261014.json",
 archiveVerificationStatus:"SI_001-090_90_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 nextStart:"SI canonical 091",
 note:"SI 한국판 001/414-090/414 총 90장 실제 일러스트 검수, 340장 미검수. 기존 SI_342 수면 테마 보존, 소유 기록 무변경."};
state.execution.currentEra="S";state.execution.currentSet="SI";
state.execution.lastSafeCheckpoint="SI canonical 001-090 (90/430) Korean artwork checked; previous 60 and original SI_342 preserved";
state.execution.nextStart="SI canonical 091";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SI",range:"canonical 061-090 Korean Start Deck 100",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:added,nextStart:"SI canonical 091",
 note:"30 actual numbered Korean SI images; no offsite requests, existing ownership and card identity preserved."});
images.nextStart="SI canonical 091";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const prog={schemaVersion:1,recordedAt:"2026-10-14",set:"SI",status:"in_progress",
 masterCards:430,reviewedCardCount:90,remainingUnreviewed:340,
 verifiedOwnCDNImages:90,newlyAddedThisBatch:57,
 totalNewThemeSlots:state.reviews.SI.newlyAddedThemeSlotCount,
 themeAdditionsThisBatch:added,fullReviewEvidence:A+"theme-si-061-090-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SI canonical 091"};
await Promise.all([save("data/series.json",modern),save("data/series-legacy.json",legacy),
save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
save(A+"theme-si-061-090-progress-20261014.json",prog)]);
console.log(JSON.stringify({set:"SI",artReviewed:checked,themeSlots:assignments,added,
 totalVerified:90,next:images.nextStart,originRequests:0}));
