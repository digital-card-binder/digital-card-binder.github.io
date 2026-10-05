import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "data/card-related-dex-index.json");
const checkOnly = process.argv.includes("--check");

const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));

const clean = (value) => String(value ?? "").trim();

function normalizedSet(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9+\-]/g, "");
}

function cardNumerator(value) {
  const text = clean(value).replace(/\s+/g, "");
  const slash =
    text.match(/(?:^|[_:\-])0*(\d{1,4})\/\d{1,4}/i) ||
    text.match(/^0*(\d{1,4})\/\d{1,4}/);
  if (slash) return String(Number(slash[1]));

  const separated = text.match(/(?:_|-)0*(\d{1,4})(?:\D|$)/i);
  if (separated) return String(Number(separated[1]));

  const leading = text.match(/^0*(\d{1,4})(?:\D|$)/);
  return leading ? String(Number(leading[1])) : "";
}

function setFromMeta(value) {
  const chunks = clean(value)
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chunks.length < 2) return "";
  const candidate = chunks[chunks.length - 1];
  return /[a-z]/i.test(candidate) && !/\s/.test(candidate)
    ? candidate
    : "";
}

function setFromImage(imageUrl) {
  const value = clean(imageUrl).split(/[?#]/, 1)[0];
  if (!value) return "";
  const match = value.match(
    /\/wmimages\/(?:SV|SM|S|MEGA|M|XY|BW|DP|ADV)\/([^/]+)\/([^/]+)$/i,
  );
  if (!match) return "";
  const folder = match[1] || "";
  const filename = match[2] || "";
  const fileSet = filename.match(/^([^_]+)_\d+/i)?.[1] || "";
  if (
    fileSet &&
    folder &&
    fileSet.toLowerCase().startsWith(folder.toLowerCase())
  ) {
    return fileSet;
  }
  return folder || fileSet;
}

function looksLikeSetCode(value) {
  const text = clean(value);
  if (!text || /\s/.test(text) || text.length > 18) return false;
  if (/^BS20\d{5,}$/i.test(text)) return false;
  return /[a-z]/i.test(text) && /\d|[-+]/.test(text);
}

function cardReference(card = {}, context = {}) {
  const image =
    context.image ||
    card.image ||
    card.imageUrl ||
    card.imageLarge ||
    card.originalImage ||
    card.actualImage ||
    "";
  const directCandidates = [
    context.setCode,
    card.set,
    setFromMeta(card.meta || card.code),
    card.setCode,
    card.actualSetCode,
  ];
  let setCode = directCandidates.find(looksLikeSetCode) || "";
  if (!setCode) setCode = setFromImage(image);

  const number =
    context.cardNumber ||
    card.cardNumber ||
    card.number ||
    card.actualCardNumber ||
    card.code ||
    card.meta ||
    image;

  const set = normalizedSet(setCode);
  const numerator = cardNumerator(number);
  return set && numerator ? `${set}::${numerator}` : "";
}

function mergeGroups(baseGroups, supplementGroups, key) {
  const merged = [...(Array.isArray(baseGroups) ? baseGroups : [])];
  for (const extra of Array.isArray(supplementGroups) ? supplementGroups : []) {
    const value = clean(extra?.[key]).toLowerCase();
    if (!value) continue;
    const index = merged.findIndex(
      (group) => clean(group?.[key]).toLowerCase() === value,
    );
    if (index >= 0) merged[index] = extra;
    else merged.push(extra);
  }
  return merged;
}

const index = new Map();

function add(card, collectionId, groupKey, groupLabel, context = {}) {
  const fingerprint = cardReference(card, context);
  if (!fingerprint) return;
  const row = [
    collectionId,
    clean(groupKey),
    clean(groupLabel || groupKey),
  ];
  if (!index.has(fingerprint)) index.set(fingerprint, []);
  const rows = index.get(fingerprint);
  if (!rows.some((item) => item[0] === row[0] && item[1] === row[1])) {
    rows.push(row);
  }
}

const pokemonGroups = mergeGroups(
  readJson("data/pokemon-collections.json"),
  readJson("data/pokemon-collections-21-40.json"),
  "name",
);
for (const group of pokemonGroups) {
  for (const card of group.cards || []) {
    add(card, "pokemon", group.name, group.name, {
      setCode: setFromMeta(card.meta),
    });
  }
}

const arGroups = mergeGroups(
  readJson("data/ar.json"),
  readJson("data/ar-supplement.json"),
  "code",
);
for (const group of arGroups) {
  for (const card of group.cards || []) {
    add(card, "ar", group.code, group.title || group.code, {
      setCode: group.code,
    });
  }
}

const artists = readJson("data/artists.json");
for (const artist of artists.artists || []) {
  for (const card of artist.cards || []) {
    add(card, "artist", artist.name, artist.name);
  }
}

const people = readJson("data/people.json");
for (const person of people.people || []) {
  for (const card of person.cards || []) {
    add(
      card,
      "people",
      person.id,
      person.nameKo || person.nameEn || person.id,
    );
  }
}

const trainer = readJson("data/trainer-pokemon.json");
for (const group of trainer.groups || []) {
  for (const card of group.cards || []) {
    add(card, "trainerPokemon", group.name, group.name);
  }
}

const fossil = readJson("data/fossil.json");
for (const group of fossil.groups || []) {
  for (const card of group.cards || []) {
    add(
      card,
      "fossil",
      group.code,
      group.name || group.set || group.code,
    );
  }
}

const themes = readJson("data/art-themes.json");
for (const group of themes.groups || []) {
  for (const card of group.cards || []) {
    add(card, "artThemes", group.code, group.name);
  }
}

const pokedex = readJson("data/pokedex.json");
for (const record of pokedex.records || []) {
  add(
    record,
    "national",
    record.number,
    record.nameKo || record.nameEn || `#${record.number}`,
  );
}

const world = readJson("data/world-exploration.json");
const pokemonByNumber = new Map(
  (pokedex.records || []).map((record) => [Number(record.number), record]),
);
const peopleById = new Map(
  (people.people || []).map((person) => [person.id, person]),
);

for (const generation of world.generations || []) {
  const groupLabel = `${generation.generation}세대 ${generation.region || ""}`.trim();

  for (const slot of generation.slots || []) {
    add(slot.card || {}, "world", generation.generation, groupLabel);
  }

  for (const number of generation.pokemonRefs || []) {
    const record = pokemonByNumber.get(Number(number));
    if (record) {
      add(record, "world", generation.generation, groupLabel);
    }
  }

  for (const personId of generation.peopleRefs || []) {
    const person = peopleById.get(personId);
    const card = person?.cards?.[0] || person || {};
    add(card, "world", generation.generation, groupLabel);
  }
}

const order = [
  "ar",
  "pokemon",
  "artist",
  "people",
  "trainerPokemon",
  "fossil",
  "world",
  "artThemes",
  "national",
];
const orderIndex = new Map(order.map((value, index) => [value, index]));

const entries = {};
for (const fingerprint of [...index.keys()].sort((a, b) => a.localeCompare(b, "en"))) {
  entries[fingerprint] = index
    .get(fingerprint)
    .sort((left, right) => {
      const collectionDiff =
        (orderIndex.get(left[0]) ?? 99) - (orderIndex.get(right[0]) ?? 99);
      if (collectionDiff) return collectionDiff;
      return left[2].localeCompare(right[2], "ko");
    });
}

const output = {
  schemaVersion: 1,
  key: "normalized-set::card-numerator",
  entries,
};
const serialized = JSON.stringify(output, null, 2) + "\n";

if (checkOnly) {
  if (!existsSync(outputPath)) {
    console.error("Related dex index is missing");
    process.exit(1);
  }
  const current = readFileSync(outputPath, "utf8");
  if (current !== serialized) {
    console.error("Related dex index is out of date");
    process.exit(1);
  }
  console.log("Related dex index is current");
} else {
  writeFileSync(outputPath, serialized, "utf8");
  console.log(
    `Related dex index synchronized: ${Object.keys(entries).length} physical cards`,
  );
}
