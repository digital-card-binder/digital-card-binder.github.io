import { readFile, writeFile } from "node:fs/promises";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const save = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");
const CODE = "s6K", DATE = "2026-10-15", TOTAL = 95, REVIEWED = 30;
const NEXT = "s6K canonical 031", START = "s6K canonical 001";
const GROUPS = ["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review, proof, modern, legacy, themes, status, hosting, overrides] = await Promise.all([
  read("data/audits/theme-s6K-001-030-Korean-art-review-20261015.json"),
  read("data/audits/theme-visual-evidence/s6K/001-030/visual-index.json"),
  read("data/series.json"), read("data/series-legacy.json"),
  read("data/art-themes.json"), read("data/audits/theme-series-review-status.json"),
  read("data/audits/theme-image-selfhost-audit.json"), read("data/series-image-overrides.json")
]);
const sets = [...modern, ...legacy].filter(s => String(s.code || "").toLowerCase() === CODE.toLowerCase());
if (sets.length !== 1 || sets[0].cards?.length !== TOTAL) throw Error("Expected one canonical Korean s6K 95-card set");
const set = sets[0], cardIds = set.cards.map(c => c.code);
status.reviews ??= {};
const reviewKey = Object.keys(status.reviews).find(k => k.toLowerCase() === CODE.toLowerCase()) || set.code;
const prior = status.reviews[reviewKey] || {};
if (prior.artworkReviewedCardCount >= REVIEWED && prior.reviewedRanges?.some(s => s.startsWith("001-030"))) {
  console.log("s6K 001-030 already applied; idempotent exit");
  process.exit(0);
}
if (status.execution?.nextStart !== START || hosting.nextStart !== START ||
    String(status.execution?.currentSet || "").toLowerCase() !== CODE.toLowerCase() ||
    (prior.reviewedCardCount || 0) !== 0)
  throw Error("Checkpoint moved or 001-030 already partially reviewed; no mutation");
if (review.set !== CODE || review.range !== "001-030" ||
    review.all12ThemesInspected !== true || review.items?.length !== REVIEWED ||
    JSON.stringify(review.reviewedThemes) !== JSON.stringify(GROUPS) ||
    review.sourceImagesRequested !== 0 || review.koreanPrintExceptionNumbers?.length !== 0 ||
    proof.set !== CODE.toLowerCase() || proof.checkpointAtStart !== START ||
    proof.masterSetCardCount !== TOTAL || proof.canonicalCardsChecked !== REVIEWED ||
    proof.verifiedOwnedCdnImageCount !== REVIEWED || proof.unavailableOwnedCdnImageCount !== 0 ||
    proof.printedNumberMatchCount !== REVIEWED || proof.koreanNameNonemptyCount !== REVIEWED ||
    proof.sourceRequestCount !== 0 || proof.cards?.length !== REVIEWED)
  throw Error("Incomplete canonical Korean 30-card image/visual theme proof");
const groupMap = new Map((themes.groups || []).map(g => [g.code,g]));
for (const t of GROUPS) if (!Array.isArray(groupMap.get(t)?.cards)) throw Error("Missing independent theme " + t);
const counts = {};
overrides.sets ??= {};
overrides.sets[set.code] ??= {};
for (let i = 0; i < REVIEWED; i++) {
  const id = String(i+1).padStart(3,"0"), key = "S6K_" + id, expected = "s6k_" + id + "/070";
  const master = set.cards[i], row = review.items[i], image = proof.cards[i];
  if (!master || !row || !image || row.canonicalOrder !== i+1 || image.canonicalOrder !== i+1 ||
      row.cardKey !== key || String(master.code || "").toLowerCase() !== expected ||
      String(image.masterCode || "").toLowerCase() !== expected ||
      image.expectedPrintedNumber !== id + "/070" || !image.printedNumberMatches ||
      row.name !== master.name || image.name !== master.name || !row.artObservation?.trim() ||
      image.rawSource !== (master.sourceImage || master.image) ||
      !image.rawSource.startsWith("https://cards.image.pokemonkorea.co.kr/") ||
      !image.ownedCdnUrl.startsWith("https://dcb-card-images-modern-2026.pages.dev/") ||
      image.imageCheck?.status !== "decoded" || image.imageCheck.http !== 200 ||
      image.imageCheck.format !== "WEBP" || image.imageCheck.dimensions?.[0] < 200 ||
      image.imageCheck.dimensions?.[1] < 250 || image.priorThemes?.length)
    throw Error("Unsafe Korean print identity, CDN binary, or manual art evidence at " + id);
  const selected = new Set(row.matchedThemes);
  if (selected.size !== row.matchedThemes?.length || !selected.has("color") ||
      [...selected].some(t => !GROUPS.includes(t) || !row.categories?.[t]?.trim()) ||
      Object.keys(row.categories || {}).some(t => !selected.has(t)))
    throw Error("Missing visual theme classification at " + id);
  for (const t of GROUPS) {
    const group = groupMap.get(t);
    if (group.cards.some(c => String(c.code || "").toUpperCase() === key))
      throw Error("Unexpected pre-existing s6K independent theme slot at " + id + " " + t);
    if (!selected.has(t)) continue;
    group.cards.push({
      code:key, name:master.name, series:"S", set:set.code,
      setName:set.displayName || "칠흑의 가이스트",
      cardNumber:id + "/070", rarity:master.rarity || "",
      category:row.categories[t], image:image.ownedCdnUrl,
      evidence:"한국판 칠흑의 가이스트 s6K " + id + "/070 12테마 시각 검수: " + row.artObservation
    });
    counts[t] = (counts[t] || 0) + 1;
  }
  if (!master.sourceImage) master.sourceImage = image.rawSource;
  master.image = image.ownedCdnUrl;
  master.koreanPrintImageVerified = true;
  delete master.koreanPrintImagePending;
  overrides.sets[set.code][String(master.code).toLowerCase()] = image.ownedCdnUrl;
}
if (JSON.stringify(cardIds) !== JSON.stringify(set.cards.map(x => x.code)) ||
    GROUPS.some(t => (counts[t] || 0) !== (review.themeCounts?.[t] || 0)))
  throw Error("Canonical identifiers or manual visual classification totals changed");
status.reviews[reviewKey] = { ...prior, status:"in_progress", reviewedAt:DATE,
  artworkReviewedCardCount:REVIEWED, reviewedCardCount:REVIEWED,
  verifiedKoreanPrintImageCount:REVIEWED, verifiedSelfHostedImageCount:REVIEWED,
  reviewedRanges:["001-030"], reviewedThemes:GROUPS,
  newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount || 0) + Object.values(counts).reduce((a,b) => a+b,0),
  heldCards:[], unresolvedImageIssues:[],
  partialReviewEvidence:"data/audits/theme-s6K-001-030-Korean-art-review-20261015.json",
  archiveVerificationStatus:"30_official_Korean_prints_owned_and_12_themes_reviewed_partial_95",
  nextStart:NEXT,
  note:"한국어 인쇄 공식 원본과 자체 CDN 사본 001-030 시각 검수. 모든 12개 독립 테마 평가. 031-095 미검수, 완료 처리 금지."
};
status.execution.currentEra = "S";
status.execution.currentSet = set.code;
status.execution.lastSafeCheckpoint = "s6K canonical 001-030 official Korean prints and visual themes reviewed; 031-095 pending";
status.execution.nextStart = NEXT;
status.execution.updatedAt = DATE;
status.updatedAt = DATE;
hosting.batches ??= [];
hosting.batches.push({
  task:10, set:set.code, range:"canonical 001-030 Korean Chilling Reign",
  canonicalCardCount:REVIEWED, artworkVisuallyVerifiedCount:REVIEWED,
  artworkPendingCount:TOTAL-REVIEWED, selfHostedReferenceCountAfter:REVIEWED,
  externalImageReferenceCountAfter:0, verifiedImageCount:REVIEWED,
  unverifiedImageCount:0, brokenReferenceCount:0, koreanPrintImagesConfirmed:REVIEWED,
  koreanPrintImagesPending:TOTAL-REVIEWED, themeAdditions:counts,
  nextStart:NEXT, note:"Verified 30 owned images and Korean printed artworks; 65 untouched cards remain."
});
hosting.nextStart = NEXT;
hosting.updatedAt = DATE;
themes.updatedAt = DATE;
await Promise.all([
  save("data/series.json",modern), save("data/series-legacy.json",legacy),
  save("data/art-themes.json",themes), save("data/series-image-overrides.json",overrides),
  save("data/audits/theme-series-review-status.json",status),
  save("data/audits/theme-image-selfhost-audit.json",hosting),
  save("data/audits/theme-s6K-001-030-progress-20261015.json",{
    schemaVersion:1, recordedAt:DATE, set:set.code, status:"in_progress",
    totalMasterCards:TOTAL, artworkReviewed:REVIEWED, verifiedKoreanPrintImages:REVIEWED,
    ownedImagesVerified:REVIEWED, all12ThemesReviewedForRange:true,
    remainingUnreviewedKoreanPrints:TOTAL-REVIEWED, complete:false,
    themeCounts:counts, nextStart:NEXT,
    proof:"data/audits/theme-visual-evidence/s6K/001-030/visual-index.json",
    manualReview:"data/audits/theme-s6K-001-030-Korean-art-review-20261015.json"
  })
]);
console.log(JSON.stringify({set:CODE,reviewed:REVIEWED,total:TOTAL,counts,next:NEXT}));
