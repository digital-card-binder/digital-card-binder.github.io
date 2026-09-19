import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const legacy = JSON.parse(
  readFileSync(new URL("../data/series-legacy.json", import.meta.url), "utf8"),
);
const catalog = readFileSync(new URL("../catalog.js", import.meta.url), "utf8");
const seriesPage = readFileSync(new URL("../series.html", import.meta.url), "utf8");

const group = (code) => legacy.find((item) => item.code === code);

test("한국판 구판 카탈로그는 ORIGIN 1세트와 ADV 5세트로 구성된다", () => {
  assert.deepEqual(
    legacy
      .filter((item) => ["ORIGIN", "ADV"].includes(item.era))
      .map((item) => item.code),
    ["BASE", "ADV1", "ADV1-K", "ADV1-A", "ADV1-M", "ADVP"],
  );

  const origin = legacy.filter((item) => item.era === "ORIGIN");
  const adv = legacy.filter((item) => item.era === "ADV");

  assert.equal(origin.length, 1);
  assert.equal(origin[0].cards.length, 102);

  assert.equal(adv.length, 5);
  assert.deepEqual(adv.map((item) => item.cards.length), [63, 19, 19, 19, 1]);
  assert.equal(
    adv.reduce((total, item) => total + item.cards.length, 0),
    121,
  );
});

test("ADV 제1탄은 번호 카드 55장과 기본 에너지 8장을 포함한다", () => {
  const adv1 = group("ADV1");
  assert.ok(adv1);
  assert.equal(adv1.cards.length, 63);
  assert.equal(
    adv1.cards.filter((card) => /^adv1_\d{3}\/055$/i.test(card.code)).length,
    55,
  );
  assert.equal(
    adv1.cards.filter((card) => /^adv1_ENERGY-/i.test(card.code)).length,
    8,
  );
  assert.equal(adv1.referenceSource, "https://www.dogam.app/sets");
  assert.match(adv1.referenceNote, /한글판 63장 기준/);
});

test("ADV 프로모는 한국판 1-P 피카츄 한 장을 별도 슬롯으로 둔다", () => {
  const promo = group("ADVP");
  assert.ok(promo);
  assert.equal(promo.cards.length, 1);
  assert.equal(promo.cards[0].name, "피카츄");
  assert.equal(promo.cards[0].code, "advp_001/P");
  assert.match(promo.cards[0].note, /한국판 1\/P 피카츄/);
});

test("오리지널 Base Set은 한국판 102장 슬롯을 유지한다", () => {
  const base = group("BASE");
  assert.ok(base);
  assert.equal(base.cards.length, 102);
  assert.equal(base.cards[0].code, "base_001/102");
  assert.equal(base.cards.at(-1).code, "base_102/102");
  assert.equal(base.referenceSource, "https://www.dogam.app/sets");
  assert.match(base.referenceNote, /한글판 102장 기준/);
});

test("시리즈 도감은 legacy 카탈로그를 병합하고 ORIGIN 및 ADV 탭을 노출한다", () => {
  assert.match(catalog, /series-legacy\.json/);
  assert.match(catalog, /mergeSeriesGroups/);
  assert.match(seriesPage, /data-era="ORIGIN"/);
  assert.match(seriesPage, /data-era="ADV"/);
});


test("오리지널·ADV 확장팩·ADV 프로모는 확인된 한글판 실물 이미지를 사용한다", () => {
  for (const code of ["BASE", "ADV1", "ADVP"]) {
    const item = group(code);
    assert.ok(item, code);
    assert.equal(item.referenceImageRegion, "KR", code);
    assert.match(item.referenceNote, /한글판.*실물 이미지/, code);

    for (const card of item.cards) {
      assert.match(
        card.image,
        /^https:\/\/static[.]tcgexchange[.]kr\//,
        card.code,
      );
      assert.match(
        card.source,
        /^https:\/\/www[.]dogam[.]app\/sets\/.+\/cards\//,
        card.code,
      );
      assert.match(card.imageReferenceNote || "", /한글판 실물 이미지/, card.code);
      assert.doesNotMatch(card.image, /images[.]pokemontcg[.]io|cdn[.]collectory[.]cc/i, card.code);
    }
  }
});

test("ADV 스타터 3종은 한글판 카드 이미지 미확인 예외만 JP 참고 이미지를 유지한다", () => {
  let total = 0;
  for (const code of ["ADV1-K", "ADV1-A", "ADV1-M"]) {
    const item = group(code);
    assert.ok(item, code);
    assert.equal(item.cards.length, 19, code);
    assert.equal(item.referenceImageRegion, "JP", code);
    assert.match(item.referenceNote, /한글판 카드 이미지 미확인/, code);
    for (const card of item.cards) {
      assert.match(card.imageReferenceNote || "", /한글판 카드 이미지 미확인.*JP 참고 이미지/, card.code);
      total += 1;
    }
  }
  assert.equal(total, 57);
});
