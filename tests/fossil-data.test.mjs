import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fossil = JSON.parse(
  await readFile(new URL("../data/fossil.json", import.meta.url), "utf8"),
);

test("SV fossil dex keeps the reviewed 26-card baseline", () => {
  assert.equal(fossil.scope, "SV");
  assert.equal(fossil.total, 26);
  assert.deepEqual(
    fossil.groups.map((group) => [group.set, group.cards.length]),
    [
      ["SV2a", 9],
      ["SV7", 7],
      ["SV11B", 5],
      ["SV11W", 5],
    ],
  );

  const cards = fossil.groups.flatMap((group) => group.cards);
  assert.equal(cards.length, 26);
  assert.equal(new Set(cards.map((card) => card.meta)).size, cards.length);
  assert.ok(fossil.rule.includes("미러는 별도 집계하지 않습니다"));
});

test("fossil ownership keys stay isolated from existing Pokemon collection groups", () => {
  for (const group of fossil.groups) {
    assert.match(group.code, /^FOSSIL-/);
    assert.ok(group.cards.length > 0);
    assert.equal(
      new Set(group.cards.map((card) => card.accountIndex)).size,
      group.cards.length,
    );
  }
});
