import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n");
const CODE="s6K",DATE="2026-10-15",NUM=86;
// Korean-printed s6K photo is self-hosted under /assets/cards/s6k-korean-rare/; registry allows that owned path.
const OLD_NEXT="s6K Korean print source pending: 084-095";
const NEXT="s6K Korean print source pending: 084,085,087-095";
const approvedPath="data/audits/theme-visual-evidence/s6K/korean-candidates/approved-crops.json";
const [approved,source,modern,legacy,themes,status,hosting,overrides,progress]=await Promise.all([
read(approvedPath),
read("data/audits/theme-visual-evidence/s6K/061-095/visual-index.json"),
read("data/series.json"),read("data/series-legacy.json"),
read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
read("data/audits/theme-image-selfhost-audit.json"),
read("data/series-image-overrides.json"),
read("data/audits/theme-s6K-061-095-progress-20261015.json")
]);
const files=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE.toLowerCase());
if(files.length!==1||files[0].cards?.length!==95)throw Error("Wrong S6K canonical set");
const set=files[0],key=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()==="s6k"),r=status.reviews?.[key||set.code]||{};
const art=source.cards?.find(p=>p.canonicalOrder===NUM),card=set.cards[NUM-1];
const photo=approved.cards?.[0],itemKey="S6K_086",code="s6k_086/070";
if(r.verifiedKoreanPrintImageCount===84&&r.reviewedCardCount===84&&
 progress.verifiedKoreanPrintImages===84&&card?.image==="https://digital-card-binder.github.io/assets/cards/s6k-korean-rare/086-korean.webp"){
 console.log("S6K Korean 086 already replaced; safe idempotent skip");process.exit(0);
}
if(status.execution?.nextStart!==OLD_NEXT||hosting.nextStart!==OLD_NEXT||
 r.status!=="in_progress"||r.artworkReviewedCardCount!==95||
 r.reviewedCardCount!==83||r.verifiedKoreanPrintImageCount!==83||
 r.verifiedSelfHostedImageCount!==95||
 (r.heldCards||[]).length!==12||
 !r.heldCards.some(s=>String(s).toLowerCase()===code)||
 progress.artworkReviewed!==95||progress.verifiedKoreanPrintImages!==83||
 progress.pendingKoreanImages?.length!==12||
 progress.remainingUnreviewedKoreanPrints!==12||
 String(status.execution.currentSet).toLowerCase()!=="s6k")
 throw Error("s6K Korean rare checkpoint changed; no mutation");
if(approved.set!==CODE||approved.count!==1||approved.cards?.length!==1||
 approved.pendingNumbers?.length!==11||
 photo.number!==NUM||photo.code!==code||photo.name!=="흑마 버드렉스 VMAX"||
 photo.status!=="Korean_card_photo_reviewed"||
 photo.koreanPrintedEditionVerified!==true||
 photo.sourceCardNumberVisualConfidence!=="visible"||
 photo.inspection?.visibleKoreanTitle!==photo.name||
 photo.inspection?.numberEvidence!=="S6K 086/070 HR printed footer visible"||
 photo.source!=="https://media.bunjang.co.kr/product/250071997_1_1706006498_w1200.jpg"||
 photo.sourceProductPage!=="https://globalbunjang.com/product/250071997"||
 photo.sourceSha256?.length!==64||
 photo.ownedPath!=="assets/cards/s6k-korean-rare/086-korean.webp")
 throw Error("Korean printed card photo provenance incomplete");
if(source.set!=="s6k"||!art||art.canonicalOrder!==86||art.masterCode!==code||
 art.printedNumberMatches!==true||art.expectedPrintedNumber!=="086/070"||
 art.name!==photo.name||art.priorThemes?.length!==0||
 art.imageCheck?.status!=="decoded"||art.imageCheck?.http!==200||
 art.ownedCdnUrl!==card.image||
 art.rawSource!==(card.sourceImage||card.image)||
 card.code.toLowerCase()!==code||card.name!==photo.name||
 card.koreanPrintImagePending!==true||
 !card.image.startsWith("https://dcb-card-images-legacy-2026.pages.dev/"))
 throw Error("Master Korean card, foreign photo, or archived image does not match");
const bytes=await readFile(photo.ownedPath);
if(bytes.length<20000||bytes.toString("ascii",0,4)!=="RIFF"||
bytes.toString("ascii",8,12)!=="WEBP")throw Error("Missing verified WebP crop");
const expectedThemes=themes.groups.flatMap(g=>g.cards.filter(c=>
String(c.code||"").toUpperCase()===itemKey).map(c=>({group:g.code,card:c})));
if(expectedThemes.length!==1||expectedThemes[0].group!=="color"||
 expectedThemes[0].card.name!==photo.name||
 expectedThemes[0].card.image!==card.image)
 throw Error("Independent color theme slot is missing or changed");
const owned="https://digital-card-binder.github.io/"+photo.ownedPath;
card.previousNonKoreanSourceImage=art.rawSource;
card.sourceImage=photo.source;
card.image=owned;
card.koreanPrintImageVerified=true;
delete card.koreanPrintImagePending;
expectedThemes[0].card.image=owned;
const oldNote=" (일본어 인쇄 임시 이미지: 한국판 인쇄 실물사진 확보 전 완료 처리 금지)";
expectedThemes[0].card.evidence=String(expectedThemes[0].card.evidence||"").replace(oldNote,"")+
 " 한국어 인쇄 S6K 086/070 HR 실물사진 출처: "+approvedPath;
overrides.sets??={};overrides.sets[set.code]??={};
overrides.sets[set.code][code]=owned;
r.reviewedCardCount=84;r.verifiedKoreanPrintImageCount=84;
r.heldCards=r.heldCards.filter(x=>String(x).toLowerCase()!==code);
r.unresolvedImageIssues=(r.unresolvedImageIssues||[]).filter(x=>String(x.code||"").toLowerCase()!==code);
if(r.heldCards.length!==11||r.unresolvedImageIssues.length!==11)throw Error("Held card count mismatch after single Korean recovery");
r.reviewedRanges=["001-030","031-060","061-095 (art complete; Korean 084,085,087-095 pending)"];
r.archiveVerificationStatus="95_artworks_84_Korean_prints_11_Japanese_placeholders";
r.nextStart=NEXT;
r.note="한국어판 S6K 086/070 HR 실물사진 확인 및 자체 이미지 교체. 95장 일러스트 12테마 검수는 유지, 084/085/087-095 일본어 인쇄 11장은 한국판 확보 전 보류.";
status.execution.currentEra="S";
status.execution.currentSet=set.code;
status.execution.lastSafeCheckpoint="s6K canonical 001-095 artwork checked, Korean print images 84/95; 11 foreign print placeholders held";
status.execution.nextStart=NEXT;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches??=[];
hosting.batches.push({task:13,set:set.code,range:"Korean 086/070 physical seller photograph",
 canonicalCardCount:1,artworkVisuallyVerifiedCount:1,verifiedImageCount:1,
 verifiedKoreanPrintImageCount:1,selfHostedReferenceCountAfter:1,
 koreanPrintImagesConfirmed:84,koreanPrintImagesPending:11,
 externalImageReferenceCountAfter:0,brokenReferenceCount:0,
 archiveVerificationStatus:"s6K_086_Korean_print_rehosted_11_foreign_holds",
 nextStart:NEXT,notes:"Card 086 printed Korean title, attacks, and S6K 086/070 HR footer directly inspected. 084 partial image not approved."});
hosting.nextStart=NEXT;hosting.updatedAt=DATE;
themes.updatedAt=DATE;
progress.verifiedKoreanPrintImages=84;
progress.pendingKoreanImages=progress.pendingKoreanImages.filter(x=>x.toLowerCase()!==code);
progress.remainingUnreviewedKoreanPrints=11;
progress.complete=false;progress.nextStart=NEXT;
progress.recoveredKoreanImages=[...(progress.recoveredKoreanImages||[]),{
 code,name:card.name,owned,source:photo.source,sourceProductPage:photo.sourceProductPage,
 printConfidence:"visible_Korean_footer_086/070"}];
progress.koreanPrintSourceProof=approvedPath;
await Promise.all([
save("data/series.json",modern),save("data/series-legacy.json",legacy),
save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
save("data/audits/theme-series-review-status.json",status),
save("data/audits/theme-image-selfhost-audit.json",hosting),
save("data/audits/theme-s6K-061-095-progress-20261015.json",progress)
]);
console.log(JSON.stringify({set:CODE,recovered:code,owned,confirmedKorean:84,total:95,held:11,next:NEXT}));
