import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const data = JSON.parse(await readFile(new URL("../data/trainer-pokemon.json", import.meta.url), "utf8"));
test("people and Pokemon dex is grouped by National Dex", () => {
  const cards = data.groups.flatMap((group) => group.cards || []);
  assert.equal(data.title, "사람과 포켓몬 도감");
  assert.equal(data.grouping, "pokemon-national-dex");
  assert.equal(cards.length, 6);
  assert.deepEqual(data.groups.map((g) => g.nationalDexNo), [54,131,157,445,644,820]);
  assert.equal(cards.every((c) => c.owned === false), true);
  assert.equal(new Set(cards.map((c) => c.code)).size, 6);
  for (const group of data.groups) for (const card of group.cards) {
    assert.equal(card.pokemonName, group.name);
    assert.ok(card.personName);
    assert.ok(["named","other"].includes(card.personType));
    assert.match(card.image, /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\//);
    assert.match(card.source, /^https:\/\/pokemoncard[.]co[.]kr\/cards\/detail\//);
  }
});
