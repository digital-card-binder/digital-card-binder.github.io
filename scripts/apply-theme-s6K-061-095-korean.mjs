import { readFile, writeFile } from "node:fs/promises";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const save = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");
const CODE = "s6K", DATE = "2026-10-15", TOTAL = 95, REVIEWED = 35, OFFSET = 60, CHECKED = 95;
const NEXT = "s6K Korean print source pending: 084-095", START = "s6K canonical 061";
const HELD = Array.from({length:12},(_,i)=>84+i);
const GROUPS = ["sleeping","connected","evolution","night","season","color","sunset","reflections","food","street","work","cameo"];
const [review, proof, modern, legacy, themes, status, hosting, overrides] = await Promise.all([
  read("data/audits/theme-s6K-061-095-Korean-art-review-20261015.json"),
  read("data/audits/theme-visual-evidence/s6K/061-095/visual-index.json"),
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
if (prior.artworkReviewedCardCount >= CHECKED && prior.reviewedRanges?.some(s => s.startsWith("061-095"))) {
  console.log("s6K 061-095 artwork already applied; awaiting twelve Korean print photos");
  process.exit(0);
}
if (status.execution?.nextStart !== START || hosting.nextStart !== START ||
    String(status.execution?.currentSet || "").toLowerCase() !== CODE.toLowerCase() ||
    (prior.reviewedCardCount || 0) !== OFFSET ||
    prior.artworkReviewedCardCount !== OFFSET ||
    !prior.reviewedRanges?.some(s => s.startsWith("001-030")) ||
    !prior.reviewedRanges?.some(s => s.startsWith("031-060")) ||
    !prior.reviewedThemes || JSON.stringify(prior.reviewedThemes) !== JSON.stringify(GROUPS))
  throw Error("Checkpoint moved or existing 001-060 review is incomplete; no mutation");
if (review.set !== CODE || review.range !== "061-095" ||
    review.all12ThemesInspected !== true || review.items?.length !== REVIEWED ||
    JSON.stringify(review.reviewedThemes) !== JSON.stringify(GROUPS) ||
    review.sourceImagesRequested !== 0 ||
    JSON.stringify(review.koreanPrintExceptionNumbers) !== JSON.stringify(HELD) ||
    review.verifiedKoreanPrintImageCount !== 23 || review.unverifiedForeignPrintImageCount !== 12 ||
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
  const n = OFFSET + i + 1;
  const id = String(n).padStart(3,"0"), key = "S6K_" + id, expected = "s6k_" + id + "/070";
  const master = set.cards[OFFSET+i], row = review.items[i], image = proof.cards[i];
  if (!master || !row || !image || row.canonicalOrder !== n || image.canonicalOrder !== n ||
      row.cardKey !== key || String(master.code || "").toLowerCase() !== expected ||
      String(image.masterCode || "").toLowerCase() !== expected ||
      image.expectedPrintedNumber !== id + "/070" || !image.printedNumberMatches ||
      row.name !== master.name || image.name !== master.name || !row.artObservation?.trim() ||
      image.rawSource !== (master.sourceImage || master.image) ||
      (HELD.includes(n)
        ? (!image.rawSource.startsWith("https://static.tcgexchange.kr/") ||
           !image.ownedCdnUrl.startsWith("https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/"))
        : (!image.rawSource.startsWith("https://cards.image.pokemonkorea.co.kr/") ||
           !image.ownedCdnUrl.startsWith("https://dcb-card-images-modern-2026.pages.dev/"))) ||
      image.imageCheck?.status !== "decoded" || image.imageCheck.http !== 200 ||
      image.imageCheck.format !== "WEBP" || image.imageCheck.dimensions?.[0] < 200 ||
      image.imageCheck.dimensions?.[1] < 250 || image.priorThemes?.length)
    throw Error("Unsafe canonical card identity, CDN binary, or manual art evidence at " + id);
  const foreign = HELD.includes(n);
  if (row.koreanPrintImageVerified === foreign || row.printLanguage !== (foreign ? "Japanese_placeholder" : "Korean"))
    throw Error("Foreign print must remain held, never recorded as Korean: " + id);
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
      evidence:"한국판 칠흑의 가이스트 s6K " + id + "/070 12테마 시각 검수: " + row.artObservation +
      (foreign ? " (일본어 인쇄 임시 이미지: 한국판 인쇄 실물사진 확보 전 완료 처리 금지)" : "")
    });
    counts[t] = (counts[t] || 0) + 1;
  }
  if (!master.sourceImage) master.sourceImage = image.rawSource;
  master.image = image.ownedCdnUrl;
  if (foreign) {
    master.koreanPrintImagePending = true;
    delete master.koreanPrintImageVerified;
  } else {
    master.koreanPrintImageVerified = true;
    delete master.koreanPrintImagePending;
  }
  overrides.sets[set.code][String(master.code).toLowerCase()] = image.ownedCdnUrl;
}
if (JSON.stringify(cardIds) !== JSON.stringify(set.cards.map(x => x.code)) ||
    GROUPS.some(t => (counts[t] || 0) !== (review.themeCounts?.[t] || 0)))
  throw Error("Canonical identifiers or manual visual classification totals changed");
status.reviews[reviewKey] = { ...prior, status:"in_progress", reviewedAt:DATE,
  artworkReviewedCardCount:CHECKED, reviewedCardCount:CHECKED-HELD.length,
  verifiedKoreanPrintImageCount:CHECKED-HELD.length, verifiedSelfHostedImageCount:CHECKED,
  reviewedRanges:["001-030","031-060","061-095 (art complete; Korean 084-095 pending)"], reviewedThemes:GROUPS,
  newlyAddedThemeSlotCount:(prior.newlyAddedThemeSlotCount || 0) + Object.values(counts).reduce((a,b) => a+b,0),
  heldCards:HELD.map(n=>"s6k_"+String(n).padStart(3,"0")+"/070"),
  unresolvedImageIssues:HELD.map(n=>({code:"s6k_"+String(n).padStart(3,"0")+"/070",issue:"Japanese printed placeholder; Korean printed artwork required"})),
  partialReviewEvidence:"data/audits/theme-s6K-061-095-Korean-art-review-20261015.json",
  archiveVerificationStatus:"95_artworks_83_Korean_prints_12_Japanese_placeholders",
  nextStart:NEXT,
  note:"95장 일러스트 12테마 검수 완료. 84~95번은 자체 CDN 웹프 이미지에 일본어 제목과 카드 설명 인쇄, 한국판 실물 이미지 확보 전 검수 완료 금지. 83개 한국어판 확인."
};
status.execution.currentEra = "S";
status.execution.currentSet = set.code;
status.execution.lastSafeCheckpoint = "s6K canonical 001-095 artwork checked, Korean prints 83/95; 084-095 Japanese-print placeholders held";
status.execution.nextStart = NEXT;
status.execution.updatedAt = DATE;
status.updatedAt = DATE;
hosting.batches ??= [];
hosting.batches.push({
  task:12, set:set.code, range:"canonical 061-095 Korean Chilling Reign artworks",
  canonicalCardCount:REVIEWED, artworkVisuallyVerifiedCount:REVIEWED,
  artworkPendingCount:0, selfHostedReferenceCountAfter:REVIEWED,
  externalImageReferenceCountAfter:0, verifiedImageCount:REVIEWED,
  unverifiedImageCount:0, brokenReferenceCount:0, koreanPrintImagesConfirmed:REVIEWED-HELD.length,
  koreanPrintImagesPending:HELD.length, themeAdditions:counts,
  nextStart:NEXT, note:"35 owned artworks checked; Korean images verified 23/35, twelve Japanese language prints held 084-095."
});
hosting.nextStart = NEXT;
hosting.updatedAt = DATE;
themes.updatedAt = DATE;
await Promise.all([
  save("data/series.json",modern), save("data/series-legacy.json",legacy),
  save("data/art-themes.json",themes), save("data/series-image-overrides.json",overrides),
  save("data/audits/theme-series-review-status.json",status),
  save("data/audits/theme-image-selfhost-audit.json",hosting),
  save("data/audits/theme-s6K-061-095-progress-20261015.json",{
    schemaVersion:1, recordedAt:DATE, set:set.code, status:"in_progress",
    totalMasterCards:TOTAL, artworkReviewed:CHECKED, verifiedKoreanPrintImages:CHECKED-HELD.length,
    ownedImagesVerified:CHECKED, all12ThemesReviewedForRange:true,
    remainingUnreviewedKoreanPrints:HELD.length, pendingKoreanImages:HELD.map(n=>"s6k_"+String(n).padStart(3,"0")+"/070"),
    all12ThemesReviewed:true, complete:false,
    themeCounts:counts, nextStart:NEXT,
    proof:"data/audits/theme-visual-evidence/s6K/061-095/visual-index.json",
    manualReview:"data/audits/theme-s6K-061-095-Korean-art-review-20261015.json"
  })
]);
console.log(JSON.stringify({set:CODE,artworks:CHECKED,koreanPrints:CHECKED-HELD.length,total:TOTAL,held:HELD,counts,next:NEXT}));
