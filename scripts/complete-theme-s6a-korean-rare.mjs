import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,x)=>writeFile(p,JSON.stringify(x,null,2)+"\n");
const CODE="s6a",DATE="2026-10-15",TOTAL=101,NEXT="s6K canonical 001";
const HELD=[88,92,96,97,99,100,101];
const [source,progress,proof,modern,legacy,themes,status,hosting,overrides]=await Promise.all([
 read("data/audits/theme-visual-evidence/s6a/korean-candidates/approved-crops.json"),
 read("data/audits/theme-s6a-001-101-progress-20261015.json"),
 read("data/audits/theme-visual-evidence/s6a/001-101/visual-index.json"),
 read("data/series.json"),read("data/series-legacy.json"),
 read("data/art-themes.json"),read("data/audits/theme-series-review-status.json"),
 read("data/audits/theme-image-selfhost-audit.json"),read("data/series-image-overrides.json")
]);
const sets=[...modern,...legacy].filter(s=>String(s.code||"").toLowerCase()===CODE);
if(sets.length!==1||sets[0].cards?.length!==TOTAL)throw Error("Expected exactly one canonical Korean s6a 101-card set");
const set=sets[0],reviewKey=Object.keys(status.reviews||{}).find(k=>k.toLowerCase()===CODE)||set.code;
const prior=status.reviews?.[reviewKey]||{};
if(prior.status==="complete"&&prior.reviewedCardCount===TOTAL){
 console.log("s6a 101/101 already complete; safe idempotent exit.");process.exit(0);
}
const pending=HELD.map(n=>"s6a_"+String(n).padStart(3,"0")+"/069");
const heldRaw=HELD.map(n=>"s6a_"+n+"/069");
if(prior.status!=="in_progress"||prior.artworkReviewedCardCount!==TOTAL||
 prior.reviewedCardCount!==94||prior.verifiedKoreanPrintImageCount!==94||
 prior.verifiedSelfHostedImageCount!==TOTAL||
 JSON.stringify(prior.heldCards)!==JSON.stringify(heldRaw)||
 progress.status!=="in_progress"||progress.artworkReviewed!==TOTAL||
 progress.verifiedKoreanPrintImages!==94||
 JSON.stringify(progress.pendingKoreanImages)!==JSON.stringify(pending)||
 status.execution?.nextStart!=="s6a Korean print source pending: 088,092,096,097,099,100,101"||
 hosting.nextStart!==status.execution.nextStart||
 String(status.execution.currentSet).toLowerCase()!==CODE||
 proof.canonicalCardsChecked!==TOTAL||proof.verifiedOwnedCdnImageCount!==TOTAL)
 throw Error("Unsafe Korean s6a checkpoint; no changes made");
if(source.set!==CODE||source.cardCount!==7||
 JSON.stringify(source.reviewedCardNumbers)!==JSON.stringify(HELD)||
 source.cards?.length!==7||source.cards.some(r=>!r.koreanPrintedEditionVerified))
 throw Error("Korean photo visual proof incomplete or out of order");
const names={88:"리피아 VMAX",92:"님피아 VMAX",96:"마쿠와",97:"아로마 아가씨",
 99:"부쩍부쩍 셰이크",100:"터프스타디움",101:"기본 악 에너지"};
const originalCodes=set.cards.map(c=>c.code),groups=themes.groups||[],changes=[];
for(const r of source.cards){
 const n=r.number,id=String(n).padStart(3,"0"),key="S6A_"+id;
 const master=set.cards[n-1],priorProof=proof.cards[n-1];
 if(!master||!priorProof||master.code.toLowerCase()!=="s6a_"+id+"/069"||
    String(priorProof.masterCode||"").toLowerCase()!==master.code.toLowerCase()||
    r.code.toLowerCase()!==master.code.toLowerCase()||
    master.name!==names[n]||priorProof.name!==names[n]||r.name!==names[n]||
    master.koreanPrintImagePending!==true||master.image!==priorProof.ownedCdnUrl||
    master.sourceImage!==priorProof.rawSource)
  throw Error("Wrong S6a Korean master card or pending artwork: "+n);
 if(r.status!=="Korean_card_photo_reviewed"||
    r.inspection?.visibleKoreanTitle!==names[n]||
    !r.inspection?.visibleKoreanText||!r.inspection?.numberEvidence||
    r.sourceSha256?.length!==64||
    r.ownedPath!=="assets/cards/s6a-korean-rare/"+id+"-korean.webp"||
    !r.source?.startsWith("https://i.ebayimg.com/images/g/")||
    !r.sourceProductPage?.startsWith("https://www.ebay.com/itm/"))
  throw Error("Missing valid Korean seller photo provenance at "+n);
 const bytes=await readFile(r.ownedPath);
 if(bytes.length<3000||bytes.toString("ascii",0,4)!=="RIFF"||
    bytes.toString("ascii",8,12)!=="WEBP")
  throw Error("Invalid owned Korean WebP data at "+n);
 const matched=groups.flatMap(g=>g.cards.filter(c=>String(c.code||"").toUpperCase()===key).map(c=>({g,c})));
 const expectedThemeCount=n===100?2:1;
 if(matched.length!==expectedThemeCount||
    matched.some(({c})=>c.name!==names[n]||c.image!==master.image))
  throw Error("Prior independent theme membership mismatch "+n);
 const owned="https://digital-card-binder.github.io/"+r.ownedPath;
 master.previousNonKoreanSourceImage=priorProof.rawSource;
 master.sourceImage=r.source;master.image=owned;
 delete master.koreanPrintImagePending;master.koreanPrintImageVerified=true;
 for(const {c} of matched){
  c.image=owned;
  c.evidence=String(c.evidence||"").replace(
   " (해외판 인쇄 임시 이미지: 한국어 이미지 교체 필수)","")+
   " 한국어 인쇄 사진 출처: data/audits/theme-visual-evidence/s6a/korean-candidates/approved-crops.json";
 }
 overrides.sets??={};overrides.sets[set.code]??={};
 overrides.sets[set.code][master.code.toLowerCase()]=owned;
 changes.push({code:master.code,name:master.name,owned,source:r.source,printConfidence:r.sourceCardNumberVisualConfidence});
}
if(JSON.stringify(originalCodes)!==JSON.stringify(set.cards.map(x=>x.code)))
 throw Error("Canonical Korean set card IDs unexpectedly changed");
status.reviews[reviewKey]={...prior,status:"complete",reviewedAt:DATE,completedAt:DATE,
 reviewedCardCount:TOTAL,artworkReviewedCardCount:TOTAL,
 verifiedKoreanPrintImageCount:TOTAL,verifiedSelfHostedImageCount:TOTAL,
 heldCards:[],unresolvedImageIssues:[],reviewedRanges:["001-101"],
 archiveVerificationStatus:"s6a_101_Korean_print_images_selfhosted_and_themes_verified",
 nextStart:NEXT,partialReviewEvidence:"data/audits/theme-visual-evidence/s6a/korean-candidates/approved-crops.json",
 note:"한국판 이브이 히어로즈 101장 시각·12테마 검수 및 자체 이미지 반영. 기존 95번 밤 테마 유지. 희귀 7장의 일본판 임시 이미지를 실제 한국어 인쇄 실물사진으로 교체. 101번 촬영본의 하단 번호는 흐려서 판매처 번호로 교차 확인했고 추후 화질 보강 권장."
};
status.execution.currentEra="S";status.execution.currentSet="s6K";
status.execution.lastSafeCheckpoint="s6a canonical 001-101, Korean print source checked 101/101, all artwork themes audited";
status.execution.nextStart=NEXT;status.execution.updatedAt=DATE;status.updatedAt=DATE;
hosting.batches.push({task:9,set:set.code,range:"S6a Korean 088,092,096,097,099,100,101 rare photos",
 canonicalCardCount:7,artworkVisuallyVerifiedCount:7,artworkPendingCount:0,
 selfHostedReferenceCountAfter:7,externalImageReferenceCountAfter:0,
 verifiedImageCount:7,unverifiedImageCount:0,brokenReferenceCount:0,
 koreanPrintImagesConfirmed:101,koreanPrintImagesPending:0,
 archiveVerificationStatus:"s6a_7_Korean_seller_photos_hosted",nextStart:NEXT,
 note:"Seven documented Korean photo sources replace Japanese placeholders, card 101 print number corroborated with listing. All 101 theme artworks preserved."});
hosting.nextStart=NEXT;hosting.updatedAt=DATE;themes.updatedAt=DATE;
progress.status="complete";progress.verifiedKoreanPrintImages=TOTAL;
progress.pendingKoreanImages=[];progress.remainingUnreviewedKoreanPrints=0;
progress.complete=true;progress.nextStart=NEXT;
progress.recoveredKoreanImages=changes;
progress.imageQualityFollowUps=[101];
progress.koreanPrintSourceProof="data/audits/theme-visual-evidence/s6a/korean-candidates/approved-crops.json";
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
 save("data/audits/theme-series-review-status.json",status),
 save("data/audits/theme-image-selfhost-audit.json",hosting),
 save("data/audits/theme-s6a-001-101-progress-20261015.json",progress)
]);
console.log(JSON.stringify({set:CODE,complete:true,koreanPrints:TOTAL,artworks:TOTAL,
 fixed:HELD,priorThemeSlotsPreserved:1,newThemeSlotsPreserved:177,next:NEXT}));
