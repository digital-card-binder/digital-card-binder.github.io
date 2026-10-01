import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const targetPath = path.join(root, "core/catalog/catalog-service.js");
const startMarker = "  // <catalog-metrics-generated>";
const endMarker = "  // </catalog-metrics-generated>";

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function clean(value) {
  return String(value ?? "").trim().toLowerCase();
}

function asGroups(payload, preferredKey = "") {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (preferredKey && Array.isArray(payload[preferredKey])) return payload[preferredKey];
  for (const key of ["groups", "artists"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function mergeGroups(basePayload, supplementPayload, key) {
  const merged = [...asGroups(basePayload)];
  const indexByKey = new Map(
    merged.map((group, index) => [clean(group?.[key]), index]),
  );
  for (const extra of asGroups(supplementPayload)) {
    const groupKey = clean(extra?.[key]);
    if (!groupKey) continue;
    if (indexByKey.has(groupKey)) {
      merged[indexByKey.get(groupKey)] = extra;
    } else {
      indexByKey.set(groupKey, merged.length);
      merged.push(extra);
    }
  }
  return merged;
}

function countCards(groups) {
  return asGroups(groups).reduce(
    (total, group) => total + (Array.isArray(group?.cards) ? group.cards.length : 0),
    0,
  );
}

function countPopulatedGroups(groups) {
  return asGroups(groups).filter(
    (group) => Array.isArray(group?.cards) && group.cards.length > 0,
  ).length;
}

async function buildMetrics() {
  const [
    pokedex,
    artists,
    seriesBase,
    seriesLegacy,
    pokemonBase,
    pokemonSupplement,
    arBase,
    arSupplement,
    people,
    trainerPokemon,
    fossil,
    world,
    promos,
    packsSource,
  ] = await Promise.all([
    readJson("data/pokedex.json"),
    readJson("data/artists.json"),
    readJson("data/series.json"),
    readJson("data/series-legacy.json"),
    readJson("data/pokemon-collections.json"),
    readJson("data/pokemon-collections-21-40.json"),
    readJson("data/ar.json"),
    readJson("data/ar-supplement.json"),
    readJson("data/people.json"),
    readJson("data/trainer-pokemon.json"),
    readJson("data/fossil.json"),
    readJson("data/world-exploration.json"),
    readJson("data/promo-packs.json"),
    readFile(path.join(root, "packs.js"), "utf8"),
  ]);

  const series = mergeGroups(seriesBase, seriesLegacy, "code");
  const pokemon = mergeGroups(pokemonBase, pokemonSupplement, "name");
  const ar = mergeGroups(arBase, arSupplement, "code");
  const artistGroups = Array.isArray(artists?.artists) ? artists.artists : [];
  const trainerGroups = Array.isArray(trainerPokemon?.groups) ? trainerPokemon.groups : [];
  const fossilGroups = Array.isArray(fossil?.groups) ? fossil.groups : [];
  const worldGenerations = Array.isArray(world?.generations) ? world.generations : [];
  const worldItems = worldGenerations.reduce(
    (total, generation) =>
      total +
      (Array.isArray(generation?.slots) ? generation.slots.length : 0) +
      (Array.isArray(generation?.pokemonRefs) ? generation.pokemonRefs.length : 0) +
      (Array.isArray(generation?.peopleRefs) ? generation.peopleRefs.length : 0),
    0,
  );

  const regularPacks = [
    ...packsSource.matchAll(/\["([^"]+)","([^"]+)","([^"]+)",([01])\]/g),
  ];
  const promoPacks = Array.isArray(promos)
    ? promos
    : [
        ...(Array.isArray(promos?.packs) ? promos.packs : []),
        ...(Array.isArray(promos?.cards) ? promos.cards : []),
      ];
  const promoPackCount = Array.isArray(promos?.packs) ? promos.packs.length : promoPacks.length;
  const promoCardCount = Array.isArray(promos?.cards) ? promos.cards.length : 0;

  return {
    national: {
      itemCount: Array.isArray(pokedex?.records) ? pokedex.records.length : 0,
      groupCount: Array.isArray(pokedex?.generations) ? pokedex.generations.length : 0,
      unit: "종",
    },
    series: {
      itemCount: countCards(series),
      groupCount: series.length,
      unit: "장",
    },
    ar: {
      itemCount: countCards(ar),
      groupCount: countPopulatedGroups(ar),
      unit: "장",
    },
    pack: {
      itemCount: regularPacks.length,
      groupCount: new Set(regularPacks.map((match) => match[1])).size,
      unit: "팩",
      promoItemCount: promoPacks.length,
      promoPackCount,
      promoCardCount,
    },
    pokemon: {
      itemCount: countCards(pokemon),
      groupCount: pokemon.length,
      unit: "장",
    },
    artist: {
      itemCount: countCards(artistGroups),
      groupCount: artistGroups.length,
      unit: "장",
    },
    people: {
      itemCount: Array.isArray(people?.people) ? people.people.length : 0,
      groupCount: Array.isArray(people?.generations) ? people.generations.length : 0,
      unit: "명",
    },
    trainerPokemon: {
      itemCount: countCards(trainerGroups),
      groupCount: trainerGroups.length,
      unit: "장",
    },
    fossil: {
      itemCount: countCards(fossilGroups),
      groupCount: fossilGroups.length,
      unit: "장",
    },
    world: {
      itemCount: worldItems,
      groupCount: worldGenerations.length,
      unit: "장",
    },
  };
}

function renderBlock(metrics) {
  const json = JSON.stringify(metrics, null, 2)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join("\n");
  return [
    startMarker,
    `  const CATALOG_METRICS = Object.freeze(${json});`,
    endMarker,
  ].join("\n");
}

async function main() {
  const metrics = await buildMetrics();
  for (const [key, metric] of Object.entries(metrics)) {
    if (!Number.isInteger(metric.itemCount) || metric.itemCount < 0) {
      throw new Error(`${key}: invalid item count`);
    }
    if (!Number.isInteger(metric.groupCount) || metric.groupCount < 0) {
      throw new Error(`${key}: invalid group count`);
    }
  }

  const source = await readFile(targetPath, "utf8");
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end < start) {
    throw new Error("catalog-service.js is missing generated catalog metric markers");
  }

  const expected = renderBlock(metrics);
  const current = source.slice(start, end + endMarker.length);
  if (current === expected) {
    console.log("Catalog metrics are synchronized.");
    return;
  }

  if (checkOnly) {
    console.error("Catalog metrics are out of sync.");
    console.error("Run: npm run catalog-metrics:sync");
    process.exit(1);
  }

  const next =
    source.slice(0, start) +
    expected +
    source.slice(end + endMarker.length);
  await writeFile(targetPath, next);
  console.log("Synchronized catalog metrics from canonical catalog data.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
