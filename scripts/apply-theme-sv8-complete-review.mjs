import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {routeCardImage} from "./card-image-routing.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,o)=>writeFile(path.join(root,p),JSON.stringify(o,null,2)+"\n");
const evidencePath="data/audits/theme-sv8-001-138-art-review.json";
const evidence=await read(evidencePath);
const [index,series,legacy,themes,state,imageAudit]=await Promise.all([
 read("data/audits/theme-visual-evidence/sv8/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json")
]);
const code="sv8", set=[...series,...legacy].filter(x=>String(x.code).toLowerCase()===code);
if(set.length!==1)throw Error("Expected one SV8 Korean master");
const master=set[0];
const allowed=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const byTheme=new Map(themes.groups.map(x=>[x.code,x]));
const prior=new Map();
for(const group of themes.groups){
 for(const card of group.cards||[]){
  if(String(card.set||"").toLowerCase()==="sv8"||/^SV8_\d{3}$/.test(String(card.code||"").toUpperCase())){
   const k=String(card.code).toUpperCase(),arr=prior.get(k)||[];
   arr.push(group.code);prior.set(k,arr);
  }
 }
}
const old=state.reviews?.sv8;
if(old?.status==="complete"){
 if(old.reviewedCardCount===138&&master.cards.filter(x=>x.name).length===138){
  console.log("SV8 already completed; no duplicate commit");process.exit(0);
 }
 throw Error("Completed SV8 marker conflicts with master; manual reconciliation required");
}
if((old?.reviewedCardCount||0)>0)throw Error("SV8 has prior partial verified reviews");
if(imageAudit.nextStart!=="sv8 canonical 001")throw Error("Expected next checkpoint SV8 canonical 001, got: "+imageAudit.nextStart);
if(evidence.set!=="sv8"||evidence.officialKoreanSetName!=="초전브레이커"||
  evidence.masterCanonicalCount!==138||evidence.cardsReviewed!==138||master.cards.length!==138||
  evidence.cards.length!==138||index.cardCount!==138||
  index.verificationCounts.verified!==138||index.verificationCounts.missing!==0||
  evidence.verifiedAlreadyArchivedImages!==138||index.cards.length!==138||
  evidence.missingMasterNamesRecovered!==118||evidence.previousMasterNameCorrectionsRequired.length!==2||
  evidence.priorThemePlacementsRetained!==7)throw Error("SV8 source proof/checkpoint metadata mismatch");
const priorCount=[...prior.values()].reduce((sum,x)=>sum+x.length,0);
if(priorCount!==7)throw Error("Previous theme slot count changed: "+priorCount);
const correctionIndex=new Map(evidence.previousMasterNameCorrectionsRequired.map(c=>[c.order,c]));
if([...correctionIndex.keys()].sort((a,b)=>a-b).join(",")!=="137,138")throw Error("Unexpected preexisting name corrections");
const counts={};let filled=0,corrected=0,placed=0;
for(let n=1;n<=138;n++){
 const c=evidence.cards[n-1],m=master.cards[n-1],proof=index.cards[n-1];
 const key="SV8_"+String(n).padStart(3,"0");
 const route=routeCardImage(m.sourceImage||m.image);
 const cdn=route? "https://dcb-card-images-"+route.project+"-2026.pages.dev/"+route.relativePath:"";
 if(c.canonicalOrder!==n||c.code!==key||c.canonicalMasterCode.toLowerCase()!==String(m.code).toLowerCase()||
   proof.masterCode.toLowerCase()!==String(m.code).toLowerCase()||proof.canonicalOrder!==n||
   c.printedNumber!==String(m.code).split("_")[1]||
   c.verifiedCdnUrl!==proof.cdnUrl||c.verifiedCdnUrl!==cdn||
   c.sourceImage!==proof.rawSource||c.sourceImage!==(m.sourceImage||m.image)||
   !c.verifiedImageBinary||proof.imageCheck.status!=="decoded"||
   !Array.isArray(proof.imageCheck.dimensions)||c.verifiedImageSize.join(",")!==proof.imageCheck.dimensions.join(",")||
   !c.visualEvidenceSheet.startsWith("data/audits/theme-visual-evidence/sv8/")||
   !c.visualTitleEvidenceSheet.startsWith("data/audits/theme-visual-evidence/sv8/")||
   !c.artworkReviewed||!c.all12ThemesChecked||c.sourceRegion!=="KR"||
   !String(c.koreanName).trim()||c.originalMasterName!==(m.name||""))
    throw Error("SV8 canonical Korean card name/image provenance mismatch "+n);
 if(m.name!==c.koreanName){
  if(!m.name){m.name=c.koreanName;filled++;}
  else{
    const exception=correctionIndex.get(n);
    if(!exception||m.name!==exception.old||c.koreanName!==exception.printed||
       exception.code.toLowerCase()!==String(m.code).toLowerCase())
      throw Error("Refusing to replace existing Korean name without printed title proof at "+n);
    m.name=c.koreanName;corrected++;
  }
 }
 const current=prior.get(key)||[];
 if([...current].sort().join(",")!==[...c.preexistingThemes].sort().join(","))
   throw Error("Existing classification changed on "+key);
 const t=c.themesMatched;
 if(!Array.isArray(t)||new Set(t).size!==t.length||t.some(k=>!allowed.includes(k)||current.includes(k)))
   throw Error("Invalid or duplicate theme classification at "+key);
 for(const themeCode of t){
  const g=byTheme.get(themeCode);
  if(!g||!Array.isArray(g.cards)||g.cards.some(x=>String(x.code).toUpperCase()===key))
   throw Error("Theme duplicate or unknown "+themeCode+"/"+key);
  g.cards.push({
   code:key,name:c.koreanName,series:"SV",set:code,setName:"초전브레이커",
   cardNumber:c.printedNumber,rarity:m.rarity||"",
   category:g.cards[0]?.category||g.name,
   evidence:"기존 Digital Card Binder 자체 CDN 한국어 카드 원본("+
     c.visualEvidenceSheet+")과 카드 이름 확대 증거("+c.visualTitleEvidenceSheet+
     ")를 직접 확인: "+c.visualObservation+
     " 외부 원본 이미지 신규 요청·핫링크 없음.",
   image:m.sourceImage||m.image
  });
  counts[themeCode]=(counts[themeCode]||0)+1;placed++;
 }
}
if(filled!==118||corrected!==2)throw Error("Verified name repairs not 118 + 2");
for(const t of new Set([...Object.keys(counts),...Object.keys(evidence.themeAdditions)])){
 if((counts[t]||0)!==(evidence.themeAdditions[t]||0))
  throw Error("Theme count mismatch: "+t);
}
if(master.name!=="초전브레이커")throw Error("Unexpected Korean set name "+master.name);
state.reviews||={};
state.reviews[code]={
 status:"complete",reviewedAt:evidence.recordedAt,reviewedCardCount:138,
 reviewedThemes:allowed,heldCards:[],newlyAddedCards:evidence.cards.map(x=>x.code),
 newlyAddedThemeSlotCount:placed,previouslyPreservedThemeSlotCount:7,
 masterKoreanNamesRepaired:filled,masterKoreanNamesCorrected:corrected,
 verifiedSelfHostedImageCount:138,
 archiveVerificationStatus:"138_existing_Korean_CDN_image_files_decoded_no_external_hotlinks",
 fullSetEvidence:evidencePath,
 note:"SV8 초전브레이커 한국어 인쇄 카드 138/138 전수 검수. 118 이름 공란 복구, 근거가 확인된 137·138번 기존 오기 2건 교정; 기존 sleeping 4 connected 2 sunset 1 유지. 외부 원본 요청 없음."
};
const bump=(node)=>{
 if(!node||typeof node!=="object")return false;
 if(typeof node.lastSafeCheckpoint==="string"&&node.lastSafeCheckpoint.toLowerCase().includes("sv8a")){
  node.lastSafeCheckpoint="sv8 초전브레이커 138/138, owned-CDN 138/138; Korean names restored 118, corrected 2. Prior 39 complete sets retained.";
  node.currentTaskScope="sv8 strict-complete; next sv7a 낙원드래고나";
  node.nextStart="sv7a canonical 001";
  return true;
 }
 for(const value of Object.values(node)){if(!Array.isArray(value)&&bump(value))return true}
 return false;
};
if(!bump(state))throw Error("Refusing update: cannot find recent safe sv8a checkpoint");
if(String(state.lastEvidenceAuditCheckpoint?.set).toLowerCase()!=="sv8a")
 throw Error("Last verified evidence set not sv8a");
Object.assign(state.lastEvidenceAuditCheckpoint,{set:code,range:"canonical 001-138",reviewedCardCount:138,
 artworkEvidenceHolds:0,archiveVerificationStatus:"existing_own_CDN_138_200_image_verified",evidenceFile:evidencePath});
imageAudit.batches.push({
 task:6,set:code,range:"canonical 001-138 full Korean artwork review",
 canonicalCardCount:138,artworkVisuallyVerifiedCount:138,artworkPendingCount:0,
 externalImageReferenceCountBefore:138,newlyInternalizedReferenceCount:0,
 selfHostedReferenceCountAfter:138,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_existing_DCB_CDN_138_images_decoded",
 verifiedImageCount:138,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:counts,masterKoreanNamesRepaired:filled,masterKoreanNamesCorrected:corrected,
 previousThemePlacementsPreserved:7,nextStart:"sv7a canonical 001",
 note:"Self-hosted Korean original artwork sheets checked; 138/138 image bytes decoded, not hotlinked to external source. 118 blanks and two title mismatches corrected. No ownership changes."
});
imageAudit.nextStart="sv7a canonical 001";
imageAudit.updatedAt=evidence.recordedAt;
const sourcePath=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(sourcePath,sourcePath==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write("data/audits/theme-image-selfhost-audit.json",imageAudit)
]);
console.log(JSON.stringify({set:code,reviewed:138,restoredNames:filled,correctedNames:corrected,themeAdditions:counts,placed,nextStart:imageAudit.nextStart}));
