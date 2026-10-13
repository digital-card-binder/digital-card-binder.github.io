import{readFile,writeFile}from"node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n");
const root="data/audits/",themes12=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [e2,e3,index,modern,legacy,art,st,im,progress]=await Promise.all([
 read(root+"theme-sp-057-120-Korean-art-review-20261013.json"),
 read(root+"theme-sp-121-204-Korean-art-review-20261013.json"),
 read(root+"theme-visual-evidence/S-P/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read(root+"theme-series-review-status.json"),
 read(root+"theme-image-selfhost-audit.json"),
 read(root+"theme-sp-series-progress-20261013.json")
]);
const owners=[...modern,...legacy].filter(g=>String(g.code||"").toUpperCase()==="S-P");
if(owners.length!==1||owners[0].cards?.length!==204)throw Error("Korean S-P master count changed");
const m=owners[0],old=st.reviews?.[m.code];
if(old?.status==="complete")throw Error("Do not override a complete S-P review");
if(old?.reviewedCardCount===202&&progress.canonicalCheckedThrough===204){
 console.log("S-P 202 already done; no duplicate review");process.exit(0);
}
if(old?.status!=="in_progress"||old.reviewedCardCount!==55||
 progress.KoreanArtworkReviewed!==55||progress.canonicalCheckedThrough!==56||
 im.nextStart!=="S-P canonical 057"||
 e2.items?.length!==64||e2.KoreanCardArtReviewed!==63||e2.heldSourceQualityCount!==1||
 e3.items?.length!==84||e3.KoreanCardArtReviewed!==84||e3.heldCount!==0||
 index.cardCount!==204||index.verificationCounts?.verified!==204)
 throw Error("Expected S-P first 55 approved cards/checkpoint; source moved");
const groups=new Map(art.groups.map(g=>[g.code,g]));
for(const t of themes12)if(!Array.isArray(groups.get(t)?.cards))throw Error("Missing art group "+t);
const original=new Map();
for(const g of art.groups)for(const c of g.cards||[]){
 const k=String(c.code||"").toUpperCase();
 if(String(c.set||"").toUpperCase()==="S-P"||/^S-P_\d{3}$/.test(k)){
  const vals=original.get(k)||[];
  if(vals.includes(g.code))throw Error("Prior S-P theme duplicate "+k);
  vals.push(g.code);original.set(k,vals);
 }
}
if(original.size!==55)throw Error("Expected 55 first-batch Korean cards already mapped, found "+original.size);
const priorSlots=[...original.values()].reduce((sum,v)=>sum+v.length,0);
const seen=new Set();const additions={};let verified=0,held=0,slots=0;
const rows=[...e2.items,...e3.items];
for(let order=57;order<=204;order++){
 const row=rows[order-57],p=index.cards[order-1],c=m.cards[order-1],num=String(c?.code||"").match(/^s-p_([^/ ]+)/i)?.[1];
 if(!row||!p||!c||!num||row.canonicalOrder!==order||
   row.masterCode.toLowerCase()!==c.code.toLowerCase()||
   p.masterCode.toLowerCase()!==c.code.toLowerCase()||
   row.cardKey!=="S-P_"+num||row.koreanName!==c.name||
   row.sourceOwnedCDN!==p.cdnUrl||
   row.evidenceContactSheet!=="data/audits/theme-visual-evidence/S-P/S-P-"+String(Math.ceil(order/15)).padStart(2,"0")+".webp.b64"||
   !String(row.artworkObservation||"").trim()||
   !Array.isArray(row.matchedThemes)||
   new Set(row.matchedThemes).size!==row.matchedThemes.length||
   row.matchedThemes.some(t=>!themes12.includes(t)))
  throw Error("Korean visual evidence mismatch at canonical "+order);
 if(seen.has(row.cardKey))throw Error("Repeated S-P key "+row.cardKey);
 seen.add(row.cardKey);
 if(!row.confirmedKoreanPrintedImage){
  if(row.cardKey!=="S-P_115"||row.status!=="hold_masked_identifier"||
     row.all12ThemesChecked!==false||row.matchedThemes.length!==0||
     c.image!=="/assets/card-image-unavailable.svg")
   throw Error("Unknown Japanese or masked Korean promo image "+row.cardKey);
  held++;continue;
 }
 if(!row.all12ThemesChecked||row.status!=="verified_Korean_print_scene"||
    c.image!==p.cdnUrl)
  throw Error("Korean printed original not fully reviewed, or display is not owned "+row.cardKey);
 verified++;
 for(const tag of row.matchedThemes){
  if((original.get(row.cardKey)||[]).includes(tag))continue;
  const g=groups.get(tag);
  g.cards.push({
   code:row.cardKey,name:c.name,series:"S",set:m.code,setName:m.name,
   cardNumber:c.code.split("_")[1],rarity:c.rarity||"",
   category:g.cards[0]?.category||g.name,
   image:c.image,
   evidence:"한국판 자체 CDN 카드 원본 일러스트 12테마 시각검수: "+row.artworkObservation+
      ". 확인 시트 "+row.evidenceContactSheet+"; 외부 이미지 트래픽 0."
  });
  additions[tag]=(additions[tag]||0)+1;slots++;
 }
}
if(verified!==147||held!==1||seen.size!==148||
 !original.has("S-P_001")||!seen.has("S-P_503"))
 throw Error("Later 148 canonical S-P reviewed cards count/key mismatch");
const heldKeys=["S-P_022","S-P_115"];
st.reviews[m.code]={
 ...old,status:"in_progress",reviewedAt:"2026-10-13",
 reviewedCardCount:202,reviewedThemes:themes12,
 lastReviewedCanonicalOrder:204,heldCards:heldKeys,
 verifiedSelfHostedImageCount:202,newlyAddedThemeSlotCount:(old.newlyAddedThemeSlotCount||0)+slots,
 artifactRegionExceptionsPending:2,
 fullContactSheetEvidence:"data/audits/theme-visual-evidence/S-P/visual-index.json",
 continuationEvidence:[
   "data/audits/theme-sp-001-060-Korean-art-review-20261013.json",
   "data/audits/theme-sp-057-120-Korean-art-review-20261013.json",
   "data/audits/theme-sp-121-204-Korean-art-review-20261013.json"
 ],
 nextIndependentSet:"SA-W",
 note:"한국판 S-P 204장 전체 시트 검수 완료. 202장은 실제 한국어판으로 판정 및 12테마 분류, 022 일본판과 115 인쇄정보 훼손 이미지 2장 보류. 소유 상태 변경 없음. 다음 SA-W 계속."
};
im.batches.push({
 task:6,set:m.code,range:"canonical 057-204 Korean original card art (147 verified, masked S-P_115 held)",
 canonicalCardCount:204,artworkVisuallyVerifiedCount:202,artworkPendingCount:2,
 verifiedImageCount:204,unverifiedImageCount:0,brokenReferenceCount:0,
 selfHostedReferenceCountAfter:202,localPendingImageCount:2,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"all_204_owned_CDNBinaries_decoded__202_Korean_originals__2_print_region_holds",
 themeAdditions:additions,priorArtworkReviewsPreserved:55,priorThemeSlotsPreserved:priorSlots,
 nextStart:"SA-W canonical 001",
 note:"202 Korean S-P card scenes across 12 themes reviewed; 2 held for region/original ID evidence; next set continues independently without resetting."
});
im.nextStart="SA-W canonical 001";im.updatedAt="2026-10-13";
Object.assign(progress,{
 status:"in_progress",canonicalCheckedThrough:204,KoreanArtworkReviewed:202,
 approvedKoreanArtCount:202,heldCardKeys:heldKeys,
 newThemeSlotsAdded:progress.newThemeSlotsAdded+slots,
 themeAdditions:Object.fromEntries(new Set([...Object.keys(progress.themeAdditions),...Object.keys(additions)]).values().map(k=>[k,(progress.themeAdditions[k]||0)+(additions[k]||0)])),
 remaining:[{key:"S-P_022",reason:"Japanese image replacement needed"},{key:"S-P_115",reason:"Korean printed ID masked in source"}],
 nextSafeStart:"SA-W canonical 001",
 note:"S-P Korean 202 card artwork inspections complete. Two held and independently tracked; do not mark entire set complete. Proceed to SA-W."});
const report={schemaVersion:1,recordedAt:"2026-10-13",set:"S-P",
 status:"in_progress_artwork_complete_except_two_nonKorean_proofs",
 canonicalCards:204,verifiedKoreanPrintedArtCards:202,
 regionAndOriginalIssues:heldKeys,
 originalImageBinariesDecoded:204,
 ownedCdnDisplay:202,localPlaceholderDisplay:2,
 originalThemeSlotsPreserved:priorSlots,newLaterThemeSlots:slots,
 laterThemesAdded:additions,priorCheckpointsPreserved:true,
 nextIndependentSet:"SA-W canonical 001",
 noExternalImageRequests:true,noOwnershipChanges:true};
await Promise.all([
 save("data/art-themes.json",art),
 save(root+"theme-series-review-status.json",st),
 save(root+"theme-image-selfhost-audit.json",im),
 save(root+"theme-sp-series-progress-20261013.json",progress),
 save(root+"theme-sp-202-korean-artwork-closure-two-holds-20261013.json",report)
]);
console.log(JSON.stringify({KoreanPrintedArtReviewed:202,holds:heldKeys,newSlots:slots,oldSlots:priorSlots,themeAdditions:additions,next:im.nextStart},null,2));
