import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const pokedex = read("../data/pokedex.json");
const series = read("../data/series.json");
const relatedDexIndex = read("../data/card-related-dex-index.json");
const audit = read("../data/audits/national-dex-image-review.json");
const cards = series.flatMap((set) => set.cards || []);
const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

test("national dex keeps all 1,025 unique Pokemon records", () => {
  assert.equal(pokedex.records.length, 1025);
  assert.equal(new Set(pokedex.records.map((record) => record.number)).size, 1025);
});

test("corrected representative images match Korean Pokemon card catalog entries", () => {
  assert.equal(audit.corrections.length, 18);
  for (const correction of audit.corrections) {
    const record = pokedex.records.find((item) => item.number === correction.number);
    const card = cards.find((item) => item.code === correction.cardCode);
    assert.ok(record, `missing #${correction.number}`);
    assert.ok(card, `missing card ${correction.cardCode}`);
    assert.equal(new URL(record.imageUrl).pathname, new URL(card.image).pathname, `image mismatch for #${correction.number}`);
    assert.ok(normalize(card.name).includes(normalize(record.nameKo)), `title mismatch for #${correction.number}`);
    assert.match(card.image, /^https:\/\/cards\.image\.pokemonkorea\.co\.kr\//);
  }
});

test("Guzzlord no longer points to the Tag Switch Trainer card", () => {
  const guzzlord = pokedex.records.find((record) => record.number === 799);
  assert.equal(guzzlord.imageUrl, "https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM6/SM6_056.png");
  assert.doesNotMatch(guzzlord.imageUrl, /SM10a_046/);
});

test("national dex uses the official Korean name for Sandy Shocks", () => {
  const pokemon = pokedex.records.find((record) => record.number === 989);
  assert.equal(pokemon.nameKo, "모래털가죽");
  assert.ok(audit.corrections.some((item) => item.number === 989 && item.previousNameKo === "모래털가족"));
});

test("national card links use printed set and card numbers from the representative image", () => {
  assert.ok(relatedDexIndex.entries["sm6::56"].some(([collection, key]) => collection === "national" && key === "799"));
  assert.ok(relatedDexIndex.entries["sm10::19"].some(([collection, key]) => collection === "national" && key === "806"));
  assert.equal(Boolean(relatedDexIndex.entries["sm6::799"]?.some(([collection]) => collection === "national")), false);
});
