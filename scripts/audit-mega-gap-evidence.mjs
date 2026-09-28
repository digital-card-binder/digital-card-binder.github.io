import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
      printedNumber: norm(token[2].replace(/\s+(?:C|U|R|RR|RRR|AR|SR|SAR|UR|CHR|CSR|K|A)$/i, "")),
    };
  }
  return { groupCode, actualSetCode: groupCode, printedNumber: norm(raw || index) };
}

const [base, legacy, audit] = await Promise.all([
  readFile(path.join(root, "data", "series.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "data", "series-legacy.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "data", "audits", "series-print-variant-audit-M.json"), "utf8").then(JSON.parse),
]);

const groups = mergeGroups(base, legacy);
const groupMap = new Map(groups.map((group) => [norm(group.code), group]));
const report = {
  schemaVersion: 1,
  purpose: "Evidence report for Korean MEGA slots absent from Pokemon Korea product-search results.",
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
    const key = `${norm(slot.actualSetCode)}::${norm(slot.printedNumber).replace(/^0+(?=\d)/, "")}`;
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

const out = path.join(root, "data", "audits", "mega-gap-evidence.json");
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Wrote MEGA gap evidence: ${report.sets.reduce((sum, set) => sum + set.missing.length, 0)} missing slots across ${report.sets.length} sets.`,
);
