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

function normalizeSetCode(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9+]/g, "");
}

function normalizedCardNumerator(value) {
  const text = clean(value).replace(/\s+/g, "");
  const slash =
    text.match(/(?:^|[_:-])0*(\d{1,4})\/\d{1,4}/i) ||
    text.match(/^0*(\d{1,4})\/\d{1,4}/);
  if (slash) return String(Number(slash[1]));

  const separated = text.match(/(?:_|-)(0*\d{1,4})(?:\D|$)/i);
  if (separated) return String(Number(separated[1]));

  const leading = text.match(/^0*(\d{1,4})(?:\D|$)/);
  return leading ? String(Number(leading[1])) : "";
}

function fingerprint(setCode, cardNumberValue) {
  const set = normalizeSetCode(setCode);
  const number = normalizedCardNumerator(cardNumberValue);
  return set && number ? `${set}::${number}` : "";
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

function metadataEntry(map, setCode, cardNumberValue) {
  const key = fingerprint(setCode, cardNumberValue);
  if (!key) return null;
  if (!map.has(key)) {
    map.set(key, {
      illustrators: new Set(),
      trainers: new Set(),
      rarities: new Set(),
    });
  }
  return map.get(key);
}

function buildMetadata(artistsPayload, trainerPayload) {
  const map = new Map();

  for (const artist of artistsPayload?.artists || []) {
    const artistName = clean(artist?.name);
    for (const card of artist?.cards || []) {
      const entry = metadataEntry(map, card?.set, card?.cardNumber || card?.code || card?.meta);
      if (!entry) continue;
      if (artistName) entry.illustrators.add(artistName);
      if (clean(card?.rarity)) entry.rarities.add(clean(card.rarity));
    }
  }

  for (const group of trainerPayload?.groups || []) {
    for (const card of group?.cards || []) {
      const entry = metadataEntry(
        map,
        card?.set || card?.setCode,
        card?.cardNumber || card?.code || card?.meta,
      );
      if (!entry) continue;
      const trainer = clean(card?.personName);
      if (trainer && trainer !== "그 외") entry.trainers.add(trainer);
      if (clean(card?.illustrator)) entry.illustrators.add(clean(card.illustrator));
      if (clean(card?.rarity)) entry.rarities.add(clean(card.rarity));
    }
  }

  return map;
}

function compactCard(card, group, metadata) {
  const entry = metadata.get(
    fingerprint(
      group?.code || group?.name,
      card?.cardNumber || card?.code || card?.meta,
    ),
  );
  const rarity =
    clean(card?.rarity) ||
    (entry?.rarities?.size === 1 ? [...entry.rarities][0] : [...(entry?.rarities || [])].join("|"));
  const illustrators = [...(entry?.illustrators || [])].sort().join("|");
  const trainers = [...(entry?.trainers || [])].sort().join("|");

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
    rarity,
    illustrators,
    trainers,
  ];
}

async function generate() {
  const [seriesRaw, legacyRaw, pokedexRaw, artistsRaw, trainerRaw] = await Promise.all([
    readFile(path.join(root, "data/series.json"), "utf8"),
    readFile(path.join(root, "data/series-legacy.json"), "utf8"),
    readFile(path.join(root, "data/pokedex.json"), "utf8"),
    readFile(path.join(root, "data/artists.json"), "utf8"),
    readFile(path.join(root, "data/trainer-pokemon.json"), "utf8"),
  ]);
  const groups = mergeGroups(JSON.parse(seriesRaw), JSON.parse(legacyRaw));
  const pokedex = JSON.parse(pokedexRaw);
  const metadata = buildMetadata(JSON.parse(artistsRaw), JSON.parse(trainerRaw));

  return `${JSON.stringify({
    version: 2,
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
      (group?.cards || []).map((card) => compactCard(card, group, metadata)),
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
    `Pokemon search index is synchronized (v${payload.version}, ${payload.groups.length} groups / ${cards} cards).`,
  );
} else if (current === expected) {
  console.log("Pokemon search index already synchronized.");
} else {
  await writeFile(OUTPUT, expected);
  console.log("Pokemon search index synchronized.");
}
