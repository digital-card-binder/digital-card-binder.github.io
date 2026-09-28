import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputArg = process.argv[2];
if (!inputArg) {
  console.error("Usage: node scripts/merge-series-print-variant-audit.mjs <audit.json>");
  process.exit(1);
}

const auditPath = path.resolve(root, inputArg);
const metadataPath = path.join(root, "data", "series-print-variants.json");

const [audit, metadata] = await Promise.all([
  readFile(auditPath, "utf8").then(JSON.parse),
  readFile(metadataPath, "utf8").then(JSON.parse),
]);

const era = String(audit?.era || "").trim().toUpperCase();
if (!era) throw new Error("Audit era is missing.");

const sets = Array.isArray(audit?.sets) ? audit.sets : [];
const completeSets = sets.filter(
  (set) =>
    Array.isArray(set?.missingProducts) &&
    set.missingProducts.length === 0 &&
    Number(set?.unresolvedRecordCount || 0) === 0 &&
    Number(set?.rawRecordCount || 0) > 0,
);
const partialSets = sets.filter((set) => !completeSets.includes(set));
const completeCodes = completeSets.map((set) => String(set.code || "").trim());
const partialCodes = partialSets.map((set) => String(set.code || "").trim());
const auditedCodes = new Set(
  sets.map((set) => String(set.code || "").trim().toLowerCase()).filter(Boolean),
);

const nextSlots = {};
for (const [key, variants] of Object.entries(metadata?.slots || {})) {
  const groupCode = String(key).split("::", 1)[0].toLowerCase();
  if (!auditedCodes.has(groupCode)) nextSlots[key] = variants;
}

for (const set of sets) {
  const groupCode = String(set.code || "").trim().toLowerCase();
  for (const slot of Array.isArray(set.variantSlots) ? set.variantSlots : []) {
    const actualCode = String(slot.actualSetCode || "").trim().toLowerCase();
    const printed = String(slot.printedNumber || "").trim().replace(/^0+(?=\d)/, "");
    if (!groupCode || !actualCode || !printed) continue;
    const extras = (slot.availablePrintVariants || [])
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => value && value !== "normal");
    if (!extras.length) continue;
    nextSlots[`${groupCode}::${actualCode}::${printed}`] = [...new Set(extras)].sort();
  }
}

const summary = audit?.summary || {};
metadata.coverage = metadata.coverage || {};
metadata.coverage[era] = {
  setCodes: completeCodes,
  partialSetCodes: partialCodes,
  configuredSetCount: Number(summary.configuredSetCount || sets.length),
  resolvedProductCount: Number(summary.resolvedProductCount || 0),
  missingProductCount: Number(summary.missingProductCount || 0),
  variantSlotCount: Number(summary.variantSlotCount || 0),
  variantCounts: {
    holo: Number(summary.variantCounts?.holo || 0),
    mirror: Number(summary.variantCounts?.mirror || 0),
    other: Number(summary.variantCounts?.other || 0),
  },
};

metadata.slots = Object.fromEntries(
  Object.entries(nextSlots).sort(([a], [b]) => a.localeCompare(b)),
);

await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(
  `Merged ${era} audit: ${completeCodes.length} complete / ${partialCodes.length} partial / ${summary.variantSlotCount || 0} variant slots.`,
);
