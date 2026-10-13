import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+"\n");
const ePath="data/audits/theme-sv1a-001-103-art-review.json";
const progressPath="data/audits/theme-sv1a-set-progress-20261013.json";
const [e,index,series,legacy,themes,state,images,progress]=await Promise.all([
 read(ePath),read("data/audits/theme-visual-evidence/sv1a/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read(progressPath)
]);
const matches=[...series,...legacy].filter(s=>String(s.code||"").toLowerCase()==="sv1a");
if(matches.length!==1)throw Error("Expected exactly one canonical Korean Triplet Beat master");
const master=matches[0],code=master.code,previous=state.reviews?.[code];
if(previous?.status==="complete"&&previous.reviewedCardCount===103){
 console.log("Korean Triplet Beat already complete; do not reapply");process.exit(0);
}
if((previous?.reviewedCardCount||0)>0||progress.appliedReviewThrough!==0||
 String(images.nextStart||"").toLowerCase()!=="sv1a canonical 001")
 throw Error("Latest checkpoint moved; refusing overlapping Korean print edits");
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
if(e.set!=="sv1a"||e.officialKoreanSetName!=="트리플렛비트"||
 e.masterCanonicalCount!==103||e.cardsReviewed!==103||e.cards?.length!==103||
 master.cards?.length!==103||index.cardCount!==103||index.verificationCounts?.verified!==103||
 index.verificationCounts?.missing!==0||e.existingOwnedCdnImagesVerified!==103||
 e.originImageRequests!==0||e.missingMasterNamesRequiringRepair!==0||
 e.priorThemePlacementsRetained!==21||e.requiredAllTwelveChecked!==true||
 progress.masterNamesMissing!==0||progress.previousThemePlacementsToPreserve!==21)
 throw Error("103 Korean image/card/name/theme evidence or existing archives changed");
const byTheme=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!Array.isArray(byTheme.get(t)?.cards))throw Error("Missing independent theme "+t);
const existing=new Map();
for(const g of themes.groups)
 for(const row of g.cards||[])
  if(String(row.set||"").toLowerCase()==="sv1a"||
     /^SV1A_\d{3}$/.test(String(row.code||"").toUpperCase())){
   const key=String(row.code||"").toUpperCase(),v=existing.get(key)||[];
   v.push(g.code);existing.set(key,v);
  }
const existingTotal=[...existing.values()].reduce((sum,v)=>sum+v.length,0);
if(existingTotal!==21)throw Error("Twenty-one prior SV1A theme references have changed");
const newHits={};let named=0,added=0;
for(let i=0;i<103;i++){
 const n=i+1,row=e.cards[i],proof=index.cards[i],c=master.cards[i];
 const printed=String(c?.code||"").match(/_(\d{3})\//)?.[1];
 const key="SV1A_"+printed;
 if(!row||!proof||!c||!printed||
  row.canonicalOrder!==n||proof.canonicalOrder!==n||
  String(row.code).toUpperCase()!==key.toUpperCase()||
  String(c.code).toLowerCase()!==String(proof.masterCode).toLowerCase()||
  String(row.canonicalMasterCode).toLowerCase()!==String(proof.masterCode).toLowerCase()||
  row.printedNumber!==String(proof.masterCode).match(/_(\d{3}\/\d{3})/)?.[1]||
  row.sourceImage!==proof.rawSource||row.verifiedCdnUrl!==proof.cdnUrl||
  row.verifiedImageBinary!==true||proof.imageCheck?.status!=="decoded"||
  row.verifiedImageSize?.join(",")!==proof.imageCheck?.dimensions?.join(",")||
  row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv1a/sv1a-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
  row.all12ThemesChecked!==true||row.sourceRegion!=="KR"||
  !row.printedIdentityVerified||!row.visualObservation?.trim()||!row.koreanName?.trim()||
  !Array.isArray(row.wasAlreadyInThemes)||!Array.isArray(row.themesMatched)||
  new Set(row.themesMatched).size!==row.themesMatched.length||
  row.themesMatched.some(t=>!themes12.includes(t)))
  throw Error("Invalid verified Korean print, name, image or independent 12-theme review: "+key);
 const prior=(existing.get(key.toUpperCase())||[]).sort();
 if(JSON.stringify(prior)!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
  throw Error("Existing theme placement differs from visual evidence for "+key);
 if(row.themesMatched.some(t=>prior.includes(t)))
  throw Error("Attempted duplicate previous thematic placement "+key);
 if(c.name&&c.name!==row.koreanName)
  throw Error("Do not overwrite existing Korean name "+key+" "+c.name);
 if(!c.name){c.name=row.koreanName;named++;}
 for(const t of row.themesMatched){
  const group=byTheme.get(t);
  group.cards.push({
   code:key,name:row.koreanName,series:"SV",set:code,
   setName:e.officialKoreanSetName,cardNumber:row.printedNumber,
   rarity:c.rarity||"",category:group.cards[0]?.category||group.name,
   evidence:"한국판 원본 자가저장 증거("+row.visualEvidenceSheet+") 직접 판독: "+
    row.visualObservation+". 신규 외부 이미지 요청 없음.",
   image:c.sourceImage||c.image
  });
  newHits[t]=(newHits[t]||0)+1;added++;
 }
}
if(named!==0||JSON.stringify(Object.entries(newHits).sort())!==
 JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("Repaired Korean name count or visually determined theme totals mismatch");
if(master.cards.some(c=>!String(c.name||"").trim()))
 throw Error("Korean card names remain missing; cannot mark full set complete");
if(!master.name||String(master.name).toLowerCase()==="sv1a 도감")
 master.name=e.officialKoreanSetName;
else if(master.name!==e.officialKoreanSetName)
 throw Error("Existing set name differs from official Korean set title");
state.reviews[code]={
 status:"complete",reviewedAt:e.reviewedAt,reviewedCardCount:103,
 reviewedThemes:themes12,heldCards:[],
 newlyAddedThemeSlotCount:added,previouslyPreservedThemeSlotCount:21,
 masterKoreanNamesRepaired:named,verifiedSelfHostedImageCount:103,
 archiveVerificationStatus:"103_owned_CDN_Korean_print_images_decoded",
 fullSetEvidence:ePath,
 note:"트리플렛비트 한국판 카드 103장 실물 번호/카드명/12테마 시각 전수검수 완료. 기존 테마 8건 및 소유상태 보존, 외부 이미지 신규 트래픽 없음."
};
Object.assign(progress,{
 status:"complete",appliedReviewThrough:103,masterNamesMissing:0,
 namedCardsRepaired:0,themeSlotsApplied:added,
 appliedThemeAdditions:newHits,
 nextSafeStart:"sv1a strict complete; next pending sv1V canonical 001",
 remainingWork:[],
 notes:"103 Korean printed cards visually examined; 0 blank names fixed. Eight existing placements retained and 103 preexisting owned CDN image files decoded."
});
images.batches.push({
 task:6,set:code,range:"canonical 001-0103 Korean Triplet Beat full printed artwork review",
 canonicalCardCount:103,artworkVisuallyVerifiedCount:103,artworkPendingCount:0,
 newlyInternalizedReferenceCount:0,selfHostedReferenceCountAfter:103,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_existing_Korean_CDN_binary_decoded",
 verifiedImageCount:103,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:newHits,masterKoreanNamesRepaired:0,
 priorPreservedThemePlacements:21,
 nextStart:"sv1V canonical 001",
 note:"All 103 official Korean print artworks inspected through DCB self-hosted Cloudflare cards; no third-party origin downloads."
});
images.nextStart="sv1V canonical 001";images.updatedAt=e.reviewedAt;
const db=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(db,db==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write("data/audits/theme-image-selfhost-audit.json",images),
 write(progressPath,progress)
]);
console.log(JSON.stringify({set:code,strictComplete:true,reviewed:103,
 fixedKoreanNames:named,newThemeSlots:added,priorThemeSlotsKept:21,byTheme:newHits,next:images.nextStart},null,2));
