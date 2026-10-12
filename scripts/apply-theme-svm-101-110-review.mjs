import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = (p) => path.join(root, p);
const readJson = async (p) => JSON.parse(await readFile(file(p), "utf8"));
const writeJson = async (p, obj) => writeFile(file(p), JSON.stringify(obj, null, 2) + "\n");
const batchPath = "data/audits/theme-svm-101-110-art-review.json";
const [batch, series, themes, state, images] = await Promise.all([
  readJson(batchPath), readJson("data/series.json"), readJson("data/art-themes.json"),
  readJson("data/audits/theme-series-review-status.json"),
  readJson("data/audits/theme-image-selfhost-audit.json")
]);
const set = series.find((s) => String(s.code).toUpperCase() === "SVM");
const review = state?.reviews?.SVM;
if (!set || set.cards?.length !== 183 || !review || batch.cards?.length !== 10)
  throw new Error("Master SVM set, review record, or evidence count mismatch.");
if (batch.cards.some((c, i) => c.canonicalOrder !== i + 101 ||
    c.code !== "SVM_" + String(i + 101) || !c.artworkReviewed ||
    !c.all12ThemesChecked || c.sourceRegion !== "KR" || c.verifiedImageBinary !== false))
  throw new Error("Evidence sequence or verification flags invalid.");
const groups = new Map(themes.groups.map((g) => [String(g.code).toLowerCase(), g]));
const validThemes = new Set(["sleeping","connected","evolution","night","season",
  "color","sunset","reflections","food","street","work","cameo"]);
const keys = batch.cards.map((c) => c.code);
if (keys.some((k) => review.newlyAddedCards?.includes(k))) {
  if (keys.every((k) => review.newlyAddedCards?.includes(k)) &&
      review.reviewedCardCount >= 109) {
    console.log("SVM 101-110 already applied; leaving stable data unchanged.");
    process.exit(0);
  }
  throw new Error("Partial duplicate evidence checkpoint. Aborting.");
}
if (review.reviewedCardCount !== 99 ||
    !String(images.nextStart || "").includes("SVM canonical 101"))
  throw new Error("Expected SVM canonical 101 checkpoint not at HEAD; aborting.");
const themeCounts = {};
for (const c of batch.cards) {
  const master = set.cards[c.canonicalOrder - 1];
  const masterCode = String(master?.code || "").toLowerCase();
  if (masterCode !== c.canonicalMasterCode.toLowerCase() ||
      String(master?.name || "") !== c.koreanName ||
      c.koreanNumber !== String(c.canonicalOrder).padStart(3, "0") + "/175")
    throw new Error("Master mismatch: " + c.code + " got " + masterCode);
  const sourceImage = master.sourceImage || master.image;
  if (!sourceImage || typeof sourceImage !== "string")
    throw new Error("No existing catalog image: " + c.code);
  for (const themeCode of c.themesMatched) {
    if (!validThemes.has(themeCode) || !groups.has(themeCode))
      throw new Error("Invalid theme " + themeCode);
    const g = groups.get(themeCode);
    if (!Array.isArray(g.cards)) throw new Error("Broken theme group " + themeCode);
    if (g.cards.some((x) => String(x.code).toUpperCase() === c.code))
      throw new Error("Existing theme placement requires manual review: " + c.code + " / " + themeCode);
    g.cards.push({
      code: c.code, name: c.koreanName, series: "SV", set: "SVM",
      setName: batch.setName, cardNumber: c.koreanNumber, rarity: master.rarity || "",
      category: g.cards[0]?.category || g.name,
      evidence: "포켓몬코리아 한국판 공식 상세 " + c.evidenceUrl +
        " · 워터마크 카드 " + c.illustrationReferenceUrl +
        " 직접 시각 검수: " + c.illustrationSourceNote +
        " 12개 테마 확인. 기존 이미지 출처 유지, 새 바이너리 저장·배포 미검증.",
      image: sourceImage
    });
    themeCounts[themeCode] = (themeCounts[themeCode] || 0) + 1;
  }
}
const expected = batch.themeAdditions || {};
for (const themeCode of new Set([...Object.keys(expected), ...Object.keys(themeCounts)]))
  if ((expected[themeCode] || 0) !== (themeCounts[themeCode] || 0))
    throw new Error("Theme count mismatch: " + themeCode);
const totalAdded = Object.values(themeCounts).reduce((a, b) => a + b, 0);
review.reviewedCardCount += 10;
review.newlyAddedThemeSlotCount = (Number(review.newlyAddedThemeSlotCount) || 0) + totalAdded;
review.newlyAddedCards.push(...keys);
review.reviewedAt = batch.recordedAt;
review.note = "SVM canonical 001-110, 109 Korean official artworks verified; 079 evidence held, 111-183 unreviewed. Image binaries/deployment not verified.";
for (const [key, val] of Object.entries(review)) {
  if (!Array.isArray(val)) continue;
  if (val.some((item) => typeof item === "string" && item.includes("canonical 091-100"))) {
    val.push("canonical 101-110 (10 official Korean card illustrations checked)");
  }
  if (val.some((item) => item && typeof item === "object" &&
        item.range === "canonical-order 091-100")) {
    val.push({
      range: "canonical-order 101-110",
      status: "complete_10_official_Korean_artworks_verified",
      checkedCardCount: 10, heldCardCount: 0, artworkAudit: batchPath,
      themeAdditions: themeCounts,
      imageAudit: {
        catalogImageReferenceCount: 10, selfHostedImageReferenceCountAfter: 0,
        externalImageReferenceCountAfter: 10, newlyInternalizedReferenceCount: 0,
        archiveVerificationStatus: "pending", unverifiedImageCount: 10,
        brokenReferenceCount: null
      },
      cards: batch.cards
    });
  }
}
const updateProgress = (node) => {
  if (!node || typeof node !== "object") return;
  if (typeof node.lastSafeCheckpoint === "string" &&
      node.lastSafeCheckpoint.includes("SVM")) {
    node.currentTaskScope = "SVM 109/183 Korean official artworks visually verified (079 held)";
    node.lastSafeCheckpoint = "SVM 001-110: 109 Korean artwork reviews complete, SVM 079 evidence held. SVLS 6 additional holds remain; new archive verification pending.";
    node.nextStart = "SVM canonical 111 (SVM 079 and SVLS six holds)";
    return true;
  }
  for (const child of Object.values(node))
    if (!Array.isArray(child) && updateProgress(child)) return true;
  return false;
};
if (!updateProgress(state)) throw new Error("Cannot locate safe resume checkpoint object.");
if (!state.lastEvidenceAuditCheckpoint || state.lastEvidenceAuditCheckpoint.set !== "SVM")
  throw new Error("Unrecognized evidence checkpoint structure.");
Object.assign(state.lastEvidenceAuditCheckpoint, {
  range: "canonical 101-110", reviewedCardCount: 10, artworkEvidenceHolds: 0,
  archiveVerificationStatus: "pending"
});
if (!Array.isArray(images.batches)) throw new Error("Missing image audit batch list.");
images.batches.push({
  task: 6, set: "SVM", range: "canonical-order 101-110 Korean artwork review",
  canonicalCardCount: 10, artworkVisuallyVerifiedCount: 10, artworkPendingCount: 0,
  externalImageReferenceCountBefore: 10, newlyInternalizedReferenceCount: 0,
  selfHostedReferenceCountAfter: 0, externalImageReferenceCountAfter: 10,
  archiveVerificationStatus: "pending", verifiedImageCount: 0, unverifiedImageCount: 10,
  brokenReferenceCount: null, themeAdditions: themeCounts,
  nextStart: "SVM canonical 111",
  note: "Official Korean artwork reviewed. Existing catalog image URL retained; new binary self-hosting and deployed CDN verification not performed."
});
images.nextStart = "SVM canonical 111";
await Promise.all([
  writeJson("data/art-themes.json", themes),
  writeJson("data/audits/theme-series-review-status.json", state),
  writeJson("data/audits/theme-image-selfhost-audit.json", images)
]);
console.log("Applied SVM 101-110: 10 artwork checks, " + totalAdded + " theme placements, next SVM 111.");
