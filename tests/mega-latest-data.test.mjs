import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const series = JSON.parse(
  readFileSync(new URL("../data/series.json", import.meta.url), "utf8"),
);

const group = (code) =>
  series.find((item) => String(item?.code || "").toLowerCase() === code);

test("M6 Storm Emeralda is part of the canonical series catalog", () => {
  const m6 = group("m6");
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

test("M5 canonical names include the former runtime corrections", () => {
  const m5 = group("m5");
  assert.ok(m5);
  const byNumber = new Map(
    m5.cards.map((card) => {
      const match = String(card.code || "").match(/_(\d+)/);
      return [Number(match?.[1]), card];
    }),
  );
  assert.equal(byNumber.get(26)?.name, "메가제라오라 ex");
  assert.equal(byNumber.get(36)?.name, "메가샹델라 ex");
  assert.equal(byNumber.get(46)?.name, "메가다크라이 ex");
  assert.equal(byNumber.get(63)?.name, "메가몰드류 ex");
  assert.equal(m5.cards.filter((card) => !String(card.name || "").trim()).length, 0);
});
