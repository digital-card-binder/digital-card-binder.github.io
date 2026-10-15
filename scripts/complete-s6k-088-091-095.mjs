import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,value)=>writeFile(p,JSON.stringify(value,null,2)+"\n");
const DATE="2026-10-15",CODE="s6K",NEW=[88,91,95],OLD_NEXT="s6K Korean print source pending: 088-095",NEXT="s6K Korean print source pending: 089,090,092-094";
const evidencePath="data/audits/theme-visual-evidence/s6K/korean-candidates/retailer-approved/staged-crops.json";
const [proof,archived,modern,legacy,themes,status,hosting,overrides,progress]=await Promise.all([
read(evidencePath),
read("data/audits/theme-visual-evidence/s6K/061-095/visual-index.json"),
read("data/series.json"),read("data/series-legacy.json"),
read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
read("data/audits/theme-image-selfhost-audit.json"),
read("data/series-image-overrides.json"),
read("data/audits/theme-s6K-061-095-progress-20261015.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE.toLowerCase());
if(sets.length!==1||sets[0].cards?.length!==95)throw Error("Expected exactly one canonical Korean s6K 95 card set");
const set=sets[0],originalIds=set.cards.map(c=>c.code);
status.reviews??={};const key=Object.keys(status.reviews).find(k=>k.toLowerCase()==="s6k")||set.code;
const prior=status.reviews[key]||{};
const canonicalPending=[89,90,92,93,94].map(n=>"s6k_"+String(n).padStart(3,"0")+"/070");
if(prior.reviewedCardCount===90&&prior.verifiedKoreanPrintImageCount===90&&
 progress.verifiedKoreanPrintImages===90&&progress.pendingKoreanImages?.length===5&&
 NEW.every(n=>set.cards[n-1].image===("https://digital-card-binder.github.io/assets/cards/s6k-korean-rare/"+String(n).padStart(3,"0")+"-korean.webp"))){
 console.log("s6K 088 091 095 Korean photos already applied; safe skip");
 process.exit(0);
}
if(status.execution?.nextStart!==OLD_NEXT||hosting.nextStart!==OLD_NEXT||
 String(status.execution?.currentSet||"").toLowerCase()!=="s6k"||
 prior.status!=="in_progress"||prior.artworkReviewedCardCount!==95||
 prior.reviewedCardCount!==87||prior.verifiedKoreanPrintImageCount!==87||
 prior.verifiedSelfHostedImageCount!==95||
 prior.heldCards?.length!==8||prior.unresolvedImageIssues?.length!==8||
 progress.artworkReviewed!==95||progress.verifiedKoreanPrintImages!==87||
 progress.remainingUnreviewedKoreanPrints!==8||progress.pendingKoreanImages?.length!==8)
 throw Error("Unexpected progress checkpoint; refuse to alter user catalog");
if(proof.set!==CODE||proof.count!==3||proof.status!=="3_Korean_prints_verified_low_res_watermark"||
 JSON.stringify(proof.reviewedNumbers)!==JSON.stringify(NEW)||
 JSON.stringify(proof.nextPendingNumbers)!==JSON.stringify([89,90,92,93,94])||
 proof.cards?.length!==3||archived.set!=="s6k")
 throw Error("Missing independent image and printed Korean identity approvals");
const color=themes.groups.find(g=>g.code==="color");
if(!color||!Array.isArray(color.cards))throw Error("Independent color theme missing");
const ownedPrefix="https://digital-card-binder.github.io/";
const originals=[];
overrides.sets??={};overrides.sets[set.code]??={};
for(const n of NEW){
 const id=String(n).padStart(3,"0"),code="s6k_"+id+"/070",themeCode="S6K_"+id;
 const image=set.cards[n-1];
 const prev=archived.cards.find(p=>p.canonicalOrder===n),entry=proof.cards.find(p=>p.number===n);
 if(!prev||!entry||!image||prev.masterCode.toLowerCase()!==code||
 prev.name!==image.name||!prev.printedNumberMatches||
 prev.expectedPrintedNumber!==id+"/070"||prev.imageCheck?.status!=="decoded"||
 entry.code!==code||entry.name!==image.name||entry.status!=="Korean_card_image_and_print_footer_verified"||
 entry.verifiedKoreanPrintedEdition!==true||!entry.inspection?.visibleKoreanTitle||
 (n!==95&&entry.inspection.visibleKoreanTitle!==entry.name)||!entry.inspection?.visibleKoreanText||
 !entry.inspection?.numberEvidence?.includes(id+"/070")||
 entry.inspection?.printConfidence!=="visible"||
 entry.ownedPath!=="assets/cards/s6k-korean-rare/"+id+"-korean.webp"||
 entry.source!=="https://tcgbox.co.kr/web/product/big/s6k/S6K_"+id+".jpg"||
 !entry.sourceProductPage.startsWith("https://tcgbox.co.kr/product/")||
 !entry.sourceSha256||entry.sourceSha256.length!==64||
 image.code.toLowerCase()!==code||
 !image.koreanPrintImagePending||image.koreanPrintImageVerified===true||
 image.image!==prev.ownedCdnUrl||
 image.sourceImage!==prev.rawSource)
 throw Error("Unexpected 12-theme card identity, source provenance, or Korean printed footer "+n);
 const bytes=await readFile(entry.ownedPath);
 if(bytes.length<12000||bytes.toString("ascii",0,4)!=="RIFF"||
 bytes.toString("ascii",8,12)!=="WEBP")
 throw Error("Owned WebP binary missing or invalid "+n);
 const matches=color.cards.filter(c=>String(c.code||"").toUpperCase()===themeCode);
 if(matches.length!==1||matches[0].name!==image.name||matches[0].image!==image.image)
 throw Error("Independent color theme source mismatch "+n);
 const allThemes=themes.groups.flatMap(g=>g.cards.filter(c=>String(c.code||"").toUpperCase()===themeCode).map(c=>g.code));
 if(JSON.stringify(allThemes)!==JSON.stringify(["color"]))throw Error("Unexpected existing s6K theme membership "+n);
 const owned=ownedPrefix+entry.ownedPath;
 originals.push({code,source:entry.source,listing:entry.sourceProductPage,owned,confidence:entry.inspection.printConfidence});
 image.previousNonKoreanSourceImage=prev.rawSource;
 image.sourceImage=entry.source;
 image.image=owned;image.koreanPrintImageVerified=true;delete image.koreanPrintImagePending;
 matches[0].image=owned;
 matches[0].evidence=String(matches[0].evidence||"").replace(" (일본어 인쇄 임시 이미지: 한국판 인쇄 실물사진 확보 전 완료 처리 금지)","")+
  " 한국어 실물 카드 번호 검증 "+id+"/070: "+evidencePath+" (TCGBOX 워터마크·저해상도 이미지, 후속 화질 교체 권장)";
 overrides.sets[set.code][code]=owned;
}
const kept=prior.heldCards.filter(x=>!NEW.some(n=>String(x).toLowerCase()==="s6k_"+String(n).padStart(3,"0")+"/070"));
if(kept.length!==5||JSON.stringify(kept.map(x=>x.toLowerCase()))!==JSON.stringify(canonicalPending))
 throw Error("Unexpected five remaining Korean print holds");
const exceptions=prior.unresolvedImageIssues.filter(x=>!NEW.some(n=>String(x.code||"").toLowerCase()==="s6k_"+String(n).padStart(3,"0")+"/070"));
if(exceptions.length!==5)throw Error("Held image issue count mismatch");
if(JSON.stringify(set.cards.map(c=>c.code))!==JSON.stringify(originalIds))
 throw Error("Canonical identifiers changed");
prior.reviewedCardCount=90;prior.verifiedKoreanPrintImageCount=90;
prior.heldCards=kept;prior.unresolvedImageIssues=exceptions;
prior.reviewedRanges=["001-030","031-060","061-095 (art complete; Korean 089,090,092-094 pending)"];
prior.archiveVerificationStatus="95_artworks_90_Korean_prints_5_Japanese_placeholders";
prior.partialReviewEvidence=evidencePath;
prior.nextStart=NEXT;
prior.note="S6K 088·091·095 한국판 카드명·설명·번호 검증 후 자체 WebP 교체. TCGBOX 저해상도 워터마크 개선 필요. 089·090·092·093·094 한국판 실물 확보 전 보류.";
status.execution.currentSet=set.code;
status.execution.currentEra="S";
status.execution.lastSafeCheckpoint="s6K 95 artworks; Korean printed images 90/95, five foreign placeholders held";
status.execution.nextStart=NEXT;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches??=[];
hosting.batches.push({task:15,set:set.code,range:"Korean TCGBOX s6K 088 091 095 retailer card images",
 canonicalCardCount:3,artworkVisuallyVerifiedCount:3,verifiedImageCount:3,
 verifiedKoreanPrintImageCount:3,selfHostedReferenceCountAfter:3,
 koreanPrintImagesConfirmed:90,koreanPrintImagesPending:5,
 externalImageReferenceCountAfter:0,brokenReferenceCount:0,
 archivedProof:evidencePath,nextStart:NEXT,
 note:"Three Korean-printed HR/UR retailer scans validated for language and card number. Watermarked low-res quality follow-ups; five unverified prints still held."});
hosting.nextStart=NEXT;hosting.updatedAt=DATE;
themes.updatedAt=DATE;
progress.verifiedKoreanPrintImages=90;
progress.remainingUnreviewedKoreanPrints=5;
progress.pendingKoreanImages=canonicalPending;
progress.complete=false;progress.nextStart=NEXT;
progress.recoveredKoreanImages=[...(progress.recoveredKoreanImages||[]),...originals.map(c=>({
 code:c.code,name:set.cards[Number(c.code.slice(4,7))-1].name,owned:c.owned,
 source:c.source,sourceProductPage:c.listing,printConfidence:c.confidence
}))];
progress.koreanPrintSourceProofBatch3=evidencePath;
progress.imageQualityFollowUps=[...new Set([...(progress.imageQualityFollowUps||[]),88,91,95])];
await Promise.all([
save("data/series.json",modern),save("data/series-legacy.json",legacy),
save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
save("data/audits/theme-series-review-status.json",status),
save("data/audits/theme-image-selfhost-audit.json",hosting),
save("data/audits/theme-s6K-061-095-progress-20261015.json",progress)
]);
console.log(JSON.stringify({set:CODE,recovered:NEW,koreanPrintedImages:90,total:95,pending:canonicalPending,next:NEXT}));
