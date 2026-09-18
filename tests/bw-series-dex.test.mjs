import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const groups = JSON.parse(
  readFileSync(new URL("../data/series-legacy.json", import.meta.url), "utf8"),
);
const bw = groups.filter((group) => group.era === "BW");
const byCode = new Map(bw.map((group) => [group.code, group]));

const expectedCounts = new Map([
  ["BW1-Bb",56],["BW1-Bw",56],["BD",16],["TD",16],["FS",40],["BW2",72],
  ["BTV",24],["BGc",16],["PBG",18],["BGt",17],["BGv",17],["BW3-Bh",57],
  ["BW3-Bp",57],["BW4",76],["BKR",20],["BGZ",20],["DC",20],["BW5-Brn",55],
  ["BW5-Brz",55],["GBR",18],["SZD",18],["BW6-Bc",65],["BW6-Bf",65],["KD",18],
  ["BW7",79],["PPD",19],["BGB",20],["BGW",20],["BW8-Brf",58],["BW8-Brn",58],
  ["SC",25],["BW9",86],["K+K",19],["MG-Bg",17],["MG-Bm",17],["EBB",95],["BWP",72],
]);

test("BW 한국판 카탈로그는 Dogam 기준 37세트 1477장이다", () => {
  assert.equal(bw.length, 37);
  assert.equal(bw.reduce((total, group) => total + group.cards.length, 0), 1477);
  for (const [code, count] of expectedCounts) {
    assert.equal(byCode.get(code)?.cards.length, count, code);
  }
});

test("BW 카드 슬롯은 전부 한글판 이름과 이미지를 가진다", () => {
  for (const group of bw) {
    assert.equal(group.referenceSource, "https://www.dogam.app/sets");
    assert.equal(group.referenceImageRegion, "KR");
    assert.ok(group.sourceProducts.length >= 1, group.code);
    assert.equal(new Set(group.cards.map((card) => card.code)).size, group.cards.length, group.code);

    group.cards.forEach((card, index) => {
      assert.equal(card.order, index + 1, card.code);
      assert.ok(card.name, card.code);
      assert.equal(/No[.]$/.test(card.name), false, card.code);
      assert.ok(card.image, card.code);
      assert.match(
        card.image,
        /^https:\/\/(?:cards[.]image[.]pokemonkorea[.]co[.]kr|static[.]tcgexchange[.]kr)\//,
        card.code,
      );
      assert.match(
        card.source,
        /^https:\/\/(?:pokemoncard[.]co[.]kr\/cards\/detail|www[.]dogam[.]app\/sets)\//,
        card.code,
      );
    });
  }
});

test("BW 비밀카드 번호와 구축덱 No. 카드를 올바르게 보존한다", () => {
  assert.equal(byCode.get("BW1-Bb").cards.at(-1).code, "bw1-bb_056/053");
  assert.equal(byCode.get("BW1-Bw").cards.at(-1).code, "bw1-bw_056/053");
  assert.equal(byCode.get("BD").cards.at(-1).code, "bd_016");
  assert.equal(byCode.get("TD").cards.at(-1).code, "td_016");
  assert.equal(byCode.get("MG-Bg").cards.at(-1).code, "mg-bg_017");
  assert.equal(byCode.get("MG-Bm").cards.at(-1).code, "mg-bm_017");
});

test("BW 프로모 72장을 모두 유지한다", () => {
  const promo = byCode.get("BWP");
  assert.ok(promo);
  assert.equal(promo.cards.length, 72);
  assert.equal(promo.cards[0].order, 1);
  assert.equal(promo.cards.at(-1).order, 72);
  assert.equal(promo.cards.at(-1).name, "이브이");
});


test("BW에서 확인된 일본판 에너지 7장은 한글판 공식 이미지로 교체됐다", () => {
  const targetCodes = new Set([
    "gbr_016/015",
    "gbr_017/015",
    "gbr_018/015",
    "szd_016/015",
    "szd_017/015",
    "szd_018/015",
    "k+k_019/018",
  ]);
  const cards = bw.flatMap((group) => group.cards);
  const targets = cards.filter((card) => targetCodes.has(card.code));
  assert.equal(targets.length, targetCodes.size);
  for (const card of targets) {
    assert.match(card.image, /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\//, card.code);
    assert.match(card.imageReferenceNote || "", /한글판 공식 참고 이미지/, card.code);
  }
});
