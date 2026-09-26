import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data", "series-inventory-audit.json");
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

function hostOf(value) {
  const match = clean(value).match(/^https?:\/\/([^/]+)/i);
  return match ? match[1].toLowerCase() : "";
}

function increment(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function summarizeSet(group) {
  const cards = Array.isArray(group?.cards) ? group.cards : [];
  const missing = {
    code: 0,
    name: 0,
    label: 0,
    image: 0,
    source: 0,
    rarity: 0,
    illustrator: 0,
  };
  let pokemonNameFallback = 0;

  for (const card of cards) {
    const name = clean(card?.name);
    const pokemonName = clean(card?.pokemonName);
    if (!clean(card?.code)) missing.code += 1;
    if (!name) missing.name += 1;
    if (!name && !pokemonName) missing.label += 1;
    if (!name && pokemonName) pokemonNameFallback += 1;
    if (!clean(card?.image)) missing.image += 1;
    if (!clean(card?.source)) missing.source += 1;
    if (!clean(card?.rarity)) missing.rarity += 1;
    if (!clean(card?.illustrator)) missing.illustrator += 1;
  }

  return {
    era: inferEra(group),
    code: clean(group?.code),
    title: clean(group?.title),
    displayName: clean(group?.displayName),
    cardCount: cards.length,
    firstCardCode: clean(cards[0]?.code),
    lastCardCode: clean(cards.at(-1)?.code),
    pokemonNameFallback,
    missing,
  };
}

async function buildAudit() {
  const [base, legacy] = await Promise.all([
    readFile(path.join(root, "data", "series.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "data", "series-legacy.json"), "utf8").then(JSON.parse),
  ]);

  const merged = mergeGroups(base, legacy);
  const sets = merged.map(summarizeSet);
  const duplicateSetCodes = [];
  const setSeen = new Set();
  const cardSeen = new Map();
  const duplicateCardIdentities = [];
  const imageHosts = {};
  const sourceHosts = {};
  const metadata = {
    missingCode: 0,
    missingName: 0,
    missingLabel: 0,
    missingImage: 0,
    missingSource: 0,
    missingRarity: 0,
    missingIllustrator: 0,
    pokemonNameFallback: 0,
  };

  for (const group of merged) {
    const setKey = clean(group?.code).toLowerCase();
    if (setSeen.has(setKey)) duplicateSetCodes.push(clean(group?.code));
    setSeen.add(setKey);

    for (const card of Array.isArray(group?.cards) ? group.cards : []) {
      const cardKey = `${setKey}::${clean(card?.code).toLowerCase()}`;
      cardSeen.set(cardKey, (cardSeen.get(cardKey) || 0) + 1);
      const imageHost = hostOf(card?.image);
      const sourceHost = hostOf(card?.source);
      increment(imageHosts, imageHost || "(missing)");
      increment(sourceHosts, sourceHost || "(missing)");

      const name = clean(card?.name);
      const pokemonName = clean(card?.pokemonName);
      if (!clean(card?.code)) metadata.missingCode += 1;
      if (!name) metadata.missingName += 1;
      if (!name && !pokemonName) metadata.missingLabel += 1;
      if (!name && pokemonName) metadata.pokemonNameFallback += 1;
      if (!clean(card?.image)) metadata.missingImage += 1;
      if (!clean(card?.source)) metadata.missingSource += 1;
      if (!clean(card?.rarity)) metadata.missingRarity += 1;
      if (!clean(card?.illustrator)) metadata.missingIllustrator += 1;
    }
  }

  for (const [identity, count] of cardSeen) {
    if (count > 1) duplicateCardIdentities.push({ identity, count });
  }

  const eraOrder = ["ORIGIN", "ADV", "DP", "BW", "XY", "SM", "S", "SV", "M", "UNKNOWN"];
  const eras = eraOrder
    .map((era) => {
      const eraSets = sets.filter((set) => set.era === era);
      if (!eraSets.length) return null;
      return {
        era,
        setCount: eraSets.length,
        cardCount: eraSets.reduce((sum, set) => sum + set.cardCount, 0),
        missingName: eraSets.reduce((sum, set) => sum + set.missing.name, 0),
        missingLabel: eraSets.reduce((sum, set) => sum + set.missing.label, 0),
        missingSource: eraSets.reduce((sum, set) => sum + set.missing.source, 0),
        missingRarity: eraSets.reduce((sum, set) => sum + set.missing.rarity, 0),
        missingIllustrator: eraSets.reduce(
          (sum, set) => sum + set.missing.illustrator,
          0,
        ),
      };
    })
    .filter(Boolean);

  return {
    schemaVersion: 1,
    sourceFiles: ["data/series.json", "data/series-legacy.json"],
    mergeRule:
      "Group code is matched case-insensitively; a legacy group replaces the same base group, otherwise it is appended.",
    cardIdentityRule: "lowercase(set code) + '::' + lowercase(card code)",
    summary: {
      setCount: sets.length,
      cardCount: sets.reduce((sum, set) => sum + set.cardCount, 0),
      duplicateSetCodeCount: duplicateSetCodes.length,
      duplicateCardIdentityCount: duplicateCardIdentities.length,
      metadata,
    },
    eras,
    imageHosts: Object.fromEntries(
      Object.entries(imageHosts).sort(([a], [b]) => a.localeCompare(b)),
    ),
    sourceHosts: Object.fromEntries(
      Object.entries(sourceHosts).sort(([a], [b]) => a.localeCompare(b)),
    ),
    duplicateSetCodes,
    duplicateCardIdentities,
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
    console.error("Series inventory audit is out of sync.");
    console.error("Run: npm run series-inventory:sync");
    process.exit(1);
  }
  console.log(
    `Series inventory audit is synchronized: ${audit.summary.setCount} sets / ${audit.summary.cardCount} cards.`,
  );
} else {
  await writeFile(outputPath, expected);
  console.log(
    `Wrote series inventory audit: ${audit.summary.setCount} sets / ${audit.summary.cardCount} cards.`,
  );
}
