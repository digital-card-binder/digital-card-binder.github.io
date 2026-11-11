import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const groups = [...read("data/series.json"), ...read("data/series-legacy.json")];
const required = [
  { code: "MEZ", count: 21, last: "조로아", lead: "샤프니아", denominator: 19, energy: "기본 악 에너지", symbol: "DAR" },
  { code: "MEM", count: 19, last: "나오하", lead: "쉐이미", denominator: 17, energy: "기본 풀 에너지", symbol: "GRA" },
  { code: "MEE", count: 21, last: "이브이", lead: "쥬피썬더", denominator: 19, energy: "기본 번개 에너지", symbol: "LIG" },
];

test("three 2026 Korean MEGA ex starter decks have 61 unique catalog slots", () => {
  const seen = new Set();
  let total = 0;
  for (const entry of required) {
    const matches = groups.filter((group) => String(group.code).toLowerCase() === entry.code.toLowerCase());
    assert.equal(matches.length, 1, `${entry.code} should be registered once`);
    const group = matches[0];
    assert.equal(group.era, "M");
    assert.equal(group.release, "2026-09-30");
    assert.match(group.displayName, /MEGA 스타터 세트 ex/);
    assert.equal(group.cards.length, entry.count, `${entry.code} unique prints + energy`);
    assert.equal(group.cards[0].name, entry.lead);
    assert.equal(group.cards.at(-2).name, entry.last);
    assert.equal(group.cards.at(-1).name, entry.energy);
    assert.equal(group.cards.at(-1).printedCode, entry.symbol);
    for (const [index, card] of group.cards.entries()) {
      const id = `${entry.code.toLowerCase()}_${String(index+1).padStart(3,"0")}/${String(entry.denominator).padStart(3,"0")}`;
      assert.equal(card.code, id);
      assert.equal(card.order, index+1);
      assert.ok(card.name && card.image && card.source, id);
      assert.equal(card.owned, undefined, "do not overwrite member-owned state in catalog source");
      assert.ok(!seen.has(id), `duplicate print identity: ${id}`);
      seen.add(id);
    }
    for (const card of group.cards.slice(0,-1)) {
      assert.match(card.image, /^https:\/\/pokemoncard[.]co[.]kr\/s3[.]php[?]/);
      assert.match(card.source, new RegExp(`^https://collec-hub[.]store/cards/ko/${entry.code.toLowerCase()}/`));
    }
    total += group.cards.length;
  }
  assert.equal(total, 61);
});

test("starter deck print IDs do not duplicate existing master or legacy groups", () => {
  const seen = new Set();
  for (const group of groups) {
    const key = String(group.code || "").toLowerCase();
    assert.equal(seen.has(key), false, `duplicate set code: ${key}`);
    seen.add(key);
  }
});
