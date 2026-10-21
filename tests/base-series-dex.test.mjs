import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// 기본 수록 보기는 별도 도감이 아니라 시리즈도감의 범위 필터로 유지하며 회귀를 방지한다.
const nav = readFileSync(new URL("../collector-nav.js", import.meta.url), "utf8");
const legacyPage = readFileSync(new URL("../base-series.html", import.meta.url), "utf8");
const seriesPage = readFileSync(new URL("../series.html", import.meta.url), "utf8");
const scopeFilter = readFileSync(
  new URL("../series-scope-filter.js", import.meta.url),
  "utf8",
);
const catalog = readFileSync(new URL("../catalog.js", import.meta.url), "utf8");

test("시리즈도감 기본 수록 필터는 각 세트의 분모 이하 카드만 표시한다", () => {
  assert.match(scopeFilter, /params\.get\("scope"\) === "base"/);
  assert.match(catalog, /range\.number <= range\.denominator/);
  assert.match(catalog, /account\.applyGroups\(groups\);[\s\S]*?allSeriesGroups = groups;[\s\S]*?applySeriesScope\(\);/);
  assert.match(scopeFilter, /history\.pushState/);
  assert.doesNotMatch(scopeFilter, /window\.fetch\s*=/);
  assert.match(seriesPage, /series-scope-filter\.js/);
});

test("마스터/기본 도감 전환은 접힌 필터 밖에서 제공된다", () => {
  assert.match(scopeFilter, /data-scope="all"/);
  assert.match(scopeFilter, /data-scope="base"/);
  assert.match(scopeFilter, />마스터 도감<\/button>/);
  assert.match(scopeFilter, />기본 도감<\/button>/);
  assert.match(scopeFilter, /heading[.]insertAdjacentElement\("afterend", control\)/);
  assert.match(scopeFilter, /[.]catalog-panel > [.]catalog-heading/);
  assert.doesNotMatch(scopeFilter, /row[.]prepend\(control\)/);
  assert.doesNotMatch(nav, /navigationLink\(\s*"\.\/base-series\.html"/);
  assert.doesNotMatch(nav, /"기본 수록 도감"/);
});

test("기존 기본 수록 도감 주소는 시리즈도감 기본 수록 보기로 연결된다", () => {
  assert.match(legacyPage, /series\.html\?scope=base/);
  assert.doesNotMatch(legacyPage, /data-series-scope="base"/);
  assert.doesNotMatch(legacyPage, /<h1>기본 수록 도감<\/h1>/);
});

test("RGB 특별 카드는 마스터 도감에만 포함되며 M6a 기본 도감은 103장이다", () => {
  // Execute the actual catalog filter rather than duplicating its business logic.
  const definitions = ["seriesCardRange", "isBaseSeriesCard"].map((name) => {
    const match = catalog.match(new RegExp(`function ${name}\\(card\\) \\{[\\s\\S]*?\\n\\}`));
    assert.ok(match, `missing function ${name}`);
    return match[0];
  });
  const isBaseSeriesCard = runInNewContext(
    definitions.join("\n") + "\nisBaseSeriesCard",
  );

  const data = JSON.parse(
    readFileSync(new URL("../data/series.json", import.meta.url), "utf8"),
  );
  const m6a = data.find((group) => String(group.code).toLowerCase() === "m6a");
  assert.ok(m6a);
  assert.equal(m6a.cards.length, 176, "master data remains unchanged");
  const rgbCards = m6a.cards.filter((card) => card.rarity === "RGB");
  assert.equal(rgbCards.length, 3);
  assert.ok(rgbCards.every((card) => !isBaseSeriesCard(card)));
  assert.equal(m6a.cards.filter(isBaseSeriesCard).length, 103);
  assert.equal(isBaseSeriesCard({ code: "test_001/003", rarity: " rgb " }), false);
  assert.equal(isBaseSeriesCard({ code: "test_001/003", rarity: "C" }), true);
  assert.equal(isBaseSeriesCard({ code: "test_004/003", rarity: "SAR" }), false);
});
