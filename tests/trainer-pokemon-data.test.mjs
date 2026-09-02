import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const data = JSON.parse(await readFile(new URL("../data/trainer-pokemon.json", import.meta.url), "utf8"));
test("trainer and Pokemon dex uses stable National Dex groups and verified Korean cards", () => {
  const cards = data.groups.flatMap((group) => group.cards || []);
  assert.equal(data.title, "트레이너와 포켓몬 도감");
  assert.equal(data.grouping, "pokemon-national-dex");
  assert.equal(data.catalogCount, cards.length);
  assert.ok(cards.length >= 120);
  assert.deepEqual(data.groups.map((g) => g.nationalDexNo), [...data.groups.map((g) => g.nationalDexNo)].sort((a,b) => a-b));
  assert.equal(cards.every((c) => c.owned === false), true);
  assert.equal(new Set(cards.map((c) => c.code.toLowerCase())).size, cards.length);
  for (const group of data.groups) for (const [index, card] of (group.cards || []).entries()) {
    assert.equal(card.pokemonName, group.name);
    assert.ok(card.personName);
    assert.ok(["named","other"].includes(card.personType));
    assert.equal(Number.isInteger(card.accountIndex), true);
    assert.equal(card.accountIndex, index);
    assert.match(card.image, /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\//);
    assert.match(card.source, /^https:\/\/pokemoncard[.]co[.]kr\/cards(?:\/detail\/.*)?$/);
  }
  const byCode = new Map(cards.map((c) => [c.code.toLowerCase(), c]));
  assert.equal(byCode.get("sv9_109/100")?.personName, "N");
  assert.equal(byCode.get("m2a_206/193")?.personName, "비주기");
  assert.equal(byCode.get("m2a_245/193")?.personName, "성호");
  assert.equal(byCode.has("m1l_030/063"), false);
});
