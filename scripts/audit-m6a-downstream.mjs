import fs from "node:fs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(new URL("../" + path, import.meta.url), "utf8"));
}
function clean(value) {
  return String(value || "").trim();
}
function basePokemonName(value) {
  return clean(value)
    .replace(/\s+(?:ex|VSTAR|VMAX|V|GX|EX)$/i, "")
    .trim();
}

const series = readJson("data/series.json");
const m6a = series.find((group) => clean(group.code).toLowerCase() === "m6a");
if (!m6a) throw new Error("M6a group not found");

const pokemonGroups = [
  ...readJson("data/pokemon-collections.json"),
  ...readJson("data/pokemon-collections-21-40.json"),
];
const pokemonNames = new Set(pokemonGroups.map((group) => clean(group.name)));

const fossil = readJson("data/fossil.json");
const fossilPokemonNames = new Set(
  fossil.groups.flatMap((group) =>
    group.cards
      .filter((card) => card.category === "화석 포켓몬")
      .map((card) => clean(card.name)),
  ),
);

const trainer = readJson("data/trainer-pokemon.json");
const trainerPokemonNames = new Set(
  trainer.groups.map((group) => clean(group.name)),
);

const cards = m6a.cards.map((card) => ({
  code: clean(card.code),
  name: clean(card.name || card.pokemonName),
  baseName: basePokemonName(card.name || card.pokemonName),
  rarity: clean(card.rarity),
  image: clean(card.image),
  source: clean(card.source),
  order: Number(card.order || 0),
}));

const summary = {
  set: {
    code: m6a.code,
    title: m6a.title,
    cardCount: cards.length,
  },
  ar: cards.filter((card) => card.rarity === "AR"),
  sar: cards.filter((card) => card.rarity === "SAR"),
  pokemonCollectionMatches: cards.filter((card) => pokemonNames.has(card.baseName)),
  fossilPokemonMatches: cards.filter((card) => fossilPokemonNames.has(card.baseName)),
  trainerPokemonNameCandidates: cards.filter((card) => trainerPokemonNames.has(card.baseName)),
  baseCards: cards.filter((card) => /^m6a_\d{3}\/103$/i.test(card.code) && card.order <= 103),
};

console.log("M6A_AUDIT_JSON=" + JSON.stringify(summary));
