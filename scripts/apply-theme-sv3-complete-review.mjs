import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const write=async(p,data)=>writeFile(path.join(root,p),JSON.stringify(data,null,2)+"\n");
const evidencePath="data/audits/theme-sv3-001-0141-art-review.json";
const indexPath="data/audits/theme-visual-evidence/sv3/visual-index.json";
const [e,index,series,legacy,themes,state,images]=await Promise.all([
read(evidencePath),read(indexPath),read("data/series.json"),read("data/series-legacy.json"),
read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
read("data/audits/theme-image-selfhost-audit.json")]);
const matches=[...series,...legacy].filter(x=>String(x.code).toLowerCase()==="sv3");
if(matches.length!==1)throw Error("Must have one Korean sv3 canonical master set.");
const master=matches[0],setCode=master.code;
const themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
if(state.reviews?.[setCode]?.status==="complete"&&state.reviews[setCode].reviewedCardCount===141){
 console.log("sv3 already strict-complete. Do not reapply.");process.exit(0);
}
if(state.reviews?.[setCode]?.reviewedCardCount>0)throw Error("Review checkpoint already advanced; do not overwrite");
if(String(images.nextStart).toLowerCase()!=="sv3 canonical 001")throw Error("Image checkpoint changed; abort");
if(e.set!=="sv3"||e.officialKoreanSetName!=="흑염의 지배자"||
 e.masterCanonicalCount!==141||e.cardsReviewed!==141||e.cards?.length!==141||
 master.cards?.length!==141||index.cardCount!==141||
 index.verificationCounts.verified!==141||index.verificationCounts.missing!==0||
 e.existingOwnedCdnImagesVerified!==141||e.originImageRequests!==0||
 e.missingMasterNamesRequiringRepair!==124||e.priorThemeSlotsToPreserve!==9||
 e.requiredAllTwelveChecked!==true)throw Error("Korean 141-card evidence, cardinality, or archive mismatch.");
const byTheme=new Map(themes.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!byTheme.has(t)||!Array.isArray(byTheme.get(t).cards))
 throw Error("Required theme missing: "+t);
const existing=new Map();
for(const group of themes.groups)
 for(const item of group.cards||[])
  if(String(item.set||"").toLowerCase()==="sv3"||
    /^SV3_\d{3}$/.test(String(item.code||"").toUpperCase())){
   const key=String(item.code).toUpperCase();
   if(!existing.has(key))existing.set(key,[]);
   existing.get(key).push(group.code);
  }
const existingCount=[...existing.values()].reduce((a,b)=>a+b.length,0);
if(existingCount!==9)throw Error("Existing nine prior SV3 theme placements have changed.");
const counts={};let repaired=0,newPlacements=0;
for(let i=0;i<141;i++){
 const n=i+1,row=e.cards[i],p=index.cards[i],c=master.cards[i];
 const key="SV3_"+String(n).padStart(3,"0");
 const previous=(existing.get(key)||[]).sort();
 if(!p||!c||row.canonicalOrder!==n||p.canonicalOrder!==n||row.code!==key||
 String(row.canonicalMasterCode).toLowerCase()!==String(p.masterCode).toLowerCase()||
 String(c.code).toLowerCase()!==String(p.masterCode).toLowerCase()||
 row.printedNumber!==String(p.masterCode).split("_")[1]||
 row.sourceImage!==p.rawSource||row.verifiedCdnUrl!==p.cdnUrl||
 row.verifiedImageBinary!==true||p.imageCheck?.status!=="decoded"||
 !Array.isArray(row.verifiedImageSize)||
 row.verifiedImageSize.join(",")!==p.imageCheck?.dimensions?.join(",")||
 row.sourceRegion!=="KR"||row.all12ThemesChecked!==true||
 row.visualEvidenceSheet!=="data/audits/theme-visual-evidence/sv3/sv3-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
 !row.koreanName||!row.koreanName.trim()||
 !Array.isArray(row.themesMatched)||
 new Set(row.themesMatched).size!==row.themesMatched.length||
 row.themesMatched.some(t=>!themes12.includes(t))||
 JSON.stringify(previous)!==JSON.stringify([...row.wasAlreadyInThemes].sort()))
 throw Error("Official printed Korean card or previous-theme evidence mismatch: "+key);
 if(c.name&&c.name!==row.koreanName)
  throw Error("Must not overwrite existing master Korean printed name: "+key);
 if(!c.name){c.name=row.koreanName;repaired++;}
 for(const t of row.themesMatched){
  if(previous.includes(t))throw Error("Cannot duplicate existing theme: "+key+"/"+t);
  const group=byTheme.get(t);
  if(group.cards.some(item=>String(item.code).toUpperCase()===key))
   throw Error("Duplicate art-theme placement: "+key+"/"+t);
  group.cards.push({
   code:key,name:row.koreanName,series:"SV",set:setCode,setName:e.officialKoreanSetName,
   cardNumber:row.printedNumber,rarity:c.rarity||"",
   category:group.cards[0]?.category||group.name,
   evidence:"한국판 카드번호 "+row.printedNumber+" 자체 호스팅 인쇄 이미지("+
    row.visualEvidenceSheet+")를 직접 대조해 12테마 개별 판독: "+row.visualObservation+
    ". 외부 원본 신규 다운로드 없음.",
   image:c.sourceImage||c.image
  });
  counts[t]=(counts[t]||0)+1;newPlacements++;
 }
}
if(repaired!==124)throw Error("Expected 124 new Korean printed names, got "+repaired);
if(JSON.stringify(Object.entries(counts).sort())!==JSON.stringify(Object.entries(e.themeAdditions).sort()))
 throw Error("The thematic hit totals diverge from evidence.");
if(!master.name || /^sv3( 도감)?$/i.test(master.name))master.name="흑염의 지배자";
else if(master.name!=="흑염의 지배자")throw Error("Existing Korean set title conflicts with official.");
state.reviews[setCode]={
 status:"complete",reviewedAt:e.reviewedAt,reviewedCardCount:141,
 reviewedThemes:themes12,heldCards:[],
 newlyAddedCards:e.cards.filter(c=>c.themesMatched.length>0).map(c=>c.code),
 newlyAddedThemeSlotCount:newPlacements,previouslyPreservedThemeSlotCount:9,
 masterKoreanNamesRepaired:124,verifiedSelfHostedImageCount:141,
 archiveVerificationStatus:"141_existing_Korean_owned_CDN_images_decoded",
 fullSetEvidence:evidencePath,
 note:"흑염의 지배자 한국판 141개 canonical 카드의 인쇄 번호와 원본 이미지 및 12테마 개별 그림 검수 완료. 기존 9개 테마 기록 유지, 새 카드명 124건 보완. 수집·UX/UI 변경 없음."
};
images.batches.push({
 task:6,set:setCode,range:"canonical 001-0141 full Korean Obsidian Flames visual review",
 canonicalCardCount:141,artworkVisuallyVerifiedCount:141,artworkPendingCount:0,
 externalImageReferenceCountBefore:141,newlyInternalizedReferenceCount:0,
 selfHostedReferenceCountAfter:141,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"verified_existing_official_Korean_CDN_binary_decoded",
 verifiedImageCount:141,unverifiedImageCount:0,brokenReferenceCount:0,
 themeAdditions:counts,masterKoreanNamesRepaired:124,
 priorPreservedThemePlacements:9,nextStart:"sv2a canonical 001",
 note:"141 self-hosted Korean card images decoded and visually reviewed against their printed card numbers. No third-party image downloads."
});
images.nextStart="sv2a canonical 001";
images.updatedAt=e.reviewedAt;
const file=series.includes(master)?"data/series.json":"data/series-legacy.json";
await Promise.all([
 write(file,file==="data/series.json"?series:legacy),
 write("data/art-themes.json",themes),
 write("data/audits/theme-series-review-status.json",state),
 write("data/audits/theme-image-selfhost-audit.json",images)
]);
console.log(JSON.stringify({set:setCode,complete:true,cardsReviewed:141,verifiedOwnedImages:141,
  repairedKoreanNames:repaired,priorPlacementsKept:9,addedThemeSlots:newPlacements,
  themeCounts:counts,nextStart:"sv2a canonical 001"},null,2));
