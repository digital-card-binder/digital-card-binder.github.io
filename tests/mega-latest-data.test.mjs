import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

function loadMegaLatest() {
  const source = fs.readFileSync(new URL("../mega-latest.js", import.meta.url), "utf8");
  const window = {};
  vm.runInNewContext(source, { window, Set, Object, String });
  return window.PokemonDexMegaLatest;
}

test("M6 Storm Emeralda contains all 113 numbered cards", () => {
  const supplement = loadMegaLatest();
  const m6 = supplement.groups.find((group) => group.code === "m6");
  assert.ok(m6);
  assert.equal(m6.era, "M");
  assert.equal(m6.cards.length, 113);
  assert.equal(m6.cards[0].code, "m6_001/076");
  assert.equal(m6.cards.at(-1).code, "m6_113/076");
  assert.equal(new Set(m6.cards.map((card) => card.code)).size, 113);
  assert.equal(m6.cards.filter((card) => card.rarity === "AR").length, 12);
  assert.equal(m6.cards.filter((card) => card.rarity === "SR").length, 18);
  assert.equal(m6.cards.filter((card) => card.rarity === "SAR").length, 6);
  assert.equal(m6.cards.filter((card) => card.rarity === "MUR").length, 1);
  assert.ok(m6.cards.every((card) => card.name && card.image));
});

test("M5 title corrections include all base ex cards", () => {
  const supplement = loadMegaLatest();
  assert.equal(supplement.m5NameOverrides[26], "메가제라오라 ex");
  assert.equal(supplement.m5NameOverrides[36], "메가샹델라 ex");
  assert.equal(supplement.m5NameOverrides[46], "메가다크라이 ex");
  assert.equal(supplement.m5NameOverrides[63], "메가몰드류 ex");
});
