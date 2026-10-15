import {readFile, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const read = async path => JSON.parse(await readFile(path, "utf8"));
const save = async (path, data) => writeFile(path, JSON.stringify(data, null, 2) + "\n");
const date = "2026-10-16";
const globalHold = "s6K Korean print source pending: 089,090,092,094";
const proofPath = "data/audits/theme-s6H-085-Korean-print-review-20261016.json";
const stagePath = "data/audits/theme-visual-evidence/s6H/korean-rare-candidates/staged-085-korean.json";
const fivePath = "data/audits/theme-s6H-084-095-five-Korean-prints-review-20261015.json";
const fullPath = "data/audits/theme-s6H-001-095-Korean-print-review-20261015.json";
const progressPath = "data/audits/theme-s6H-085-Korean-progress-20261016.json";
const owned = "https://digital-card-binder.github.io/assets/cards/s6h-korean-rare/085-korean.webp";
const remaining = [88,89,90,91,92,93];
const heldCodes = remaining.map(n => "s6h_" + String(n).padStart(3,"0") + "/070");
const [review, stage, olderProof, modern, themes, status, hosting, overrides, full] = await Promise.all([
  read(proofPath), read(stagePath), read(fivePath), read("data/series.json"),
  read("data/art-themes.json"), read("data/audits/theme-series-review-status.json"),
  read("data/audits/theme-image-selfhost-audit.json"),
  read("data/series-image-overrides.json"), read(fullPath)
]);
const set = modern.find(s => String(s.code).toLowerCase() === "s6h");
if (!set || set.cards?.length !== 95) throw Error("S6H original 95 canonical identities changed");
const keys = set.cards.map(c => c.code);
const key = Object.keys(status.reviews || {}).find(k => k.toLowerCase() === "s6h");
if (!key) throw Error("Missing current S6H audit status");
const meta = status.reviews[key];
const candidate = set.cards[84];
if (meta.reviewedCardCount === 89 && candidate?.image === owned &&
    meta.heldCards?.length === 6) {
  console.log("Korean printed s6H 085 already restored; idempotent exit.");
  process.exit(0);
}
if (status.execution?.nextStart !== globalHold || hosting.nextStart !== globalHold ||
    meta.status !== "in_progress" || meta.reviewedCardCount !== 88 ||
    meta.artworkReviewedCardCount !== 88 || meta.verifiedKoreanPrintImageCount !== 88 ||
    meta.verifiedSelfHostedImageCount !== 95 || meta.heldCards?.length !== 7 ||
    meta.unresolvedImageIssues?.length !== 7 || meta.newlyAddedThemeSlotCount !== 141 ||
    !meta.heldCards.some(x=>x.toLowerCase() === "s6h_085/070"))
  throw Error("Checkpoint drift: refuse automatic mutation of s6H/s6K");
if (review.status !== "Korean_print_visually_confirmed_085" ||
    review.code !== "s6h_085/070" || review.koreanTitle !== "백마 버드렉스 VMAX" ||
    review.printedNumber !== "085/070" || review.rarity !== "HR" ||
    !review.sourcePrintVerified || !review.all12ThemesReviewed ||
    JSON.stringify(review.matchedThemes) !== JSON.stringify(["color","season"]) ||
    JSON.stringify(review.remainingHolds) !== JSON.stringify(remaining) ||
    review.s6KGlobalCheckpoint !== globalHold)
  throw Error("085 manual Korean print evidence not approved");
if (stage.status !== "Korean_print_visually_approved_rehosted" ||
    stage.code !== review.code || stage.number !== 85 ||
    stage.source !== review.sourceUrl ||
    stage.visualApproval !== proofPath ||
    JSON.stringify(stage.heldUnresolvedNumbers) !== JSON.stringify(remaining) ||
    stage.ownedPath !== "assets/cards/s6h-korean-rare/085-korean.webp" ||
    stage.imageWidth !== 420 || stage.imageHeight !== 586)
  throw Error("085 staged Korean source identity mismatch");
const binary = await readFile(stage.ownedPath);
const actual = createHash("sha256").update(binary).digest("hex");
if (binary.length < 18000 || binary.toString("ascii",0,4) !== "RIFF" ||
    binary.toString("ascii",8,12) !== "WEBP" || actual !== stage.stagedSha256 ||
    stage.sourceSha256?.length !== 64)
  throw Error("Staged WebP invalid or hash mismatch");
if (candidate?.code !== review.code || candidate.name !== review.koreanTitle ||
    candidate.rarity !== "SR" || !String(candidate.image||"").startsWith("https://static.tcgexchange.kr/") ||
    candidate.koreanPrintImageVerified === true)
  throw Error("Master 085 unexpected name, rarity, or prior ownership/image state");
const previous = set.cards[83];
const oldProof = olderProof.cards.find(c=>c.number===84);
if (previous.code !== "s6h_084/070" || previous.rarity !== "SR" ||
    !previous.koreanPrintImageVerified || oldProof?.rarity !== "HR" ||
    review.verified0804RarityCorrection?.number !== 84)
  throw Error("Verified 084 HR metadata fix evidence missing");
if (full.set !== "s6H" || full.visuallyReviewedKoreanPrintCount !== 88 ||
    full.foreignPrintImagePlaceholderCount !== 7 ||
    full.heldNumbers?.length !== 7)
  throw Error("S6H full print audit changed");
const gcolor = themes.groups.find(g=>g.code==="color");
const gseason = themes.groups.find(g=>g.code==="season");
if (!gcolor?.cards || !gseason?.cards) throw Error("Required theme groups missing");
const current = themes.groups.flatMap(g=>g.cards.filter(c=>String(c.code).toUpperCase()==="S6H_085"));
if (current.length !== 0) throw Error("Existing S6H_085 theme entries must not be overwritten");
const allExisting = themes.groups.flatMap(g=>g.cards.filter(c=>String(c.set).toLowerCase()==="s6h"));
if (allExisting.length !== 141) throw Error("Previously verified S6H theme total changed: "+allExisting.length);
const previous084 = allExisting.filter(c=>String(c.code).toUpperCase()==="S6H_084");
if (previous084.length !== 1 || previous084[0].rarity !== "SR")
  throw Error("Verified Korean 084 rarity must be corrected in exactly one theme");
const s6kBefore = JSON.stringify(Object.entries(status.reviews).find(([k])=>k.toLowerCase()==="s6k")?.[1]);
if (!s6kBefore) throw Error("S6K checkpoint is missing");
// Korean 085/070 is a distinct physical HR special-art print; never overwrite ownership codes.
const before085 = candidate.image;
candidate.previousNonKoreanSourceImage = before085;
candidate.sourceImage = review.sourceUrl;
candidate.image = owned;
candidate.rarity = "HR";
candidate.koreanPrintImageVerified = true;
delete candidate.koreanPrintImagePending;
candidate.imageQualityFollowUp = "Kakao Shopping search image (~500px); replace with clean Korean high-resolution scan";
previous.rarity = "HR";
previous084[0].rarity = "HR";
for (const entry of [["color",gcolor],["season",gseason]]) {
  const themeCode = entry[0], group = entry[1];
  group.cards.push({
    code:"S6H_085", name:candidate.name, series:"S", set:"s6H",
    setName:set.displayName || "백은의 랜스", cardNumber:"085/070",
    rarity:"HR", category:review.categories[themeCode], image:owned,
    evidence:"한국판 백마 버드렉스 VMAX 085/070 HR 사진의 한국어 카드명·하단 번호 확인; "+
      review.imageObservation+" ("+proofPath+")"
  });
}
overrides.sets ??= {};
overrides.sets.s6H ??= {};
if (overrides.sets.s6H["s6h_085/070"]) throw Error("085 already has an override");
overrides.sets.s6H["s6h_085/070"] = owned;
meta.heldCards = meta.heldCards.filter(x=>String(x).toLowerCase()!=="s6h_085/070");
meta.unresolvedImageIssues = meta.unresolvedImageIssues.filter(x=>String(x.code).toLowerCase()!=="s6h_085/070");
if (JSON.stringify(meta.heldCards.map(x=>x.toLowerCase())) !== JSON.stringify(heldCodes) ||
    JSON.stringify(meta.unresolvedImageIssues.map(x=>x.code.toLowerCase())) !== JSON.stringify(heldCodes))
  throw Error("Remaining six Japanese-placeholder holds were altered");
meta.artworkReviewedCardCount = 89;
meta.reviewedCardCount = 89;
meta.verifiedKoreanPrintImageCount = 89;
meta.koreanPrintedImageConfirmed = 89;
meta.koreanPrintImageHoldCount = 6;
meta.reviewedRanges = ["001-030","031-060","061-083","084-087 (085 Korea confirmed)","094-095"];
meta.reviewedAt = date;
meta.newlyAddedThemeSlotCount = 143;
meta.partialReviewEvidence = proofPath;
meta.nextStart = "s6H Korean print source pending: 088-093";
meta.archiveVerificationStatus = "89_Korean_prints_verified_6_foreign_placeholders_6_image_quality_followups";
meta.note = "S6H 한국어 인쇄 카드 89/95장 실제 이미지 확인 및 12개 테마 검수. 085 한국어판 스페셜아트 소장형 WebP 보관; 084와 085 HR 표기 정정. 088-093 6장은 일본어판 임시 이미지로 계속 보류. 6장 저해상도 이미지 품질 추후 개선. S6K 글로벌 보류 4장, 기존 보유 코드 유지.";
meta.complete = false;
status.updatedAt = date;
themes.updatedAt = date;
full.visuallyReviewedKoreanPrintCount = 89;
full.foreignPrintImagePlaceholderCount = 6;
full.heldNumbers = full.heldNumbers.filter(x=>x.number!==85);
full.reasonForNoCompletion = "S6H 한국판 89장 확인, 088-093 일본어 이미지 6장 한국판 확인 보류";
full.nextSetArtworkVisualReview = meta.nextStart;
full.fullSeriesArtworkThemeClassificationComplete = false;
full.newKoreanRarePrintedImages ??= [];
full.newKoreanRarePrintedImages.push({
  number:85, code:review.code, theme:["color","season"], image:owned,
  source:review.sourceUrl, quality:"Kakao_search_photo_500px_Korean_print"
});
full.imageQualityFollowUps = [84,85,86,87,94,95];
hosting.batches ??= [];
hosting.batches.push({
  set:"s6H",range:"s6H Korean printed special art 085",
  canonicalCardCount:1,verifiedKoreanPrintImageCount:1,
  selfHostedReferenceCountAfter:1,archiveVerificationStatus:"085_owned_Korean_print_webp",
  KoreanPrintImagesConfirmed:89,KoreanPrintImagesPending:6,
  sourceProof:proofPath,nextStart:meta.nextStart,
  note:"Korean printed 085/070 visible; hosted own WebP; six Japanese prints held."
});
hosting.updatedAt = date;
if (JSON.stringify(set.cards.map(c=>c.code)) !== JSON.stringify(keys) ||
    JSON.stringify(Object.entries(status.reviews).find(([k])=>k.toLowerCase()==="s6k")?.[1]) !== s6kBefore ||
    status.execution.nextStart !== globalHold || hosting.nextStart !== globalHold)
  throw Error("Canonical card IDs or global checkpoint changed");
await Promise.all([
  save("data/series.json", modern),
  save("data/art-themes.json",themes),
  save("data/series-image-overrides.json",overrides),
  save("data/audits/theme-series-review-status.json",status),
  save("data/audits/theme-image-selfhost-audit.json",hosting),
  save(fullPath,full),
  save(progressPath,{
    schemaVersion:1,recordedAt:date,set:"s6H",totalCards:95,
    KoreanPrintedImagesVerified:89,artworkReviewed:89,
    reviewedKoreanCard:85,rarityCorrections:[84,85],
    colorAndSeasonThemesAdded:2,totalNewlyAddedThemeSlots:143,
    foreignLanguageImageHolds:6,heldKoreanPrintCodes:heldCodes,
    imageQualityFollowUps:[84,85,86,87,94,95],
    ownedImage:owned,sourceProof:proofPath,stagedProof:stagePath,
    nextStart:meta.nextStart,globalCheckpointPreserved:globalHold,
    complete:false
  })
]);
console.log(JSON.stringify({set:"s6H",KoreanVerified:89,total:95,held:remaining,
   newThemes:["color","season"],rarityCorrected:[84,85],
   owned:owned,nextStart:meta.nextStart,globalHold}));
