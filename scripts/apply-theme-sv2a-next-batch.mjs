import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const progressPath="data/audits/theme-sv2a-set-progress-20261013.json";
const progress=await read(progressPath);
const done=Number(progress.appliedReviewThrough||0);
if(done===210&&progress.status==="complete"){console.log("SV2a 210 cards already complete; skip duplicate.");process.exit(0);}
if(done<60||done>=210||done%30!==0)throw Error("Unrecognized existing Korean 151 progress; abort.");
const start=done+1,end=done+30;
const slug=n=>String(n).padStart(3,"0");
const evidencePath="data/audits/theme-sv2a-"+slug(start)+"-"+slug(end)+"-art-review.json";
const [e,proof,series,legacy,themes,state,images]=await Promise.all([
 read(evidencePath),read("data/audits/theme-visual-evidence/sv2a/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read("data/audits/theme-image-selfhost-audit.json")
]);
const matches=[...series,...legacy].filter(s=>String(s.code).toLowerCase()==="sv2a");
if(matches.length!==1)throw Error("One Korean sv2a master required");
const master=matches[0],code=master.code,prev=state.reviews?.[code];
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const earlier="data/audits/theme-sv2a-"+slug(start-30)+"-"+slug(start-1)+"-art-review.json";
if(prev?.status!=="in_progress"||prev.reviewedCardCount!==done||
 progress.batchEvidence?.at(-1)!==earlier||prev.partialBatchEvidence!==earlier||
 String(images.nextStart||"").toLowerCase()!=="sv2a canonical "+slug(start))
 throw Error("Sequential checkpoint differs; do not overlap or reapply.");
if(master.cards?.length!==210||proof.cardCount!==210||proof.verificationCounts?.verified!==210||
 proof.verificationCounts?.missing!==0||e.set!=="sv2a"||
 e.masterCanonicalCount!==210||e.start!==start||e.end!==end||
 e.cardsReviewed!==30||e.cards?.length!==30||e.originImageRequests!==0||
 e.requiredAllTwelveChecked!==true)throw Error("Korean canonical set or image verification changed.");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!Array.isArray(groups.get(t)?.cards))throw Error("Required theme missing: "+t);
let fixed=0,added=0;const counts={};
for(let i=0;i<30;i++){
 const n=start+i,row=e.cards[i],p=proof.cards[n-1],c=master.cards[n-1],key="SV2a_"+String(p?.masterCode||"").split("_")[1]?.split("/")[0];
 if(!row||!p||!c||row.canonicalOrder!==n||p.canonicalOrder!==n||String(row.code||"").toLowerCase()!==key.toLowerCase()||
  String(row.canonicalMasterCode).toLowerCase()!==String(p.masterCode).toLowerCase()||
  String(c.code).toLowerCase()!==String(p.masterCode).toLowerCase()||
  row.printedNumber!==String(p.masterCode).split("_")[1]||
  row.sourceImage!==p.rawSource||row.verifiedCdnUrl!==p.cdnUrl||
  !row.verifiedImageBinary||p.imageCheck?.status!=="decoded"||
  row.verifiedImageSize?.join(",")!==p.imageCheck?.dimensions?.join(",")||
  row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv2a/sv2a-"+
    String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  row.sourceRegion!=="KR"||row.all12ThemesChecked!==true||
  typeof row.koreanName!=="string"||!row.koreanName.trim()||
  typeof row.visualObservation!=="string"||!row.visualObservation.trim()||
  !Array.isArray(row.wasAlreadyInThemes)||!Array.isArray(row.themesMatched)||
  row.themesMatched.some(t=>!themes12.includes(t))||
  new Set(row.themesMatched).size!==row.themesMatched.length)
  throw Error("Invalid Korean print or archive evidence: "+key);
 const already=[];
 for(const g of themes.groups)
  if(g.cards.some(item=>String(item.code).toUpperCase()===key.toUpperCase()))already.push(g.code);
 if(JSON.stringify(already.sort())!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
  throw Error("Preserve previous independent theme slots: "+key);
 if(row.themesMatched.some(t=>already.includes(t)))
  throw Error("Duplicate previous placement: "+key);
 if(c.name&&c.name!==row.koreanName)
  throw Error("Existing Korean name mismatch: "+key+" "+c.name+" / "+row.koreanName);
 if(!c.name){c.name=row.koreanName;fixed++;}
 for(const t of row.themesMatched){
  const g=groups.get(t);
  g.cards.push({
   code:key,name:row.koreanName,series:"SV",set:code,setName:e.officialKoreanSetName,
   cardNumber:row.printedNumber,rarity:c.rarity||"",category:g.cards[0]?.category||g.name,
   evidence:"한국판 카드 자체 보관 이미지 검수 ("+row.visualEvidenceSheet+"): "+
    row.visualObservation+" 외부 이미지 다운로드 없음.",
   image:c.sourceImage||c.image
  });
  counts[t]=(counts[t]||0)+1;added++;
 }
}
if(JSON.stringify(Object.entries(counts).sort())!==
 JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("Manual visual theme totals mismatch; abort.");
const remaining=Number(progress.unnamedMasterCardsRequiringOfficialKoreanProof);
if(!Number.isInteger(remaining)||remaining<fixed)
 throw Error("Previously unresolved Korean name counts do not match");
const newRemaining=remaining-fixed;
state.reviews[code]={
 ...prev,status:end===210?"complete":"in_progress",reviewedAt:e.reviewedAt,
 reviewedCardCount:end,
 reviewedThemes:end===210?themes12:[],
 partialBatchEvidence:evidencePath,partialReviewedRange:"canonical 001-"+slug(end),
 newlyAddedThemeSlotCount:Number(prev.newlyAddedThemeSlotCount||0)+added,
 masterKoreanNamesRepaired:Number(prev.masterKoreanNamesRepaired||0)+fixed,
 verifiedSelfHostedImageCount:210,
 heldCards:end===210?[]:prev.heldCards||[],
 note:end===210?
 "SV2a 한국판 210장 이름, 12테마 완전 검수. 소유상태 및 기존 테마 배치 유지. 210개 이미지 자가호스팅 검증.":
 "SV2a 한국판 001-"+slug(end)+" 이름 및 12테마 시각 검수 완료. 나머지 검수 필요."
};
Object.assign(progress,{
 status:end===210?"complete":"in_progress",
 appliedReviewThrough:end,reviewedKoreanNames:end,
 unnamedMasterCardsRequiringOfficialKoreanProof:newRemaining,
 appliedThemeSlots:Number(progress.appliedThemeSlots||0)+added,
 batchEvidence:[...progress.batchEvidence,evidencePath]
});
progress.appliedThemeAdditions=progress.appliedThemeAdditions||{};
for(const [t,c]of Object.entries(counts))
 progress.appliedThemeAdditions[t]=(progress.appliedThemeAdditions[t]||0)+c;
progress.nextSafeStart=end===210?
 "sv2a strict complete; next pending sv2P canonical 001 (confirm latest main first)":
 "sv2a canonical "+slug(end+1)+"; preserve completed 001-"+slug(end)+"; owned images 210/210";
progress.notes=end===210?
 "All 210 Korean printed cards classified against 12 independent themes; 188 originally absent Korean names resolved; all owned CDN assets decoded. Ownership/UI unchanged.":
 "Cards canonical 001-"+slug(end)+" reviewed; remaining "+(210-end)+" pending. Original image origin not requested.";
if(end===210){
 if(master.cards.some(c=>!String(c.name||"").trim())||newRemaining!==0||
  progress.appliedReviewThrough!==210)
  throw Error("Not all Korean master names and canonical slots resolved.");
 progress.cannotMarkCompleteUntil=[];
 images.batches.push({
  task:6,set:code,range:"canonical 001-210 Korean printed card visual review",
  canonicalCardCount:210,artworkVisuallyVerifiedCount:210,artworkPendingCount:0,
  newlyInternalizedReferenceCount:0,selfHostedReferenceCountAfter:210,
  externalImageReferenceCountAfter:0,archiveVerificationStatus:"verified_existing_official_Korean_CDN_binary_decoded",
  verifiedImageCount:210,unverifiedImageCount:0,brokenReferenceCount:0,
  themeAdditions:progress.appliedThemeAdditions,
  masterKoreanNamesRepaired:state.reviews[code].masterKoreanNamesRepaired,
  nextStart:"sv2P canonical 001",
  note:"All 210 Korean printed visual cards reviewed from existing DCB-hosted decoded image binaries. No third-party origin downloads."
 });
}
images.nextStart=end===210?"sv2P canonical 001":"sv2a canonical "+slug(end+1);
images.updatedAt=e.reviewedAt;
const db=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(db,db==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write(progressPath,progress),
 write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:code,start,end,strictComplete:end===210,
 namesFixed:fixed,unresolvedRemaining:newRemaining,themesAdded:added,perTheme:counts,next:images.nextStart},null,2));
