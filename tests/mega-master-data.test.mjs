import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const norm = (value) => String(value ?? "").trim().toLowerCase();

async function mergedSeries() {
  const [base, legacy] = await Promise.all([
    read("data/series.json").then(JSON.parse),
    read("data/series-legacy.json").then(JSON.parse),
  ]);
  const merged = [...base];
  for (const group of legacy) {
    const index = merged.findIndex((item) => norm(item.code) === norm(group.code));
    if (index >= 0) merged[index] = group;
    else merged.push(group);
  }
  return merged;
}

test("MC Korean numbering uses official 767-774 energy slots", async () => {
  const groups = await mergedSeries();
  const mc = groups.find((group) => norm(group.code) === "mc");
  assert.ok(mc);

  const expectedNames = [
    "기본 풀 에너지",
    "기본 불꽃 에너지",
    "기본 물 에너지",
    "기본 번개 에너지",
    "기본 초 에너지",
    "기본 격투 에너지",
    "기본 악 에너지",
    "기본 강철 에너지",
  ];

  for (let index = 0; index < expectedNames.length; index += 1) {
    const oldCode = `mc_${1000 + index}/742`;
    const newCode = `mc_${767 + index}/742`;
    assert.equal(
      mc.cards.some((card) => norm(card.code) === norm(oldCode)),
      false,
      oldCode,
    );
    const card = mc.cards.find((item) => norm(item.code) === norm(newCode));
    assert.ok(card, newCode);
    assert.equal(card.name, expectedNames[index]);
    assert.ok((card.legacyCodes || []).includes(oldCode));
    assert.equal(
      card.source,
      `https://pokemoncard.co.kr/cards/detail/BS2026001${767 + index}`,
    );
  }
});

test("M-P includes the three official ex special-set energy tokens", async () => {
  const groups = await mergedSeries();
  const promo = groups.find((group) => norm(group.code) === "m-p");
  assert.ok(promo);

  const expected = [
    ["m-p_GRA", "기본 풀 에너지", "MP002026001"],
    ["m-p_FIR", "기본 불꽃 에너지", "MP002026002"],
    ["m-p_WAT", "기본 물 에너지", "MP002026003"],
  ];

  for (const [code, name, cardNum] of expected) {
    const card = promo.cards.find((item) => norm(item.code) === norm(code));
    assert.ok(card, code);
    assert.equal(card.name, name);
    assert.equal(card.source, `https://pokemoncard.co.kr/cards/detail/${cardNum}`);
    assert.match(card.image, /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\//);
  }
  assert.equal(promo.cards.length, 68);
});

test("legacy series codes remain compatible after corrected numbering", async () => {
  const source = await read("core/catalog/card-identity.js");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);

  const identity = context.window.DigitalCardBinder.cardIdentity;
  const keys = identity.cardCompatibilityKeys(
    "series",
    { code: "MC" },
    { code: "mc_767/742", legacyCodes: ["mc_1000/742"] },
    0,
    0,
  );

  assert.deepEqual([...keys], [
    "series::mc::mc_767/742",
    "series::mc::mc_1000/742",
  ]);
});

test("master inventory reflects the three newly verified Korean promo cards", async () => {
  const inventory = JSON.parse(await read("data/series-inventory-audit.json"));
  assert.equal(inventory.summary.setCount, 273);
  assert.equal(inventory.summary.cardCount, 20243);
  assert.equal(inventory.summary.duplicateSetCodeCount, 0);
  assert.equal(inventory.summary.duplicateCardIdentityCount, 0);
});
