import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const groups = JSON.parse(
  readFileSync(new URL("../data/series-legacy.json", import.meta.url), "utf8"),
);
const dp = groups.filter((group) => group.era === "DP");
const byCode = new Map(dp.map((group) => [group.code, group]));

const expected = [
  ["BS1", "모험의 시작", 60],
  ["BS2", "불꽃 튀는 대결", 40],
  ["BS3", "시공의 격돌", 60],
  ["BS4", "또 다른 세계", 40],
  ["BS5", "7개의 신비", 40],
  ["BS6", "암흑의 초승달", 60],
  ["BS7", "보이지 않는 힘", 40],
  ["BS8", "화려한 전설", 40],
  ["BS9", "호수의 기적", 40],
  ["BS10", "고대의 수호자", 40],
  ["CSD", "크레세리아 덱", 14],
  ["DGD", "디아루가 덱", 15],
  ["DRD", "다크라이 덱", 13],
  ["PKD", "펄기아 덱", 15],
  ["ST1", "DP 랜덤 구축덱", 59],
  ["DPP", "DP 프로모 카드", 22],
];

test("DP 한국판 카탈로그는 dogam 기준 16세트 598장이다", () => {
  assert.deepEqual(
    dp.map((group) => [group.code, group.displayName, group.cards.length]),
    expected,
  );
  assert.equal(dp.reduce((total, group) => total + group.cards.length, 0), 598);
});

test("DP 카드 슬롯은 포켓몬코리아 공식 한글 이미지와 상세 링크를 사용한다", () => {
  for (const group of dp) {
    assert.equal(group.referenceSource, "https://www.dogam.app/sets");
    assert.equal(group.referenceImageRegion, "KR");
    assert.match(group.referenceNote, /포켓몬코리아 공식 이미지/);
    assert.ok(group.sourceProducts.length >= 1, group.code);

    assert.equal(
      new Set(group.cards.map((card) => card.code)).size,
      group.cards.length,
      group.code,
    );

    group.cards.forEach((card, index) => {
      assert.equal(card.order, index + 1, card.code);
      assert.ok(card.name, card.code);
      assert.match(
        card.image,
        /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\/data\/wmimages\/DP\//,
        card.code,
      );
      assert.match(
        card.source,
        /^https:\/\/pokemoncard[.]co[.]kr\/cards\/detail\//,
        card.code,
      );
    });
  }
});

test("DP 확장팩과 프로모의 양끝 번호가 정확하다", () => {
  assert.equal(byCode.get("BS1").cards[0].code, "bs1_001/060");
  assert.equal(byCode.get("BS1").cards.at(-1).code, "bs1_060/060");
  assert.equal(byCode.get("BS10").cards[0].code, "bs10_001/040");
  assert.equal(byCode.get("BS10").cards.at(-1).code, "bs10_040/040");
  assert.equal(byCode.get("DPP").cards[0].code, "dpp_001/P");
  assert.equal(byCode.get("DPP").cards.at(-1).code, "dpp_022/P");
});

test("DP 구축덱은 번호 외 기본 에너지 슬롯까지 dogam 장수에 포함한다", () => {
  assert.equal(byCode.get("DGD").cards.filter((card) => /_ENERGY-/.test(card.code)).length, 3);
  assert.equal(byCode.get("PKD").cards.filter((card) => /_ENERGY-/.test(card.code)).length, 3);
  assert.equal(byCode.get("CSD").cards.filter((card) => /_ENERGY-/.test(card.code)).length, 2);
  assert.equal(byCode.get("DRD").cards.filter((card) => /_ENERGY-/.test(card.code)).length, 2);
  assert.equal(byCode.get("ST1").cards.filter((card) => /_ENERGY-/.test(card.code)).length, 4);
});
