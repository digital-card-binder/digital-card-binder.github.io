import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const OUTPUT = path.join(root, "data/pokemon-search-index.json");
const OFFICIAL_IMAGE_BASE = "https://cards.image.pokemonkorea.co.kr";

function clean(value) {
  return String(value ?? "").trim();
}

function mergeGroups(baseGroups, supplementGroups) {
  const merged = Array.isArray(baseGroups) ? [...baseGroups] : [];
  for (const extra of Array.isArray(supplementGroups) ? supplementGroups : []) {
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

function encodeImage(value) {
  const source = String(value || "");
  return source.startsWith(OFFICIAL_IMAGE_BASE)
    ? `@${source.slice(OFFICIAL_IMAGE_BASE.length)}`
    : source;
}

function compactCard(card) {
  return [
    card?.code || "",
    card?.name || "",
    card?.pokemonName || "",
    encodeImage(card?.image),
    card?.meta || "",
    card?.cardNumber || "",
    Number.isInteger(card?.accountIndex) ? card.accountIndex : null,
    card?.owned === true ? 1 : 0,
    card?.originalImage && card.originalImage !== card.image
      ? encodeImage(card.originalImage)
      : "",
  ];
}

async function generate() {
  const [seriesRaw, legacyRaw, pokedexRaw] = await Promise.all([
    readFile(path.join(root, "data/series.json"), "utf8"),
    readFile(path.join(root, "data/series-legacy.json"), "utf8"),
    readFile(path.join(root, "data/pokedex.json"), "utf8"),
  ]);
  const groups = mergeGroups(JSON.parse(seriesRaw), JSON.parse(legacyRaw));
  const pokedex = JSON.parse(pokedexRaw);
  return `${JSON.stringify({
    version: 1,
    imageBase: OFFICIAL_IMAGE_BASE,
    pokedex: (pokedex.records || []).map((record) => [
      record.number,
      record.nameKo,
      record.nameEn || "",
    ]),
    groups: groups.map((group) => [
      group?.code || group?.name || "",
      group?.title || "",
      group?.displayName || "",
      group?.era || "",
      (group?.cards || []).map(compactCard),
    ]),
  })}\n`;
}

const expected = await generate();
let current = "";
try {
  current = await readFile(OUTPUT, "utf8");
} catch {}

if (checkOnly) {
  if (current !== expected) {
    console.error("Pokemon search index is out of sync.");
    console.error("Run: npm run search-index:sync");
    process.exit(1);
  }
  const payload = JSON.parse(expected);
  const cards = payload.groups.reduce((total, group) => total + group[4].length, 0);
  console.log(
    `Pokemon search index is synchronized (${payload.groups.length} groups / ${cards} cards).`,
  );
} else if (current === expected) {
  console.log("Pokemon search index already synchronized.");
} else {
  await writeFile(OUTPUT, expected);
  console.log("Pokemon search index synchronized.");
}
