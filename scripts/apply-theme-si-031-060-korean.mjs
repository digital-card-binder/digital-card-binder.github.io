import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-si-031-060-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SI/031-060/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(A+"theme-series-review-status.json"),
 read(A+"theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const matches=[...modern,...legacy].filter(s=>String(s.code||"").toUpperCase()==="SI");
if(matches.length!==1||matches[0].cards?.length!==430)throw Error("SI Korean full master unexpectedly modified");
const master=matches[0],prior=state.reviews?.SI;
if(prior?.status==="in_progress"&&prior.reviewedCardCount>=60&&prior.reviewedRanges?.includes("031-060")){
 console.log("SI 031-060 already applied");process.exit(0);
}
if(prior?.status!=="in_progress"||prior.reviewedCardCount!==30||
 prior.reviewedRanges?.join(",")!=="001-030"||images.nextStart!=="SI canonical 031"||
 ev.set!=="SI"||ev.expectedCanonicalCards!==430||ev.physicallyNumberedCardsReviewed!==30||
 ev.items?.length!==30||ev.ownedCdnImagesDecoded!==30||
 index.masterSetCardCount!==430||index.canonicalRange!=="031-060"||index.cardCount!==30||
 index.verificationCounts?.verified!==30||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)throw Error("SI 031-060 safe Korean prior batch checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing 12-theme group "+t);
for(const g of art.groups)for(const c of g.cards||[]){
 const key=String(c.code||"").toUpperCase();
 const m=/^SI_(\d{3})$/.exec(key);
 if(m&&+m[1]>=31&&+m[1]<=60)throw Error("Cannot overwrite prior SI 031-060 "+key);
}
overrides.sets??={};overrides.sets.si??={};
let inspected=0,assigned=0;const added={};
for(let i=0;i<30;i++){
 const n=i+31,num=String(n).padStart(3,"0"),c=master.cards[n-1],p=index.cards[i],row=ev.items[i];
 if(!c||!p||!row||row.canonicalOrder!==n||p.canonicalOrder!==n||
 row.cardKey!=="SI_"+num||c.code.toLowerCase()!=="si_"+num+"/414"||
 String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
 String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
 p.name!==c.name||row.koreanName!==c.name||row.ownedCDNUrl!==p.cdnUrl||
 row.physicalPrintedNumber!==num+"/414"||row.syntheticIdentifierOnly||
 !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
 !Array.isArray(row.matchedThemes)||new Set(row.matchedThemes).size!==row.matchedThemes.length||
 !row.matchedThemes.includes("color")||
 row.proofImage!=="data/audits/theme-visual-evidence/SI/031-060/SI-031-060-"+String(Math.ceil((i+1)/15)).padStart(2,"0")+".webp.b64"||
 p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
 p.imageCheck?.dimensions?.join(",")!=="420,586"||
 !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
  throw Error("SI Korean artwork/image print mismatch at "+n);
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage)c.sourceImage=c.image;c.image=p.cdnUrl;}
 overrides.sets.si[c.code.toLowerCase()]=p.cdnUrl;inspected++;
 for(const t of row.matchedThemes){
  if(!T.includes(t))throw Error("Unknown theme "+t);
  const g=groups.get(t);
  g.cards.push({code:row.cardKey,name:c.name,series:"S",set:"SI",setName:master.displayName,
   cardNumber:num+"/414",rarity:c.rarity||"",
   category:t==="color"?row.colorCategory:t==="street"?"생활 공간·정원":"초원",
   image:p.cdnUrl,
   evidence:"한국판 SI 스타트 덱 100 12테마 직접 시각검수: "+row.artObservation+
     ". 증빙 "+row.proofImage+"; 자체 CDN만 사용, 타 사이트 원본 핫링크 없음."});
  added[t]=(added[t]||0)+1;assigned++;
 }
}
if(inspected!==30||assigned!==53||added.color!==30||added.season!==22||added.street!==1)
 throw Error("SI 031-060 expected 53 slots on 30 distinct Korean cards");
state.reviews.SI={...prior,reviewedAt:"2026-10-14",reviewedCardCount:60,
 reviewedRanges:[...prior.reviewedRanges,"031-060"],verifiedSelfHostedImageCount:60,
 newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount||0)+53,
 partialReviewEvidence:A+"theme-si-031-060-Korean-art-review-20261014.json",
 archiveVerificationStatus:"SI_001-060_60_Korean_owned_CDN_images_decoded_and_artwork_reviewed",
 nextStart:"SI canonical 061",
 note:"스타트 덱 100 한국판 카드 실물 번호 001/414–060/414 시각검수 완료. 미검수 370개, 기존 SI_342 테마 그대로 유지."};
state.execution.currentEra="S";state.execution.currentSet="SI";
state.execution.lastSafeCheckpoint="SI canonical 001-060 (60 of 430) Korean artwork checked against own CDN; SI_342 prior sleeping theme preserved";
state.execution.nextStart="SI canonical 061";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SI",range:"canonical 031-060 Korean Start Deck 100",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_owned_CDN_images_decoded",verifiedImageCount:30,
 unverifiedImageCount:0,brokenReferenceCount:0,themeAdditions:added,nextStart:"SI canonical 061",
 note:"SI next 30 physically numbered Korean cards; source origin traffic 0; master owner identity preserved."});
images.nextStart="SI canonical 061";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const progress={schemaVersion:1,recordedAt:"2026-10-14",set:"SI",status:"in_progress",
 masterCards:430,reviewedCardCount:60,remainingUnreviewed:370,verifiedOwnCDNImages:60,
 newlyAddedThisBatch:53,totalNewThemeSlots:state.reviews.SI.newlyAddedThemeSlotCount,
 themeAdditionsThisBatch:added,fullReviewEvidence:A+"theme-si-031-060-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SI canonical 061"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-si-031-060-progress-20261014.json",progress)
]);
console.log(JSON.stringify({set:"SI",range:"031-060",inspected,assigned,added,
 cumulative:state.reviews.SI.reviewedCardCount,next:images.nextStart,originTraffic:0}));
