import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async p => JSON.parse(await readFile(path.join(root,p),"utf8"));
const write = async (p,v) => writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const evidencePath="data/audits/theme-sv4a-001-060-art-review.json";
const progressPath="data/audits/theme-sv4a-set-progress-20261013.json";
const [e,proof,series,legacy,themes,state,progress] = await Promise.all([
 read(evidencePath),read("data/audits/theme-visual-evidence/sv4a/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read(progressPath)
]);
const matches=[...series,...legacy].filter(s=>String(s.code).toLowerCase()==="sv4a");
if(matches.length!==1)throw Error("Expected exactly one Korean sv4a master set");
const master=matches[0];
const expected=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
if(master.cards?.length!==360||proof.cardCount!==360||proof.verificationCounts.verified!==360||
 proof.verificationCounts.missing!==0||progress.canonicalCardSlots!==360||
 progress.existingOwnedCdnImagesDecoded!==360||progress.missingOwnedCdnImages!==0||
 e.set!=="sv4a"||e.start!==1||e.end!==60||e.cards?.length!==60||
 e.requiredAllTwelveChecked!==true)throw Error("Canonical evidence baseline mismatch");
if(state.reviews?.sv4a?.status==="complete")throw Error("Whole set already complete; must not apply partial review");
const previous=state.reviews?.sv4a;
if(previous && Number(previous.reviewedCardCount||0)>0){
 if(previous.partialBatchEvidence===evidencePath&&previous.reviewedCardCount>=60){
  console.log("First 60 already safely applied; no duplicate edits");process.exit(0);
 }
 throw Error("SV4a review advanced in another session; avoid destructive overlap");
}
if(progress.appliedReviewThrough && Number(progress.appliedReviewThrough)>0)throw Error("SV4a progress moved");
const byTheme=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of expected)if(!byTheme.get(t)||!Array.isArray(byTheme.get(t).cards))throw Error("Missing group "+t);
let repaired=0,added=0;const perTheme={};
for(let i=0;i<60;i++){
 const row=e.cards[i],p=proof.cards[i],c=master.cards[i],n=i+1,key="SV4A_"+String(n).padStart(3,"0");
 if(row.canonicalOrder!==n||row.code!==key||row.canonicalMasterCode!==p.masterCode||
 String(c.code).toLowerCase()!==p.masterCode.toLowerCase()||
 row.printedNumber!==p.masterCode.split("_")[1]||
 row.sourceImage!==p.rawSource||row.verifiedCdnUrl!==p.cdnUrl||
 p.imageCheck?.status!=="decoded"||!row.koreanName||
 row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv4a/sv4a-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
 row.all12ThemesChecked!==true||row.sourceRegion!=="KR"||
 !Array.isArray(row.themesMatched)||new Set(row.themesMatched).size!==row.themesMatched.length||
 row.themesMatched.some(t=>!expected.includes(t)))throw Error("Invalid Korean print evidence "+key);
 if(c.name&&c.name!==row.koreanName)throw Error("Never override non-empty master card name "+key);
 if(!c.name){c.name=row.koreanName;repaired++;}
 for(const theme of row.themesMatched){
  const g=byTheme.get(theme);
  if(g.cards.some(v=>String(v.code).toUpperCase()===key))throw Error("Existing theme placement must not be duplicated: "+key+"/"+theme);
  g.cards.push({code:key,name:row.koreanName,series:"SV",set:master.code,setName:"샤이니트레져 ex",
    cardNumber:row.printedNumber,rarity:c.rarity||"",category:g.cards[0]?.category||g.name,
    evidence:"한국판 자체 보관 카드 이미지("+row.visualEvidenceSheet+")를 직접 시각 확인: "+row.visualObservation+
      " (자가 호스팅 기존 이미지 사용; 원본 신규 다운로드 없음).",
    image:c.sourceImage||c.image});
  perTheme[theme]=(perTheme[theme]||0)+1;added++;
 }
}
if(repaired!==60)throw Error("Expected exactly 60 blank Korean card names at batch start; found "+repaired);
if(JSON.stringify(Object.entries(perTheme).sort())!==JSON.stringify(Object.entries(e.themeAdditions).sort()))throw Error("Theme counts diverge from evidence");
state.reviews[master.code]={
 status:"in_progress",reviewedAt:e.reviewedAt,reviewedCardCount:60,reviewedThemes:[],
 partialBatchEvidence:evidencePath,partialReviewedRange:"canonical 001-060",
 newlyAddedThemeSlotCount:added,masterKoreanNamesRepaired:60,verifiedSelfHostedImageCount:360,
 note:"SV4a 001-060 한국판 카드명 60건/12테마 개별 시각 검수. 전체 360장 완료 아님. 기존 SV4A_085/340 배치 유지."
};
progress.status="in_progress";
progress.appliedReviewThrough=60;
progress.reviewedKoreanNames=60;
progress.appliedThemeSlots=added;
progress.appliedThemeAdditions=perTheme;
progress.batchEvidence=[...(progress.batchEvidence||[]),evidencePath];
progress.koreanMasterNamesRequiringReview=95;
progress.nextSafeStart="SV4a canonical 061: continue Korean printed-card name and 12-theme review; 360/360 images self-host verified";
progress.notes="001-060 Korean printed names and conservative artwork themes applied by guarded GitHub Actions. No ownership/UI changes. 061-360 still pending.";
const masterPath=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(masterPath,masterPath==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write(progressPath,progress)
]);
console.log(JSON.stringify({set:"sv4a",reviewed:60,remaining:300,namesRepaired:repaired,themeSlotsAdded:added,byTheme:perTheme,keepPrior:"SV4A_085 / SV4A_340",next:"SV4a 061"},null,2));
