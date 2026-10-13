import {readFile,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const evidencePath="data/audits/theme-sv2a-001-030-art-review.json";
const progressPath="data/audits/theme-sv2a-set-progress-20261013.json";
const [e,proof,series,legacy,themes,state,progress,images]=await Promise.all([
 read(evidencePath),read("data/audits/theme-visual-evidence/sv2a/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read(progressPath),
 read("data/audits/theme-image-selfhost-audit.json")
]);
const sets=[...series,...legacy].filter(s=>String(s.code).toLowerCase()==="sv2a");
if(sets.length!==1)throw Error("Expected one Korean SV2a master set.");
const master=sets[0],code=master.code;
const expected=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
if(state.reviews?.[code]?.status==="complete") {console.log("Already strict-complete; never overwrite.");process.exit(0);}
if(progress.batchEvidence?.includes(evidencePath)&&progress.appliedReviewThrough>=30&&
    state.reviews?.[code]?.reviewedCardCount>=30) {console.log("001-030 already applied.");process.exit(0);}
if(progress.appliedReviewThrough||Number(state.reviews?.[code]?.reviewedCardCount||0)>0)
 throw Error("Existing SV2a partial review checkpoint advanced; no overwrite.");
if(String(images.nextStart).toLowerCase()!=="sv2a canonical 001")
 throw Error("Self-host audit start moved; no overlapping work.");
if(master.cards?.length!==210||proof.cardCount!==210||
  proof.verificationCounts?.verified!==210||proof.verificationCounts?.missing!==0||
  progress.canonicalCardSlots!==210||progress.ownedCdnImageBinariesDecoded!==210||
  e.masterCanonicalCount!==210||e.set!=="sv2a"||e.start!==1||e.end!==30||
  e.cardsReviewed!==30||e.cards?.length!==30||
  e.originImageRequests!==0||e.requiredAllTwelveChecked!==true)
 throw Error("Korean proof coverage/count mismatch.");
const byTheme=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of expected)if(!Array.isArray(byTheme.get(t)?.cards))throw Error("Missing expected art theme: "+t);
const observed={};let fixed=0,inserted=0;
for(let i=0;i<30;i++){
 const n=i+1,row=e.cards[i],p=proof.cards[i],c=master.cards[i];
 const key="SV2A_"+String(n).padStart(3,"0");
 if(!row||!p||!c||row.canonicalOrder!==n||p.canonicalOrder!==n||row.code!==key||
  String(row.canonicalMasterCode).toLowerCase()!==String(p.masterCode).toLowerCase()||
  String(c.code).toLowerCase()!==String(p.masterCode).toLowerCase()||
  row.printedNumber!==p.masterCode.split("_")[1]||
  row.sourceImage!==p.rawSource||row.verifiedCdnUrl!==p.cdnUrl||
  !row.verifiedImageBinary||p.imageCheck?.status!=="decoded"||
  row.verifiedImageSize?.join(",")!==p.imageCheck.dimensions.join(",")||
  row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv2a/sv2a-"+
    String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  row.sourceRegion!=="KR"||row.all12ThemesChecked!==true||
  typeof row.koreanName!=="string"||!row.koreanName.trim()||
  typeof row.visualObservation!=="string"||!row.visualObservation.trim()||
  !Array.isArray(row.wasAlreadyInThemes)||!Array.isArray(row.themesMatched)||
  new Set(row.themesMatched).size!==row.themesMatched.length||
  row.themesMatched.some(t=>!expected.includes(t)))
  throw Error("Invalid Korean printed card evidence: "+key);
 const current=[];
 for(const group of themes.groups){
  if(group.cards.some(t=>String(t.code).toUpperCase()===key))current.push(group.code);
 }
 if(JSON.stringify(current.sort())!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
  throw Error("Prior theme placements modified: "+key);
 if(row.themesMatched.some(t=>current.includes(t)))
  throw Error("Duplicate existing thematic slot: "+key);
 if(c.name&&c.name!==row.koreanName)throw Error("Would overwrite original Korean master name: "+key);
 if(!c.name){c.name=row.koreanName;fixed++;}
 for(const t of row.themesMatched){
  const group=byTheme.get(t);
  group.cards.push({
   code:key,name:row.koreanName,series:"SV",set:code,setName:e.officialKoreanSetName,
   cardNumber:row.printedNumber,rarity:c.rarity||"",
   category:group.cards[0]?.category||group.name,
   evidence:"한국판 인쇄 카드의 자체 저장된 아트 검수 시트 ("+row.visualEvidenceSheet+
    ") 직접 판독: "+row.visualObservation+" (원본 외부 요청 없음)",
   image:c.sourceImage||c.image
  });
  observed[t]=(observed[t]||0)+1;inserted++;
 }
}
if(fixed!==30 || JSON.stringify(Object.entries(observed).sort())!==
 JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("Expected 30 Korean printed names or theme counts mismatch.");
state.reviews[code]={
 status:"in_progress",reviewedAt:e.reviewedAt,reviewedCardCount:30,reviewedThemes:[],
 partialBatchEvidence:evidencePath,partialReviewedRange:"canonical 001-030",
 newlyAddedThemeSlotCount:inserted,masterKoreanNamesRepaired:fixed,
 verifiedSelfHostedImageCount:210,
 note:"SV2a 151 한국판 001-030 12테마 및 카드명 검수 완료, 031-210 미완료. 210장 이미지 기존 자가저장 확인. 카드 수집/UX 변경 없음."
};
Object.assign(progress,{
 status:"in_progress",appliedReviewThrough:30,reviewedKoreanNames:30,
 unnamedMasterCardsRequiringOfficialKoreanProof:158,
 appliedThemeSlots:inserted,appliedThemeAdditions:observed,
 batchEvidence:[...(progress.batchEvidence||[]),evidencePath],
 nextSafeStart:"sv2a canonical 031, preserve 001-030; 210/210 self-hosted images already verified",
 notes:"Korean printed names 001-030 and independent 12-theme artwork checked with existing 23 historical themed keys preserved."
});
images.nextStart="sv2a canonical 031";images.updatedAt=e.reviewedAt;
const source=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(source,source==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write(progressPath,progress),
 write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:code,reviewed:30,remaining:180,KoreanNamesAdded:fixed,themeAdditions:observed,themeSlotsAdded:inserted,next:images.nextStart,ownerModified:false},null,2));
