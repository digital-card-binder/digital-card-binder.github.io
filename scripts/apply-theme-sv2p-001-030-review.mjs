import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const evidence="data/audits/theme-sv2P-001-030-art-review.json";
const checkpoint="data/audits/theme-sv2P-set-progress-20261013.json";
const [e,idx,series,legacy,themes,state,progress,images]=await Promise.all([
 read(evidence),read("data/audits/theme-visual-evidence/sv2P/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read(checkpoint),
 read("data/audits/theme-image-selfhost-audit.json")
]);
const matches=[...series,...legacy].filter(s=>String(s.code).toLowerCase()==="sv2p");
if(matches.length!==1)throw Error("Exactly one Korean Snow Hazard master set required");
const master=matches[0],code=master.code,old=state.reviews?.[code];
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
if(old?.status==="complete"){console.log("Set complete already; skip duplicate");process.exit(0);}
if(progress.batchEvidence?.includes(evidence)&&progress.appliedReviewThrough>=30){
 console.log("001-030 already applied; no-op");process.exit(0);
}
if(Number(old?.reviewedCardCount||0)>0||Number(progress.appliedReviewThrough||0)>0||
 String(images.nextStart||"").toLowerCase()!=="sv2p canonical 001")
 throw Error("Checkpoint has moved; refuse overlapping Korean card changes");
if(e.set!=="sv2P"||e.start!==1||e.end!==30||e.cards?.length!==30||
 e.masterCanonicalCount!==99||master.cards?.length!==99||idx.cardCount!==99||
 idx.verificationCounts?.verified!==99||idx.verificationCounts?.missing!==0||
 e.existingOwnedCdnImagesVerified!==99||e.originImageRequests!==0||
 e.requiredAllTwelveChecked!==true||progress.unresolvedKoreanMasterNames!==87)
 throw Error("99-card Korean print proof baseline invalid");
const groups=new Map(themes.groups.map(g=>[g.code,g]));
for(const theme of themes12)if(!Array.isArray(groups.get(theme)?.cards))throw Error("Missing theme "+theme);
let fixed=0,slots=0;const additions={};
for(let i=0;i<30;i++){
 const n=i+1,c=master.cards[i],p=idx.cards[i],row=e.cards[i];
 const printed=String(c?.code||"").match(/_(\d{3})\//)?.[1];
 const key="SV2P_"+printed;
 if(!row||!p||!c||!printed||row.canonicalOrder!==n||p.canonicalOrder!==n||
  String(row.code).toUpperCase()!==key.toUpperCase()||
  String(p.masterCode).toLowerCase()!==String(c.code).toLowerCase()||
  String(row.canonicalMasterCode).toLowerCase()!==String(c.code).toLowerCase()||
  row.printedNumber!==String(p.masterCode).split("_")[1]||
  row.sourceImage!==p.rawSource||row.verifiedCdnUrl!==p.cdnUrl||
  p.imageCheck?.status!=="decoded"||row.verifiedImageBinary!==true||
  row.verifiedImageSize?.join(",")!==p.imageCheck.dimensions.join(",")||
  row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv2P/sv2P-"+
    String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  row.sourceRegion!=="KR"||row.all12ThemesChecked!==true||
  !row.koreanName?.trim()||!row.visualObservation?.trim()||
  !Array.isArray(row.themesMatched)||!Array.isArray(row.wasAlreadyInThemes)||
  new Set(row.themesMatched).size!==row.themesMatched.length||
  row.themesMatched.some(t=>!themes12.includes(t)))
  throw Error("Invalid name, printed identity, archived Korean image or themed art: "+key);
 const previous=[];
 for(const g of themes.groups)
  if(g.cards.some(t=>String(t.code||"").toUpperCase()===key.toUpperCase()))previous.push(g.code);
 if(JSON.stringify(previous.sort())!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
  throw Error("Do not modify preexisting thematic print: "+key);
 if(row.themesMatched.some(t=>previous.includes(t)))throw Error("Duplicate printed card theme: "+key);
 if(c.name&&c.name!==row.koreanName)throw Error("Do not overwrite existing Korean card name "+key);
 if(!c.name){c.name=row.koreanName;fixed++;}
 for(const theme of row.themesMatched){
  const g=groups.get(theme);
  g.cards.push({
   code:key,name:row.koreanName,series:"SV",set:code,setName:e.officialKoreanSetName,
   cardNumber:row.printedNumber,rarity:c.rarity||"",
   category:g.cards[0]?.category||g.name,
   evidence:"한국어판 카드 자가 저장 시트("+row.visualEvidenceSheet+") 직접 판독: "+row.visualObservation+
    ". 기존 CDN 이미지 사용, 제삼자 원본 요청 없음.",
   image:c.sourceImage||c.image
  });
  additions[theme]=(additions[theme]||0)+1;slots++;
 }
}
if(fixed!==30||JSON.stringify(Object.entries(additions).sort())!==
 JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("Korean names or illustrated theme counts diverge from recorded proof");
state.reviews[code]={
 status:"in_progress",reviewedAt:e.reviewedAt,reviewedCardCount:30,
 reviewedThemes:[],partialBatchEvidence:evidence,partialReviewedRange:"canonical 001-030",
 newlyAddedThemeSlotCount:slots,masterKoreanNamesRepaired:fixed,
 verifiedSelfHostedImageCount:99,
 note:"한국판 스노해저드 001-030 인쇄번호/한글 카드명/12테마 검수. 총99장 중 남은 69장 보류. 기존 테마 및 소유상태 유지."
};
Object.assign(progress,{
 status:"in_progress",appliedReviewThrough:30,reviewedKoreanNames:30,
 unresolvedKoreanMasterNames:progress.unresolvedKoreanMasterNames-fixed,
 appliedThemeSlots:slots,appliedThemeAdditions:additions,
 batchEvidence:[...(progress.batchEvidence||[]),evidence],
 nextSafeStart:"sv2P canonical 031; 001-030 preserved, 99/99 owned CDN images previously decoded",
 notes:"The first 30 Korean printed cards and all twelve theme criteria reviewed. Card ownership/UI untouched."
});
images.nextStart="sv2P canonical 031";
images.updatedAt=e.reviewedAt;
const db=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(db,db==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write(checkpoint,progress),
 write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:code,through:30,restoredKoreanNames:fixed,addedThemeSlots:slots,byTheme:additions,next:images.nextStart},null,2));
