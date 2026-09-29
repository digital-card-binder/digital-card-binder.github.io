import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [eraArg, primaryArg, localArg, outputArg] = process.argv.slice(2);
if (!eraArg || !primaryArg || !localArg || !outputArg) {
  console.error(
    "Usage: node scripts/merge-series-korean-membership.mjs <ERA> <primary-membership.json> <local-evidence.json> <output.json>",
  );
  process.exit(1);
}

const era = String(eraArg).trim().toUpperCase();
const primaryPath = path.resolve(root, primaryArg);
const localPath = path.resolve(root, localArg);
const outputPath = path.resolve(root, outputArg);

const [primary, local] = await Promise.all([
  readFile(primaryPath, "utf8").then(JSON.parse),
  readFile(localPath, "utf8").then(JSON.parse),
]);

let directOfficialDetailAudit = null;
if (era === "SV") {
  try {
    directOfficialDetailAudit = JSON.parse(
      await readFile(
        path.join(root, "data", "audits", "sv-p-official-detail-audit.json"),
        "utf8",
      ),
    );
  } catch {}
}

if (String(primary?.scope?.era || "").toUpperCase() !== era) {
  throw new Error("Primary membership era mismatch.");
}
if (String(local?.scope?.era || "").toUpperCase() !== era) {
  throw new Error("Local evidence era mismatch.");
}

const primaryCodes = new Set(
  (primary.sets || []).map((item) => String(item.code || "").toLowerCase()),
);

const primarySets = (primary.sets || []).map((item) => ({
  ...item,
  verificationMode: "official-product-search-plus-gap-evidence",
  productSearchAudited: true,
  notProductSearchAuditedSlotCount: 0,
  officialVerifiedSlotCount: Number(
    item.officialVerifiedSlotCount ??
      Number(item.productSearchSlotCount || 0) +
        Number(item.firstPartyVerifiedGapCount || 0),
  ),
  koreanSupportedSlotCount: Number(
    item.koreanSupportedSlotCount ??
      Number(item.productSearchSlotCount || 0) +
        Number(item.firstPartyVerifiedGapCount || 0) +
        Number(item.koreanSecondaryVerifiedGapCount || 0),
  ),
  pendingOfficialEvidenceCount: Number(
    item.pendingOfficialEvidenceCount ??
      Math.max(
        0,
        Number(item.expectedSlotCount || 0) -
          Number(item.productSearchSlotCount || 0) -
          Number(item.firstPartyVerifiedGapCount || 0),
      ),
  ),
}));

const localSets = (local.sets || [])
  .filter(
    (item) => !primaryCodes.has(String(item.code || "").toLowerCase()),
  )
  .map((item) => {
    const expectedSlotCount = Number(item.cardCount || 0);
    const localFirstPartyCount = Number(item.firstPartyCount || 0);
    const localSupportedSlotCount =
      localFirstPartyCount + Number(item.koreanSecondaryCount || 0);
    const isSvPromo =
      era === "SV" && String(item.code || "").toLowerCase() === "sv-p";
    const directVerifiedSlotCount =
      isSvPromo &&
      Number(directOfficialDetailAudit?.summary?.expectedSlotCount || 0) ===
        expectedSlotCount
        ? Number(directOfficialDetailAudit?.summary?.verifiedSlotCount || 0)
        : 0;
    const officialVerifiedSlotCount = Math.max(
      localFirstPartyCount,
      directVerifiedSlotCount,
    );
    const koreanSupportedSlotCount = Math.max(
      localSupportedSlotCount,
      officialVerifiedSlotCount,
    );
    const koreanSecondaryVerifiedGapCount = Math.max(
      0,
      koreanSupportedSlotCount - officialVerifiedSlotCount,
    );
    const pendingOfficialEvidenceCount = Math.max(
      0,
      expectedSlotCount - officialVerifiedSlotCount,
    );

    return {
      code: item.code,
      title: item.title,
      expectedSlotCount,
      productSearchSlotCount: 0,
      productSearchGapCount: 0,
      firstPartyVerifiedGapCount: officialVerifiedSlotCount,
      koreanSecondaryVerifiedGapCount,
      unresolvedGapCount: Number(item.unresolvedCount || 0),
      officialVerifiedSlotCount,
      koreanSupportedSlotCount,
      pendingOfficialEvidenceCount,
      verifiedSlotCount: officialVerifiedSlotCount,
      complete:
        expectedSlotCount > 0 &&
        pendingOfficialEvidenceCount === 0,
      koreanSupportedComplete:
        expectedSlotCount > 0 &&
        koreanSupportedSlotCount === expectedSlotCount,
      verificationMode:
        directVerifiedSlotCount > 0
          ? "official-card-detail-scan-plus-local-korean-evidence"
          : "local-korean-evidence",
      productSearchAudited: false,
      directOfficialDetailAudited: directVerifiedSlotCount > 0,
      notProductSearchAuditedSlotCount: expectedSlotCount,
      sourceHosts: item.sourceHosts || {},
      imageHosts: item.imageHosts || {},
    };
  });

const sets = [...primarySets, ...localSets];
const output = {
  schemaVersion: 1,
  scope: {
    era,
    market: "KR",
    koreanReleaseOnly: true,
  },
  evidencePolicy: {
    tier1:
      "Pokemon Korea official product-search/detail/image evidence.",
    tier2:
      "Known Korean card database source paired with Korean card image evidence is provisional support only and never finalizes official Korean membership.",
    japaneseReference:
      "Reference-only. Japanese existence alone never verifies a Korean master slot.",
  },
  summary: {
    setCount: sets.length,
    completeSetCount: sets.filter((item) => item.complete).length,
    pendingSetCount: sets.filter((item) => !item.complete).length,
    koreanSupportedCompleteSetCount: sets.filter(
      (item) => item.koreanSupportedComplete,
    ).length,
    productSearchAuditedSetCount: primarySets.length,
    localEvidenceOnlySetCount: localSets.filter(
      (item) => !item.directOfficialDetailAudited,
    ).length,
    directOfficialDetailAuditedSetCount: localSets.filter(
      (item) => item.directOfficialDetailAudited,
    ).length,
    expectedSlotCount: sets.reduce(
      (sum, item) => sum + Number(item.expectedSlotCount || 0),
      0,
    ),
    productSearchSlotCount: sets.reduce(
      (sum, item) => sum + Number(item.productSearchSlotCount || 0),
      0,
    ),
    firstPartyVerifiedGapCount: sets.reduce(
      (sum, item) => sum + Number(item.firstPartyVerifiedGapCount || 0),
      0,
    ),
    koreanSecondaryVerifiedGapCount: sets.reduce(
      (sum, item) => sum + Number(item.koreanSecondaryVerifiedGapCount || 0),
      0,
    ),
    notProductSearchAuditedSlotCount: sets.reduce(
      (sum, item) =>
        sum + Number(item.notProductSearchAuditedSlotCount || 0),
      0,
    ),
    pendingOfficialEvidenceCount: sets.reduce(
      (sum, item) => sum + Number(item.pendingOfficialEvidenceCount || 0),
      0,
    ),
    unresolvedGapCount: sets.reduce(
      (sum, item) => sum + Number(item.unresolvedGapCount || 0),
      0,
    ),
  },
  sets,
  sources: [
    path.relative(root, primaryPath).replaceAll("\\", "/"),
    path.relative(root, localPath).replaceAll("\\", "/"),
    ...(directOfficialDetailAudit
      ? ["data/audits/sv-p-official-detail-audit.json"]
      : []),
  ],
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `${era} combined Korean membership: ${output.summary.completeSetCount}/${output.summary.setCount} sets officially complete; ${output.summary.koreanSupportedCompleteSetCount} Korean-supported; ${output.summary.pendingOfficialEvidenceCount} slots pending official evidence.`,
);
