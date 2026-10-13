import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const evidence="data/audits/theme-sv2P-061-099-art-review.json";
const checkpoint="data/audits/theme-sv2P-set-progress-20261013.json";
const [e,index,series,legacy,themes,state,progress,images]=await Promise.all([
 read(evidence),read("data/audits/theme-visual-evidence/sv2P/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read(checkpoint),
 read("data/audits/theme-image-selfhost-audit.json")
]);
const matches=[...series,...legacy].filter(s=>String(s.code).toLowerCase()==="sv2p");
if(matches.length!==1)throw Error("Expected exactly one Korean Snow Hazard set");
const master=matches[0],code=master.code,prev=state.reviews?.[code];
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
if(prev?.status==="complete"&&prev.reviewedCardCount===99){
 console.log("Korean Snow Hazard already complete, skip duplicate work");process.exit(0);
}
if(Number(progress.appliedReviewThrough)!==60||Number(prev?.reviewedCardCount)!==60||
 progress.batchEvidence?.at(-1)!=="data/audits/theme-sv2P-031-060-art-review.json"||
 String(images.nextStart||"").toLowerCase()!=="sv2p canonical 061")
 throw Error("Korean 001-060 not safely committed; refuse to overlap or skip cards");
if(e.set!=="sv2P"||e.start!==61||e.end!==99||e.cardsReviewed!==39||
 e.cards?.length!==39||e.masterCanonicalCount!==99||master.cards?.length!==99||
 index.cardCount!==99||index.verificationCounts?.verified!==99||index.verificationCounts?.missing!==0||
 e.existingOwnedCdnImagesVerified!==99||e.originImageRequests!==0||
 e.requiredAllTwelveChecked!==true||progress.unresolvedKoreanMasterNames!==27)
 throw Error("Master, Korean visual evidence or verified image cardinality changed");
const grouped=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!Array.isArray(grouped.get(t)?.cards))throw Error("Missing required theme "+t);
const counts={};let namesFixed=0,themeSlots=0;
for(let n=61;n<=99;n++){
 const row=e.cards[n-61],p=index.cards[n-1],c=master.cards[n-1];
 const number=String(c?.code||"").match(/_(\d{3})\//)?.[1];
 const key="SV2P_"+number;
 if(!row||!p||!c||!number||row.canonicalOrder!==n||p.canonicalOrder!==n||
  String(row.code).toUpperCase()!==key.toUpperCase()||
  String(row.canonicalMasterCode).toLowerCase()!==String(p.masterCode).toLowerCase()||
  String(c.code).toLowerCase()!==String(p.masterCode).toLowerCase()||
  row.printedNumber!==String(p.masterCode).split("_")[1]||
  row.sourceImage!==p.rawSource||row.verifiedCdnUrl!==p.cdnUrl||
  row.verifiedImageBinary!==true||p.imageCheck?.status!=="decoded"||
  row.verifiedImageSize?.join(",")!==p.imageCheck?.dimensions?.join(",")||
  row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv2P/sv2P-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  row.sourceRegion!=="KR"||row.all12ThemesChecked!==true||
  !row.koreanName?.trim()||!row.visualObservation?.trim()||
  !Array.isArray(row.themesMatched)||!Array.isArray(row.wasAlreadyInThemes)||
  new Set(row.themesMatched).size!==row.themesMatched.length||
  row.themesMatched.some(t=>!themes12.includes(t)))
   throw Error("Korean printed card or theme verification invalid at "+key);
 const prior=[];
 for(const g of themes.groups)
  if(g.cards.some(c=>String(c.code||"").toUpperCase()===key.toUpperCase()))prior.push(g.code);
 if(JSON.stringify(prior.sort())!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
  throw Error("Do not overwrite existing independently classified theme: "+key);
 if(row.themesMatched.some(t=>prior.includes(t)))throw Error("Duplicate theme card "+key);
 if(c.name&&c.name!==row.koreanName)
  throw Error("Previously saved Korean name does not match visual evidence at "+key+": "+c.name);
 if(!c.name){c.name=row.koreanName;namesFixed++;}
 for(const t of row.themesMatched){
  const g=grouped.get(t);
  g.cards.push({
   code:key,name:row.koreanName,series:"SV",set:code,setName:e.officialKoreanSetName,
   cardNumber:row.printedNumber,rarity:c.rarity||"",category:g.cards[0]?.category||g.name,
   evidence:"한국판 카드 자가 저장 이미지("+row.visualEvidenceSheet+") 직접 시각 검수: "+
    row.visualObservation+" 외부 이미지 신규 요청 없음.",
   image:c.sourceImage||c.image
  });
  counts[t]=(counts[t]||0)+1;themeSlots++;
 }
}
if(namesFixed!==27||JSON.stringify(Object.entries(counts).sort())!==
 JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("Final 39 Korean card names or theme selections differ from reviewed evidence");
const unresolved=progress.unresolvedKoreanMasterNames-namesFixed;
if(unresolved!==0||master.cards.some(c=>!String(c.name||"").trim()))
 throw Error("Missing Korean card names remain, cannot claim set complete");
const merged={...(progress.appliedThemeAdditions||{})};
for(const [t,n]of Object.entries(counts))merged[t]=(merged[t]||0)+n;
const newTotal=Number(progress.appliedThemeSlots||0)+themeSlots;
state.reviews[code]={
 ...prev,status:"complete",reviewedAt:e.reviewedAt,reviewedCardCount:99,
 reviewedThemes:themes12,heldCards:[],partialBatchEvidence:evidence,
 partialReviewedRange:"canonical 001-099",
 fullSetEvidence:[...(progress.batchEvidence||[]),evidence],
 newlyAddedThemeSlotCount:newTotal,masterKoreanNamesRepaired:87,
 verifiedSelfHostedImageCount:99,
 archiveVerificationStatus:"99_existing_Korean_print_owned_CDN_images_decoded",
 note:"스노해저드 한국판 인쇄카드 99장 12테마 전수 검수, 87개 빈 카드명 보완, 기존 잠자는 포켓몬 배치 유지. 외부 이미지 요청 및 소유상태 변경 없음."
};
Object.assign(progress,{
 status:"complete",appliedReviewThrough:99,reviewedKoreanNames:99,
 unresolvedKoreanMasterNames:0,
 appliedThemeSlots:newTotal,appliedThemeAdditions:merged,
 batchEvidence:[...(progress.batchEvidence||[]),evidence],
 nextSafeStart:"sv2P strict complete; next pending sv2D canonical 001 after checking current main",
 remainingWork:[],
 notes:"99/99 owned CDN images decoded, Korean printed names verified, 12 independent themes classified. Existing sleeping and ownership preserved."
});
if(images.batches.some(b=>String(b.set).toLowerCase()==="sv2p"&&b.canonicalCardCount===99))
 throw Error("Completed image audit batch already exists; avoid duplicate append");
images.batches.push({
 task:6,set:code,range:"canonical 001-099 complete Korean Snow Hazard artwork review",
 canonicalCardCount:99,artworkVisuallyVerifiedCount:99,artworkPendingCount:0,
 newlyInternalizedReferenceCount:0,selfHostedReferenceCountAfter:99,
 externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_existing_Korean_CDN_binary_decoded",
 verifiedImageCount:99,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:merged,masterKoreanNamesRepaired:87,
 nextStart:"sv2D canonical 001",
 note:"All 99 self-hosted Korean printed card images inspected and decoded; no third-party origin image requests. Card ownership unaffected."
});
images.nextStart="sv2D canonical 001";
images.updatedAt=e.reviewedAt;
const masterPath=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(masterPath,masterPath==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write(checkpoint,progress),
 write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:code,strictComplete:true,reviewed:99,newNames:namesFixed,
 totalNamesRestored:87,newThemeSlots:themeSlots,cumulativeThemeSlots:newTotal,addedByTheme:counts,next:images.nextStart},null,2));
