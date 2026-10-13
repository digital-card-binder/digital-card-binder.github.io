import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,x)=>writeFile(path.join(root,p),JSON.stringify(x,null,2)+"\n");
const evidencePath="data/audits/theme-sv2a-031-060-art-review.json";
const firstPath="data/audits/theme-sv2a-001-030-art-review.json";
const progressPath="data/audits/theme-sv2a-set-progress-20261013.json";
const [e,proof,series,legacy,themes,state,progress,images]=await Promise.all([
 read(evidencePath),read("data/audits/theme-visual-evidence/sv2a/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read(progressPath),
 read("data/audits/theme-image-selfhost-audit.json")
]);
const set=[...series,...legacy].filter(x=>String(x.code).toLowerCase()==="sv2a");
if(set.length!==1)throw Error("One and only one Korean sv2a master set required");
const master=set[0],code=master.code,prev=state.reviews?.[code];
const expected=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
if(prev?.status==="complete")throw Error("Strict complete already; no overwrites");
if(progress.appliedReviewThrough>=60 && progress.batchEvidence?.includes(evidencePath)){
 console.log("SV2a 031-060 already applied, skip.");process.exit(0);
}
if(prev?.reviewedCardCount!==30||prev.partialBatchEvidence!==firstPath||
 progress.appliedReviewThrough!==30||!progress.batchEvidence?.includes(firstPath)||
 !String(images.nextStart||"").toLowerCase().includes("sv2a canonical 031"))
 throw Error("Previous safe checkpoint differs from first 30; do not overwrite.");
if(master.cards?.length!==210||proof.cardCount!==210||
 proof.verificationCounts.verified!==210||proof.verificationCounts.missing!==0||
 e.set!=="sv2a"||e.masterCanonicalCount!==210||e.start!==31||e.end!==60||
 e.cardsReviewed!==30||e.cards?.length!==30||e.originImageRequests!==0||
 e.requiredAllTwelveChecked!==true)throw Error("Korean 210-image review evidence mismatch.");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const code of expected)if(!Array.isArray(groups.get(code)?.cards))
 throw Error("Theme group missing: "+code);
const totals={};let fixed=0,inserted=0;
for(let i=0;i<30;i++){
 const n=i+31,row=e.cards[i],proofCard=proof.cards[n-1],card=master.cards[n-1];
 const key="SV2A_"+String(n).padStart(3,"0");
 if(!card||!row||!proofCard||row.canonicalOrder!==n||proofCard.canonicalOrder!==n||
 row.code!==key||String(row.canonicalMasterCode).toLowerCase()!==String(proofCard.masterCode).toLowerCase()||
 String(card.code).toLowerCase()!==String(proofCard.masterCode).toLowerCase()||
 row.printedNumber!==String(proofCard.masterCode).split("_")[1]||
 row.sourceImage!==proofCard.rawSource||row.verifiedCdnUrl!==proofCard.cdnUrl||
 !row.verifiedImageBinary||proofCard.imageCheck?.status!=="decoded"||
 row.verifiedImageSize?.join(",")!==proofCard.imageCheck.dimensions.join(",")||
 row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv2a/sv2a-"+
  String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
 row.sourceRegion!=="KR"||row.all12ThemesChecked!==true||
 typeof row.koreanName!=="string"||!row.koreanName.trim()||
 typeof row.visualObservation!=="string"||!row.visualObservation.trim()||
 !Array.isArray(row.wasAlreadyInThemes)||!Array.isArray(row.themesMatched)||
 row.themesMatched.some(t=>!expected.includes(t))||
 new Set(row.themesMatched).size!==row.themesMatched.length)
 throw Error("Korean printed card evidence mismatch: "+key);
 const previous=[];
 for(const g of themes.groups)if(g.cards.some(x=>String(x.code).toUpperCase()===key))previous.push(g.code);
 if(JSON.stringify(previous.sort())!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
  throw Error("Prior theme slot changed: "+key);
 if(row.themesMatched.some(t=>previous.includes(t)))
  throw Error("Duplicate theme placement attempted: "+key);
 if(card.name&&card.name!==row.koreanName)
  throw Error("Never overwrite existing canonical Korean name: "+key);
 if(!card.name){card.name=row.koreanName;fixed++;}
 for(const t of row.themesMatched){
  const g=groups.get(t);
  g.cards.push({
   code:key,name:row.koreanName,series:"SV",set:code,setName:e.officialKoreanSetName,
   cardNumber:row.printedNumber,rarity:card.rarity||"",category:g.cards[0]?.category||g.name,
   evidence:"포켓몬 한국판 자체 호스팅 카드 시트("+row.visualEvidenceSheet+") 확인: "+row.visualObservation+
     ". 외부 이미지 요청 없이 기존 자가 저장 카드 사용.",
   image:card.sourceImage||card.image
  });
  inserted++;totals[t]=(totals[t]||0)+1;
 }
}
if(fixed!==30||JSON.stringify(Object.entries(totals).sort())!==
 JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("Reviewed Korean names or theme counts mismatch.");
state.reviews[code]={...prev,status:"in_progress",reviewedAt:e.reviewedAt,reviewedCardCount:60,
 partialBatchEvidence:evidencePath,partialReviewedRange:"canonical 001-060",
 newlyAddedThemeSlotCount:Number(prev.newlyAddedThemeSlotCount||0)+inserted,
 masterKoreanNamesRepaired:Number(prev.masterKoreanNamesRepaired||0)+fixed,
 verifiedSelfHostedImageCount:210,
 note:"SV2a 포켓몬카드 151 한국판 001-060 이름/12테마 전수 시각 검수. 061-210 보류. 기존 소유상태와 테마 기록 보존."
};
progress.appliedReviewThrough=60;
progress.reviewedKoreanNames=60;
progress.unnamedMasterCardsRequiringOfficialKoreanProof=128;
progress.appliedThemeSlots=Number(progress.appliedThemeSlots||0)+inserted;
progress.appliedThemeAdditions=progress.appliedThemeAdditions||{};
for(const [t,v] of Object.entries(totals))
 progress.appliedThemeAdditions[t]=(progress.appliedThemeAdditions[t]||0)+v;
progress.batchEvidence.push(evidencePath);
progress.nextSafeStart="sv2a canonical 061; 001-060 complete partial batches; 210/210 selfhosted images verified";
progress.notes="Korean visual art and 60 printed names reviewed. Remaining 150 canonical slots deferred. No independent collection states changed.";
images.nextStart="sv2a canonical 061";images.updatedAt=e.reviewedAt;
const dbPath=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(dbPath,dbPath==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write(progressPath,progress),
 write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:code,through:60,newKoreanNames:fixed,addedThemeSlots:inserted,perTheme:totals,next:images.nextStart},null,2));
