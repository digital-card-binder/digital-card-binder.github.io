import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputArg = process.argv[2];
if (!inputArg) {
  console.error("Usage: node scripts/merge-series-print-variant-images.mjs <audit.json>");
  process.exit(1);
}

const auditPath = path.resolve(root, inputArg);
const imageMapPath = path.join(root, "data", "series-print-variant-images.json");

const [audit, current] = await Promise.all([
  readFile(auditPath, "utf8").then(JSON.parse),
  readFile(imageMapPath, "utf8").then(JSON.parse).catch(() => ({
    schemaVersion: 1,
    purpose: "Compact official image filenames for verified series print variants used by Binder Studio.",
    source: "Pokemon Korea official card-search audit evidence",
    slots: {},
  })),
]);

const sets = Array.isArray(audit?.sets) ? audit.sets : [];
const auditedCodes = new Set(
  sets.map((set) => String(set?.code || "").trim().toLowerCase()).filter(Boolean),
);

const next = {};
for (const [key, value] of Object.entries(current?.slots || {})) {
  const groupCode = String(key).split("::", 1)[0].toLowerCase();
  if (!auditedCodes.has(groupCode)) next[key] = value;
}

const clean = (value) => String(value || "").trim();
const normalizeNumber = (value) => {
  const raw = clean(value).toLowerCase();
  return /^\d+$/.test(raw) ? String(Number(raw)) : raw;
};

for (const set of sets) {
  const groupCode = clean(set?.code).toLowerCase();
  if (!groupCode) continue;

  for (const slot of Array.isArray(set?.variantSlots) ? set.variantSlots : []) {
    const printed = normalizeNumber(slot?.printedNumber);
    if (!printed) continue;

    const evidence = (slot?.evidence || [])
      .map((item) => ({
        file: clean(item?.imageFile),
        classification: clean(item?.classification).toLowerCase(),
      }))
      .filter((item) => item.file);

    const variants = {};
    for (const item of evidence) {
      if (!item.classification || item.classification === "normal") continue;
      (variants[item.classification] ||= []);
      if (!variants[item.classification].includes(item.file)) {
        variants[item.classification].push(item.file);
      }
    }

    const available = new Set(
      (slot?.availablePrintVariants || [])
        .map((value) => clean(value).toLowerCase())
        .filter(Boolean),
    );

    if (available.has("other") && !variants.other?.length) {
      const files = [...new Set(evidence.map((item) => item.file))];
      if (files.length > 1) {
        const canonical = [...files].sort((a, b) =>
          a.length - b.length || a.localeCompare(b)
        )[0];
        const alternatives = files.filter((file) => file !== canonical);
        if (alternatives.length) variants.other = alternatives;
      }
    }

    if (Object.keys(variants).length) {
      for (const values of Object.values(variants)) values.sort();
      next[`${groupCode}::${printed}`] = { variants };
    }
  }
}

const output = {
  schemaVersion: 1,
  purpose: "Compact official image filenames for verified series print variants used by Binder Studio.",
  source: "Pokemon Korea official card-search audit evidence",
  slots: Object.fromEntries(
    Object.entries(next).sort(([a], [b]) => a.localeCompare(b)),
  ),
};

await writeFile(imageMapPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Merged image evidence for ${audit?.era || "unknown"}: ${Object.keys(output.slots).length} total mapped slots.`,
);
