import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,j)=>writeFile(path.join(root,p),JSON.stringify(j,null,2)+"\n");
const proofPath="data/audits/theme-sv4a-061-120-art-review.json";
const progressPath="data/audits/theme-sv4a-set-progress-20261013.json";
const [e,index,series,legacy,themes,state,progress,images]=await Promise.all([
 read(proofPath),read("data/audits/theme-visual-evidence/sv4a/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read(progressPath),
 read("data/audits/theme-image-selfhost-audit.json")
]);
const masters=[...series,...legacy].filter(x=>String(x.code).toLowerCase()==="sv4a");
if(masters.length!==1)throw Error("One Korean master set required");
const master=masters[0],themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const prev=state.reviews?.[master.code];
if(prev?.status==="complete")throw Error("Must not modify a completed set");
if(progress.appliedReviewThrough>=120 && progress.batchEvidence?.includes(proofPath)){
 console.log("Second batch already applied; stop safely");process.exit(0);
}
if(prev?.reviewedCardCount!==60||progress.appliedReviewThrough!==60||
 !progress.batchEvidence?.includes("data/audits/theme-sv4a-001-060-art-review.json")||
 e.set!=="sv4a"||e.start!==61||e.end!==120||e.cards?.length!==60||
 e.requiredAllTwelveChecked!==true||master.cards?.length!==360||
 index.cardCount!==360||index.verificationCounts.verified!==360||index.verificationCounts.missing!==0)
 throw Error("Sequential Korean batch checkpoint changed");
const byTheme=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!byTheme.get(t)||!Array.isArray(byTheme.get(t).cards))throw Error("Missing theme group "+t);
let repaired=0,added=0;const totals={};
for(let i=0;i<e.cards.length;i++){
 const n=61+i,row=e.cards[i],card=master.cards[n-1],p=index.cards[n-1],key="SV4A_"+String(n).padStart(3,"0");
 if(row.canonicalOrder!==n||row.code!==key||p.canonicalOrder!==n||
 row.canonicalMasterCode.toLowerCase()!==p.masterCode.toLowerCase()||
 String(card.code).toLowerCase()!==p.masterCode.toLowerCase()||
 row.printedNumber!==p.masterCode.split("_")[1]||
 !row.koreanName||row.sourceImage!==p.rawSource||row.verifiedCdnUrl!==p.cdnUrl||
 p.imageCheck?.status!=="decoded"||row.verifiedImageBinary!==true||
 !row.all12ThemesChecked||row.sourceRegion!=="KR"||
 !Array.isArray(row.themesMatched)||new Set(row.themesMatched).size!==row.themesMatched.length||
 row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv4a/sv4a-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
 row.themesMatched.some(t=>!themes12.includes(t)))throw Error("Invalid card evidence "+key);
 const old=new Set();
 for(const group of themes.groups){
  if(group.cards.some(c=>String(c.code).toUpperCase()===key))old.add(group.code);
 }
 if(JSON.stringify([...old].sort())!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
  throw Error("Preserve existing multi-theme card "+key);
 if(card.name && card.name!==row.koreanName)throw Error("Cannot replace Korean canonical name "+key);
 if(!card.name){card.name=row.koreanName;repaired++;}
 for(const theme of row.themesMatched){
  if(old.has(theme))throw Error("Refuse duplicate theme "+key+"/"+theme);
  const group=byTheme.get(theme);
  group.cards.push({code:key,name:row.koreanName,series:"SV",set:master.code,setName:"샤이니트레져 ex",
    cardNumber:row.printedNumber,rarity:card.rarity||"",category:group.cards[0]?.category||group.name,
    evidence:"자가 저장된 한국판 이미지("+row.visualEvidenceSheet+") 시각 판독: "+row.visualObservation+
      " 외부 사이트에 이미지 요청 없음.",
    image:card.sourceImage||card.image});
  totals[theme]=(totals[theme]||0)+1;added++;
 }
}
if(repaired!==60||JSON.stringify(Object.entries(totals).sort())!==JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("Unexpected names or theme group summary");
state.reviews[master.code]={...prev,status:"in_progress",reviewedCardCount:120,reviewedAt:e.reviewedAt,
 partialBatchEvidence:proofPath,partialReviewedRange:"canonical 001-120",
 newlyAddedThemeSlotCount:Number(prev.newlyAddedThemeSlotCount||0)+added,
 masterKoreanNamesRepaired:120,
 note:"SV4a 001-120 한국판 카드명 120건과 12테마 그림 검수. 나머지 240장은 미완료. 기존 SV4A_085 connected, SV4A_340 sleeping 보존."};
progress.appliedReviewThrough=120;
progress.reviewedKoreanNames=120;
progress.koreanMasterNamesRequiringReview=35;
progress.appliedThemeSlots=(progress.appliedThemeSlots||0)+added;
for(const [t,v] of Object.entries(totals))progress.appliedThemeAdditions[t]=(progress.appliedThemeAdditions[t]||0)+v;
progress.batchEvidence.push(proofPath);
progress.nextSafeStart="SV4a canonical 121: continue Korean printed-card and 12-theme review; 360/360 images self-hosted";
progress.notes="001-120 visual evidence and Korean printed names applied, 121-360 pending; existing independent deck ownership, UX/UI unchanged.";
images.nextStart="sv4a canonical 121";
images.updatedAt=e.reviewedAt;
const masterPath=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([write(masterPath,masterPath==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),write("data/audits/theme-series-review-status.json",state),
 write(progressPath,progress),write("data/audits/theme-image-selfhost-audit.json",images)]);
console.log(JSON.stringify({set:"sv4a",reviewed:120,next:121,repaired,themeSlotsAdded:added,themeAdditions:totals,archived360:360},null,2));
