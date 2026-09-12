import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const data = JSON.parse(
  readFileSync(new URL("../data/trainer-pokemon.json", import.meta.url), "utf8"),
);

const groups = Array.isArray(data.groups) ? data.groups : [];

const cards = groups.flatMap((group) =>
  (Array.isArray(group.cards) ? group.cards : []).map((card, cardIndex) => ({
    group,
    card,
    cardIndex,
  })),
);

test("trainer-pokemon catalog has a stable version and non-empty groups", () => {
  assert.ok(Number.isInteger(data.version) && data.version > 0);
  assert.ok(groups.length > 0);
});

test("trainer-pokemon cards have stable accountIndex values within each group", () => {
  for (const group of groups) {
    const values = (Array.isArray(group.cards) ? group.cards : []).map(
      (card, index) => card.accountIndex ?? index,
    );
    assert.equal(new Set(values).size, values.length, `duplicate accountIndex in ${group.name}`);
    values.forEach((value) => assert.ok(Number.isInteger(value) && value >= 0));
  }
});

test("trainer-pokemon card codes preserve set and card-number identity", () => {
  for (const { card } of cards) {
    assert.match(String(card.code || ""), /^[a-z0-9+]+_[0-9]+\/[0-9]+$/i);
    assert.match(String(card.set || ""), /^[A-Za-z0-9+]+$/);
    assert.ok(String(card.cardNumber || "").includes("/"));
  }
});

test("S and SM trainer-pokemon entries remain represented", () => {
  const sets = new Set(cards.map(({ card }) => String(card.set || "").toLowerCase()));
  assert.ok([...sets].some((set) => /^s/.test(set)), "S-series entries are missing");
  assert.ok([...sets].some((set) => /^sm/.test(set)), "SM-series entries are missing");
});
