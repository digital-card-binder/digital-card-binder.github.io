import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(
  await readFile(new URL("../data/trainer-pokemon.json", import.meta.url), "utf8"),
);

test("trainer and Pokemon dex starts with verified Korean scene cards", () => {
  const cards = data.groups.flatMap((group) => group.cards || []);
  assert.equal(cards.length, 6);
  assert.equal(
    data.groups.some((group) => group.name === "그 외의 사람들"),
    true,
  );
  assert.equal(cards.every((card) => card.owned === false), true);
  assert.equal(new Set(cards.map((card) => card.code)).size, cards.length);

  for (const card of cards) {
    assert.match(
      card.image,
      /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\//,
    );
    assert.match(
      card.source,
      /^https:\/\/pokemoncard[.]co[.]kr\/cards\/detail\//,
    );
    assert.ok(card.trainer);
    assert.ok(card.pokemonName);
  }
});
