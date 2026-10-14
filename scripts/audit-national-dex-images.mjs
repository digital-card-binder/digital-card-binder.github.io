import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const records = read("data/pokedex.json").records;
const cards = read("data/series.json").flatMap((set) =>
  (set.cards || []).map((card) => ({ ...card, setCode: set.code })),
);

function imagePath(value) {
  try {
    return decodeURIComponent(new URL(value).pathname).toLowerCase();
  } catch {
    return "";
  }
}

function normalize(value) {
  return String(value || "").toLocaleLowerCase("ko-KR").replace(/[^a-z0-9가-힣]/g, "");
}

const cardsByPath = new Map();
for (const card of cards) {
  const path = imagePath(card.image);
  if (!path) continue;
  if (!cardsByPath.has(path)) cardsByPath.set(path, []);
  cardsByPath.get(path).push(card);
}

const withoutCatalogPath = [];
const missingCatalogTitles = [];
const titleMismatches = [];
const recordsByImage = new Map();
let exactPathMatches = 0;

for (const record of records) {
  const path = imagePath(record.imageUrl);
  if (!recordsByImage.has(path)) recordsByImage.set(path, []);
  recordsByImage.get(path).push(record.number);
  const matches = cardsByPath.get(path) || [];
  if (!matches.length) {
    withoutCatalogPath.push(record.number);
    continue;
  }
  exactPathMatches += 1;
  if (matches.some((card) => normalize(card.name).includes(normalize(record.nameKo)))) continue;
  const titles = matches.map((card) => card.name).filter(Boolean);
  const finding = { number: record.number, nameKo: record.nameKo, titles };
  if (titles.length) titleMismatches.push(finding);
  else missingCatalogTitles.push(finding);
}

const duplicateImagePaths = [...recordsByImage.entries()]
  .filter(([path, numbers]) => path && numbers.length > 1)
  .map(([path, numbers]) => ({ path, numbers }));

console.log(
  JSON.stringify(
    {
      totalPokemon: records.length,
      seriesCards: cards.length,
      exactPathMatches,
      withoutCatalogPath,
      missingCatalogTitles,
      titleMismatches,
      duplicateImagePaths,
      note: "Automated path and catalog-title triage only; it does not replace visual image verification.",
    },
    null,
    2,
  ),
);
