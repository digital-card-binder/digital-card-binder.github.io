import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+"\n");
const DATE="2026-10-15",CODE="s6K",TARGETS=[88,91,95];
const OLD_NEXT="s6K Korean print source pending: 088-095";
const NEXT="s6K Korean print source pending: 089,090,092-094";
const EVIDENCE="data/audits/theme-visual-evidence/s6K/korean-candidates/retailer-approved/staged-crops.json";
const [proof,archived,modern,legacy,themes,status,hosting,overrides,progress]=await Promise.all([
 read(EVIDENCE),read("data/audits/theme-visual-evidence/s6K/061-095/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json"),
 read("data/audits/theme-s6K-061-095-progress-20261015.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE.toLowerCase());
if(sets.length!==1||sets[0].cards?.length!==95)throw Error("Canonical S6K 95-card count invalid");
const set=sets[0],originalIds=set.cards.map(x=>x.code);
status.reviews??={};const k=Object.keys(status.reviews).find(k=>k.toLowerCase()==="s6k")||set.code;const prior=status.reviews[k]||{};
const pending=[89,90,92,93,94].map(n=>"s6k_"+String(n).padStart(3,"0")+"/070");
const own=(n)=>"https://digital-card-binder.github.io/assets/cards/s6k-korean-rare/"+String(n).padStart(3,"0")+"-korean.webp";
if(prior.reviewedCardCount===90&&progress.verifiedKoreanPrintImages===90&&
TARGETS.every(n=>set.cards[n-1]?.image===own(n))){
 console.log("Already applied three Korean print replacements; safe skip");process.exit(0);
}
if(status.execution?.nextStart!==OLD_NEXT||hosting.nextStart!==OLD_NEXT||
 String(status.execution?.currentSet||"").toLowerCase()!=="s6k"||
 prior.status!=="in_progress"||prior.artworkReviewedCardCount!==95||
 prior.reviewedCardCount!==87||prior.verifiedKoreanPrintImageCount!==87||
 prior.verifiedSelfHostedImageCount!==95||prior.heldCards?.length!==8||
 prior.unresolvedImageIssues?.length!==8||
 progress.artworkReviewed!==95||progress.verifiedKoreanPrintImages!==87||
 progress.remainingUnreviewedKoreanPrints!==8||
 progress.pendingKoreanImages?.length!==8)
 throw Error("Changed S6K checkpoint, refusing unsafe data mutation");
if(proof.set!==CODE||proof.count!==3||
 proof.status!=="3_Korean_prints_verified_low_res_watermark"||
 JSON.stringify(proof.cards?.map(c=>c.number))!==JSON.stringify(TARGETS)||
 archived.set!=="s6k"||archived.canonicalCardsChecked!==35)
 throw Error("Approved Korean print identity proof missing");
const color=themes.groups.find(g=>g.code==="color");
if(!color||!Array.isArray(color.cards))throw Error("Missing independent color theme");
overrides.sets??={};overrides.sets[set.code]??={};
const added=[];
for(const n of TARGETS){
 const id=String(n).padStart(3,"0"),code="s6k_"+id+"/070",key="S6K_"+id;
 const card=set.cards[n-1],source=archived.cards.find(x=>x.canonicalOrder===n),item=proof.cards.find(x=>x.number===n);
 if(!card||!source||!item||card.code?.toLowerCase()!==code||
 source.masterCode?.toLowerCase()!==code||
 card.name!==item.name||source.name!==item.name||
 !source.printedNumberMatches||source.expectedPrintedNumber!==id+"/070"||
 source.imageCheck?.status!=="decoded"||source.imageCheck?.http!==200||
 item.code!==code||item.status!=="Korean_card_image_and_print_footer_verified"||
 item.verifiedKoreanPrintedEdition!==true||
 item.inspection?.visibleKoreanTitle!==item.name||
 !item.inspection?.visibleKoreanText||
 !item.inspection?.numberEvidence?.includes(id+"/070")||
 item.inspection?.printConfidence!=="visible"||
 item.ownedPath!=="assets/cards/s6k-korean-rare/"+id+"-korean.webp"||
 item.source!=="https://tcgbox.co.kr/web/product/big/s6k/S6K_"+id+".jpg"||
 !item.sourceProductPage?.includes("/"+String(n+13003)+"/")||
 item.sourceSha256?.length!==64||
 item.sourceSize?.[0]!==286||item.sourceSize?.[1]!==400||
 !item.watermark?.includes("TCGBOX")||
 card.koreanPrintImagePending!==true||card.koreanPrintImageVerified===true||
 card.image!==source.ownedCdnUrl||card.sourceImage!==source.rawSource)
 throw Error("Korean card printing, watermark flag, archived evidence or existing identity mismatch at "+id);
 const bytes=await readFile(item.ownedPath);
 if(bytes.length<10000||bytes.toString("ascii",0,4)!=="RIFF"||
 bytes.toString("ascii",8,12)!=="WEBP")throw Error("Bad staged self-hosted WebP at "+id);
 const m=color.cards.filter(x=>String(x.code||"").toUpperCase()===key);
 if(m.length!==1||m[0].name!==card.name||m[0].image!==card.image||
 themes.groups.some(g=>g.code!=="color"&&g.cards.some(c=>String(c.code||"").toUpperCase()===key)))
 throw Error("Independent theme membership changed at "+id);
 const url=own(n);
 card.previousNonKoreanSourceImage=source.rawSource;
 card.sourceImage=item.source;card.image=url;card.koreanPrintImageVerified=true;
 delete card.koreanPrintImagePending;
 card.imageQualityFollowUp="Korean 286x400 TCGBOX watermark; replace with unwatermarked high-resolution Korean print";
 m[0].image=url;
 m[0].evidence=String(m[0].evidence||"").replace(" (일본어 인쇄 임시 이미지: 한국판 인쇄 실물사진 확보 전 완료 처리 금지)","")+
 " 한국판 실물 인쇄 확인 "+id+"/070. TCGBOX 워터마크·저해상도 임시 이미지: "+EVIDENCE;
 overrides.sets[set.code][code]=url;
 added.push({code,name:card.name,owned:url,source:item.source,sourceProductPage:item.sourceProductPage,
  printConfidence:"visible_Korean_footer",imageQuality:"watermarked_low_res_286x400"});
}
prior.heldCards=prior.heldCards.filter(x=>!TARGETS.some(n=>String(x).toLowerCase()==="s6k_"+String(n).padStart(3,"0")+"/070"));
prior.unresolvedImageIssues=prior.unresolvedImageIssues.filter(x=>!TARGETS.some(n=>String(x.code||"").toLowerCase()==="s6k_"+String(n).padStart(3,"0")+"/070"));
if(JSON.stringify(prior.heldCards.map(x=>String(x).toLowerCase()))!==JSON.stringify(pending)||
 prior.unresolvedImageIssues.length!==5)throw Error("Unverified Korean cards must remain on hold");
if(JSON.stringify(set.cards.map(x=>x.code))!==JSON.stringify(originalIds))throw Error("Canonical card identifiers unexpectedly modified");
prior.reviewedCardCount=90;prior.verifiedKoreanPrintImageCount=90;
prior.reviewedRanges=["001-030","031-060","061-095 (art complete; Korean 089,090,092-094 pending)"];
prior.archiveVerificationStatus="95_artworks_90_Korean_prints_5_Japanese_placeholders_3_watermarked_quality_followups";
prior.partialReviewEvidence=EVIDENCE;prior.nextStart=NEXT;
prior.note="S6K 088·091·095 한국어 인쇄·하단 번호 확인 및 자체 WebP 이미지 교체. 판매처 워터마크 있는 286×400 원본은 고화질 대체 필요. 089·090·092·093·094는 외국어 임시 이미지로 보류.";
status.execution.currentSet=set.code;status.execution.currentEra="S";
status.execution.lastSafeCheckpoint="s6K artworks 95/95; Korean printed images 90/95; 5 foreign-language print holds";
status.execution.nextStart=NEXT;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches??=[];hosting.batches.push({task:15,set:set.code,
 range:"S6K 088 091 095 verified Korean low-res retailer prints",
 canonicalCardCount:3,artworkVisuallyVerifiedCount:3,verifiedImageCount:3,
 verifiedKoreanPrintImageCount:3,selfHostedReferenceCountAfter:3,
 koreanPrintImagesConfirmed:90,koreanPrintImagesPending:5,externalImageReferenceCountAfter:0,
 brokenReferenceCount:0,archivedProof:EVIDENCE,nextStart:NEXT,
 note:"Verified Korean source images; three 286×400 retailer watermarks are flagged for quality replacement, remaining five foreign prints held."});
hosting.nextStart=NEXT;hosting.updatedAt=DATE;themes.updatedAt=DATE;
progress.verifiedKoreanPrintImages=90;progress.remainingUnreviewedKoreanPrints=5;
progress.pendingKoreanImages=pending;progress.complete=false;progress.nextStart=NEXT;
progress.recoveredKoreanImages=[...(progress.recoveredKoreanImages||[]),...added];
progress.koreanPrintSourceProofBatch3=EVIDENCE;
progress.imageQualityFollowUps=[...new Set([...(progress.imageQualityFollowUps||[]),...TARGETS])].sort((a,b)=>a-b);
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
 save("data/audits/theme-series-review-status.json",status),
 save("data/audits/theme-image-selfhost-audit.json",hosting),
 save("data/audits/theme-s6K-061-095-progress-20261015.json",progress)
]);
console.log(JSON.stringify({set:CODE,replaced:TARGETS,verifiedKorean:90,total:95,pending,next:NEXT}));
