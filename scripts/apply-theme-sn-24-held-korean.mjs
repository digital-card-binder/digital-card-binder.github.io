import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const A="data/audits/",T=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [ev,index,modern,legacy,art,state,images,overrides]=await Promise.all([
 read(A+"theme-sn-001-026-Korean-art-review-20261014.json"),
 read(A+"theme-visual-evidence/SN/visual-index.json"),read("data/series.json"),
 read("data/series-legacy.json"),read("data/art-themes.json"),
 read(A+"theme-series-review-status.json"),read(A+"theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const masterSets=[...modern,...legacy].filter(x=>String(x.code||"").toUpperCase()==="SN");
if(masterSets.length!==1||masterSets[0].cards?.length!==26)throw Error("SN master mismatch");
const master=masterSets[0],prior=state.reviews?.SN;
if(prior?.status==="in_progress"&&prior.reviewedCardCount===24&&prior.heldCards?.length===2){
 console.log("SN 001-024 already reviewed; retain 025-026 holds");process.exit(0);
}
if(prior?.status==="complete"||prior?.reviewedCardCount>0||images.nextStart!=="SN canonical 001"||
 ev.set!=="SN"||ev.masterCount!==26||ev.fullyReviewedCardCount!==24||
 ev.artIdentityHolds!==2||ev.items?.length!==26||
 index.cardCount!==26||index.cards?.length!==26||index.verificationCounts?.verified!==26||
 index.verificationCounts?.missing!==0||index.masterMissingKoreanNames!==0)
 throw Error("SN safe starting checkpoint mismatch");
const groups=new Map(art.groups.map(g=>[g.code,g]));for(const t of T)if(!Array.isArray(groups.get(t)?.cards))throw Error("Theme missing "+t);
for(const g of art.groups)for(const c of g.cards||[])if(String(c.set||"").toUpperCase()==="SN"||/^SN_\d{3}$/.test(String(c.code||"").toUpperCase()))throw Error("Cannot overwrite pre-existing SN themes");
overrides.sets??={};overrides.sets.sn??={};
let owned=0,fully=0,held=0,themeSlots=0;
const themeAdded={};
for(let i=0;i<26;i++){
 const n=i+1,card=master.cards[i],proof=index.cards[i],row=ev.items[i];
 const num=String(n).padStart(3,"0"),key="SN_"+num;
 if(!card||!proof||!row||row.canonicalOrder!==n||proof.canonicalOrder!==n||
 row.cardKey!==key||String(card.code).toLowerCase()!==String(row.masterCode).toLowerCase()||
 String(proof.masterCode).toLowerCase()!==String(card.code).toLowerCase()||
 proof.name!==card.name||row.koreanName!==card.name||proof.cdnUrl!==row.ownedCDNUrl||
 proof.imageCheck?.status!=="decoded"||proof.imageCheck?.http!==200||
 proof.imageCheck?.format!=="WEBP"||proof.imageCheck?.dimensions?.join(",")!=="420,586"||
 !proof.cdnUrl?.startsWith("https://dcb-card-images-legacy-2026.pages.dev/")||
 row.proofImage!=="data/audits/theme-visual-evidence/SN/SN-"+String(Math.ceil(n/15)).padStart(2,"0")+".webp.b64"||
 card.code.toLowerCase()!=="sn_"+num+"/024")
 throw Error("SN Korean source / CDN proof mismatch at "+key);
 if(n<=24){
  if(!row.all12ThemesInspected||row.reviewStatus!=="artwork_reviewed"||
    row.physicalPrintedNumber!==num+"/024"||row.syntheticIdentifierOnly||
    !row.matchedThemes?.includes("color"))throw Error("SN numbered print / themes mismatch at "+key);
  fully++;
 }else{
  if(row.physicalPrintedNumber!==null||!row.syntheticIdentifierOnly||
    row.reviewStatus!=="held_unnumbered_duplicate_energy_identity"||
    row.matchedThemes.length!==0||row.all12ThemesInspected)throw Error("SN energy hold must remain unresolved at "+key);
  held++;
 }
 if(card.image!==proof.cdnUrl){if(card.image&&!card.sourceImage)card.sourceImage=card.image;card.image=proof.cdnUrl;}
 overrides.sets.sn[card.code.toLowerCase()]=proof.cdnUrl;
 owned++;
 if(n>24)continue;
 for(const t of row.matchedThemes){
  if(!T.includes(t))throw Error("Unknown independent theme "+t);
  const g=groups.get(t);
  g.cards.push({code:key,name:card.name,series:"S",set:"SN",
    setName:master.displayName||master.title,cardNumber:num+"/024",
    rarity:card.rarity||"",category:t==="color"?row.colorCategory:
      t==="sleeping"?"수면 · 휴식":t==="night"?"도시 야경":t==="street"?"도시 · 생활 공간":"초원",
    image:proof.cdnUrl,
    evidence:"한국판 SN 카드 자체 이미지 12테마 시각검수: "+row.artObservation+
      ". 원본 근거 "+row.proofImage+"; 자체 CDN만 사용."});
  themeSlots++;themeAdded[t]=(themeAdded[t]||0)+1;
 }
}
if(fully!==24||held!==2||owned!==26||themeSlots!==37||
 themeAdded.color!==24||themeAdded.season!==8||themeAdded.sleeping!==1||
 themeAdded.night!==1||themeAdded.street!==3||
 index.cards[24].cdnUrl!==index.cards[25].cdnUrl)
 throw Error("SN 24 reviewed / 2 physical print holds or theme count mismatch");
state.reviews??={};state.reviews.SN={
 ...prior,status:"in_progress",reviewedAt:"2026-10-14",
 reviewedCardCount:24,reviewedThemes:T,heldCards:["SN_025","SN_026"],
 deferredReason:"Two identical physically unnumbered basic lightning energies share the same CDN image; distinct Korean print identities not evidenced. Master canonical keys preserved.",
 verifiedSelfHostedImageCount:26,newlyAddedThemeSlotCount:37,priorThemeSlotsPreserved:0,
 partialReviewEvidence:A+"theme-sn-001-026-Korean-art-review-20261014.json",
 archiveVerificationStatus:"26_own_CDN_binary_decoded_24_artwork_reviewed_2_print_identity_holds",
 note:"SN 한국판 물리 번호 001/024–024/024 24장을 12테마 검수. 동일한 무번호 번개 에너지 2장은 캐노니컬 중복 가능성으로 보류. 완료 처리 금지."};
state.execution.currentEra="S";state.execution.currentSet="SI";
state.execution.lastSafeCheckpoint="SN printed 001-024 reviewed (24), two unnumbered duplicate-energy identity holds, 26 CDN decoded; defer full set completion";
state.execution.nextStart="SI canonical 001";state.execution.updatedAt="2026-10-14";
images.batches.push({task:6,set:"SN",range:"canonical 001-026 (24 printed Korean cards visually reviewed, 2 unnumbered basic lightning energy identity holds)",
 canonicalCardCount:26,artworkVisuallyVerifiedCount:24,artworkPendingCount:2,
 selfHostedReferenceCountAfter:26,externalImageReferenceCountAfter:0,
 archiveVerificationStatus:"26_Korean_owned_CDN_decoded_2_energy_identity_holds",
 verifiedImageCount:26,unverifiedImageCount:0,brokenReferenceCount:0,
 heldCards:["SN_025","SN_026"],themeAdditions:themeAdded,
 nextStart:"SI canonical 001",note:"No external source requests; 2 energy records show the same unnumbered card image, so master identity untouched and full review held."});
images.nextStart="SI canonical 001";images.updatedAt="2026-10-14";art.updatedAt="2026-10-14";
const report={schemaVersion:1,recordedAt:"2026-10-14",set:"SN",status:"in_progress",
 KoreanMasterCards:26,numberedCardsReviewed:24,unnumberedEnergyIdentityHolds:2,
 ownedCdnImagesDecoded:26,newThemeSlots:37,themesAdded:themeAdded,
 fullReviewEvidence:A+"theme-sn-001-026-Korean-art-review-20261014.json",
 originImageDownloads:0,ownershipStateChanges:0,nextSafeStart:"SI canonical 001"};
await Promise.all([save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/series-image-overrides.json",overrides),save("data/art-themes.json",art),
 save(A+"theme-series-review-status.json",state),save(A+"theme-image-selfhost-audit.json",images),
 save(A+"theme-sn-set-progress-20261014.json",report)]);
console.log(JSON.stringify({set:"SN",fullyReviewed:fully,holds:held,imagesDecoded:owned,
 themeSlots,themeAdded,next:images.nextStart,masterDeleted:0,ownershipChanged:0}));
