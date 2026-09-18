import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const legacy = JSON.parse(
  readFileSync(new URL("../data/series-legacy.json", import.meta.url), "utf8"),
);
const catalog = readFileSync(new URL("../catalog.js", import.meta.url), "utf8");
const seriesPage = readFileSync(new URL("../series.html", import.meta.url), "utf8");

test("ADV 한국 발매 카탈로그는 4개 세트 112장으로 구성된다", () => {
  assert.deepEqual(
    legacy.map((group) => group.code),
    ["ADV1", "ADV1-K", "ADV1-A", "ADV1-M"],
  );
  assert.ok(legacy.every((group) => group.era === "ADV"));
  assert.deepEqual(
    legacy.map((group) => group.cards.length),
    [55, 19, 19, 19],
  );
  assert.equal(
    legacy.reduce((total, group) => total + group.cards.length, 0),
    112,
  );
});

test("ADV 카드 슬롯은 번호, 이름, 참고 이미지를 갖는다", () => {
  for (const group of legacy) {
    assert.equal(group.referenceImageRegion, "JP");
    assert.match(group.referenceNote, /JP 참고 이미지/);
    group.cards.forEach((card, index) => {
      assert.ok(card.name);
      assert.ok(card.image);
      assert.equal(card.order, index + 1);
      assert.match(card.code, /^adv1(?:-[kam])?_\d{3}\/\d{3}$/i);
    });
  }
});

test("시리즈 도감은 legacy 카탈로그를 병합하고 ADV 탭을 노출한다", () => {
  assert.match(catalog, /series-legacy\.json/);
  assert.match(catalog, /mergeSeriesGroups/);
  assert.match(seriesPage, /data-era="ADV"/);
});
