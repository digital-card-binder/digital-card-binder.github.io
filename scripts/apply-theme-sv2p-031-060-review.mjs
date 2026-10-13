import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const evidence="data/audits/theme-sv2P-031-060-art-review.json";
const checkpoint="data/audits/theme-sv2P-set-progress-20261013.json";
const [e,index,series,legacy,themes,state,progress,images]=await Promise.all([
 read(evidence),read("data/audits/theme-visual-evidence/sv2P/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read(checkpoint),
 read("data/audits/theme-image-selfhost-audit.json")
]);
const matches=[...series,...legacy].filter(s=>String(s.code).toLowerCase()==="sv2p");
if(matches.length!==1)throw Error("Expected one Korean Snow Hazard canonical set");
const master=matches[0],code=master.code,review=state.reviews?.[code];
const categories=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
if(review?.status==="complete"){console.log("Already complete; no duplicate edit");process.exit(0);}
if(progress.batchEvidence?.includes(evidence)&&Number(progress.appliedReviewThrough)>=60){
 console.log("Batch 031-060 previously applied; skip");process.exit(0);
}
if(Number(progress.appliedReviewThrough)!==30 || Number(review?.reviewedCardCount)!==30 ||
 String(images.nextStart||"").toLowerCase()!=="sv2p canonical 031" ||
 !progress.batchEvidence?.includes("data/audits/theme-sv2P-001-030-art-review.json"))
 throw Error("First 30 cards not yet safely committed; refusing out-of-order application");
if(e.set!=="sv2P" || e.start!==31 || e.end!==60 || e.cardsReviewed!==30 ||
 e.cards?.length!==30 || e.masterCanonicalCount!==99 || master.cards?.length!==99 ||
 index.cardCount!==99 || index.verificationCounts?.verified!==99 ||
 index.verificationCounts?.missing!==0 || e.existingOwnedCdnImagesVerified!==99 ||
 e.originImageRequests!==0 || e.requiredAllTwelveChecked!==true ||
 progress.unresolvedKoreanMasterNames!==57)
 throw Error("Korean 031-060 full print evidence or previous checkpoint mismatch");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const theme of categories)if(!Array.isArray(groups.get(theme)?.cards))throw Error("Missing theme "+theme);
const added={};let fixed=0,slots=0;
for(let n=31;n<=60;n++){
 const row=e.cards[n-31],p=index.cards[n-1],c=master.cards[n-1];
 const printed=String(c?.code||"").match(/_(\d{3})\//)?.[1];
 const key="SV2P_"+printed;
 if(!row||!p||!c||!printed||row.canonicalOrder!==n||p.canonicalOrder!==n||
  String(row.code).toUpperCase()!==key.toUpperCase()||
  String(row.canonicalMasterCode).toLowerCase()!==String(c.code).toLowerCase()||
  String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
  row.printedNumber!==String(p.masterCode).split("_")[1]||
  row.sourceImage!==p.rawSource||row.verifiedCdnUrl!==p.cdnUrl||
  row.verifiedImageBinary!==true||p.imageCheck?.status!=="decoded"||
  row.verifiedImageSize?.join(",")!==p.imageCheck?.dimensions?.join(",")||
  row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv2P/sv2P-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  row.sourceRegion!=="KR"||row.all12ThemesChecked!==true||
  !row.koreanName?.trim()||!row.visualObservation?.trim()||
  !Array.isArray(row.wasAlreadyInThemes)||!Array.isArray(row.themesMatched)||
  new Set(row.themesMatched).size!==row.themesMatched.length||
  row.themesMatched.some(t=>!categories.includes(t)))
  throw Error("Card identity, Korean archived artwork or themes mismatched at canonical "+n);
 const previous=[];
 for(const group of themes.groups)
  if(group.cards.some(t=>String(t.code||"").toUpperCase()===key.toUpperCase()))previous.push(group.code);
 if(JSON.stringify(previous.sort())!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
  throw Error("Previously classified card must remain unchanged: "+key);
 if(row.themesMatched.some(t=>previous.includes(t)))throw Error("Duplicate theme assignment at "+key);
 if(c.name&&c.name!==row.koreanName)throw Error("Would overwrite Korean card name at "+key);
 if(!c.name){c.name=row.koreanName;fixed++;}
 for(const t of row.themesMatched){
  const group=groups.get(t);
  group.cards.push({
   code:key,name:row.koreanName,series:"SV",set:code,setName:e.officialKoreanSetName,
   cardNumber:row.printedNumber,rarity:c.rarity||"",
   category:group.cards[0]?.category||group.name,
   evidence:"한국판 자가 저장 이미지("+row.visualEvidenceSheet+") 실제 그림 확인: "+row.visualObservation+
    ". 이미지 신규 외부 요청 없음.",
   image:c.sourceImage||c.image
  });
  added[t]=(added[t]||0)+1;slots++;
 }
}
if(fixed!==30 || JSON.stringify(Object.entries(added).sort())!==JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("Names or theme tally differs from inspected Korean cards");
Object.assign(review,{
 status:"in_progress",reviewedAt:e.reviewedAt,reviewedCardCount:60,
 partialBatchEvidence:evidence,partialReviewedRange:"canonical 001-060",
 newlyAddedThemeSlotCount:Number(review.newlyAddedThemeSlotCount||0)+slots,
 masterKoreanNamesRepaired:Number(review.masterKoreanNamesRepaired||0)+fixed,
 verifiedSelfHostedImageCount:99,
 note:"스노해저드 한국판 001-060 실물 번호 기준 카드명/12테마 검수. 나머지 39장 보류, 기존 sleeping 배치 유지."
});
const cum={...(progress.appliedThemeAdditions||{})};
for(const [k,v]of Object.entries(added))cum[k]=(cum[k]||0)+v;
Object.assign(progress,{
 status:"in_progress",appliedReviewThrough:60,
 reviewedKoreanNames:Number(progress.reviewedKoreanNames||0)+fixed,
 unresolvedKoreanMasterNames:progress.unresolvedKoreanMasterNames-fixed,
 appliedThemeSlots:Number(progress.appliedThemeSlots||0)+slots,
 appliedThemeAdditions:cum,
 batchEvidence:[...(progress.batchEvidence||[]),evidence],
 nextSafeStart:"sv2P canonical 061; Korean 001-060 reviewed, all 99 owned-CDN images previously verified",
 notes:"Printed card identifiers used, prior sleeping theme preserved. No user ownership or layout edits."
});
images.nextStart="sv2P canonical 061";
images.updatedAt=e.reviewedAt;
const masterPath=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(masterPath,masterPath==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write(checkpoint,progress),
 write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:code,through:60,koreanNamesRepaired:fixed,themeSlotsAdded:slots,next:images.nextStart}));
