import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fossil = JSON.parse(
  await readFile(new URL("../data/fossil.json", import.meta.url), "utf8"),
);
const [fossilHtml, fossilJs, auditReport] = await Promise.all([
  readFile(new URL("../fossil.html", import.meta.url), "utf8"),
  readFile(new URL("../fossil.js", import.meta.url), "utf8"),
  readFile(new URL("../docs/fossil-audit-2026-09-16.md", import.meta.url), "utf8"),
]);
const cards = fossil.groups.flatMap((group) =>
  group.cards.map((card) => ({ ...card, groupCode: group.code })),
);

test("fossil dex covers the fully reviewed S, SV, and MEGA scope", () => {
  assert.equal(fossil.version, 3);
  assert.equal(fossil.scope, "S / SV / MEGA");
  assert.equal(fossil.total, 122);
  assert.equal(cards.length, fossil.total);
  assert.equal(fossil.groups.length, 26);
  assert.deepEqual(fossil.seriesCounts, { S: 60, SV: 38, MEGA: 24 });

  const actualSeriesCounts = Object.fromEntries(
    ["S", "SV", "MEGA"].map((series) => [
      series,
      cards.filter((card) => card.series === series).length,
    ]),
  );
  assert.deepEqual(actualSeriesCounts, fossil.seriesCounts);
  assert.ok(fossil.auditMethod.includes("공식 카드 이미지"));
  assert.ok(fossil.rule.includes("단순 미러는 별도 집계하지 않고"));
});

test("fossil dex exposes all three required categories and exact counts", () => {
  const actualCategoryCounts = cards.reduce((counts, card) => {
    counts[card.category] = (counts[card.category] || 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(actualCategoryCounts, {
    "화석 포켓몬": 71,
    "화석 아이템": 17,
    "일러스트 속 화석": 34,
  });
  assert.deepEqual(actualCategoryCounts, fossil.categoryCounts);
});

test("every included card has official image evidence and stable unique identity", () => {
  assert.equal(new Set(cards.map((card) => card.meta)).size, cards.length);
  assert.equal(
    new Set(cards.map((card) => `${card.groupCode}:${card.accountIndex}`)).size,
    cards.length,
  );

  for (const card of cards) {
    assert.match(card.groupCode, /^FOSSIL-/);
    assert.match(card.image, /^https:\/\/cards\.image\.pokemonkorea\.co\.kr\/data\/wmimages\//);
    assert.match(card.source, /^https:\/\/pokemoncard\.co\.kr\/cards\/detail\//);
    assert.ok(card.evidence.length >= 15);
    assert.equal(card.owned, false);
    assert.doesNotMatch(card.image, /_m\./);
  }
});

test("the original SV 26 cards keep their ownership indexes", () => {
  const expected = {
    "FOSSIL-SV2A": {
      "SV2a-138": 0, "SV2a-139": 1, "SV2a-140": 2, "SV2a-141": 3,
      "SV2a-142": 4, "SV2a-154": 5, "SV2a-155": 6, "SV2a-156": 7,
      "SV2a-180": 8,
    },
    "FOSSIL-SV7": {
      "SV7-003": 0, "SV7-004": 1, "SV7-022": 2, "SV7-023": 3,
      "SV7-089": 4, "SV7-090": 5, "SV7-104": 6,
    },
    "FOSSIL-SV11B": {
      "SV11B-025": 0, "SV11B-026": 1, "SV11B-080": 2,
      "SV11B-110": 3, "SV11B-111": 4,
    },
    "FOSSIL-SV11W": {
      "SV11W-047": 0, "SV11W-048": 1, "SV11W-080": 2,
      "SV11W-129": 3, "SV11W-130": 4,
    },
  };

  for (const [groupCode, indexes] of Object.entries(expected)) {
    const group = fossil.groups.find((item) => item.code === groupCode);
    assert.ok(group, `missing group ${groupCode}`);
    for (const [meta, accountIndex] of Object.entries(indexes)) {
      assert.equal(
        group.cards.find((card) => card.meta === meta)?.accountIndex,
        accountIndex,
        `${meta} ownership index changed`,
      );
    }
  }
});

test("reviewed additions and exclusions capture the requested edge cases", () => {
  const included = new Set(cards.map((card) => card.meta));
  for (const meta of [
    "SV5K-077",
    "M3-084",
    "M3-089",
    "M5-091",
    "S3-091",
    "S9a-065",
    "S6H-004",
  ]) {
    assert.ok(included.has(meta), `missing requested candidate ${meta}`);
  }

  const excluded = new Set(
    fossil.excluded.map((card) => `${card.set}-${card.cardNumber.split("/")[0]}`),
  );
  for (const meta of ["S9a-081", "S9a-089", "SV8-115", "M5-016"]) {
    assert.ok(excluded.has(meta), `missing reviewed exclusion ${meta}`);
  }
});

test("fossil page renders dataset-driven totals, categories, and evidence", () => {
  for (const id of [
    "fossil-scope",
    "fossil-hero-description",
    "fossil-pokemon-count",
    "fossil-item-count",
    "fossil-illustration-count",
    "fossil-catalog-title",
    "fossil-dialog-evidence",
    "fossil-footer-note",
  ]) {
    assert.match(fossilHtml, new RegExp(`id=["']${id}["']`));
    assert.match(fossilJs, new RegExp(`fossilEl\\(["']${id}["']\\)`));
  }
  assert.match(fossilJs, /card\.series/);
  assert.ok(fossilJs.includes("wmimages/${series}/${folder}/"));
});

test("published audit report lists every included card and reviewed exclusion", () => {
  assert.equal(auditReport.match(/\| \[확인\]\(https:\/\/pokemoncard\.co\.kr\/cards\/detail\//g)?.length, 122);
  assert.match(auditReport, /\| \*\*전체\*\* \| \*\*122\*\* \|/);
  for (const excluded of fossil.excluded) {
    assert.ok(
      auditReport.includes(`| ${excluded.series} | ${excluded.set} ${excluded.setName} | ${excluded.name} | ${excluded.cardNumber} |`),
    );
  }
});
