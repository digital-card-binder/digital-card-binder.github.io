import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidencePath = path.join(root, "data", "audits", "mega-gap-evidence.json");
const officialPath = path.join(root, "data", "audits", "mega-official-image-probe.json");
const outputPath = path.join(root, "data", "audits", "mega-korean-membership-audit.json");

const clean = (value) => String(value ?? "").trim();
const norm = (value) => clean(value).toLowerCase();

function trustedKoreanSecondary(record) {
  return (
    clean(record?.source).startsWith("https://www.dogam.app/") &&
    clean(record?.image).startsWith("https://static.tcgexchange.kr/") &&
    Boolean(clean(record?.name))
  );
}

const [gapEvidence, officialEvidence] = await Promise.all([
  readFile(evidencePath, "utf8").then(JSON.parse),
  readFile(officialPath, "utf8").then(JSON.parse),
]);

const officialSlots = officialEvidence?.slots || {};
const sets = [];
const slots = {};

for (const set of gapEvidence?.sets || []) {
  let firstPartyVerifiedGapCount = 0;
  let koreanSecondaryVerifiedGapCount = 0;
  let unresolvedGapCount = 0;

  for (const missing of set.missing || []) {
    const key = [
      norm(set.code),
      norm(missing.actualSetCode),
      norm(missing.printedNumber),
    ].join("::");

    const official = officialSlots[key];
    if (official?.verified === true) {
      firstPartyVerifiedGapCount += 1;
      slots[key] = {
        setCode: set.code,
        actualSetCode: missing.actualSetCode,
        printedNumber: missing.printedNumber,
        verified: true,
        officialConfirmed: true,
        koreanSupported: true,
        evidenceTier: "first-party",
        evidence: official.evidence,
        source: official.url || "",
      };
      continue;
    }

    const secondary = (missing.localRecords || []).find(trustedKoreanSecondary);
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
    };
  }

  const productSearchSlotCount = Number(set.officialParsedSlotCount || 0);
  const expectedSlotCount = Number(set.expectedSlotCount || 0);
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
    productSearchGapCount: Number(set.missingExpectedSlotCount || 0),
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
    era: "M",
    market: "KR",
    koreanReleaseOnly: true,
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
  `MEGA Korean membership: ${output.summary.completeSetCount}/${output.summary.setCount} sets officially complete; ${output.summary.koreanSupportedCompleteSetCount} Korean-supported; ${output.summary.pendingOfficialEvidenceCount} slots pending official evidence.`,
);
