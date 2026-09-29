import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [eraArg, inputArg, outputArg] = process.argv.slice(2);
if (!eraArg || !inputArg || !outputArg) {
  console.error(
    "Usage: node scripts/audit-series-korean-membership.mjs <ERA> <gap-evidence.json> <output.json>",
  );
  process.exit(1);
}

const era = String(eraArg).trim().toUpperCase();
const inputPath = path.resolve(root, inputArg);
const outputPath = path.resolve(root, outputArg);
const clean = (value) => String(value ?? "").trim();

function isOfficialDetailEvidence(record) {
  if (record?.verified !== true) return false;
  try {
    const url = new URL(clean(record?.source));
    return (
      (url.hostname === "pokemoncard.co.kr" ||
        url.hostname.endsWith(".pokemoncard.co.kr")) &&
      url.pathname.startsWith("/cards/detail/")
    );
  } catch {
    return false;
  }
}

function isFirstParty(record) {
  return (
    clean(record?.image).startsWith(
      "https://cards.image.pokemonkorea.co.kr/",
    ) ||
    /(^|\.)pokemoncard[.]co[.]kr$/i.test(
      (() => {
        try {
          return new URL(clean(record?.source)).hostname;
        } catch {
          return "";
        }
      })(),
    )
  );
}

function isKoreanSecondary(record) {
  return (
    clean(record?.source).startsWith("https://www.dogam.app/") &&
    clean(record?.image).startsWith("https://static.tcgexchange.kr/") &&
    Boolean(clean(record?.name))
  );
}

const gapEvidence = JSON.parse(await readFile(inputPath, "utf8"));
let officialDetailEvidence = { eras: {} };
try {
  officialDetailEvidence = JSON.parse(
    await readFile(
      path.join(root, "data", "audits", "series-official-gap-evidence.json"),
      "utf8",
    ),
  );
} catch {}
const officialOverrideSlots =
  officialDetailEvidence?.eras?.[era]?.slots || {};

if (String(gapEvidence?.era || "").toUpperCase() !== era) {
  throw new Error(
    `Gap evidence era mismatch: expected ${era}, got ${gapEvidence?.era || "(missing)"}`,
  );
}

const sets = [];
const slots = {};

for (const set of gapEvidence.sets || []) {
  let firstPartyVerifiedGapCount = 0;
  let koreanSecondaryVerifiedGapCount = 0;
  let unresolvedGapCount = 0;

  for (const missing of set.missing || []) {
    const key = [
      String(set.code || "").toLowerCase(),
      String(missing.actualSetCode || "").toLowerCase(),
      String(missing.printedNumber || "").toLowerCase(),
    ].join("::");
    const records = missing.localRecords || [];
    const officialDetail = officialOverrideSlots[key];
    if (isOfficialDetailEvidence(officialDetail)) {
      firstPartyVerifiedGapCount += 1;
      slots[key] = {
        setCode: set.code,
        actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber,
        verified: true,
        officialConfirmed: true,
        koreanSupported: true,
        evidenceTier: "first-party",
        evidence: "pokemon-korea-card-detail",
        source: clean(officialDetail.source),
        image: clean(officialDetail.image),
        name: clean(officialDetail.name),
        rarity: clean(officialDetail.rarity),
      };
      continue;
    }

    const firstParty = records.find(isFirstParty);
    if (firstParty) {
      firstPartyVerifiedGapCount += 1;
      slots[key] = {
        setCode: set.code,
        actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber,
        verified: true,
        officialConfirmed: true,
        koreanSupported: true,
        evidenceTier: "first-party",
        evidence: "pokemon-korea-image-or-card-source",
        source: clean(firstParty.source),
        image: clean(firstParty.image),
        name: clean(firstParty.name),
        rarity: clean(firstParty.rarity),
      };
      continue;
    }

    const secondary = records.find(isKoreanSecondary);
    if (secondary) {
      koreanSecondaryVerifiedGapCount += 1;
      slots[key] = {
        setCode: set.code,
        actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber,
        verified: false,
        officialConfirmed: false,
        koreanSupported: true,
        evidenceTier: "korean-secondary",
        evidence: "korean-card-database-and-image",
        source: clean(secondary.source),
        image: clean(secondary.image),
        name: clean(secondary.name),
        rarity: clean(secondary.rarity),
      };
      continue;
    }

    unresolvedGapCount += 1;
    slots[key] = {
      setCode: set.code,
      actualSetCode: missing.actualSetCode,
      printedNumber: missing.printedNumber,
      verified: false,
      officialConfirmed: false,
      koreanSupported: false,
      evidenceTier: "unresolved",
      evidence: "no-accepted-korean-evidence",
      source: "",
      records,
    };
  }

  const expectedSlotCount = Number(set.expectedSlotCount || 0);
  const productSearchGapCount = Number(set.missingExpectedSlotCount || 0);
  // A product can legitimately bundle cards from another set code (for
  // example SVM Generations includes SV-P promos). Count only expected
  // canonical slots matched by official search, never all parsed records.
  const productSearchSlotCount = Math.max(
    0,
    expectedSlotCount - productSearchGapCount,
  );
  const officialParsedSlotCount = Number(set.officialParsedSlotCount || 0);
  const unexpectedOfficialSlotCount = Number(
    set.unexpectedOfficialSlotCount || 0,
  );
  const officialVerifiedSlotCount =
    productSearchSlotCount + firstPartyVerifiedGapCount;
  const koreanSupportedSlotCount =
    officialVerifiedSlotCount + koreanSecondaryVerifiedGapCount;
  const pendingOfficialEvidenceCount = Math.max(
    0,
    expectedSlotCount - officialVerifiedSlotCount,
  );

  sets.push({
    code: set.code,
    title: set.title,
    expectedSlotCount,
    productSearchSlotCount,
    productSearchGapCount,
    officialParsedSlotCount,
    unexpectedOfficialSlotCount,
    firstPartyVerifiedGapCount,
    koreanSecondaryVerifiedGapCount,
    unresolvedGapCount,
    officialVerifiedSlotCount,
    koreanSupportedSlotCount,
    pendingOfficialEvidenceCount,
    verifiedSlotCount: officialVerifiedSlotCount,
    complete:
      pendingOfficialEvidenceCount === 0 &&
      officialVerifiedSlotCount === expectedSlotCount,
    koreanSupportedComplete:
      unresolvedGapCount === 0 &&
      koreanSupportedSlotCount === expectedSlotCount,
  });
}

const output = {
  schemaVersion: 1,
  scope: {
    era,
    market: "KR",
    koreanReleaseOnly: true,
    auditedSetCount: sets.length,
  },
  evidencePolicy: {
    tier1:
      "Pokemon Korea official product-search/detail/image evidence.",
    tier2:
      "Korean secondary card database plus Korean card image evidence is provisional support only and never finalizes official Korean membership.",
    japaneseReference:
      "Reference-only. Japanese existence alone never verifies a Korean master slot.",
  },
  summary: {
    setCount: sets.length,
    completeSetCount: sets.filter((set) => set.complete).length,
    pendingSetCount: sets.filter((set) => !set.complete).length,
    koreanSupportedCompleteSetCount: sets.filter(
      (set) => set.koreanSupportedComplete,
    ).length,
    expectedSlotCount: sets.reduce((sum, set) => sum + set.expectedSlotCount, 0),
    productSearchSlotCount: sets.reduce(
      (sum, set) => sum + set.productSearchSlotCount,
      0,
    ),
    productSearchGapCount: sets.reduce(
      (sum, set) => sum + set.productSearchGapCount,
      0,
    ),
    firstPartyVerifiedGapCount: sets.reduce(
      (sum, set) => sum + set.firstPartyVerifiedGapCount,
      0,
    ),
    koreanSecondaryVerifiedGapCount: sets.reduce(
      (sum, set) => sum + set.koreanSecondaryVerifiedGapCount,
      0,
    ),
    pendingOfficialEvidenceCount: sets.reduce(
      (sum, set) => sum + set.pendingOfficialEvidenceCount,
      0,
    ),
    unresolvedGapCount: sets.reduce(
      (sum, set) => sum + set.unresolvedGapCount,
      0,
    ),
  },
  sets,
  slots,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `${era} Korean membership: ${output.summary.completeSetCount}/${output.summary.setCount} audited sets officially complete; ${output.summary.koreanSupportedCompleteSetCount} Korean-supported; ${output.summary.pendingOfficialEvidenceCount} slots pending official evidence.`,
);
