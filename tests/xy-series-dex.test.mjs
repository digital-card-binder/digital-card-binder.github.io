import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const groups = JSON.parse(
  readFileSync(new URL("../data/series-legacy.json", import.meta.url), "utf8"),
);
const xy = groups.filter((group) => group.era === "XY");
const byCode = new Map(xy.map((group) => [group.code, group]));

const expected = [
  ["XY",188],["CP6",113],["CP5",38],["XY11-Br",59],["XY11-Bb",59],
  ["CP4",140],["XY10",88],["XYH",27],["XYG",20],["CP3",32],["20th",71],
  ["XY9",89],["XYF",17],["XY8-Bb",65],["UBD",19],["RBD",19],
  ["XY8-Br",65],["XYE",26],["CP2",27],["XY7",97],["XY6",91],["XYD",20],
  ["CP1",34],["XY5-Bg",80],["XY5-Bt",80],["XYC",25],["XYB",20],
  ["XY4",97],["XY3",105],["XYA",23],["XY2",90],["X30",15],["Y30",15],
  ["XY1-Bx",63],["XY1-By",63],["FXY",42],["XYP",191],
];

test("XY 한국판 카탈로그는 Dogam 기준 37세트 2313장이다", () => {
  assert.equal(xy.length, 37);
  assert.equal(xy.reduce((sum, group) => sum + group.cards.length, 0), 2313);
  assert.deepEqual(
    xy.map((group) => [group.code, group.cards.length]),
    expected,
  );
});

test("XY 카드 슬롯은 모두 한글명과 한글판 이미지 소스를 가진다", () => {
  for (const group of xy) {
    assert.equal(group.referenceSource, "https://www.dogam.app/sets");
    assert.equal(group.referenceImageRegion, "KR");
    assert.match(group.referenceNote, /한글판/);
    assert.equal(
      new Set(group.cards.map((card) => card.code)).size,
      group.cards.length,
      group.code,
    );

    group.cards.forEach((card, index) => {
      assert.equal(card.order, index + 1, card.code);
      assert.ok(card.name, card.code);
      assert.ok(card.image, card.code);
      assert.equal(/No[.]$/.test(card.name), false, card.code);
      if (card.code === "xyp_185" || card.code === "xyp_186") {
        assert.match(card.image, /^https:\/\/tcgbox[.]co[.]kr\//, card.code);
        assert.match(card.source, /^https:\/\/tcgbox[.]co[.]kr\//, card.code);
      } else {
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
      }
    });
  }
});

test("XY 주요 한국판 세트와 프로모 장수를 보존한다", () => {
  assert.equal(byCode.get("XY")?.cards.length, 188);
  assert.equal(byCode.get("CP6")?.cards.length, 113);
  assert.equal(byCode.get("FXY")?.cards.length, 42);
  assert.equal(byCode.get("XYP")?.cards.length, 191);
});

test("XY 데이터에 BW 공식 이미지가 잘못 섞이지 않는다", () => {
  for (const group of xy) {
    for (const card of group.cards) {
      if (!card.image.includes("pokemonkorea.co.kr")) continue;
      assert.doesNotMatch(card.image, /\/wmimages\/BW\//i, card.code);
    }
  }
});


test("XY 20th에서 확인된 일본판 이미지 26장은 한글판 공식 이미지로 교체됐다", () => {
  const targetCodes = new Set([
    "20th_030/071", "20th_031/071", "20th_032/071",
    "20th_048/071", "20th_049/071", "20th_050/071",
    "20th_051/071", "20th_053/071", "20th_054/071",
    "20th_055/071", "20th_056/071", "20th_057/071",
    "20th_058/071", "20th_059/071", "20th_060/071",
    "20th_061/071", "20th_062/071", "20th_063/071",
    "20th_064/071", "20th_065/071", "20th_066/071",
    "20th_067/071", "20th_068/071", "20th_069/071",
    "20th_070/071", "20th_071/071",
  ]);
  const trainerSet = byCode.get("20th");
  assert.ok(trainerSet);
  const targets = trainerSet.cards.filter((card) => targetCodes.has(card.code));
  assert.equal(targets.length, targetCodes.size);
  for (const card of targets) {
    assert.match(card.image, /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\//, card.code);
    assert.match(card.imageReferenceNote || "", /한글판 공식 참고 이미지/, card.code);
    assert.ok(card.imageReferenceSet, card.code);
  }
});


test("XY 일본판 이미지로 판별된 슬롯은 모두 한글판 이미지로 교체됐다", () => {
  const targetCodes = new Set([
    "20th_002/071","20th_011/071","20th_012/071","20th_020/071","20th_023/071","20th_025/071",
    "20th_030/071","20th_031/071","20th_032/071","20th_039/071","20th_041/071",
    "20th_048/071","20th_049/071","20th_050/071","20th_051/071","20th_053/071","20th_054/071",
    "20th_055/071","20th_056/071","20th_057/071","20th_058/071","20th_059/071","20th_060/071",
    "20th_061/071","20th_062/071","20th_063/071","20th_064/071","20th_065/071","20th_066/071",
    "20th_067/071","20th_068/071","20th_069/071","20th_070/071","20th_071/071",
    "cp4_132/131","cp4_134/131","cp4_136/131","cp4_137/131","cp4_140/131","cp5_038/036",
    "fxy_037","fxy_038","fxy_039","fxy_041","rbd_018","rbd_019","x30_015/014",
    "xy10_088/078","xy3_104/096","xy4_097/088","xy7_093/081","xy7_094/081","xy9_089/080",
    "xya_022/021","xyb_020/018","xyc_024/023","xyd_019/018","xye_023/022","xye_024/022",
    "xye_025/022","xye_026/022","xyf_017/016","xyh_027/026","xyp_122","xyp_185","xyp_186",
  ]);
  const targets = xy.flatMap((group) => group.cards).filter((card) => targetCodes.has(card.code));
  assert.equal(targets.length, targetCodes.size);
  for (const card of targets) {
    assert.doesNotMatch(card.image, /static[.]tcgexchange[.]kr/, card.code);
    assert.match(card.imageReferenceNote || "", /한글판/, card.code);
  }
  assert.match(targets.find((card) => card.code === "xyp_185")?.image || "", /xy-p%20185[.]jpg$/);
  assert.match(targets.find((card) => card.code === "xyp_186")?.image || "", /xy-p%20186[.]jpg$/);
});
