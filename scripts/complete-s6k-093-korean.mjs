import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n");
const CODE="s6K",DATE="2026-10-15",N=93,id="093",key="S6K_093",code="s6k_093/070";
const EVIDENCE="data/audits/theme-visual-evidence/s6K/korean-candidates/ssg-093/stage.json";
const OLD_NEXT="s6K Korean print source pending: 089,090,092-094";
const NEXT="s6K Korean print source pending: 089,090,092,094";
const [p,archived,modern,legacy,themes,status,hosting,overrides,progress]=await Promise.all([
read(EVIDENCE),read("data/audits/theme-visual-evidence/s6K/061-095/visual-index.json"),
read("data/series.json"),read("data/series-legacy.json"),
read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
read("data/audits/theme-image-selfhost-audit.json"),
read("data/series-image-overrides.json"),
read("data/audits/theme-s6K-061-095-progress-20261015.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE.toLowerCase());
if(sets.length!==1||sets[0].cards?.length!==95)throw Error("Incorrect S6K canonical set");
const set=sets[0],originalIds=set.cards.map(x=>x.code),card=set.cards[N-1];
const rvKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()==="s6k")||set.code,review=status.reviews?.[rvKey]||{};
const owned="https://digital-card-binder.github.io/assets/cards/s6k-korean-rare/093-korean.webp";
if(review.reviewedCardCount===91&&progress.verifiedKoreanPrintImages===91&&card?.image===owned){
console.log("Korean 093 already applied; safe skip");process.exit(0);}
if(status.execution?.nextStart!==OLD_NEXT||hosting.nextStart!==OLD_NEXT||
 String(status.execution?.currentSet||"").toLowerCase()!=="s6k"||
 review.status!=="in_progress"||review.artworkReviewedCardCount!==95||
 review.reviewedCardCount!==90||review.verifiedKoreanPrintImageCount!==90||
 review.verifiedSelfHostedImageCount!==95||review.heldCards?.length!==5||
 review.unresolvedImageIssues?.length!==5||
 progress.artworkReviewed!==95||progress.verifiedKoreanPrintImages!==90||
 progress.remainingUnreviewedKoreanPrints!==5||progress.pendingKoreanImages?.length!==5)
 throw Error("Unexpected S6K checkpoint: protect existing user catalog");
const archive=archived.cards?.find(x=>x.canonicalOrder===N);
if(!archive||archived.set!=="s6k"||archive.masterCode!==code||
archive.expectedPrintedNumber!=="093/070"||!archive.printedNumberMatches||
archive.imageCheck?.status!=="decoded"||archive.imageCheck?.http!==200||
archive.name!==card.name||archive.ownedCdnUrl!==card.image||
archive.rawSource!==card.sourceImage||card.code?.toLowerCase()!==code||
card.koreanPrintImagePending!==true||card.koreanPrintImageVerified===true)
throw Error("Printed edition reference or old card does not match");
if(p.set!==CODE||p.number!==N||p.code!==code||p.name!==card.name||
p.status!=="Korean_card_printed_title_and_number_visually_verified"||
p.verifiedKoreanPrint!==true||p.inspection?.visibleKoreanTitle!=="안개의 수정"||
p.inspection?.numberEvidence!=="s6K 093/070 UR"||
p.inspection?.photoPrintConfidence!=="visible"||
p.inspection?.noWatermarkVisible!==true||p.inspection?.cardBorderComplete!==true||
p.source!=="https://sitem.ssgcdn.com/98/22/20/item/1000523202298_i1_1200.jpg"||
p.sourceProductPage!=="https://www.ssg.com/item/itemView.ssg?itemId=1000523202298"||
p.ownedPath!=="assets/cards/s6k-korean-rare/093-korean.webp"||
p.imageSize?.[0]!==420||p.imageSize?.[1]!==586||p.sourceSha256?.length!==64)
throw Error("Korean image verification/provenance missing");
const bytes=await readFile(p.ownedPath);
if(bytes.length<18000||bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP")
throw Error("Missing local verified 093 WebP");
const appearances=themes.groups.flatMap(g=>g.cards.filter(x=>String(x.code||"").toUpperCase()===key).map(x=>({t:g.code,card:x})));
if(appearances.length!==1||appearances[0].t!=="color"||
appearances[0].card.name!==card.name||appearances[0].card.image!==card.image)
throw Error("Independent theme membership mismatched");
card.previousNonKoreanSourceImage=archive.rawSource;
card.sourceImage=p.source;card.image=owned;card.koreanPrintImageVerified=true;
delete card.koreanPrintImagePending;
appearances[0].card.image=owned;
appearances[0].card.evidence=String(appearances[0].card.evidence||"").replace(" (일본어 인쇄 임시 이미지: 한국판 인쇄 실물사진 확보 전 완료 처리 금지)","")+
" 한국어 인쇄 093/070 UR 사진 실물 번호 확인: "+EVIDENCE;
overrides.sets??={};overrides.sets[set.code]??={};overrides.sets[set.code][code]=owned;
review.heldCards=review.heldCards.filter(x=>String(x).toLowerCase()!==code);
review.unresolvedImageIssues=review.unresolvedImageIssues.filter(x=>String(x.code||"").toLowerCase()!==code);
const expected=[89,90,92,94].map(n=>"s6k_"+String(n).padStart(3,"0")+"/070");
if(review.heldCards.length!==4||review.unresolvedImageIssues.length!==4||
JSON.stringify(review.heldCards.map(x=>String(x).toLowerCase()))!==JSON.stringify(expected))
throw Error("Must retain exactly four unresolved Korean print holds");
if(JSON.stringify(set.cards.map(x=>x.code))!==JSON.stringify(originalIds))throw Error("Canonical identifiers changed");
review.reviewedCardCount=91;review.verifiedKoreanPrintImageCount=91;
review.reviewedRanges=["001-030","031-060","061-095 (art complete; Korean 089,090,092,094 pending)"];
review.archiveVerificationStatus="95_artworks_91_Korean_prints_4_Japanese_placeholders";
review.partialReviewEvidence=EVIDENCE;review.nextStart=NEXT;
review.note="한국판 S6K 093/070 안개의 수정 UR 이미지 확인·자체 저장 완료. 089/090/092/094 인쇄 미검수 이미지 교체 대기. 한국판 088/091/095는 워터마크 화질 보강 필요.";
status.execution.currentEra="S";status.execution.currentSet=set.code;
status.execution.lastSafeCheckpoint="s6K 95 artwork verified, Korean print images 91/95; 089,090,092,094 foreign placeholders held";
status.execution.nextStart=NEXT;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches??=[];
hosting.batches.push({task:16,set:set.code,range:"S6K 093 Korean physical Fog Crystal clean retailer scan",
 canonicalCardCount:1,artworkVisuallyVerifiedCount:1,verifiedImageCount:1,
 verifiedKoreanPrintImageCount:1,selfHostedReferenceCountAfter:1,
 koreanPrintImagesConfirmed:91,koreanPrintImagesPending:4,
 externalImageReferenceCountAfter:0,brokenReferenceCount:0,
 archivedProof:EVIDENCE,nextStart:NEXT,
 note:"Korean title and s6K 093/070 UR footer visible; 4 foreign language temporary images remain."});
hosting.nextStart=NEXT;hosting.updatedAt=DATE;themes.updatedAt=DATE;
progress.verifiedKoreanPrintImages=91;progress.remainingUnreviewedKoreanPrints=4;
progress.pendingKoreanImages=expected;progress.complete=false;progress.nextStart=NEXT;
progress.recoveredKoreanImages=[...(progress.recoveredKoreanImages||[]),{
 code,name:card.name,owned,source:p.source,sourceProductPage:p.sourceProductPage,printConfidence:"visible_Korean_footer_093/070_UR",
 imageQuality:"clean_Korean_product_image_600x600_source"}];
progress.koreanPrintSourceProof093=EVIDENCE;
await Promise.all([
save("data/series.json",modern),save("data/series-legacy.json",legacy),
save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
save("data/audits/theme-series-review-status.json",status),
save("data/audits/theme-image-selfhost-audit.json",hosting),
save("data/audits/theme-s6K-061-095-progress-20261015.json",progress)]);
console.log(JSON.stringify({set:CODE,verified:91,remaining:4,replaced:code,next:NEXT}));
