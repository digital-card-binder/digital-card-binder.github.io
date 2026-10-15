import {readFile,writeFile} from "node:fs/promises";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const save=async(p,j)=>writeFile(p,JSON.stringify(j,null,2)+"\n");
const CODE="s6H",DATE="2026-10-15",GLOBAL="s6K Korean print source pending: 089,090,092,094";
const NUMS=[84,86,87,94,95],HELD=[85,88,89,90,91,92,93],NEXT="s6H Korean print source pending: 085,088-093";
const REVIEW="data/audits/theme-s6H-084-095-five-Korean-prints-review-20261015.json";
const STAGE="data/audits/theme-visual-evidence/s6H/korean-rare-candidates/staged-five-korean.json";
const PROOF="data/audits/theme-visual-evidence/s6H/061-095/visual-index.json";
const FULL="data/audits/theme-s6H-001-095-Korean-print-review-20261015.json";
const [review,staged,proof,full,modern,legacy,themes,status,hosting,overrides,prev]=await Promise.all([
 read(REVIEW),read(STAGE),read(PROOF),read(FULL),read("data/series.json"),
 read("data/series-legacy.json"),read("data/art-themes.json"),
 read("data/audits/theme-series-review-status.json"),read("data/audits/theme-image-selfhost-audit.json"),
 read("data/series-image-overrides.json"),read("data/audits/theme-s6H-061-083-progress-20261015.json")
]);
const sets=[...modern,...legacy].filter(x=>String(x.code||"").toLowerCase()==="s6h");
if(sets.length!==1||sets[0].cards?.length!==95)throw Error("S6H Korean printed master changed");
const set=sets[0],origIds=set.cards.map(c=>c.code);
const mkey=Object.keys(status.reviews||{}).find(x=>x.toLowerCase()==="s6h")||set.code;
const meta=status.reviews?.[mkey]||{};
const owned=n=>"https://digital-card-binder.github.io/assets/cards/s6h-korean-rare/"+String(n).padStart(3,"0")+"-korean.webp";
if(meta.artworkReviewedCardCount===88&&meta.verifiedKoreanPrintImageCount===88&&
 NUMS.every(n=>set.cards[n-1]?.image===owned(n))){
 console.log("s6H five verified images already applied; skip");process.exit(0);
}
if(status.execution?.nextStart!==GLOBAL||hosting.nextStart!==GLOBAL||
 meta.status!=="in_progress"||meta.artworkReviewedCardCount!==83||
 meta.reviewedCardCount!==83||meta.verifiedKoreanPrintImageCount!==83||
 meta.verifiedSelfHostedImageCount!==95||meta.heldCards?.length!==12||
 meta.unresolvedImageIssues?.length!==12||
 prev.artworkReviewed!==83||prev.verifiedKoreanPrintImages!==83||
 prev.foreignPrintedImagesHeld!==12||prev.newlyAddedThemeSlots!==32||
 prev.globalCheckpointPreserved!==GLOBAL)
 throw Error("S6H 83-card checkpoint or S6K global holds moved");
if(review.set!==CODE||review.verifiedNumbers?.length!==5||
 JSON.stringify(review.verifiedNumbers)!==JSON.stringify(NUMS)||
 JSON.stringify(review.pendingKoreanNumbers)!==JSON.stringify(HELD)||
 !review.all12ThemesInspectedForVerifiedCardArtworks||
 review.status!=="five_Korean_printed_cards_visually_verified_low_resolution_watermarked"||
 staged.set!==CODE||staged.cards?.length!==5||
 staged.status!=="five_verified_Korean_prints_staged_low_res_watermark"||
 JSON.stringify(staged.unresolvedNumbers)!==JSON.stringify(HELD)||
 proof.set!=="s6h"||proof.range!=="061-095"||
 proof.canonicalCardsChecked!==35||proof.verifiedOwnedCdnImageCount!==35||
 proof.printedNumberMatchCount!==35||proof.unavailableOwnedCdnImageCount!==0||
 full.set!=="s6H"||full.visuallyReviewedKoreanPrintCount!==83||
 full.foreignPrintImagePlaceholderCount!==12||full.heldNumbers?.length!==12)
 throw Error("Incomplete independent manual review, source image, or Korean print proof");
const group=themes.groups.find(g=>g.code==="color");
if(!group||!Array.isArray(group.cards))throw Error("Missing independent color theme");
const totals=themes.groups.flatMap(g=>g.cards.filter(c=>/^S6H_(?:0[0-7][0-9]|08[0-3])$/i.test(String(c.code||""))));
if(totals.length!==141-5)throw Error("Previously inspected 83-card theme memberships changed "+totals.length);
overrides.sets??={};overrides.sets[set.code]??={};
const additions=[];
for(const n of NUMS){
 const id=String(n).padStart(3,"0"),code="s6h_"+id+"/070",key="S6H_"+id;
 const item=review.cards.find(x=>x.number===n),file=staged.cards.find(x=>x.number===n);
 const old=proof.cards.find(x=>x.canonicalOrder===n),card=set.cards[n-1];
 if(n===84)console.log("S6H diagnostic "+JSON.stringify({id,card:{name:card?.name,code:card?.code,image:card?.image,sourceImage:card?.sourceImage,verified:card?.koreanPrintImageVerified},old:{name:old?.name,code:old?.masterCode,owned:old?.ownedCdnUrl,raw:old?.rawSource,printed:old?.printedNumberMatches,check:old?.imageCheck?.status,http:old?.imageCheck?.http},approved:{name:item?.name,code:item?.code,number:item?.printedNumber,visible:item?.visibleKoreanName},stage:{code:file?.code,source:file?.source,owned:file?.ownedPath,sha:file?.sourceSha256?.length}}));
 if(!item||!file||!old||!card||item.code!==code||file.code!==code||
 card.code?.toLowerCase()!==code||card.name!==item.name||
 old.masterCode?.toLowerCase()!==code||old.name!==item.name||
 old.ownedCdnUrl!==card.image||old.rawSource!==card.sourceImage||
 old.imageCheck?.status!=="decoded"||old.imageCheck?.http!==200||
 old.printedNumberMatches!==true||
 item.printedNumber!==id+"/070"||!item.koreanPrintedFooterVisible||
 !item.visibleKoreanName||!item.color?.trim()||!item.observation?.trim()||
 item.sourceUrl!==file.source||file.ownedPath!=="assets/cards/s6h-korean-rare/"+id+"-korean.webp"||
 file.sourceSha256?.length!==64||file.stagedSha256?.length!==64||
 file.originalSize?.[0]!==286||file.originalSize?.[1]!==400||
 card.koreanPrintImageVerified===true)
 throw Error("Cannot approve mismatch in S6H "+id);
 const bytes=await readFile(file.ownedPath);
 if(bytes.length<12000||bytes.toString("ascii",0,4)!=="RIFF"||
 bytes.toString("ascii",8,12)!=="WEBP")throw Error("Missing self-owned staged WebP "+id);
 const existing=themes.groups.flatMap(g=>g.cards.filter(c=>
 String(c.code||"").toUpperCase()===key||
 (String(c.set||"").toLowerCase()==="s6h"&&String(c.cardNumber||"").startsWith(id+"/"))));
 if(existing.length)throw Error("Refusing to overwrite existing S6H 12-theme entries "+id);
 card.previousNonKoreanSourceImage=old.rawSource;
 card.sourceImage=item.sourceUrl;card.image=owned(n);
 card.koreanPrintImageVerified=true;delete card.koreanPrintImagePending;
 card.imageQualityFollowUp="TCGBOX 286x400 Korean watermark / low resolution; replace with clean high-resolution Korean scan";
 group.cards.push({code:key,name:card.name,series:"S",set:set.code,
  setName:set.displayName||"백은의 랜스",cardNumber:id+"/070",rarity:card.rarity||"",
  category:item.color,image:owned(n),
  evidence:"한국어 카드명·"+id+"/070 "+item.rarity+" 실제 인쇄 확인, 12테마 검수: "+
  item.observation+" (판매처 워터마크·저해상도 이미지 품질 개선 필요; "+REVIEW+")"});
 overrides.sets[set.code][code]=owned(n);
 additions.push({number:n,code,theme:"color",owned:owned(n),source:item.sourceUrl,quality:"286x400_source_TCGBOX_watermark"});
}
const remaining=HELD.map(n=>"s6h_"+String(n).padStart(3,"0")+"/070");
meta.heldCards=meta.heldCards.filter(x=>!NUMS.includes(Number(String(x).match(/_(\d{3})\//)?.[1])));
meta.unresolvedImageIssues=meta.unresolvedImageIssues.filter(x=>!NUMS.includes(Number(String(x.code||"").match(/_(\d{3})\//)?.[1])));
if(meta.heldCards.length!==7||meta.unresolvedImageIssues.length!==7||
 JSON.stringify(meta.heldCards.map(x=>String(x).toLowerCase()))!==JSON.stringify(remaining))
 throw Error("Unexpected Korean high-rare print holds; should be seven");
if(JSON.stringify(origIds)!==JSON.stringify(set.cards.map(c=>c.code)))throw Error("Canonical ownership codes changed");
meta.artworkReviewedCardCount=88;meta.reviewedCardCount=88;
meta.verifiedKoreanPrintImageCount=88;meta.verifiedSelfHostedImageCount=95;
meta.reviewedRanges=["001-030","031-060","061-083","084,086,087,094,095"];
meta.reviewedThemes=["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
meta.partialReviewEvidence=REVIEW;meta.nextStart=NEXT;
meta.newlyAddedThemeSlotCount=(meta.newlyAddedThemeSlotCount||0)+5;
meta.archiveVerificationStatus="88_Korean_prints_verified_7_foreign_language_placeholders_5_low_res_quality_followups";
meta.note="백은의 랜스 88/95장 한국어판 이미지 및 12테마 검수. 84·86·87·94·95 한국판 실물 제목·인쇄 번호 확인 후 WebP 자체 저장, TCGBOX 286×400 워터마크 고화질 교체 대상 지정. 85·88~93 일본어 이미지 한국판 검수 보류. S6K 글로벌 보류 4장은 유지.";
meta.reviewedAt=DATE;meta.status="in_progress";
status.updatedAt=DATE;themes.updatedAt=DATE;
full.visuallyReviewedKoreanPrintCount=88;
full.foreignPrintImagePlaceholderCount=7;
full.heldNumbers=full.heldNumbers.filter(x=>!NUMS.includes(x.number));
full.fullSeriesArtworkThemeClassificationComplete=false;
full.reasonForNoCompletion="S6H 한국판 카드 88장 확인. 085,088-093 7장의 현재 이미지는 일본어판 임시 자료이며 한국판 인쇄·테마 확정 보류.";
full.nextSetArtworkVisualReview=NEXT;
full.newKoreanRarePrintedImages=additions;
full.imageQualityFollowUps=[84,86,87,94,95];
hosting.batches??=[];
hosting.batches.push({set:set.code,range:"s6H Korean printed rares 084 086 087 094 095",
 canonicalCardCount:5,verifiedKoreanPrintImageCount:5,
 selfHostedReferenceCountAfter:5,archiveVerificationStatus:"five_low_res_Korean_prints_watermarked",
 KoreanPrintImagesConfirmed:88,KoreanPrintImagesPending:7,sourceProof:REVIEW,
 nextStart:NEXT,note:"Korean title and printed card number confirmed in retailer images; higher-resolution clean replacement needed."});
hosting.updatedAt=DATE;
// Do not replace hosting.nextStart: S6K four outstanding Korean source cards remain the global checkpoint.
await Promise.all([
 save("data/series.json",modern),save("data/series-legacy.json",legacy),
 save("data/art-themes.json",themes),save("data/series-image-overrides.json",overrides),
 save("data/audits/theme-series-review-status.json",status),
 save("data/audits/theme-image-selfhost-audit.json",hosting),
 save(FULL,full),
 save("data/audits/theme-s6H-084-095-five-Korean-progress-20261015.json",{
  schemaVersion:1,recordedAt:DATE,set:CODE,totalCards:95,artworkReviewed:88,
  KoreanPrintedImagesVerified:88,selfHostedImageCount:95,
  foreignLanguageImageHolds:7,heldKoreanPrintCodes:remaining,
  themeAdditionsThisBatch:5,totalNewlyAddedThemeSlots:meta.newlyAddedThemeSlotCount,
  imageQualityFollowUps:[84,86,87,94,95],
  reviewedKoreanNumbers:NUMS,complete:false,nextStart:NEXT,
  globalCheckpointPreserved:GLOBAL,sourceProof:REVIEW,stagedProof:STAGE,
  note:"Source cards are low resolution TCGBOX images, Korean text and number verified, watermark retained. Seven Japanese placeholders await clean Korean printed artwork."
 })
]);
console.log(JSON.stringify({set:CODE,reviewed:88,total:95,
 KoreanPrintImagesVerified:88,foreignPrintHolds:7,added:5,holding:remaining,
 qualityFollowUps:NUMS,next:NEXT,global:GLOBAL}));
