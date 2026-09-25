import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const OUTPUT = path.join(root, "data/series-inventory.json");
const ERA_ORDER = ["ORIGIN", "ADV", "DP", "BW", "XY", "SM", "S", "SV", "M", "UNKNOWN"];

function clean(value) {
  return String(value ?? "").trim();
}

function sha(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function mergeGroups(baseGroups, legacyGroups) {
  const merged = Array.isArray(baseGroups) ? [...baseGroups] : [];
  for (const extra of Array.isArray(legacyGroups) ? legacyGroups : []) {
    const key = clean(extra?.code).toLowerCase();
    if (!key) continue;
    const index = merged.findIndex(
      (group) => clean(group?.code).toLowerCase() === key,
    );
    if (index >= 0) merged[index] = extra;
    else merged.push(extra);
  }
  return merged;
}

function normalizedEra(group) {
  const explicit = clean(group?.era).toUpperCase();
  if (explicit) return explicit;
  const code = clean(group?.code).toLowerCase();
  if (code.startsWith("sv")) return "SV";
  if (code.startsWith("sm")) return "SM";
  if (code.startsWith("s")) return "S";
  if (code.startsWith("m")) return "M";
  return "UNKNOWN";
}

function host(value) {
  const url = clean(value);
  if (!url) return "(missing)";
  const match = url.match(/^https?:\/\/([^/]+)/i);
  return match ? match[1].toLowerCase() : "(invalid)";
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function sortedCounts(map) {
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
}

function seriesIdentity(group, card, groupIndex, cardIndex) {
  const groupId = clean(group?.code || group?.name || group?.title || groupIndex);
  const accountIndex = Number.isInteger(card?.accountIndex)
    ? card.accountIndex
    : cardIndex;
  return [
    groupId,
    card?.code || card?.meta || cardIndex,
    accountIndex,
  ].join("::");
}

function cardLabel(card, index) {
  return (
    clean(card?.code) ||
    clean(card?.cardNumber) ||
    clean(card?.meta) ||
    clean(card?.name) ||
    clean(card?.pokemonName) ||
    `#${index + 1}`
  );
}

async function generate() {
  const [baseRaw, legacyRaw] = await Promise.all([
    readFile(path.join(root, "data/series.json"), "utf8"),
    readFile(path.join(root, "data/series-legacy.json"), "utf8"),
  ]);
  const groups = mergeGroups(JSON.parse(baseRaw), JSON.parse(legacyRaw));

  const eraStats = new Map();
  const sourceHosts = new Map();
  const imageHosts = new Map();
  const completeness = {
    displayName: 0,
    name: 0,
    pokemonName: 0,
    image: 0,
    source: 0,
    rarity: 0,
    identity: 0,
  };
  let inferredEraGroups = 0;
  let totalCards = 0;
  let duplicateIdentities = 0;
  const catalogDigestRows = [];

  const inventoryGroups = groups.map((group, groupIndex) => {
    const cards = Array.isArray(group?.cards) ? group.cards : [];
    const era = normalizedEra(group);
    const explicitEra = clean(group?.era).toUpperCase();
    if (!explicitEra && era !== "UNKNOWN") inferredEraGroups += 1;

    if (!eraStats.has(era)) eraStats.set(era, { groups: 0, cards: 0 });
    const eraRow = eraStats.get(era);
    eraRow.groups += 1;
    eraRow.cards += cards.length;
    totalCards += cards.length;

    const identities = [];
    const metadataRows = [];
    const missing = {
      displayName: 0,
      image: 0,
      identity: 0,
      source: 0,
      rarity: 0,
    };

    cards.forEach((card, cardIndex) => {
      const identity = seriesIdentity(group, card, groupIndex, cardIndex);
      const displayName = clean(card?.name || card?.pokemonName);
      identities.push(identity);
      metadataRows.push([
        identity,
        clean(card?.code),
        clean(card?.name),
        clean(card?.pokemonName),
        clean(card?.cardNumber),
        clean(card?.meta),
        clean(card?.rarity),
        clean(card?.image),
        clean(card?.source),
      ]);

      if (displayName) completeness.displayName += 1;
      else missing.displayName += 1;
      if (clean(card?.name)) completeness.name += 1;
      if (clean(card?.pokemonName)) completeness.pokemonName += 1;
      if (clean(card?.image)) completeness.image += 1;
      else missing.image += 1;
      if (identity) completeness.identity += 1;
      else missing.identity += 1;
      if (clean(card?.source)) completeness.source += 1;
      else missing.source += 1;
      if (clean(card?.rarity)) completeness.rarity += 1;
      else missing.rarity += 1;

      increment(sourceHosts, host(card?.source));
      increment(imageHosts, host(card?.image));
    });

    const seen = new Set();
    const duplicates = new Set();
    identities.forEach((identity) => {
      if (seen.has(identity)) duplicates.add(identity);
      else seen.add(identity);
    });
    duplicateIdentities += duplicates.size;

    const digest = sha(JSON.stringify(metadataRows));
    catalogDigestRows.push([clean(group?.code), era, digest, cards.length]);

    return {
      code: clean(group?.code),
      era,
      sourceEra: explicitEra || null,
      eraInferred: !explicitEra && era !== "UNKNOWN",
      title: clean(group?.title),
      displayName: clean(group?.displayName),
      cards: cards.length,
      firstCard: cards.length ? cardLabel(cards[0], 0) : "",
      lastCard: cards.length ? cardLabel(cards.at(-1), cards.length - 1) : "",
      duplicateIdentities: duplicates.size,
      missing,
      digest,
    };
  });

  const eraSummary = ERA_ORDER
    .filter((era) => eraStats.has(era))
    .map((era) => ({ era, ...eraStats.get(era) }));

  return {
    schemaVersion: 1,
    generatedFrom: ["data/series.json", "data/series-legacy.json"],
    mergeRule: "series.json + series-legacy.json merged by case-insensitive set code; legacy replaces matching code",
    identityRule: "series card identity = group code :: card code/meta/index :: accountIndex/cardIndex",
    totals: {
      groups: groups.length,
      cards: totalCards,
      inferredEraGroups,
      duplicateIdentities,
    },
    eraSummary,
    completeness: {
      totalCards,
      ...completeness,
    },
    sourceHosts: sortedCounts(sourceHosts),
    imageHosts: sortedCounts(imageHosts),
    catalogDigest: sha(JSON.stringify(catalogDigestRows)),
    groups: inventoryGroups,
  };
}

const payload = await generate();
const expected = `${JSON.stringify(payload, null, 2)}\n`;
let current = "";
try {
  current = await readFile(OUTPUT, "utf8");
} catch {}

if (checkOnly) {
  if (current !== expected) {
    console.error("Series master inventory is out of sync.");
    console.error("Run: npm run series-inventory:sync");
    process.exit(1);
  }
  console.log(
    `Series master inventory is synchronized (${payload.totals.groups} groups / ${payload.totals.cards} cards).`,
  );
} else if (current === expected) {
  console.log("Series master inventory already synchronized.");
} else {
  await writeFile(OUTPUT, expected);
  console.log(
    `Series master inventory synchronized (${payload.totals.groups} groups / ${payload.totals.cards} cards).`,
  );
}
