import { readFile, writeFile } from "node:fs/promises";
const read = async p => JSON.parse(await readFile(p,"utf8"));
const save = async (p, j) => writeFile(p, JSON.stringify(j,null,2)+"\n");
const CODE="s6K", DATE="2026-10-15", OLD_NEXT="s6K Korean print source pending: 089,090,092-094";
const NEXT="s6K Korean print source pending: 089,090,092,094";
const PROOF="data/audits/theme-visual-evidence/s6K/korean-candidates/ssg-093/stage.json";
const CORRECTION="data/audits/theme-s6K-093-094-Korean-number-correction-20261015.json";
const [p,archive,modern,legacy,themes,status,hosting,overrides,progress]=await Promise.all([
 read(PROOF),read("data/audits/theme-visual-evidence/s6K/061-095/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/series-image-overrides.json"),
 read("data/audits/theme-s6K-061-095-progress-20261015.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE.toLowerCase());
if(sets.length!==1||sets[0].cards?.length!==95)throw Error("Expected one S6K 95-card Korean master");
const set=sets[0],keys=set.cards.map(c=>c.code);
const a=set.cards[92],b=set.cards[93],card93="s6k_093/070",card94="s6k_094/070";
const owned="https://digital-card-binder.github.io/assets/cards/s6k-korean-rare/093-korean.webp";
const k=Object.keys(status.reviews||{}).find(s=>s.toLowerCase()==="s6k")||set.code;
const review=status.reviews?.[k]||{};
if(progress.verifiedKoreanPrintImages===91&&a?.name==="안개의 수정"&&a.image===owned&&b?.name==="메아리호른"){
 console.log("S6K Korean 093/094 number correction and image already applied; skip");process.exit(0);
}
if(status.execution?.nextStart!==OLD_NEXT||hosting.nextStart!==OLD_NEXT||
 String(status.execution.currentSet||"").toLowerCase()!=="s6k"||
 review.status!=="in_progress"||review.artworkReviewedCardCount!==95||
 review.reviewedCardCount!==90||review.verifiedKoreanPrintImageCount!==90||
 review.verifiedSelfHostedImageCount!==95||review.heldCards?.length!==5||
 review.unresolvedImageIssues?.length!==5||
 progress.artworkReviewed!==95||progress.verifiedKoreanPrintImages!==90||
 progress.remainingUnreviewedKoreanPrints!==5||progress.pendingKoreanImages?.length!==5)
 throw Error("Unexpected S6K saved checkpoint, do not mutate");
const canonicalPending=[89,90,92,93,94].map(n=>"s6k_"+String(n).padStart(3,"0")+"/070");
if(JSON.stringify(progress.pendingKoreanImages.map(x=>x.toLowerCase()))!==JSON.stringify(canonicalPending))throw Error("Pending identity changed");
const archive93=archive.cards?.find(x=>x.canonicalOrder===93),archive94=archive.cards?.find(x=>x.canonicalOrder===94);
if(!a||!b||a.code?.toLowerCase()!==card93||b.code?.toLowerCase()!==card94||
 a.name!=="메아리호른"||b.name!=="안개의 수정"||
 a.koreanPrintImagePending!==true||b.koreanPrintImagePending!==true||
 a.koreanPrintImageVerified===true||b.koreanPrintImageVerified===true||
 !archive93||!archive94||archive93.name!=="메아리호른"||archive94.name!=="안개의 수정"||
 archive93.masterCode!==card93||archive94.masterCode!==card94||
 archive93.ownedCdnUrl!==a.image||archive94.ownedCdnUrl!==b.image||
 archive93.rawSource!==(a.sourceImage||a.image)||archive94.rawSource!==(b.sourceImage||b.image)||
 archive93.imageCheck?.status!=="decoded"||archive94.imageCheck?.status!=="decoded")
 throw Error("Unexpected old 093/094 Japanese order and image provenance");
if(p.set!=="s6K"||p.number!==93||p.code!==card93||p.name!=="안개의 수정"||
 p.status!=="Korean_card_printed_title_and_number_visually_verified"||
 p.verifiedKoreanPrint!==true||p.inspection?.visibleKoreanTitle!=="안개의 수정"||
 p.inspection?.numberEvidence!=="s6K 093/070 UR"||
 p.inspection?.cardBorderComplete!==true||p.inspection?.noWatermarkVisible!==true||
 p.inspection?.photoPrintConfidence!=="visible"||
 p.ownedPath!=="assets/cards/s6k-korean-rare/093-korean.webp"||
 p.source!=="https://sitem.ssgcdn.com/98/22/20/item/1000523202298_i1_1200.jpg"||
 p.sourceProductPage!=="https://www.ssg.com/item/itemView.ssg?itemId=1000523202298"||
 p.sourceSha256?.length!==64)
 throw Error("Korean 093 physical title/footer photo not approved");
const bytes=await readFile(p.ownedPath);
if(bytes.length<14000||bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP")
 throw Error("Missing 093 owned Korean WebP");
const entries=themes.groups.flatMap(g=>g.cards.filter(c=>["S6K_093","S6K_094"].includes(String(c.code||"").toUpperCase())).map(c=>({group:g.code,card:c})));
if(entries.length!==2||entries.some(x=>x.group!=="color"))throw Error("Unexpected independent theme slots 093/094");
const theme93=entries.find(x=>String(x.card.code).toUpperCase()==="S6K_093").card;
const theme94=entries.find(x=>String(x.card.code).toUpperCase()==="S6K_094").card;
if(theme93.name!==a.name||theme94.name!==b.name||
 theme93.image!==a.image||theme94.image!==b.image||
 theme93.category!=="금빛·갈색"||theme94.category!=="금빛·보라")
 throw Error("Theme imagery/category proof no longer matches archived Japanese artwork");
const prev93={name:a.name,image:a.image,sourceImage:a.sourceImage};
const prev94={name:b.name,image:b.image,sourceImage:b.sourceImage};
a.name="안개의 수정";
a.previousNonKoreanSourceImage=prev93.sourceImage;
a.sourceImage=p.source;a.image=owned;a.koreanPrintImageVerified=true;
delete a.koreanPrintImagePending;
b.name="메아리호른";
b.previousForeignImageWithDifferentArtwork=prev94.image;
b.previousForeignSourceWithDifferentArtwork=prev94.sourceImage;
// Korean 094 Echoing Horn shares illustration with archived JP 093, but printed number remains JP 093.
// It is reference only; never claim Korean 094 until the correct Korean printed copy is sourced.
b.image=prev93.image;
b.sourceImage=prev93.sourceImage;
b.koreanPrintImagePending=true;delete b.koreanPrintImageVerified;
b.provisionalForeignPrintNumberMismatch=true;
theme93.name=a.name;theme93.image=a.image;theme93.category="금빛·보라";
theme93.evidence="한국판 S6K 093/070 안개의 수정 UR 실물 한글 인쇄·번호 확인. "+PROOF;
theme94.name=b.name;theme94.image=b.image;theme94.category="금빛·갈색";
theme94.evidence="한국판 S6K 094/070 메아리호른. 이전에 일본어 인쇄 S6K 093/070으로 등록된 일러스트만 임시 참조하며, 번호가 다른 외국어 임시 이미지이므로 한국판 이미지 확보 전 완료 처리 금지.";
overrides.sets??={};overrides.sets[set.code]??={};
if(overrides.sets[set.code][card93]!==prev93.image||overrides.sets[set.code][card94]!==prev94.image)
 throw Error("Override source unexpectedly changed before 093-094 correction");
overrides.sets[set.code][card93]=owned;
overrides.sets[set.code][card94]=prev93.image;
review.heldCards=review.heldCards.filter(x=>String(x).toLowerCase()!==card93);
review.unresolvedImageIssues=review.unresolvedImageIssues.filter(x=>String(x.code||"").toLowerCase()!==card93);
const rem=[89,90,92,94].map(n=>"s6k_"+String(n).padStart(3,"0")+"/070");
if(JSON.stringify(review.heldCards.map(x=>String(x).toLowerCase()))!==JSON.stringify(rem)||
 review.unresolvedImageIssues.length!==4)throw Error("Exactly four unverified images must remain");
review.unresolvedImageIssues=review.unresolvedImageIssues.map(x=>String(x.code||"").toLowerCase()===card94?
 {...x,issue:"Korean S6K 094/070 메아리호른 photo missing; Japanese S6K 093/070 Echoing Horn art used as number-mismatched visual placeholder"}:x);
if(JSON.stringify(keys)!==JSON.stringify(set.cards.map(c=>c.code)))throw Error("Canonical printed IDs changed");
review.reviewedCardCount=91;review.verifiedKoreanPrintImageCount=91;
review.reviewedRanges=["001-030","031-060","061-095 (art complete; Korean 089,090,092,094 pending)"];
review.archiveVerificationStatus="95_artworks_91_Korean_prints_4_Japanese_placeholders_093_094_Korean_card_number_corrected";
review.partialReviewEvidence=CORRECTION;review.nextStart=NEXT;
review.note="한국판 093 안개의 수정, 094 메아리호른 순서를 한국판 실물 기준으로 정정. 093 자체 WebP 저장. 094는 일본어판 093 그림만 임시 참조하므로 한국어·카드 번호 확인 전 완료 처리 금지.";
status.execution.currentEra="S";status.execution.currentSet=set.code;
status.execution.lastSafeCheckpoint="s6K 95 artworks; 91 Korean print photos; Korean 093/094 printing map corrected; four print images held";
status.execution.nextStart=NEXT;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches??=[];
hosting.batches.push({task:16,set:set.code,
 range:"S6K 093 Korean Fog Crystal UR and 094 Echoing Horn printed-number correction",
 canonicalCardCount:2,artworkVisuallyVerifiedCount:2,
 verifiedImageCount:1,verifiedKoreanPrintImageCount:1,selfHostedReferenceCountAfter:1,
 koreanPrintImagesConfirmed:91,koreanPrintImagesPending:4,
 externalImageReferenceCountAfter:0,brokenReferenceCount:0,
 archivedProof:CORRECTION,nextStart:NEXT,
 note:"Korean 093/070 Fog Crystal verified via SSG print; 094 Echoing Horn Korean number validated via TCGBOX; old Japanese 093 Echoing Horn used only as mismatch-labelled placeholder."});
hosting.nextStart=NEXT;hosting.updatedAt=DATE;themes.updatedAt=DATE;
progress.verifiedKoreanPrintImages=91;progress.remainingUnreviewedKoreanPrints=4;
progress.pendingKoreanImages=rem;progress.complete=false;progress.nextStart=NEXT;
progress.recoveredKoreanImages=[...(progress.recoveredKoreanImages||[]),{
 code:card93,name:a.name,owned,source:p.source,sourceProductPage:p.sourceProductPage,
 printConfidence:"visible_Korean_title_and_footer_093/070_UR"}];
progress.koreanPrintSourceProof093=PROOF;
progress.correctedKoreanNameNumberMapping={93:"안개의 수정",94:"메아리호른",proof:CORRECTION};
const correction={schemaVersion:1,date:DATE,set:CODE,mode:"Korean_print_edition_number_correction",
 note:"Prior master 093/094 followed a conflicting Japanese image-to-number mapping. Korean printed S6K 093/070 photo visibly reads 안개의 수정, while Korean retailer catalog lists 094 메아리호른. Identity codes and user ownership retained.",
 sourceProof:PROOF,retailerLinks:[
  "https://tcgbox.co.kr/product/detail.html?product_no=13096",
  "https://tcgbox.co.kr/product/detail.html?product_no=13097"
 ],corrected:[{code:card93,oldName:prev93.name,newName:a.name,
   image:owned,verifiedKoreanPrint:true},
  {code:card94,oldName:prev94.name,newName:b.name,
   placeholder:prev93.image,placeholderPrintedNumber:"JP S6K 093/070",
   expectedKoreanPrintedNumber:"S6K 094/070",verifiedKoreanPrint:false}],
 originalImages:{s6K093:prev93,s6K094:prev94},
 independentThemeUpdated:true,
 collectionOwnershipKeyChanged:false,remainingPending:rem};
await Promise.all([
save("data/series.json",modern),save("data/series-legacy.json",legacy),
save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
save("data/audits/theme-series-review-status.json",status),
save("data/audits/theme-image-selfhost-audit.json",hosting),
save("data/audits/theme-s6K-061-095-progress-20261015.json",progress),
save(CORRECTION,correction)
]);
console.log(JSON.stringify({corrected:["093=안개의 수정","094=메아리호른"],koreanPrints:91,held:4,next:NEXT}));
