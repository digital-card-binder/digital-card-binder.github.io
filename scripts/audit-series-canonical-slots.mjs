import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data", "series-canonical-slot-audit.json");
const checkOnly = process.argv.includes("--check");
const clean = (value) => String(value ?? "").trim();

function inferEra(group) {
  const explicit = clean(group?.era);
  if (explicit) return explicit;
  const code = clean(group?.code).toLowerCase();
  if (code === "sd" || /^s\d/.test(code)) return "S";
  if (code.startsWith("sv")) return "SV";
  if (code.startsWith("m")) return "M";
  return "UNKNOWN";
}

function mergeGroups(base, legacy) {
  const merged = [...base];
  for (const extra of legacy) {
    const key = clean(extra?.code).toLowerCase();
    const index = merged.findIndex(
      (group) => clean(group?.code).toLowerCase() === key,
    );
    if (index >= 0) merged[index] = extra;
    else merged.push(extra);
  }
  return merged;
}

function printedSlot(group, card, cardIndex) {
  const groupCode = clean(group?.code).toLowerCase();
  const rawCode = clean(card?.code || card?.meta || cardIndex);
  const numeric = rawCode.match(/^([^_]+)_0*([0-9]+)(?:\/|\s|$)/i);
  if (numeric) {
    return {
      key: `${groupCode}::${numeric[1].toLowerCase()}::${Number(numeric[2])}`,
      actualSetCode: numeric[1],
      printedNumber: String(Number(numeric[2])),
      parsed: true,
    };
  }

  const token = rawCode.match(/^([^_]+)_(.+)$/i);
  if (token) {
    const normalizedToken = token[2]
      .replace(/\s+(?:C|U|R|RR|RRR|AR|SR|SAR|UR|CHR|CSR|K|A)$/i, "")
      .trim()
      .toLowerCase();
    return {
      key: `${groupCode}::${token[1].toLowerCase()}::${normalizedToken}`,
      actualSetCode: token[1],
      printedNumber: normalizedToken,
      parsed: false,
    };
  }

  return {
    key: `${groupCode}::raw::${rawCode.toLowerCase() || cardIndex}`,
    actualSetCode: groupCode,
    printedNumber: rawCode || String(cardIndex),
    parsed: false,
  };
}

async function buildAudit() {
  const [base, legacy] = await Promise.all([
    readFile(path.join(root, "data", "series.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "data", "series-legacy.json"), "utf8").then(JSON.parse),
  ]);
  const groups = mergeGroups(base, legacy);
  const sets = [];
  let rawCardCount = 0;
  let canonicalSlotCount = 0;
  let duplicateNormalizedSlotCount = 0;
  let extraRecordCount = 0;

  for (const group of groups) {
    const cards = Array.isArray(group?.cards) ? group.cards : [];
    const bySlot = new Map();
    cards.forEach((card, index) => {
      const slot = printedSlot(group, card, index);
      if (!bySlot.has(slot.key)) bySlot.set(slot.key, { ...slot, records: [] });
      bySlot.get(slot.key).records.push({
        code: clean(card?.code),
        name: clean(card?.name || card?.pokemonName),
        rarity: clean(card?.rarity),
        image: clean(card?.image),
      });
    });

    const duplicates = [...bySlot.values()]
      .filter((slot) => slot.records.length > 1)
      .map((slot) => ({
        actualSetCode: slot.actualSetCode,
        printedNumber: slot.printedNumber,
        recordCount: slot.records.length,
        records: slot.records,
      }));

    rawCardCount += cards.length;
    canonicalSlotCount += bySlot.size;
    duplicateNormalizedSlotCount += duplicates.length;
    extraRecordCount += cards.length - bySlot.size;

    const slots = [...bySlot.values()]
      .map((slot) => ({
        actualSetCode: slot.actualSetCode,
        printedNumber: slot.printedNumber,
      }))
      .sort((left, right) => {
        const codeCompare = left.actualSetCode.localeCompare(
          right.actualSetCode,
          undefined,
          { sensitivity: "base" },
        );
        if (codeCompare) return codeCompare;
        const leftNumber = Number(left.printedNumber);
        const rightNumber = Number(right.printedNumber);
        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
          return leftNumber - rightNumber;
        }
        return left.printedNumber.localeCompare(right.printedNumber);
      });

    sets.push({
      era: inferEra(group),
      code: clean(group?.code),
      title: clean(group?.title),
      rawCardCount: cards.length,
      canonicalSlotCount: bySlot.size,
      duplicateSlotCount: duplicates.length,
      extraRecordCount: cards.length - bySlot.size,
      slots,
      duplicates,
    });
  }

  return {
    schemaVersion: 1,
    purpose:
      "Normalize the Korean series catalog to one canonical slot per Korean set + printed card number before print variants are attached.",
    sourceFiles: ["data/series.json", "data/series-legacy.json"],
    summary: {
      setCount: sets.length,
      rawCardCount,
      canonicalSlotCount,
      duplicateNormalizedSlotCount,
      extraRecordCount,
    },
    eras: [...new Set(sets.map((set) => set.era))].map((era) => {
      const eraSets = sets.filter((set) => set.era === era);
      return {
        era,
        setCount: eraSets.length,
        rawCardCount: eraSets.reduce((sum, set) => sum + set.rawCardCount, 0),
        canonicalSlotCount: eraSets.reduce(
          (sum, set) => sum + set.canonicalSlotCount,
          0,
        ),
        duplicateSlotCount: eraSets.reduce(
          (sum, set) => sum + set.duplicateSlotCount,
          0,
        ),
        extraRecordCount: eraSets.reduce(
          (sum, set) => sum + set.extraRecordCount,
          0,
        ),
      };
    }),
    sets,
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
    console.error("Series canonical slot audit is out of sync.");
    console.error("Run: node scripts/audit-series-canonical-slots.mjs");
    process.exit(1);
  }
  console.log(
    `Canonical slot audit synchronized: ${audit.summary.rawCardCount} records -> ${audit.summary.canonicalSlotCount} slots.`,
  );
} else {
  await writeFile(outputPath, expected);
  console.log(
    `Wrote canonical slot audit: ${audit.summary.rawCardCount} records -> ${audit.summary.canonicalSlotCount} slots; ${audit.summary.extraRecordCount} extra records grouped.`,
  );
}
