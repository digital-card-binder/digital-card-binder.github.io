import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,x)=>writeFile(path.join(root,p),JSON.stringify(x,null,2)+"\n");
const evidencePath="data/audits/theme-svls-held-closure-20261013.json";
const [e,source,base,groups,reviewState,imageAudit,imageReport]=await Promise.all([
 read(evidencePath),read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/audits/theme-visual-evidence/SVLS-held.json")
]);
const set=[...source,...base].find(g=>g.code.toUpperCase()==="SVLS");
const state=reviewState.reviews?.SVLS;
const held=["SVLS_017","SVLS_018","SVLS_019","SVLS_023","SVLS_024","SVLS_025"];
if(!set||set.cards.length!==25||!state||e.cards.length!==6||
 imageReport.cards.length!==6||e.reviewPreviouslyCompletedCount!==19)
 throw Error("SVLS review prerequisites or evidence incomplete");
if(state.status==="complete"&&state.reviewedCardCount===25){
 console.log("SVLS is already strict complete; no further mutation.");process.exit(0);
}
if(state.reviewedCardCount!==19 || imageAudit.nextStart!=="SVLS six outstanding older evidence holds; then sv11W canonical 001")
 throw Error("Expected six held SVLS records not at main checkpoint.");
if([...state.heldCards].sort().join(",")!==[...held].sort().join(","))
 throw Error("Previously held SVLS records differ from stored checkpoint.");
const codes=["sleeping","connected","evolution","night","season","color","sunset",
"reflections","food","street","work","cameo"];
const themes=new Map(groups.groups.map(t=>[t.code,t]));
const expected=[17,18,19,23,24,25];
let additions=0;
for(let i=0;i<6;i++){
 const c=e.cards[i],n=expected[i],master=set.cards[n-1],proof=imageReport.cards[i];
 const original=String(master?.sourceImage||master?.image||"");
 if(c.canonicalOrder!==n||c.code!=="SVLS_"+String(n).padStart(3,"0")||
    c.canonicalMasterCode.toLowerCase()!==String(master.code).toLowerCase()||
    c.koreanName!==master.name|| c.artworkReviewed!==true||c.verifiedImageBinary!==true ||
    c.all12ThemesChecked!==true || c.cdnUrl!==proof.cdnUrl||proof.decoded!==true||
    proof.canonicalOrder!==n || proof.canonicalMasterCode.toLowerCase()!==String(master.code).toLowerCase()||
    !original.startsWith("https://")|| !c.visualObservation)
  throw Error("SVLS Korean-card identity, self-host image or visual inspection mismatch "+n);
 if(n>22&&c.printedNumber!=="")
  throw Error("Unnumbered Korean basic energy incorrectly given printed number at "+n);
 if(n<=22&&c.printedNumber!==String(master.code).split("_")[1])
  throw Error("Printed number mismatch at "+n);
 if(state.newlyAddedCards?.includes(c.code))
  throw Error("Previously reviewed Korean card marked for duplicate write "+c.code);
 for(const theme of c.themesMatched){
  if(!codes.includes(theme)||!themes.has(theme))throw Error("Unexpected theme "+theme);
  const group=themes.get(theme);
  if(group.cards.some(t=>String(t.code).toUpperCase()===c.code))
    throw Error("Existing theme placement would duplicate "+c.code);
  group.cards.push({
   code:c.code,name:c.koreanName,series:"SV",set:"SVLS",setName:e.setName,
   cardNumber:c.printedNumber,rarity:master.rarity||"",
   category:group.cards[0]?.category||group.name,
   evidence:"기존 자체 Cloudflare CDN에 보관된 한국어 카드 인쇄 이미지 "+
    c.cdnUrl+" 실제 육안 검수: "+c.visualObservation+
    " 이전 증거 보류를 해소하며 이미지 재다운로드 없음.",
   image:original
  });
  additions++;
 }
}
if(additions!==2||e.themeAdditions.street!==2)
 throw Error("SVLS expected exactly two new street placements");
state.status="complete";
state.reviewedAt=e.recordedAt;
state.reviewedCardCount=25;
state.reviewedThemes=codes;
state.note="SVLS 25/25 Korean-print cards visually reviewed; six old evidence holds resolved with decoded self-hosted Korean image files, including three unnumbered energy cards. Previously verified 19 unchanged.";
state.newlyAddedCards=[...(state.newlyAddedCards||[]),...e.cards.map(x=>x.code)];
state.newlyAddedThemeSlotCount=Number(state.newlyAddedThemeSlotCount||0)+additions;
state.resolvedHeldCards=[...(state.resolvedHeldCards||[]),...held];
state.heldCards=[];
state.fullSetEvidence=evidencePath;
state.archiveVerificationStatus="held_six_existing_CDN_print_verified";
const update=(node)=>{
 if(!node||typeof node!=="object")return false;
 if(typeof node.lastSafeCheckpoint==="string"&&node.lastSafeCheckpoint.includes("SVLS")){
  node.lastSafeCheckpoint="SVM 183/183, SVN 53/53, SVOD 21/21, SVOM 21/21 and SVLS 25/25 strict complete. Earlier unrelated sets remain in progress.";
  node.nextStart="sv11W canonical 001; independently review earlier incomplete sets as queued";
  node.currentTaskScope="Five targeted SV sets complete with validated Korean-print images.";
  return true;
 }
 for(const x of Object.values(node))if(!Array.isArray(x)&&update(x))return true;
 return false;
};
if(!update(reviewState))throw Error("Cannot locate retained stage progress checkpoint");
if(reviewState.lastEvidenceAuditCheckpoint?.set!=="SVOM")
 throw Error("Unexpected most recent evidence audit marker");
Object.assign(reviewState.lastEvidenceAuditCheckpoint,{
 set:"SVLS",range:"canonical held 017,018,019,023,024,025",
 reviewedCardCount:6,artworkEvidenceHolds:0,
 archiveVerificationStatus:"existing_CDN_Korean_print_decoded",
 evidenceFile:evidencePath
});
imageAudit.batches.push({
 task:6,set:"SVLS",range:"previously held canonical 017,018,019,023-025",
 canonicalCardCount:6,artworkVisuallyVerifiedCount:6,artworkPendingCount:0,
 externalImageReferenceCountBefore:6,newlyInternalizedReferenceCount:0,
 selfHostedReferenceCountAfter:6,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_existing_CDN_Korean_print_decoded",
 verifiedImageCount:6,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:{street:2},
 nextStart:"sv11W canonical 001",
 note:"Six old SVLS print images inspected from owned CDN, existing 19 reviews unchanged. Base energies have no printed card numbers."
});
imageAudit.nextStart="sv11W canonical 001; other older in-progress sets remain";
imageAudit.updatedAt=e.recordedAt;
await Promise.all([
 write("data/art-themes.json",groups),
 write("data/audits/theme-series-review-status.json",reviewState),
 write("data/audits/theme-image-selfhost-audit.json",imageAudit)
]);
console.log("Closed six SVLS holds, added two street theme slots, SVLS 25/25.");
