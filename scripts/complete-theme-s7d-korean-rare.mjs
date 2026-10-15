import { readFile,writeFile } from "node:fs/promises";
const read=async file=>JSON.parse(await readFile(file,"utf8"));
const save=async(file,value)=>writeFile(file,JSON.stringify(value,null,2)+"\n");
const CODE="s7D", DATE="2026-10-15", NEXT="s6a canonical 001";
const HELD=[80,81,82], CODES=HELD.map(n=>"s7d_"+String(n).padStart(3,"0")+"/067");
const [one,pair,progress,proof,modern,legacy,art,status,hosting,overrides]=await Promise.all([
 read("data/audits/theme-visual-evidence/s7d/korean-rescued-sources/080-source.json"),
 read("data/audits/theme-visual-evidence/s7d/korean-rescued-sources/081-082-sources.json"),
 read("data/audits/theme-s7d-001-090-progress-20261015.json"),
 read("data/audits/theme-visual-evidence/s7d/001-090/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()===CODE.toLowerCase());
if(sets.length!==1||sets[0].cards?.length!==90)throw Error("Canonical S7D master not exactly 90 records");
const set=sets[0],reviewKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE.toLowerCase())||set.code;
const prior=status.reviews?.[reviewKey]||{};
console.log("S7D_SAFE_CHECK",JSON.stringify({
 reviewKey,prior:{status:prior.status,artworkReviewedCardCount:prior.artworkReviewedCardCount,
 reviewedCardCount:prior.reviewedCardCount,verifiedKoreanPrintImageCount:prior.verifiedKoreanPrintImageCount,
 heldCards:prior.heldCards},progress:{status:progress.status,artworkReviewed:progress.artworkReviewed,
 verifiedKoreanPrintImages:progress.verifiedKoreanPrintImages,pendingKoreanImages:progress.pendingKoreanImages},
 execution:{nextStart:status.execution?.nextStart,currentSet:status.execution?.currentSet},
 hostingNextStart:hosting.nextStart,proof:{canonicalCardsChecked:proof.canonicalCardsChecked,
 verifiedOwnedCdnImageCount:proof.verifiedOwnedCdnImageCount}
}));
if(prior.status==="complete"&&prior.reviewedCardCount===90){
 console.log("s7D is already complete; not mutating any card");process.exit(0);
}
if(prior.status!=="in_progress"||prior.artworkReviewedCardCount!==90||
 prior.reviewedCardCount!==87||prior.verifiedKoreanPrintImageCount!==87||
 JSON.stringify(prior.heldCards)!==JSON.stringify(CODES)||
 progress.status!=="in_progress"||progress.artworkReviewed!==90||
 progress.verifiedKoreanPrintImages!==87||
 JSON.stringify(progress.pendingKoreanImages)!==JSON.stringify(CODES)||
 status.execution?.nextStart!=="s7D Korean print source pending: 080,081,082"||
 hosting.nextStart!==status.execution.nextStart||
 String(status.execution.currentSet).toLowerCase()!=="s7d"||
 proof.canonicalCardsChecked!==90||proof.verifiedOwnedCdnImageCount!==90)
 throw Error("Unsafe S7D completion checkpoint; no changes applied");
if(one.number!==80||one.code!==CODES[0]||one.status!=="verified_korean_print_in_contact_sheet"||
 pair.set!=="s7D"||pair.cards?.length!==2||
 pair.cards.some((x,i)=>x.number!==i+81||x.code!==CODES[i+1]||
 x.status!=="verified_Korean_print_and_number_from_contact_sheet"))
 throw Error("Photographic Korean print proof records do not match expected S7D cards");
const sources=[one,...pair.cards],names={80:"루가루암 VMAX",81:"더스트나 VMAX",82:"두랄루돈 VMAX"};
const allThemeCards=art.groups.flatMap(g=>g.cards);
const codes=set.cards.map(x=>x.code);
const changes=[];
for(const row of sources){
 const n=row.number, id=String(n).padStart(3,"0"), card=set.cards[n-1],p=proof.cards[n-1];
 if(!card||!p||row.name!==names[n]||card.name!==names[n]||p.name!==names[n]||
 String(card.code).toLowerCase()!=="s7d_"+id+"/067"||
 String(p.masterCode).toLowerCase()!==String(card.code).toLowerCase()||
 p.canonicalOrder!==n||card.koreanPrintImagePending!==true||
 card.sourceImage!==p.rawSource||
 card.image!==p.ownedCdnUrl)
  throw Error("Master Korean card identity, image provenance, or pending marker mismatch "+n);
 const expectedPath="assets/cards/s7d-korean-rare/"+id+"-korean.webp";
 const owned=row.ownedCandidate;
 if(owned!==expectedPath||!row.sourceImage?.startsWith("https://")||
 row.sourceSha256?.length!==64||row.candidateDimensions?.[0]===0)
  throw Error("Provenance or self-hosted asset path invalid "+n);
 const blob=await readFile(owned);
 if(blob.length<3000||blob.toString("ascii",0,4)!=="RIFF"||blob.toString("ascii",8,12)!=="WEBP")
  throw Error("Invalid self-hosted Korean WebP binary "+n);
 const matches=allThemeCards.filter(x=>String(x.code||"").toUpperCase()==="S7D_"+id);
 if(matches.length!==1||matches[0].name!==names[n]||matches[0].image!==card.image)
  throw Error("Visual theme registry diverged for rare card "+n);
 const hosted="https://digital-card-binder.github.io/"+owned;
 card.previousNonKoreanSourceImage=p.rawSource;
 card.sourceImage=row.sourceImage;card.image=hosted;
 delete card.koreanPrintImagePending;
 card.koreanPrintImageVerified=true;
 for(const tc of matches){
  tc.image=hosted;
  tc.evidence=String(tc.evidence||"").replace(
   " (일본어 인쇄 임시 이미지: 한국어 인쇄판 실물사진 확보 전 완료 처리 금지)","")+
   " 한국판 실물 이미지 및 출처 확인: data/audits/theme-visual-evidence/s7d/korean-rescued-sources";
 }
 overrides.sets??={};overrides.sets[set.code]??={};
 overrides.sets[set.code][String(card.code).toLowerCase()]=hosted;
 changes.push({code:card.code,name:card.name,source:row.sourceImage,owned:hosted});
}
if(JSON.stringify(codes)!==JSON.stringify(set.cards.map(x=>x.code)))
 throw Error("Card identifiers unexpectedly changed");
status.reviews[reviewKey]={...prior,status:"complete",reviewedAt:DATE,completedAt:DATE,
 reviewedCardCount:90,artworkReviewedCardCount:90,
 verifiedKoreanPrintImageCount:90,verifiedSelfHostedImageCount:90,
 heldCards:[],unresolvedImageIssues:[],reviewedRanges:["001-090"],
 archiveVerificationStatus:"s7D_all_90_Korean_print_images_verified_selfhosted",
 nextStart:NEXT,
 partialReviewEvidence:"data/audits/theme-visual-evidence/s7d/korean-rescued-sources/081-082-sources.json",
 note:"마천퍼펙트 한국판 90장 12테마 전수검수 완료. 80·81·82번 일본판 임시 이미지는 한국어 인쇄가 확인된 실물 사진으로 교체했고 148개 신규 테마 슬롯을 유지했습니다."
};
status.execution.currentEra="S";status.execution.currentSet="s6a";
status.execution.lastSafeCheckpoint="s7D 001-090 (90/90) Korean print, owned images and themes verified";
status.execution.nextStart=NEXT;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({task:8,set:set.code,range:"Korean 080/081/082 rare print correction",
 canonicalCardCount:3,artworkVisuallyVerifiedCount:3,artworkPendingCount:0,
 selfHostedReferenceCountAfter:3,externalImageReferenceCountAfter:0,
 verifiedImageCount:3,unverifiedImageCount:0,brokenReferenceCount:0,
 koreanPrintImagesConfirmed:90,koreanPrintImagesPending:0,nextStart:NEXT,
 archiveVerificationStatus:"s7D_three_Korean_sources_replaced_foreign_placeholders",
 note:"Three Korean HR photographs separately verified and hosted locally; no card identities or ownership data changed."});
hosting.nextStart=NEXT;hosting.updatedAt=DATE;art.updatedAt=DATE;
progress.status="complete";progress.verifiedKoreanPrintImages=90;
progress.pendingKoreanImages=[];progress.remainingUnreviewedKoreanPrints=0;
progress.complete=true;progress.recoveredKoreanImages=changes;progress.nextStart=NEXT;
progress.caution="Full Korean 90/90 print identity confirmed. Source photos are collector listing photographs; clean images may be improved later.";
progress.koreanImageProof="data/audits/theme-visual-evidence/s7d/korean-rescued-sources";
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/art-themes.json",art),save("data/series-image-overrides.json",overrides),
 save("data/audits/theme-series-review-status.json",status),
 save("data/audits/theme-image-selfhost-audit.json",hosting),
 save("data/audits/theme-s7d-001-090-progress-20261015.json",progress)
]);
console.log(JSON.stringify({set:set.code,status:"complete",reviewed:90,KoreanPrints:90,
 owned:90,recovered:changes,additionsPreserved:148,next:NEXT}));
