import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const groups = JSON.parse(
  readFileSync(new URL("../data/series.json", import.meta.url), "utf8"),
);
const sm = groups.filter((group) => group.era === "SM");
const byCode = new Map(sm.map((group) => [group.code, group]));

const expected = [
  ["sm1S", "썬 컬렉션", 73],
  ["sm1M", "문 컬렉션", 73],
  ["sm1+", "썬&문", 77],
  ["sm60A", "전력 배틀 스타터 세트 「루가루암 GX」", 27],
  ["sm2K", "알로라의 햇빛", 62],
  ["sm2L", "알로라의 달빛", 62],
  ["sm2+", "새로운 시련", 75],
  ["sm3H", "어둠을 밝힌 무지개", 64],
  ["sm3N", "빛을 삼킨 어둠", 64],
  ["sm3+", "빛나는 전설", 91],
  ["sm4S", "각성의 용사", 62],
  ["sm4A", "초차원의 침략자", 62],
  ["sm4+", "GX 배틀부스트", 125],
  ["sm5S", "울트라썬", 78],
  ["sm5M", "울트라문", 78],
  ["sm5+", "울트라포스", 72],
  ["sm6", "금단의 빛", 110],
  ["sm6a", "드래곤스톰", 75],
  ["sm6b", "챔피언로드", 86],
  ["sm7", "창공의 카리스마", 112],
  ["sm7a", "플라스마 스파크", 73],
  ["sm7b", "페어리라이즈", 63],
  ["sm8", "버스트임팩트", 111],
  ["sm8a", "다크오더", 65],
  ["sm8b", "GX 울트라샤이니", 250],
  ["sm9", "태그볼트", 118],
  ["sm9a", "나이트유니슨", 70],
  ["sm9b", "풀메탈월", 69],
  ["sm10", "더블블레이즈", 116],
  ["sm10a", "GG엔드", 69],
  ["sm10b", "스카이레전드", 69],
  ["smp2", "영화 스페셜 팩 「명탐정 피카츄」", 24],
  ["sm11", "미라클트윈", 115],
  ["sm11a", "리믹스바우트", 80],
  ["sm11b", "드림리그", 75],
  ["sm12", "얼터제네시스", 117],
  ["sm12a", "TAG TEAM GX 태그올스타즈", 235],
  ["SMP", "썬&문 프로모 카드", 249],
  ["sm30A", "썬&문 랜덤30장덱", 89],
  ["sm60B", "전격 스타터 세트 「라이코 GX」", 23],
];

test("SM 한국판 카탈로그는 Dogam 기준 40세트 3608장이다", () => {
  assert.deepEqual(
    sm.map((group) => [group.code, group.displayName, group.cards.length]),
    expected,
  );
  assert.equal(sm.reduce((sum, group) => sum + group.cards.length, 0), 3608);
});

test("SM 전 카드 슬롯은 한글명과 검증 가능한 한국판 이미지 소스를 가진다", () => {
  for (const group of sm) {
    assert.equal(group.referenceSource, "https://www.dogam.app/sets", group.code);
    assert.equal(group.referenceImageRegion, "KR", group.code);
    assert.match(group.referenceNote, /한글판/, group.code);
    assert.equal(new Set(group.cards.map((card) => card.code)).size, group.cards.length, group.code);

    group.cards.forEach((card, index) => {
      assert.equal(card.order, index + 1, card.code);
      assert.ok(String(card.name || "").trim(), card.code);
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
      assert.doesNotMatch(card.image, /pokemontcg[.]io|collectory[.]cc/i, card.code);
    });
  }
});

test("기존 누락이었던 SM 프로모와 구축덱도 정식 그룹으로 포함한다", () => {
  assert.equal(byCode.get("SMP")?.cards.length, 249);
  assert.equal(byCode.get("sm30A")?.cards.length, 89);
  assert.equal(byCode.get("sm60A")?.cards.length, 27);
  assert.equal(byCode.get("sm60B")?.cards.length, 23);
});

test("SM 주요 하이클래스·강화팩은 비밀 카드까지 Dogam 장수를 유지한다", () => {
  assert.equal(byCode.get("sm1+")?.cards.length, 77);
  assert.equal(byCode.get("sm4+")?.cards.length, 125);
  assert.equal(byCode.get("sm8b")?.cards.length, 250);
  assert.equal(byCode.get("sm12a")?.cards.length, 235);
});
