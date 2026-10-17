import { readFile, writeFile } from "node:fs/promises";

const read = async p => JSON.parse(await readFile(p, "utf8"));
const save = async (p, x) => writeFile(p, JSON.stringify(x, null, 2) + "\n", "utf8");
const CODE = "s2a";
const DATE = "2026-10-17";
const GLOBAL = "s6K Korean print source pending: 089,090,092,094";
const REVIEW = "data/audits/theme-s2a-031-060-Korean-art-review-20261017.json";
const PROOF = "data/audits/theme-visual-evidence/s2a/031-060/visual-index.json";
const PREVIOUS = "data/audits/theme-s2a-001-030-progress-20261017.json";
const PROGRESS = "data/audits/theme-s2a-031-060-progress-20261017.json";
const NEXT = "S2a 한국판 061-086 자체호스팅 이미지 및 12테마 육안검수";
const THEMES = ["sleeping","connected","evolution","night","season","color",
                "sunset","reflections","food","street","work","cameo"];

const [review,proof,previous,modern,legacy,themes,status,hosting,coverage,s2held,s3held] =
  await Promise.all([
    read(REVIEW),read(PROOF),read(PREVIOUS),read("data/series.json"),
    read("data/series-legacy.json"),read("data/art-themes.json"),
    read("data/audits/theme-series-review-status.json"),
    read("data/audits/theme-image-selfhost-audit.json"),
    read("data/audits/theme-series-coverage.json"),
    read("data/audits/theme-s2-091-115-approved16-held9-progress-20261017.json"),
    read("data/audits/theme-s3-091-119-approved20-held9-progress-20261017.json")
  ]);

const sets = [...modern,...legacy].filter(x => String(x.code || "").toLowerCase() === CODE);
if (sets.length !== 1 || sets[0].cards?.length !== 86)
  throw Error("S2a canonical 86-card set unexpectedly changed");
const set = sets[0], masterSnapshot = JSON.stringify(set.cards);
const meta = status.reviews?.[CODE];
if (!meta) throw Error("S2a 001-030 checkpoint missing");
if (meta.artworkReviewedCardCount === 60 &&
    meta.newlyAddedThemeSlotCount === 92 &&
    meta.reviewedRanges?.includes("031-060")) {
  console.log("S2a 031-060 already reviewed: safe no-op");
  process.exit(0);
}
if (meta.artworkReviewedCardCount !== 30 ||
    meta.reviewedCardCount !== 30 ||
    meta.newlyAddedThemeSlotCount !== 46 ||
    meta.preservedExistingThemeSlotCount !== 3 ||
    JSON.stringify(meta.reviewedRanges) !== JSON.stringify(["001-030"]) ||
    meta.status !== "in_progress" || meta.complete !== false ||
    previous.KoreanPrintArtworksReviewed !== 30 ||
    previous.newlyAddedThemeSlotsCumulative !== 46 ||
    previous.remainingImageAndArtworkCount !== 56 ||
    previous.globalCheckpointPreserved !== GLOBAL ||
    status.execution?.nextStart !== GLOBAL ||
    hosting.nextStart !== GLOBAL ||
    coverage.sets.find(x => String(x.code || "").toLowerCase() === CODE)?.status !== "in_progress" ||
    s2held.KoreanPrintArtworksReviewed !== 106 || s2held.heldNonKoreanSourceCount !== 9 ||
    s3held.KoreanPrintArtworksReviewed !== 110 || s3held.heldNonKoreanSourceCount !== 9)
  throw Error("Prior Korean artwork checkpoints or held-source safeguards changed");

if (review.schemaVersion !== 1 || review.set !== CODE ||
    review.range !== "031-060" || review.status !== "manual_Korean_art_12_theme_reviewed" ||
    review.artworksReviewed !== 30 || review.verifiedKoreanPrintImagesInRange !== 30 ||
    review.ownedCDNImagesDecoded !== 30 || review.officialSourceCardsInRange !== 30 ||
    review.existingThemesInThisRange !== 3 ||
    !review.preExistingThemesOutsideRangeProtected || review.themeAdditions !== 46 ||
    review.rarityVerification !== "not_in_scope_canonical_rarity_blank" ||
    !review.noMasterOrOwnershipChanges || !review.all12ThemesInspected ||
    review.imagePreflight !== PROOF || review.globalCheckpointPreserved !== GLOBAL ||
    JSON.stringify(review.reviewedThemes) !== JSON.stringify(THEMES) ||
    review.items?.length !== 30 ||
    proof.set !== CODE || proof.range !== "031-060" ||
    proof.masterCanonicalCards !== 86 || proof.checkedCardCount !== 30 ||
    proof.ownedImageDecodedCount !== 30 || proof.ownedImageMissingCount !== 0 ||
    proof.preExistingThemeMemberships !== 3 ||
    proof.cards?.length !== 30 || proof.globalCheckpointPreserved !== GLOBAL)
  throw Error("S2a second-30 Korean artwork evidence incomplete");

const groups = new Map(themes.groups.map(g => [g.code,g]));
if (groups.size !== 12 || THEMES.some(t => !groups.has(t)))
  throw Error("Expected 12 independent theme groups");
const old = themes.groups.flatMap(g => g.cards.filter(c =>
  String(c.set || "").toLowerCase() === CODE ||
  String(c.code || "").toLowerCase().startsWith(CODE + "_")));
const oldSnapshot = old.map(x => JSON.stringify(x));
if (old.length !== 49) throw Error("Original 46 new + 3 legacy S2a memberships changed");
const oldInRange = old.filter(c => {
  const n = Number(String(c.code || "").split("_")[1]?.split("/")[0]);
  return n >= 31 && n <= 60;
});
if (oldInRange.length !== 3)
  throw Error("Expected three pre-existing S2a theme memberships in 031-060");

const tally = Object.fromEntries(THEMES.map(t => [t,0]));
const additions = [];
for (let i = 0; i < 30; i++) {
  const n = i + 31, num = String(n).padStart(3,"0"), key = "S2a_" + num;
  const card = set.cards[n-1], p = proof.cards[i], r = review.items[i];
  const expectedSource = "https://cards.image.pokemonkorea.co.kr/data/wmimages/S/S2a/S2a_" + num + ".png";
  const expectedOwn = "https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S2a/S2a_" + num + ".webp";
  if (!card || !p || !r || p.canonicalOrder !== n || r.canonicalOrder !== n ||
      String(card.code || "").toLowerCase() !== "s2a_" + num + "/070" ||
      String(p.code || "").toLowerCase() !== "s2a_" + num + "/070" ||
      r.cardKey !== key || p.name !== card.name ||
      !r.koreanPrintImageVerified || !r.artObservation?.trim() ||
      r.sourceEvidence !== "pokemonkorea-catalogue-url-and-dcb-owned-decoded-image" ||
      !p.sourceAppearsPokemonKoreaOfficial || p.sourceHost !== "cards.image.pokemonkorea.co.kr" ||
      p.sourceUrl !== expectedSource || p.ownedUrl !== expectedOwn ||
      p.imageCheck?.status !== "decoded_region_unverified" ||
      p.imageCheck?.http !== 200 || p.imageCheck?.format !== "WEBP" ||
      p.imageCheck?.dimensions?.[0] !== 420 || p.imageCheck?.dimensions?.[1] !== 586 ||
      !/^[0-9a-f]{64}$/.test(p.imageCheck?.sha256 || "") ||
      JSON.stringify(r.preExistingThemeRecordsPreserved) !== JSON.stringify(p.preExistingThemeMemberships))
    throw Error("Unverified card artwork, ownership or preserved category: " + key);
  const selected = r.matchedThemes || [];
  if (new Set(selected).size !== selected.length || !selected.includes("color") ||
      selected.some(t => !THEMES.includes(t) || !r.categories?.[t]?.trim()) ||
      Object.keys(r.categories || {}).length !== selected.length)
    throw Error("Invalid independent thematic selection: " + key);
  for (const t of selected) {
    const g = groups.get(t);
    if (g.cards.some(c => String(c.code || "").toUpperCase().split("/")[0] === key.toUpperCase()))
      throw Error("Duplicate S2a thematic membership: " + key + "/" + t);
    g.cards.push({
      code:key,name:card.name,series:"S",set:set.code,
      setName:set.displayName || "폭염워커",
      cardNumber:num + "/070",rarity:card.rarity || "",
      category:r.categories[t],image:p.ownedUrl,
      evidence:"포켓몬코리아 S2a 한국어 인쇄 " + num + "/070 및 DCB 자체 보관 WebP 육안 확인. " +
               r.artObservation + " (" + REVIEW + ")."
    });
    additions.push({n,theme:t}); tally[t]++;
  }
}
if (additions.length !== review.themeAdditions ||
    THEMES.some(t => tally[t] !== review.themeCounts?.[t]) ||
    JSON.stringify(set.cards) !== masterSnapshot ||
    old.some((x,i) => JSON.stringify(x) !== oldSnapshot[i]))
  throw Error("S2a newly reviewed classifications or old S2a membership changed");

meta.artworkReviewedCardCount=60;
meta.reviewedCardCount=60;
meta.verifiedKoreanPrintImageCount=60;
meta.verifiedSelfHostedImageCount=60;
meta.reviewedRanges=["001-030","031-060"];
meta.reviewedThemes=THEMES;
meta.newlyAddedThemeSlotCount=92;
meta.preservedExistingThemeSlotCount=3;
meta.partialReviewEvidence=REVIEW;
meta.imagePreflightEvidence=PROOF;
meta.nextStart=NEXT;
meta.reviewedAt=DATE;
meta.status="in_progress";
meta.complete=false;
meta.note="S2a 폭염워커 한글판 001-060 총 60장 개별 일러스트·12테마 검수. 031-060 신규 46건, 누적 92건 및 원래 3건 보존. 061-086 26장 대기; S2/S3 일본어 소스 9장씩과 S6K 4건 보류 유지. 원본 카드/이미지/보유 데이터 불변.";
status.updatedAt=DATE;
themes.updatedAt=DATE;
if (status.execution.nextStart !== GLOBAL || hosting.nextStart !== GLOBAL)
  throw Error("Unrelated global Korean print evidence hold modified");
await Promise.all([
  save("data/art-themes.json",themes),
  save("data/audits/theme-series-review-status.json",status),
  save(PROGRESS,{
    schemaVersion:1,recordedAt:DATE,set:CODE,totalMasterCards:86,
    KoreanPrintArtworksReviewed:60,sourceImagesSelfHostedDecoded:60,
    newlyAddedThemeSlotsThisBatch:46,newlyAddedThemeSlotsCumulative:92,
    existingThemeSlotsPreserved:3,
    reviewedRanges:["001-030","031-060"],
    status:"in_progress",complete:false,nextStart:NEXT,
    globalCheckpointPreserved:GLOBAL,manualReview:REVIEW,
    ownedImagePreflight:PROOF,remainingImageAndArtworkCount:26
  })
]);
console.log(JSON.stringify({
  set:CODE,reviewed:60,total:86,addedThemeSlotsThisBatch:46,
  cumulativeThemeAdditions:92,originalThemeSlotsPreserved:3,
  masterAndOwnershipUnchanged:true
}));
