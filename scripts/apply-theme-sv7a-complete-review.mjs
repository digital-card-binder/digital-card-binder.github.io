import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {routeCardImage} from "./card-image-routing.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,o)=>writeFile(path.join(root,p),JSON.stringify(o,null,2)+"\n");
const evidencePath="data/audits/theme-sv7a-001-094-art-review.json";
const evidence=await read(evidencePath);
const [index,series,legacy,themes,state,imageAudit]=await Promise.all([
 read("data/audits/theme-visual-evidence/sv7a/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json")
]);
const code="sv7a", set=[...series,...legacy].filter(x=>String(x.code).toLowerCase()===code);
if(set.length!==1)throw Error("Expected one SV7A Korean master");
const master=set[0];
const allowed=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const byTheme=new Map(themes.groups.map(x=>[x.code,x]));
const prior=new Map();
for(const group of themes.groups){
 for(const card of group.cards||[]){
  if(String(card.set||"").toLowerCase()==="sv7a"||/^SV7A_\d{3}$/.test(String(card.code||"").toUpperCase())){
   const k=String(card.code).toUpperCase(),arr=prior.get(k)||[];
   arr.push(group.code);prior.set(k,arr);
  }
 }
}
const old=state.reviews?.sv7a;
if(old?.status==="complete"){
 if(old.reviewedCardCount===94&&master.cards.filter(x=>x.name).length===94){
  console.log("SV7A already completed; no duplicate commit");process.exit(0);
 }
 throw Error("Completed SV7A marker conflicts with master; manual reconciliation required");
}
if((old?.reviewedCardCount||0)>0)throw Error("SV7A has prior partial verified reviews");
if(imageAudit.nextStart!=="sv7a canonical 001")throw Error("Expected next checkpoint SV7A canonical 001, got: "+imageAudit.nextStart);
if(evidence.set!=="sv7a"||evidence.officialKoreanSetName!=="낙원드래고나"||
  evidence.masterCanonicalCount!==94||evidence.cardsReviewed!==94||master.cards.length!==94||
  evidence.cards.length!==94||index.cardCount!==94||
  index.verificationCounts.verified!==94||index.verificationCounts.missing!==0||
  evidence.verifiedAlreadyArchivedImages!==94||index.cards.length!==94||
  evidence.missingMasterNamesRecovered!==73||evidence.previousMasterNameCorrectionsRequired.length!==0||
  evidence.priorThemePlacementsRetained!==8)throw Error("SV7A source proof/checkpoint metadata mismatch");
const priorCount=[...prior.values()].reduce((sum,x)=>sum+x.length,0);
if(priorCount!==8)throw Error("Previous theme slot count changed: "+priorCount);
const correctionIndex=new Map(evidence.previousMasterNameCorrectionsRequired.map(c=>[c.order,c]));
if(correctionIndex.size!==0)throw Error("SV7a has no Korean master name correction exceptions");
const counts={};let filled=0,corrected=0,placed=0;
for(let n=1;n<=94;n++){
 const c=evidence.cards[n-1],m=master.cards[n-1],proof=index.cards[n-1];
 const key="SV7A_"+String(n).padStart(3,"0");
 const route=routeCardImage(m.sourceImage||m.image);
 const cdn=route? "https://dcb-card-images-"+route.project+"-2026.pages.dev/"+route.relativePath:"";
 if(c.canonicalOrder!==n||c.code!==key||c.canonicalMasterCode.toLowerCase()!==String(m.code).toLowerCase()||
   proof.masterCode.toLowerCase()!==String(m.code).toLowerCase()||proof.canonicalOrder!==n||
   c.printedNumber!==String(m.code).split("_")[1]||
   c.verifiedCdnUrl!==proof.cdnUrl||c.verifiedCdnUrl!==cdn||
   c.sourceImage!==proof.rawSource||c.sourceImage!==(m.sourceImage||m.image)||
   !c.verifiedImageBinary||proof.imageCheck.status!=="decoded"||
   !Array.isArray(proof.imageCheck.dimensions)||c.verifiedImageSize.join(",")!==proof.imageCheck.dimensions.join(",")||
   !c.visualEvidenceSheet.startsWith("data/audits/theme-visual-evidence/sv7a/")||
   !c.visualTitleEvidenceSheet.startsWith("data/audits/theme-visual-evidence/sv7a/")||
   !c.artworkReviewed||!c.all12ThemesChecked||c.sourceRegion!=="KR"||
   !String(c.koreanName).trim()||c.originalMasterName!==(m.name||""))
    throw Error("SV7A canonical Korean card name/image provenance mismatch "+n);
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
   code:key,name:c.koreanName,series:"SV",set:code,setName:"낙원드래고나",
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
if(filled!==73||corrected!==0)throw Error("Expected 73 restored names and zero overwrites");
for(const t of new Set([...Object.keys(counts),...Object.keys(evidence.themeAdditions)])){
 if((counts[t]||0)!==(evidence.themeAdditions[t]||0))
  throw Error("Theme count mismatch: "+t);
}
if(!master.name || /^sv7a 도감$/i.test(master.name))master.name="낙원드래고나";
else if(master.name!=="낙원드래고나")throw Error("Unexpected Korean set name "+master.name);
state.reviews||={};
state.reviews[code]={
 status:"complete",reviewedAt:evidence.recordedAt,reviewedCardCount:94,
 reviewedThemes:allowed,heldCards:[],newlyAddedCards:evidence.cards.map(x=>x.code),
 newlyAddedThemeSlotCount:placed,previouslyPreservedThemeSlotCount:8,
 masterKoreanNamesRepaired:filled,masterKoreanNamesCorrected:corrected,
 verifiedSelfHostedImageCount:94,
 archiveVerificationStatus:"94_existing_Korean_CDN_image_files_decoded_no_external_hotlinks",
 fullSetEvidence:evidencePath,
 note:"SV7a 낙원드래고나 한국어 인쇄 카드 94/94 검수, 73개 빈 카드명 복구. 기존 connected 4, sunset 2, street 2 항목 보존; 외부 원본 서버 요청 없음."
};
const bump=(node)=>{
 if(!node||typeof node!=="object")return false;
 if(typeof node.lastSafeCheckpoint==="string"&&node.lastSafeCheckpoint.toLowerCase().includes("sv8")){
  node.lastSafeCheckpoint="sv7a 낙원드래고나 94/94, owned-CDN 94/94; Korean names restored 73, corrected 0. Prior 40 complete sets retained.";
  node.currentTaskScope="sv7a strict-complete; next sv7a 낙원드래고나";
  node.nextStart="sv7 canonical 001";
  return true;
 }
 for(const value of Object.values(node)){if(!Array.isArray(value)&&bump(value))return true}
 return false;
};
if(!bump(state))throw Error("Refusing update: cannot find recent safe sv8a checkpoint");
if(String(state.lastEvidenceAuditCheckpoint?.set).toLowerCase()!=="sv8")
 throw Error("Last verified evidence set not sv8a");
Object.assign(state.lastEvidenceAuditCheckpoint,{set:code,range:"canonical 001-94",reviewedCardCount:94,
 artworkEvidenceHolds:0,archiveVerificationStatus:"existing_own_CDN_94_images_verified",evidenceFile:evidencePath});
imageAudit.batches.push({
 task:6,set:code,range:"canonical 001-94 full Korean artwork review",
 canonicalCardCount:94,artworkVisuallyVerifiedCount:94,artworkPendingCount:0,
 externalImageReferenceCountBefore:94,newlyInternalizedReferenceCount:0,
 selfHostedReferenceCountAfter:94,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_existing_DCB_CDN_94_images_decoded",
 verifiedImageCount:94,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:counts,masterKoreanNamesRepaired:filled,masterKoreanNamesCorrected:corrected,
 previousThemePlacementsPreserved:8,nextStart:"sv7 canonical 001",
 note:"Self-hosted Korean image files decoded 94/94; 73 Korean names filled; existing eight theme placements retained; no external image hotlink or ownership change."
});
imageAudit.nextStart="sv7 canonical 001";
imageAudit.updatedAt=evidence.recordedAt;
const sourcePath=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(sourcePath,sourcePath==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write("data/audits/theme-image-selfhost-audit.json",imageAudit)
]);
console.log(JSON.stringify({set:code,reviewed:94,restoredNames:filled,correctedNames:corrected,themeAdditions:counts,placed,nextStart:imageAudit.nextStart}));
