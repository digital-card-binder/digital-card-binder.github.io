import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data", "audits", "theme-series-coverage.json");
const checkOnly = process.argv.includes("--check");

const THEME_CODES = [
  "sleeping",
  "connected",
  "evolution",
  "night",
  "season",
  "color",
  "sunset",
  "reflections",
  "food",
  "street",
  "work",
  "cameo",
];

const ERA_ORDER = ["M", "SV", "S", "SM", "XY", "BW", "DP", "ADV", "ORIGIN"];
const clean = (value) => String(value ?? "").trim();
const keyOf = (value) => clean(value).toLowerCase();

function inferEra(group) {
  const explicit = clean(group?.era);
  if (explicit) return explicit;
  const code = keyOf(group?.code);
  if (code === "base") return "ORIGIN";
  if (code.startsWith("adv")) return "ADV";
  if (/^(bs|dpp|st1|csd|dgd|drd|pkd)/.test(code)) return "DP";
  if (/^(bw|ebb|sc|dc|bd|td|fs|btv|bg|pbg|bkr|gbr|szd|kd|ppd|mg-|k\+k)/.test(code)) return "BW";
  if (/^(xy|cp|20th|ubd|rbd|x30|y30|fxy)/.test(code)) return "XY";
  if (/^(sm|smp)/.test(code)) return "SM";
  if (code === "sd" || /^s\d/.test(code) || /^s[-a-z]/.test(code)) return "S";
  if (code.startsWith("sv") || /^cl[flk]$/.test(code)) return "SV";
  if (code.startsWith("m")) return "M";
  return "UNKNOWN";
}

function mergeGroups(base, legacy) {
  const merged = [...base];
  for (const extra of legacy) {
    const key = keyOf(extra?.code);
    const index = merged.findIndex((group) => keyOf(group?.code) === key);
    if (index >= 0) merged[index] = extra;
    else merged.push(extra);
  }
  return merged;
}

function setDisplayName(group) {
  return (
    clean(group?.displayName) ||
    clean(group?.name) ||
    clean(group?.title).replace(/\s*\([^)]*\)\s*$/, "") ||
    clean(group?.code)
  );
}

function cardSetKey(card) {
  const explicit = keyOf(card?.set);
  if (explicit) return explicit;
  const code = clean(card?.code);
  const prefix = code.split("_", 1)[0];
  return keyOf(prefix);
}

function normalizedCardIdentity(card) {
  const setKey = cardSetKey(card);
  const code = keyOf(card?.code);
  return `${setKey}::${code}`;
}

function normalizedReviewMap(reviews) {
  return new Map(
    Object.entries(reviews || {}).map(([code, review]) => [keyOf(code), review]),
  );
}

function reviewedThemeSet(review) {
  return new Set(
    Array.isArray(review?.reviewedThemes)
      ? review.reviewedThemes.map(keyOf)
      : [],
  );
}

function isStrictComplete(review, set, themeCodes) {
  if (!review || review.status !== "complete") return false;
  if (Number(review.reviewedCardCount) !== set.cardCount) return false;
  const reviewedThemes = reviewedThemeSet(review);
  return themeCodes.every((theme) => reviewedThemes.has(keyOf(theme)));
}

async function buildAudit() {
  const [base, legacy, themeData, reviewState] = await Promise.all([
    readFile(path.join(root, "data", "series.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "data", "series-legacy.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "data", "art-themes.json"), "utf8").then(JSON.parse),
    readFile(
      path.join(root, "data", "audits", "theme-series-review-status.json"),
      "utf8",
    ).then(JSON.parse),
  ]);

  const merged = mergeGroups(base, legacy);
  const sets = merged.map((group, sourceIndex) => ({
    key: keyOf(group?.code),
    code: clean(group?.code),
    era: inferEra(group),
    name: setDisplayName(group),
    cardCount: Array.isArray(group?.cards) ? group.cards.length : 0,
    sourceIndex,
  }));
  const setByKey = new Map(sets.map((set) => [set.key, set]));

  const baselineCodes = new Set(
    (reviewState?.baseline?.setCodes || []).map(keyOf),
  );
  const baselineCounts = new Map(
    Object.entries(reviewState?.baseline?.setCardCounts || {}).map(
      ([code, count]) => [keyOf(code), Number(count) || 0],
    ),
  );
  const reviews = normalizedReviewMap(reviewState?.reviews);

  const themeGroups = Array.isArray(themeData?.groups) ? themeData.groups : [];
  const themeCodes = themeGroups.map((group) => keyOf(group?.code));
  const missingRequiredThemes = THEME_CODES.filter(
    (code) => !themeCodes.includes(keyOf(code)),
  );
  const unexpectedThemes = themeCodes.filter(
    (code) => !THEME_CODES.includes(code),
  );

  const themeHitsBySet = new Map();
  const themeSummary = [];
  const unknownThemeSetRefs = [];
  const uniqueThemeCards = new Set();

  for (const theme of themeGroups) {
    const themeCode = keyOf(theme?.code);
    const cards = Array.isArray(theme?.cards) ? theme.cards : [];
    const setKeys = new Set();
    const rarities = new Set();

    for (const card of cards) {
      const setKey = cardSetKey(card);
      if (!setKey || !setByKey.has(setKey)) {
        unknownThemeSetRefs.push({
          theme: themeCode,
          cardCode: clean(card?.code),
          set: clean(card?.set),
          inferredSetKey: setKey,
        });
        continue;
      }

      setKeys.add(setKey);
      if (clean(card?.rarity)) rarities.add(clean(card?.rarity));
      uniqueThemeCards.add(normalizedCardIdentity(card));

      const current = themeHitsBySet.get(setKey) || {};
      current[themeCode] = (current[themeCode] || 0) + 1;
      themeHitsBySet.set(setKey, current);
    }

    themeSummary.push({
      code: themeCode,
      name: clean(theme?.name),
      cardSlots: cards.length,
      setCount: setKeys.size,
      rarities: [...rarities].sort((a, b) => a.localeCompare(b, "ko")),
    });
  }

  const baselineRemovedSetCodes = [...baselineCodes]
    .filter((key) => !setByKey.has(key))
    .map((key) => key);

  const changedBaselineSets = sets.filter((set) => {
    if (!baselineCodes.has(set.key)) return false;
    const baselineCount = baselineCounts.get(set.key);
    return Number.isFinite(baselineCount) && baselineCount !== set.cardCount;
  });

  const rows = sets.map((set) => {
    const review = reviews.get(set.key) || null;
    const strictComplete = isStrictComplete(review, set, THEME_CODES);
    const baseline = baselineCodes.has(set.key);
    const baselineCount = baselineCounts.get(set.key);
    const changed =
      baseline &&
      Number.isFinite(baselineCount) &&
      baselineCount !== set.cardCount;
    const origin = baseline ? "baseline" : "incremental";

    let status = "pending";
    if (strictComplete) status = "complete";
    else if (review?.status === "partial") status = "partial";
    else if (!baseline && !review) status = "unregistered";
    else if (review?.status && review.status !== "complete") status = review.status;
    else if (review?.status === "complete") status = "invalid-complete";

    return {
      era: set.era,
      code: set.code,
      name: set.name,
      cardCount: set.cardCount,
      origin,
      changedSinceBaseline: changed,
      status,
      reviewedAt: clean(review?.reviewedAt),
      themeHits: themeHitsBySet.get(set.key) || {},
    };
  });

  const strictCompleteRows = rows.filter((row) => row.status === "complete");
  const baselineRows = rows.filter((row) => row.origin === "baseline");
  const baselineRemaining = baselineRows.filter(
    (row) => row.status !== "complete",
  );
  const incrementalRows = rows.filter((row) => row.origin === "incremental");
  const incrementalIncomplete = incrementalRows.filter(
    (row) => row.status !== "complete",
  );
  const changedIncomplete = changedBaselineSets.filter((set) => {
    const row = rows.find((item) => keyOf(item.code) === set.key);
    return row?.status !== "complete";
  });

  const eras = ERA_ORDER.map((era) => {
    const eraRows = rows.filter((row) => row.era === era);
    return {
      era,
      setCount: eraRows.length,
      cardCount: eraRows.reduce((sum, row) => sum + row.cardCount, 0),
      completeSetCount: eraRows.filter((row) => row.status === "complete").length,
      remainingSetCount: eraRows.filter((row) => row.status !== "complete").length,
      currentThemeSlots: eraRows.reduce(
        (sum, row) =>
          sum +
          Object.values(row.themeHits).reduce(
            (themeSum, value) => themeSum + Number(value || 0),
            0,
          ),
        0,
      ),
    };
  }).filter((era) => era.setCount > 0);

  const eraRank = new Map(ERA_ORDER.map((era, index) => [era, index]));
  const nextQueue = rows
    .filter((row) => row.status !== "complete")
    .sort((a, b) => {
      const eraDiff =
        (eraRank.get(a.era) ?? 999) - (eraRank.get(b.era) ?? 999);
      if (eraDiff) return eraDiff;
      const aSet = setByKey.get(keyOf(a.code));
      const bSet = setByKey.get(keyOf(b.code));
      return (bSet?.sourceIndex ?? 0) - (aSet?.sourceIndex ?? 0);
    })
    .slice(0, 30)
    .map(({ era, code, name, cardCount, status }) => ({
      era,
      code,
      name,
      cardCount,
      status,
    }));

  const incrementalGateBlocked =
    incrementalIncomplete.length > 0 ||
    changedIncomplete.length > 0 ||
    baselineRemovedSetCodes.length > 0 ||
    missingRequiredThemes.length > 0 ||
    unexpectedThemes.length > 0 ||
    unknownThemeSetRefs.length > 0;

  return {
    schemaVersion: 1,
    updatedAt: "2026-10-06",
    title: "테마 도감 한국판 전체 시리즈 전수검수 현황",
    policy: reviewState.policy,
    sourceFiles: [
      "data/series.json",
      "data/series-legacy.json",
      "data/art-themes.json",
      "data/audits/theme-series-review-status.json",
    ],
    summary: {
      masterSetCount: sets.length,
      masterCardCount: sets.reduce((sum, set) => sum + set.cardCount, 0),
      themeCount: themeGroups.length,
      themeCardSlots: themeGroups.reduce(
        (sum, group) => sum + (Array.isArray(group?.cards) ? group.cards.length : 0),
        0,
      ),
      uniqueThemeCards: uniqueThemeCards.size,
      strictCompleteSetCount: strictCompleteRows.length,
      baselineSetCount: baselineRows.length,
      baselineRemainingSetCount: baselineRemaining.length,
      incrementalSetCount: incrementalRows.length,
      incrementalIncompleteSetCount: incrementalIncomplete.length,
      changedBaselineSetCount: changedBaselineSets.length,
      changedBaselineIncompleteSetCount: changedIncomplete.length,
      unknownThemeSetReferenceCount: unknownThemeSetRefs.length,
    },
    auditState: {
      status:
        baselineRemaining.length === 0 && !incrementalGateBlocked
          ? "complete"
          : "in-progress",
      completeDefinition:
        "세트 내 모든 canonical card slot을 12개 테마 기준으로 검수하고 reviewedCardCount와 reviewedThemes가 현재 마스터 DB와 일치해야 complete.",
      currentPriority: "M → SV → S → SM → XY → BW → DP → ADV → ORIGIN",
    },
    incrementalGate: {
      status: incrementalGateBlocked ? "blocked" : "pass",
      rule:
        "2026-10-06 baseline 이후 신규 세트 또는 기존 세트 카드 수 변경은 해당 세트의 12테마 전수검수 complete 전까지 CI를 차단한다.",
      incrementalIncompleteSetCodes: incrementalIncomplete.map((row) => row.code),
      changedBaselineIncompleteSetCodes: changedIncomplete.map((set) => set.code),
      removedBaselineSetCodes: baselineRemovedSetCodes,
      missingRequiredThemes,
      unexpectedThemes,
      unknownThemeSetReferenceCount: unknownThemeSetRefs.length,
    },
    themes: themeSummary,
    eras,
    nextQueue,
    sets: rows,
    unknownThemeSetRefs,
  };
}

const audit = await buildAudit();
const expected = `${JSON.stringify(audit, null, 2)}\n`;

if (checkOnly) {
  let current = "";
  try {
    current = await readFile(outputPath, "utf8");
  } catch {}

  if (current !== expected) {
    console.error("Theme series coverage audit is out of sync.");
    console.error("Run: npm run theme-audit:sync");
    process.exit(1);
  }

  if (audit.incrementalGate.status !== "pass") {
    console.error("Theme audit incremental gate is blocked.");
    console.error(JSON.stringify(audit.incrementalGate, null, 2));
    process.exit(1);
  }

  console.log(
    `Theme audit synchronized: ${audit.summary.strictCompleteSetCount}/${audit.summary.masterSetCount} sets strict-complete, ${audit.summary.baselineRemainingSetCount} baseline sets remaining.`,
  );
} else {
  await writeFile(outputPath, expected);

  if (audit.incrementalGate.status !== "pass") {
    console.error("Wrote theme coverage audit, but incremental gate is blocked.");
    console.error(JSON.stringify(audit.incrementalGate, null, 2));
    process.exit(1);
  }

  console.log(
    `Wrote theme coverage audit: ${audit.summary.strictCompleteSetCount}/${audit.summary.masterSetCount} sets strict-complete, ${audit.summary.baselineRemainingSetCount} baseline sets remaining.`,
  );
}
