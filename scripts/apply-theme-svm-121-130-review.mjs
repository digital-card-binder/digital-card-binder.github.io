import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = (p) => path.join(root, p);
const readJson = async (p) => JSON.parse(await readFile(file(p), "utf8"));
const writeJson = async (p, obj) => writeFile(file(p), JSON.stringify(obj, null, 2) + "\n");

const evidencePath = "data/audits/theme-svm-121-130-art-review.json";
const [batch, series, themes, state, images] = await Promise.all([
  readJson(evidencePath),
  readJson("data/series.json"),
  readJson("data/art-themes.json"),
  readJson("data/audits/theme-series-review-status.json"),
  readJson("data/audits/theme-image-selfhost-audit.json")
]);

const master = series.find((set) => String(set.code).toUpperCase() === "SVM");
const review = state?.reviews?.SVM;
const verifiedNumbers = [121, 124, 125];
const heldNumbers = [122, 123, 126, 127, 128, 129, 130];
const validThemes = new Set([
  "sleeping", "connected", "evolution", "night", "season", "color", "sunset",
  "reflections", "food", "street", "work", "cameo"
]);
const grouped = new Map((themes.groups || []).map((group) => [group.code, group]));

if (!master || master.cards?.length !== 183 || !review ||
    batch?.masterCanonicalCount !== 183 || batch?.cards?.length !== 3 ||
    batch?.heldCards?.length !== 7 || batch?.inspectedArtworkCount !== 3 ||
    batch?.artworkEvidencePendingCount !== 7 ||
    batch?.nextStart !== "SVM canonical 131") {
  throw new Error("SVM master, evidence count or checkpoint mismatch");
}
const cardNumbers = batch.cards.map((card) => card.canonicalOrder);
const holdNumbers = batch.heldCards.map((card) => card.canonicalOrder);
if (cardNumbers.join(",") !== verifiedNumbers.join(",") ||
    holdNumbers.join(",") !== heldNumbers.join(",") ||
    new Set([...cardNumbers, ...holdNumbers]).size !== 10)
  throw new Error("Verified/held card partitions are not exact");

const codes = batch.cards.map((card) => card.code);
const heldCodes = batch.heldCards.map((card) => card.code);
if (codes.some((code) => review.newlyAddedCards.includes(code))) {
  if (codes.every((code) => review.newlyAddedCards.includes(code)) &&
      heldCodes.every((code) => review.heldCards.includes(code)) &&
      review.reviewedCardCount >= 122) {
    console.log("Already applied SVM 121-130 with holds; no duplicate changes.");
    process.exit(0);
  }
  throw new Error("Partial SVM 121-130 update detected; refusing to overwrite.");
}
if (review.reviewedCardCount !== 119 || images.nextStart !== "SVM canonical 121")
  throw new Error("Main branch checkpoint changed, expected 119 verified / SVM 121.");
if (batch.heldCards.some((held) =>
    held.artworkReviewed !== false || held.evidenceStatus !== "held_official_image_not_accessible" ||
    review.newlyAddedCards.includes(held.code)))
  throw new Error("Held evidence incorrectly marked as inspected.");

const additions = {};
for (const card of batch.cards) {
  const source = master.cards[card.canonicalOrder - 1];
  if (!source || String(source.code).toLowerCase() !== card.canonicalMasterCode ||
      String(source.name) !== card.koreanName || card.code !== "SVM_" + card.canonicalOrder ||
      card.koreanNumber !== card.canonicalOrder + "/175" ||
      !card.artworkReviewed || !card.all12ThemesChecked || card.sourceRegion !== "KR" ||
      card.verifiedImageBinary !== false ||
      card.noApplicableTheme !== (card.themesMatched.length === 0))
    throw new Error("Korean canonical card validation failed: " + card.code);
  const sourceImage = source.sourceImage || source.image;
  if (typeof sourceImage !== "string" || !sourceImage.startsWith("https://"))
    throw new Error("Missing original catalog image reference for " + card.code);

  if (new Set(card.themesMatched).size !== card.themesMatched.length)
    throw new Error("Duplicate themes on " + card.code);
  for (const theme of card.themesMatched) {
    if (!validThemes.has(theme) || !grouped.has(theme))
      throw new Error("Unknown theme on " + card.code + ": " + theme);
    const group = grouped.get(theme);
    if (group.cards.some((entry) => String(entry.code).toUpperCase() === card.code))
      throw new Error("Pre-existing placement must not be duplicated: " + theme + "/" + card.code);
    group.cards.push({
      code: card.code, name: card.koreanName, series: "SV", set: "SVM",
      setName: batch.setName, cardNumber: card.koreanNumber, rarity: source.rarity || "",
      category: group.cards[0]?.category || group.name,
      evidence: "포켓몬코리아 공식 한국판 상세 " + card.evidenceUrl +
        " 및 카드 이미지 " + card.illustrationReferenceUrl + " 직접 시각 확인: " +
        card.illustrationSourceNote + " 나머지 검수 구간의 접근 불가 이미지는 별도 보류. " +
        "신규 이미지 파일 저장·배포 미검증.",
      image: sourceImage
    });
    additions[theme] = (additions[theme] || 0) + 1;
  }
}
for (const theme of new Set([...Object.keys(additions), ...Object.keys(batch.themeAdditions)]))
  if ((additions[theme] || 0) !== (batch.themeAdditions[theme] || 0))
    throw new Error("Theme additions mismatch for " + theme);

review.reviewedCardCount += batch.inspectedArtworkCount;
review.newlyAddedThemeSlotCount += Object.values(additions).reduce((s, count) => s + count, 0);
review.newlyAddedCards.push(...codes);
review.heldCards.push(...heldCodes.filter((code) => !review.heldCards.includes(code)));
review.reviewedAt = batch.recordedAt;
review.note = "SVM canonical 001-130: 122 Korean images inspected, 079 and 122,123,126-130 evidence-held; 131-183 unreviewed. Archive verification pending.";

for (const value of Object.values(review)) {
  if (!Array.isArray(value)) continue;
  if (value.some((x) => typeof x === "string" && x.includes("canonical 111-120")))
    value.push("canonical 121-130 (3 Korean originals reviewed, 7 image evidence holds)");
  if (value.some((x) => x && typeof x === "object" &&
      x.range === "canonical-order 111-120")) {
    value.push({
      range: "canonical-order 121-130",
      status: "partial_3_official_Korean_artworks_verified_7_evidence_held",
      checkedCardCount: 3,
      heldCardCount: 7,
      artworkAudit: evidencePath,
      themeAdditions: additions,
      imageAudit: {
        catalogImageReferenceCount: 10, selfHostedImageReferenceCountAfter: 0,
        externalImageReferenceCountAfter: 10, newlyInternalizedReferenceCount: 0,
        archiveVerificationStatus: "pending", unverifiedImageCount: 10,
        brokenReferenceCount: null
      },
      cards: batch.cards,
      heldCards: batch.heldCards
    });
  }
}
const updateProgress = (node) => {
  if (!node || typeof node !== "object") return false;
  if (typeof node.lastSafeCheckpoint === "string" &&
      node.lastSafeCheckpoint.includes("SVM")) {
    node.currentTaskScope = "SVM 122/183 Korean originals verified, 8 SVM evidence holds";
    node.lastSafeCheckpoint = "SVM 001-130: 122 artwork reviews complete, SVM 079 plus 122,123,126-130 evidence-held; SVLS six holds remain. Archive verification pending.";
    node.nextStart = "SVM canonical 131 (8 SVM artwork evidence holds, 6 SVLS holds)";
    return true;
  }
  for (const x of Object.values(node))
    if (!Array.isArray(x) && updateProgress(x)) return true;
  return false;
};
if (!updateProgress(state)) throw new Error("Cannot find existing SVM progress checkpoint.");
if (state?.lastEvidenceAuditCheckpoint?.set !== "SVM")
  throw new Error("Unexpected most recent evidence audit set.");
Object.assign(state.lastEvidenceAuditCheckpoint, {
  range: "canonical 121-130", reviewedCardCount: 3,
  artworkEvidenceHolds: 7, archiveVerificationStatus: "pending"
});
if (!Array.isArray(images.batches)) throw new Error("Missing image audit batches.");
images.batches.push({
  task: 6, set: "SVM", range: "canonical-order 121-130 Korean artwork review",
  canonicalCardCount: 10, artworkVisuallyVerifiedCount: 3, artworkPendingCount: 7,
  externalImageReferenceCountBefore: 10, newlyInternalizedReferenceCount: 0,
  selfHostedReferenceCountAfter: 0, externalImageReferenceCountAfter: 10,
  archiveVerificationStatus: "pending", verifiedImageCount: 0,
  unverifiedImageCount: 10, brokenReferenceCount: null,
  themeAdditions: additions, nextStart: "SVM canonical 131",
  note: "Three Korean card artworks inspected; seven unverified visuals held. Existing image URLs preserved. Binary self-host and deployment unverified."
});
images.nextStart = "SVM canonical 131";
await Promise.all([
  writeJson("data/art-themes.json", themes),
  writeJson("data/audits/theme-series-review-status.json", state),
  writeJson("data/audits/theme-image-selfhost-audit.json", images)
]);
console.log("SVM 121-130: 3 verified, 7 held, " +
  Object.values(additions).reduce((s, x) => s + x, 0) + " theme placements; resume SVM 131.");
