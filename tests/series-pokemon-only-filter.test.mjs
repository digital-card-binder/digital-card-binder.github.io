import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const catalog = readFileSync(new URL("../catalog.js", import.meta.url), "utf8");
const controls = readFileSync(new URL("../series-scope-filter.js", import.meta.url), "utf8");
const national = JSON.parse(readFileSync(new URL("../data/pokedex.json", import.meta.url), "utf8"));
const species = national.records.map((record) => record.nameKo);

function sourceOf(name) {
  const start = catalog.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "missing " + name);
  const end = catalog.indexOf("\n}\n", start);
  assert.notEqual(end, -1, "missing end of " + name);
  return catalog.slice(start, end + 2);
}

const definitions = [
  "seriesCardRange",
  "isBaseSeriesCard",
  "isSeriesPokemonCard",
  "applySeriesScope",
].map(sourceOf).join("\n");

function filterCards(base, onlyPokemon, originals) {
  const input = JSON.stringify(originals);
  const result = runInNewContext(
    "let groups = [{code: 'test', cards: " + input + "}];\n" +
    "let seriesBaseOnly = " + String(base) + ";\n" +
    "let seriesPokemonOnly = " + String(onlyPokemon) + ";\n" +
    "let seriesPokemonNames = new Set(" + JSON.stringify(species) + ");\n" +
    definitions + "\napplySeriesScope();\n" +
    "({ cards: groups[0]?.cards || [], groupCount: groups.length });",
  );
  return result;
}

test("마스터·기본 각각 포켓몬만 보기와 전체 보기가 독립적으로 동작한다", () => {
  const cards = [
    { name: "피카츄", code: "t_001/002", owned: true, accountKey: "a" },
    { name: "상처약", code: "t_002/002", owned: false, accountKey: "b" },
    { name: "가라르 나옹", code: "t_003/002", owned: true, accountKey: "c" },
    { name: "기본 불꽃 에너지", code: "t_004/002", owned: false, accountKey: "d" },
  ];
  assert.deepEqual(Array.from(filterCards(false, false, cards).cards, (c) => c.name), [
    "피카츄", "상처약", "가라르 나옹", "기본 불꽃 에너지",
  ]);
  assert.deepEqual(Array.from(filterCards(true, false, cards).cards, (c) => c.name), [
    "피카츄", "상처약",
  ]);
  assert.deepEqual(Array.from(filterCards(false, true, cards).cards, (c) => c.name), [
    "피카츄", "가라르 나옹",
  ]);
  assert.deepEqual(Array.from(filterCards(true, true, cards).cards, (c) => c.name), [
    "피카츄",
  ]);
  const result = filterCards(false, true, cards);
  assert.equal(result.cards[0].owned, true);
  assert.equal(result.cards[0].accountKey, "a");
  assert.equal(cards.length, 4, "Original input must not be mutated");
});

test("기존 카드 세트에서 ex·V·지역폼·태그팀만 포함하고 트레이너스와 에너지는 제외한다", () => {
  const samples = [
    ["피카츄 VMAX", true],
    ["갸라도스ex", true],
    ["메가리자몽 X ex", true],
    ["M 리자몽 EX", true],
    ["알로라식스테일", true],
    ["레지에레키 VMAX [다이맥스]", true],
    ["N의 조로아", true],
    ["피카츄&제크로무 GX", true],
    ["기본 불꽃 에너지", false],
    ["포켓몬 교체", false],
    ["박사의 연구", false],
    ["피카츄 인형", false],
    ["리자몽 스피릿링크", false],
  ];
  const result = filterCards(false, true, samples.map(([name], i) => ({
    name, code: "t_" + String(i + 1).padStart(3, "0") + "/099",
  })));
  const found = new Set(Array.from(result.cards, (c) => c.name));
  for (const [name, isPokemon] of samples) assert.equal(
    found.has(name), isPokemon, name,
  );
});

test("포켓몬 전용 스위치는 두 범위 모두에 보이며 URL 뒤로 가기·보유 데이터 공유를 지원한다", () => {
  assert.match(controls, /id="series-pokemon-only"/);
  assert.match(controls, /data-scope="all"/);
  assert.match(controls, /data-scope="base"/);
  assert.match(controls, /params\.get\("pokemon"\) === "1"/);
  assert.match(controls, /history\.pushState/);
  assert.match(controls, /popstate/);
  assert.match(catalog, /account\.applyGroups\(groups\);[\s\S]*?allSeriesGroups = groups;[\s\S]*?applySeriesScope\(\);/);
  assert.match(catalog, /if \(seriesPokemonOnly\) params\.set\("pokemon", "1"\)/);
  assert.match(catalog, /seriesPokemonOnly\].join\("\|"\)/);
});
