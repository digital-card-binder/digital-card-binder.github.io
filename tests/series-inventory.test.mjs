import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inventory = JSON.parse(
  readFileSync(new URL("../data/series-inventory.json", import.meta.url), "utf8"),
);

test("series master inventory locks the current Korean catalog baseline", () => {
  assert.equal(inventory.schemaVersion, 1);
  assert.deepEqual(inventory.generatedFrom, [
    "data/series.json",
    "data/series-legacy.json",
  ]);
  assert.equal(inventory.totals.groups, 200);
  assert.equal(inventory.totals.cards, 15670);
  assert.equal(inventory.totals.duplicateIdentities, 0);
  assert.equal(inventory.groups.length, 200);
  assert.match(inventory.catalogDigest, /^[0-9a-f]{64}$/);
});

test("series master inventory records the complete era breakdown", () => {
  assert.deepEqual(
    inventory.eraSummary.map(({ era, groups, cards }) => [era, groups, cards]),
    [
      ["ORIGIN", 1, 102],
      ["ADV", 5, 121],
      ["DP", 16, 598],
      ["BW", 37, 1477],
      ["XY", 37, 2313],
      ["SM", 40, 3608],
      ["S", 31, 3267],
      ["SV", 25, 3166],
      ["M", 8, 1018],
    ],
  );
  assert.equal(
    inventory.eraSummary.reduce((sum, item) => sum + item.cards, 0),
    inventory.totals.cards,
  );
});

test("every current series slot has a display name, image, and stable identity", () => {
  assert.equal(inventory.completeness.totalCards, 15670);
  assert.equal(inventory.completeness.displayName, 15670);
  assert.equal(inventory.completeness.image, 15670);
  assert.equal(inventory.completeness.identity, 15670);

  for (const group of inventory.groups) {
    assert.ok(group.code);
    assert.ok(group.cards > 0, group.code);
    assert.equal(group.duplicateIdentities, 0, group.code);
    assert.equal(group.missing.displayName, 0, group.code);
    assert.equal(group.missing.image, 0, group.code);
    assert.equal(group.missing.identity, 0, group.code);
    assert.match(group.digest, /^[0-9a-f]{64}$/, group.code);
  }
});

test("inventory coverage counters account for every card without pretending sparse metadata is complete", () => {
  const sourceTotal = Object.values(inventory.sourceHosts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const imageTotal = Object.values(inventory.imageHosts).reduce(
    (sum, value) => sum + value,
    0,
  );
  assert.equal(sourceTotal, inventory.totals.cards);
  assert.equal(imageTotal, inventory.totals.cards);
  assert.ok(inventory.completeness.source < inventory.totals.cards);
  assert.ok(inventory.completeness.rarity < inventory.totals.cards);
});
