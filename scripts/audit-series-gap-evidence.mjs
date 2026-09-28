import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  console.error(
    "Usage: node scripts/audit-series-gap-evidence.mjs <audit.json> <output.json>",
  );
  process.exit(1);
}

const clean = (value) => String(value ?? "").trim();
const norm = (value) => clean(value).toLowerCase();

function mergeGroups(base, legacy) {
  const merged = [...base];
  for (const group of legacy) {
    const key = norm(group?.code);
    const index = merged.findIndex((item) => norm(item?.code) === key);
    if (index >= 0) merged[index] = group;
    else merged.push(group);
  }
  return merged;
}

function slotFor(group, card, index) {
  const groupCode = norm(group?.code);
  const raw = clean(card?.code || card?.meta || index);
  const numeric = raw.match(/^([^_]+)_0*([0-9]+)(?:\/|\s|$)/i);
  if (numeric) {
    return {
      groupCode,
      actualSetCode: norm(numeric[1]),
      printedNumber: String(Number(numeric[2])),
    };
  }

  const token = raw.match(/^([^_]+)_(.+)$/i);
  if (token) {
    return {
      groupCode,
      actualSetCode: norm(token[1]),
      printedNumber: norm(
        token[2].replace(
          /\s+(?:C|U|R|RR|RRR|AR|SR|SAR|UR|CHR|CSR|K|A)$/i,
          "",
        ),
      ),
    };
  }

  return {
    groupCode,
    actualSetCode: groupCode,
    printedNumber: norm(raw || index),
  };
}

const auditPath = path.resolve(root, inputArg);
const outputPath = path.resolve(root, outputArg);
const [base, legacy, audit] = await Promise.all([
  readFile(path.join(root, "data", "series.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "data", "series-legacy.json"), "utf8").then(JSON.parse),
  readFile(auditPath, "utf8").then(JSON.parse),
]);

const groups = mergeGroups(base, legacy);
const groupMap = new Map(groups.map((group) => [norm(group.code), group]));
const report = {
  schemaVersion: 1,
  era: clean(audit?.era).toUpperCase(),
  purpose:
    "Evidence report for Korean catalog slots absent from Pokemon Korea product-search results.",
  sourceAudit: path.relative(root, auditPath).replaceAll("\\", "/"),
  sets: [],
};

for (const audited of audit.sets || []) {
  const group = groupMap.get(norm(audited.code));
  if (!group) continue;

  const localBySlot = new Map();
  (group.cards || []).forEach((card, index) => {
    const slot = slotFor(group, card, index);
    const key = `${slot.actualSetCode}::${slot.printedNumber}`;
    if (!localBySlot.has(key)) localBySlot.set(key, []);
    localBySlot.get(key).push({
      code: clean(card.code),
      name: clean(card.name || card.pokemonName || card.actualName),
      rarity: clean(card.rarity),
      image: clean(card.image),
      source: clean(card.source),
      label: clean(card.label),
    });
  });

  const missing = (audited.missingExpectedSlots || []).map((slot) => {
    const key = `${norm(slot.actualSetCode)}::${norm(slot.printedNumber).replace(
      /^0+(?=\d)/,
      "",
    )}`;
    return {
      actualSetCode: slot.actualSetCode,
      printedNumber: slot.printedNumber,
      localRecords: localBySlot.get(key) || [],
    };
  });

  report.sets.push({
    code: audited.code,
    title: audited.title,
    expectedSlotCount: audited.expectedSlotCount,
    officialParsedSlotCount: audited.parsedSlotCount,
    missingExpectedSlotCount: audited.missingExpectedSlotCount,
    unexpectedOfficialSlotCount: audited.unexpectedOfficialSlotCount,
    missing,
    unexpectedOfficialSlots: audited.unexpectedOfficialSlots || [],
  });
}

report.summary = {
  setCount: report.sets.length,
  expectedSlotCount: report.sets.reduce(
    (sum, set) => sum + Number(set.expectedSlotCount || 0),
    0,
  ),
  productSearchSlotCount: report.sets.reduce(
    (sum, set) => sum + Number(set.officialParsedSlotCount || 0),
    0,
  ),
  missingExpectedSlotCount: report.sets.reduce(
    (sum, set) => sum + Number(set.missingExpectedSlotCount || 0),
    0,
  ),
  unexpectedOfficialSlotCount: report.sets.reduce(
    (sum, set) => sum + Number(set.unexpectedOfficialSlotCount || 0),
    0,
  ),
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Wrote ${report.era} gap evidence: ${report.summary.missingExpectedSlotCount} missing slots across ${report.summary.setCount} sets.`,
);
