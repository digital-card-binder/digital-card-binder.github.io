import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-si-001-030-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SI/001-030/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const matches=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SI");
if(matches.length!==1||matches[0].cards?.length!==430)throw Error("SI complete Korean master must have 430 slots");
const master=matches[0],prior=state.reviews?.SI;
if(prior?.status==="in_progress"&&prior.reviewedCardCount===30&&prior.reviewedRanges?.includes("001-030")){console.log("SI first 30 already applied");process.exit(0);}
if(prior?.status==="complete"||prior?.reviewedCardCount>0||images.nextStart!=="SI canonical 001"||
 ev.set!=="SI"||ev.expectedCanonicalCards!==430||ev.physicallyNumberedCardsReviewed!==30||
 ev.items?.length!==30||ev.ownedCdnImagesDecoded!==30||
 index.masterSetCardCount!==430||index.cardCount!==30||
 index.verificationCounts?.verified!==30||index.verificationCounts?.missing!==0||
 index.masterMissingKoreanNames!==0)
 throw Error("SI 001-030 safe batch checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing independent theme "+t);
for(const g of art.groups)for(const c of g.cards||[])if(String(c.set||"").toUpperCase()==="SI"||/^SI_\d{3}$/.test(String(c.code||"").toUpperCase()))throw Error("Prior SI themes must not be overwritten");
overrides.sets??={};overrides.sets.si??={};
let inspected=0,assigned=0;const added={};
for(let i=0;i<30;i++){
 const n=i+1,num=String(n).padStart(3,"0"),c=master.cards[i],p=index.cards[i],row=ev.items[i];
 if(!c||!p||!row||row.canonicalOrder!==n||p.canonicalOrder!==n||
 row.cardKey!=="SI_"+num||c.code.toLowerCase()!=="si_"+num+"/414"||
 String(c.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
 String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
 p.name!==c.name||row.koreanName!==c.name||row.ownedCDNUrl!==p.cdnUrl||
 row.physicalPrintedNumber!==num+"/414"||row.syntheticIdentifierOnly||
 !row.imageInKorean||!row.all12ThemesInspected||!row.artObservation?.trim()||
 !Array.isArray(row.matchedThemes)||new Set(row.matchedThemes).size!==row.matchedThemes.length||
 !row.matchedThemes.includes("color")||
 row.proofImage!=="data/audits/theme-visual-evidence/SI/001-030/SI-001-030-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
 p.imageCheck?.status!=="decoded"||p.imageCheck?.http!==200||p.imageCheck?.format!=="WEBP"||
 p.imageCheck?.dimensions?.join(",")!=="420,586"||
 !p.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
  throw Error("SI Korean card identity or own CDN mismatch at "+n);
 if(c.image!==p.cdnUrl){if(c.image&&!c.sourceImage)c.sourceImage=c.image;c.image=p.cdnUrl;}
 overrides.sets.si[c.code.toLowerCase()]=p.cdnUrl;
 inspected++;
 for(const t of row.matchedThemes){
  if(!T.includes(t))throw Error("Unknown SI theme "+t);
  const g=groups.get(t);
  const category=t==="color"?row.colorCategory:
    t==="night"?"달빛·밤":t==="sunset"?"노을·골든아워":
    t==="street"?"마을·건물":"초원";
  g.cards.push({code:row.cardKey,name:c.name,series:"S",set:"SI",setName:master.displayName,
    cardNumber:num+"/414",rarity:c.rarity||"",category,image:p.cdnUrl,
    evidence:"한국판 SI 스타트 덱 100 카드 실제 일러스트 12테마 검수: "+row.artObservation+
      ". 확인 시트 "+row.proofImage+" 자체 CDN, 제3자 원본 트래픽 없음."});
  added[t]=(added[t]||0)+1;assigned++;
 }
}
if(inspected!==30||assigned!==54||added.color!==30||added.season!==20||
 added.sunset!==2||added.night!==1||added.street!==1)
 throw Error("SI 001-030 expected 54 art theme slots and 30 verified Korean cards");
state.reviews??={};
state.reviews.SI={...prior,status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:30,reviewedThemes:T,reviewedRanges:["001-030"],heldCards:[],
 verifiedSelfHostedImageCount:30,newlyAddedThemeSlotCount:54,
 partialReviewEvidence:A+"theme-si-001-030-Korean-art-review-20261014.json",
 archiveVerificationStatus:"SI_001-030_Korean_owned_CDN_30_decoded_and_artwork_reviewed",
 nextStart:"SI canonical 031",note:"스타트 덱 100 총 430개 중 한국판 실물 번호 001/414-030/414 시각검수 완료. 남은 400장 검수 필요. 수집 상태 무변경."};
state.execution.currentEra="S";state.execution.currentSet="SI";
state.execution.lastSafeCheckpoint="SI first 30 of 430 Korean cards artwork reviewed, 30/30 CDN decoded; no prior completed cards overwritten";
state.execution.nextStart="SI canonical 031";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SI",range:"canonical 001-030 Korean Start Deck 100",
 canonicalCardCount:30,artworkVisuallyVerifiedCount:30,artworkPendingCount:0,
 selfHostedReferenceCountAfter:30,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"30_Korean_owned_CDN_images_decoded",
 verifiedImageCount:30,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:added,nextStart:"SI canonical 031",
 note:"First 30 of 430 Korean SI master cards. Do not mark set complete; zero external origin image requests."});
images.nextStart="SI canonical 031";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"SI",status:"in_progress",
 masterCards:430,reviewedCardCount:30,remainingUnreviewed:400,
 verifiedOwnCDNImages:30,newThemeSlots:54,themeAdditions:added,
 fullReviewEvidence:A+"theme-si-001-030-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SI canonical 031"};
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),
 save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-si-001-030-progress-20261014.json",report)
]);
console.log(JSON.stringify({set:"SI",range:"001-030",inspected,assigned,added,next:images.nextStart,externalOriginDownloads:0}));
