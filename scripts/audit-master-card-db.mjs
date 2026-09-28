import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const outputPath = path.join(root, "data", "master-card-db-audit.json");
const ERA_ORDER = ["ORIGIN", "ADV", "DP", "BW", "XY", "SM", "S", "SV", "M"];

const clean = (value) => String(value ?? "").trim();
const normalized = (value) => clean(value).toLowerCase();

function buildAudit(inventory, variants, membershipEvidence = null, koreanMembership = null, svKoreanMembership = null) {
  const eras = {};
  let verifiedVariantSetCount = 0;
  let firstPartyMembershipVerifiedSetCount = 0;
  let koreanMembershipVerifiedSetCount = 0;
  let koreanMembershipPendingSetCount = 0;
  let koreanMembershipScopedSetCount = 0;

  for (const era of ERA_ORDER) {
    const eraSummary = inventory.eras.find((item) => item.era === era);
    const eraSets = inventory.sets.filter((item) => item.era === era);
    const official = variants.coverage?.[era] || {};
    const verifiedCodes = new Set(
      (official.setCodes || []).map(normalized),
    );
    const verifiedSets = eraSets.filter((item) =>
      verifiedCodes.has(normalized(item.code)),
    );
    const pendingSets = eraSets.filter((item) =>
      !verifiedCodes.has(normalized(item.code)),
    );

    verifiedVariantSetCount += verifiedSets.length;
    eras[era] = {
      setCount: eraSummary?.setCount || eraSets.length,
      cardCount:
        eraSummary?.cardCount ||
        eraSets.reduce((sum, item) => sum + Number(item.cardCount || 0), 0),
      officialVariantAudit: {
        status:
          verifiedSets.length === eraSets.length
            ? "complete"
            : verifiedSets.length
              ? "partial"
              : "pending",
        verifiedSetCount: verifiedSets.length,
        pendingSetCount: pendingSets.length,
        verifiedSetCodes: verifiedSets.map((item) => item.code),
        pendingSetCodes: pendingSets.map((item) => item.code),
        verifiedVariantSlotCount: Number(official.variantSlotCount || 0),
        variantCounts: {
          holo: Number(official.variantCounts?.holo || 0),
          mirror: Number(official.variantCounts?.mirror || 0),
          other: Number(official.variantCounts?.other || 0),
        },
      },
    };

    if (era === "M" && membershipEvidence?.sets) {
      const evidenceByCode = new Map(
        membershipEvidence.sets.map((item) => [normalized(item.code), item]),
      );
      const verifiedMembershipSets = eraSets.filter(
        (item) =>
          evidenceByCode.get(normalized(item.code))
            ?.allExpectedSlotsHaveFirstPartyEvidence === true,
      );
      const pendingMembershipSets = eraSets.filter(
        (item) =>
          evidenceByCode.get(normalized(item.code))
            ?.allExpectedSlotsHaveFirstPartyEvidence !== true,
      );
      firstPartyMembershipVerifiedSetCount += verifiedMembershipSets.length;
      eras[era].firstPartyMembershipAudit = {
        status:
          verifiedMembershipSets.length === eraSets.length
            ? "complete"
            : verifiedMembershipSets.length
              ? "partial"
              : "pending",
        verifiedSetCount: verifiedMembershipSets.length,
        pendingSetCount: pendingMembershipSets.length,
        verifiedSetCodes: verifiedMembershipSets.map((item) => item.code),
        pendingSetCodes: pendingMembershipSets.map((item) => item.code),
        productSearchGapCount: Number(
          membershipEvidence.summary?.missingExpectedSlotCount || 0,
        ),
        firstPartyVerifiedGapCount: Number(
          membershipEvidence.summary?.verifiedMissingSlotCount || 0,
        ),
        unresolvedGapCount: Number(
          membershipEvidence.summary?.unresolvedMissingSlotCount || 0,
        ),
        evidencePolicy: clean(membershipEvidence.sourcePolicy),
      };
    }

    if (era === "M" && koreanMembership?.sets) {
      const koreanByCode = new Map(
        koreanMembership.sets.map((item) => [normalized(item.code), item]),
      );
      const verifiedKoreanSets = eraSets.filter(
        (item) => koreanByCode.get(normalized(item.code))?.complete === true,
      );
      const pendingKoreanSets = eraSets.filter(
        (item) => koreanByCode.get(normalized(item.code))?.complete !== true,
      );
      koreanMembershipVerifiedSetCount += verifiedKoreanSets.length;
      koreanMembershipPendingSetCount += pendingKoreanSets.length;
      koreanMembershipScopedSetCount += eraSets.length;
      eras[era].koreanMembershipAudit = {
        status:
          verifiedKoreanSets.length === eraSets.length
            ? "complete"
            : verifiedKoreanSets.length
              ? "partial"
              : "pending",
        auditedSetCount: Number(koreanMembership.summary?.setCount || 0),
        verifiedSetCount: verifiedKoreanSets.length,
        pendingSetCount: pendingKoreanSets.length,
        verifiedSetCodes: verifiedKoreanSets.map((item) => item.code),
        pendingSetCodes: pendingKoreanSets.map((item) => item.code),
        expectedSlotCount: Number(
          koreanMembership.summary?.expectedSlotCount || 0,
        ),
        productSearchSlotCount: Number(
          koreanMembership.summary?.productSearchSlotCount || 0,
        ),
        firstPartyVerifiedGapCount: Number(
          koreanMembership.summary?.firstPartyVerifiedGapCount || 0,
        ),
        koreanSecondaryVerifiedGapCount: Number(
          koreanMembership.summary?.koreanSecondaryVerifiedGapCount || 0,
        ),
        unresolvedGapCount: Number(
          koreanMembership.summary?.unresolvedGapCount || 0,
        ),
        evidencePolicy: koreanMembership.evidencePolicy || {},
      };
    }

    if (era === "SV" && svKoreanMembership?.sets) {
      const koreanByCode = new Map(
        svKoreanMembership.sets.map((item) => [normalized(item.code), item]),
      );
      const verifiedKoreanSets = eraSets.filter(
        (item) => koreanByCode.get(normalized(item.code))?.complete === true,
      );
      const pendingKoreanSets = eraSets.filter(
        (item) => koreanByCode.get(normalized(item.code))?.complete !== true,
      );
      koreanMembershipVerifiedSetCount += verifiedKoreanSets.length;
      koreanMembershipPendingSetCount += pendingKoreanSets.length;
      koreanMembershipScopedSetCount += eraSets.length;
      eras[era].koreanMembershipAudit = {
        status:
          verifiedKoreanSets.length === eraSets.length
            ? "complete"
            : verifiedKoreanSets.length
              ? "partial"
              : "pending",
        auditedSetCount: Number(svKoreanMembership.summary?.setCount || 0),
        verifiedSetCount: verifiedKoreanSets.length,
        pendingSetCount: pendingKoreanSets.length,
        verifiedSetCodes: verifiedKoreanSets.map((item) => item.code),
        pendingSetCodes: pendingKoreanSets.map((item) => item.code),
        expectedSlotCount: Number(
          svKoreanMembership.summary?.expectedSlotCount || 0,
        ),
        productSearchSlotCount: Number(
          svKoreanMembership.summary?.productSearchSlotCount || 0,
        ),
        firstPartyVerifiedGapCount: Number(
          svKoreanMembership.summary?.firstPartyVerifiedGapCount || 0,
        ),
        koreanSecondaryVerifiedGapCount: Number(
          svKoreanMembership.summary?.koreanSecondaryVerifiedGapCount || 0,
        ),
        unresolvedGapCount: Number(
          svKoreanMembership.summary?.unresolvedGapCount || 0,
        ),
        evidencePolicy: svKoreanMembership.evidencePolicy || {},
      };
    }
  }

  const verifiedVariantCounts = Object.values(variants.coverage || {}).reduce(
    (totals, item) => {
      totals.holo += Number(item.variantCounts?.holo || 0);
      totals.mirror += Number(item.variantCounts?.mirror || 0);
      totals.other += Number(item.variantCounts?.other || 0);
      return totals;
    },
    { holo: 0, mirror: 0, other: 0 },
  );

  return {
    schemaVersion: 1,
    title: "디지털 카드 바인더 한국판 마스터 DB 감사 기준",
    scope: {
      language: "ko",
      market: "KR",
      eras: ERA_ORDER,
      koreanReleaseOnly: true,
      japaneseReferencePolicy: "reference-only",
      rule:
        "일본판은 누락·구조 대조용 참고자료로만 사용하며, 일본판 존재만으로 한국판 마스터 DB에 카드를 추가하지 않는다.",
    },
    sourcePriority: [
      "포켓몬코리아 공식 카드 검색/공식 한국판 자료",
      "한국판 실물 카드 이미지 및 국내 발매 근거",
      "일본판 원본 자료(교차검증 참고 전용)",
    ],
    canonicalPolicy: {
      canonicalUnit: "한국판 세트 + 한국판 인쇄 카드번호",
      basePrint: "normal",
      printVariants: ["holo", "mirror", "other"],
      variantRule:
        "같은 한국판 세트/카드번호의 인쇄 차이는 별도 카드 슬롯으로 늘리지 않고 기본 카드에 변형으로 연결한다.",
      reprintRule:
        "한국에서 다른 세트 또는 다른 카드번호로 재수록된 카드는 별도 canonical slot으로 유지한다.",
      ownershipRule:
        "기본 카드 보유를 중심으로 하고, 보유한 인쇄 변형은 같은 카드 슬롯의 printVariants로 저장한다.",
    },
    sourceFiles: [
      "data/series.json",
      "data/series-legacy.json",
      "data/series-inventory-audit.json",
      "data/series-print-variants.json",
      ...(membershipEvidence
        ? ["data/audits/mega-official-image-probe.json"]
        : []),
      ...(koreanMembership
        ? ["data/audits/mega-korean-membership-audit.json"]
        : []),
      ...(svKoreanMembership
        ? ["data/audits/sv-expansion-korean-membership.json"]
        : []),
    ],
    summary: {
      setCount: inventory.summary.setCount,
      cardCount: inventory.summary.cardCount,
      duplicateSetCodeCount: inventory.summary.duplicateSetCodeCount,
      duplicateCardIdentityCount: inventory.summary.duplicateCardIdentityCount,
      officialVariantVerifiedSetCount: verifiedVariantSetCount,
      officialVariantPendingSetCount:
        inventory.summary.setCount - verifiedVariantSetCount,
      officialVariantVerifiedSlotCount: Object.keys(variants.slots || {}).length,
      verifiedVariantCounts,
      ...(membershipEvidence
        ? {
            firstPartyMembershipVerifiedSetCount,
            firstPartyMembershipPendingSetCount:
              Number(membershipEvidence.summary?.setCount || 0) -
              firstPartyMembershipVerifiedSetCount,
          }
        : {}),
      ...(koreanMembership || svKoreanMembership
        ? {
            koreanMembershipScopedSetCount,
            koreanMembershipVerifiedSetCount,
            koreanMembershipPendingSetCount,
          }
        : {}),
      metadataGaps: inventory.summary.metadata,
    },
    eras,
    nextWorkRule:
      "pendingSetCodes를 한국판 공식 자료로 시대별·세트별 검수해 officialVariantAudit의 verified 범위를 확장한다.",
  };
}

async function readOptionalJson(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
  } catch {
    return null;
  }
}

const [
  inventory,
  variants,
  membershipEvidence,
  koreanMembership,
  svKoreanMembership,
] = await Promise.all([
  readFile(path.join(root, "data", "series-inventory-audit.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "data", "series-print-variants.json"), "utf8").then(JSON.parse),
  readOptionalJson("data/audits/mega-official-image-probe.json"),
  readOptionalJson("data/audits/mega-korean-membership-audit.json"),
  readOptionalJson("data/audits/sv-expansion-korean-membership.json"),
]);

const audit = buildAudit(
  inventory,
  variants,
  membershipEvidence,
  koreanMembership,
  svKoreanMembership,
);
const expected = `${JSON.stringify(audit, null, 2)}\n`;

if (checkOnly) {
  let current = "";
  try {
    current = await readFile(outputPath, "utf8");
  } catch {}
  if (current !== expected) {
    console.error("Master card DB audit is out of sync.");
    console.error("Run: npm run master-db-audit:sync");
    process.exit(1);
  }
  console.log(
    `Master DB audit synchronized: ${audit.summary.setCount} sets / ${audit.summary.cardCount} cards / ${audit.summary.officialVariantVerifiedSetCount} variant-audited sets.`,
  );
} else {
  await writeFile(outputPath, expected);
  console.log(
    `Wrote master DB audit: ${audit.summary.setCount} sets / ${audit.summary.cardCount} cards / ${audit.summary.officialVariantPendingSetCount} sets pending official variant review.`,
  );
}
