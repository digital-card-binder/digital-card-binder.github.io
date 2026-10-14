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


test("M6a 30th CELEBRATION rarity mapping matches the reviewed Korean catalog", () => {
  const m6a = group("m6a");
  assert.ok(m6a);
  assert.equal(m6a.cards.length, 176);

  const codesFor = (rarity) =>
    m6a.cards.filter((card) => card.rarity === rarity).map((card) => card.code);

  assert.deepEqual(codesFor("RR"), [
    "m6a_009/103", "m6a_015/103", "m6a_047/103", "m6a_048/103",
    "m6a_055/103", "m6a_057/103", "m6a_059/103", "m6a_076/103",
    "m6a_081/103", "m6a_088/103",
  ]);
  assert.deepEqual(
    codesFor("AR"),
    Array.from({ length: 20 }, (_, index) => `m6a_${String(index + 104).padStart(3, "0")}/103`),
  );
  assert.deepEqual(
    codesFor("SAR"),
    Array.from({ length: 10 }, (_, index) => `m6a_${String(index + 124).padStart(3, "0")}/103`),
  );
  assert.deepEqual(codesFor("FUR"), ["m6a_134/103", "m6a_135/103"]);
  assert.deepEqual(codesFor("RGB"), ["m6a_R/RGB", "m6a_G/RGB", "m6a_B/RGB"]);
  assert.equal(m6a.cards.find((card) => card.code === "m6a_011/103")?.rarity, "");
  assert.equal(m6a.cards.find((card) => card.code === "m6a_017/103")?.rarity, "");
});

test("M6a Korean cards 104-135 remain self-hosted and match official evidence", () => {
  const overrides = JSON.parse(readFileSync(new URL("../data/series-image-overrides.json", import.meta.url), "utf8"));
  const audit = JSON.parse(readFileSync(new URL("../data/audits/m6a-korean-image-sync.json", import.meta.url), "utf8"));
  const m6a = group("m6a");
  const known = new Map(m6a.cards.map((card) => [card.code, card]));
  assert.equal(audit.imported.length, 32);
  assert.deepEqual(audit.pendingNumbers, []);
  for (let number = 104; number <= 135; number += 1) {
    const token = String(number).padStart(3, "0");
    const identity = `m6a_${token}/103`;
    const path = `./assets/cards/mega/m6a/M6a_${token}.webp`;
    assert.ok(known.has(identity), identity);
    assert.equal(overrides.sets.m6a[identity], path);
    const content = readFileSync(new URL(`../assets/cards/mega/m6a/M6a_${token}.webp`, import.meta.url));
    assert.equal(content.subarray(0, 4).toString("ascii"), "RIFF", identity);
    assert.equal(content.subarray(8, 12).toString("ascii"), "WEBP", identity);
    assert.ok(content.length > 15_000, identity);
    const entry = audit.imported.find((item) => item.number === number);
    assert.equal(entry?.localPath, path);
    assert.match(entry?.source || "", /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\//);
  }
});
