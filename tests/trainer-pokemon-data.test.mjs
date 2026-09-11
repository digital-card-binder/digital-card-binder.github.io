import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const data = JSON.parse(await readFile(new URL("../data/trainer-pokemon.json", import.meta.url), "utf8"));
test("trainer and Pokemon dex uses stable National Dex groups and verified Korean cards", () => {
  const cards = data.groups.flatMap((group) => group.cards || []);
  assert.equal(data.title, "트레이너와 포켓몬 도감");
  assert.equal(data.grouping, "pokemon-national-dex");
  assert.equal(data.catalogCount, cards.length);
  assert.equal(cards.length, 245);
  assert.equal(data.groups.length, 172);
  assert.deepEqual(data.groups.map((g) => g.nationalDexNo), [...data.groups.map((g) => g.nationalDexNo)].sort((a,b) => a-b));
  assert.equal(cards.every((c) => c.owned === false), true);
  assert.equal(new Set(cards.map((c) => c.code.toLowerCase())).size, cards.length);
  for (const group of data.groups) {
    const accountIndices = new Set();
    for (const card of (group.cards || [])) {
      assert.equal(card.pokemonName, group.name);
      assert.ok(card.personName);
      assert.ok(["named","other"].includes(card.personType));
      assert.equal(Number.isInteger(card.accountIndex), true);
      assert.ok(card.accountIndex >= 0);
      assert.equal(accountIndices.has(card.accountIndex), false, `${group.name} accountIndex ${card.accountIndex}`);
      accountIndices.add(card.accountIndex);
      assert.match(card.image, /^https:\/\/cards[.]image[.]pokemonkorea[.]co[.]kr\//);
      assert.match(card.source, /^https:\/\/pokemoncard[.]co[.]kr\/cards(?:\/detail\/.*)?$/);
    }
  }
  const byCode = new Map(cards.map((c) => [c.code.toLowerCase(), c]));
  assert.equal(byCode.get("sv9_109/100")?.personName, "N");
  assert.equal(byCode.get("m2a_206/193")?.personName, "비주기");
  assert.equal(byCode.get("m2a_245/193")?.personName, "성호");
  assert.equal(byCode.get("sv9a_088/063")?.name, "페퍼의 마피티프 ex");
  assert.equal(byCode.get("sv9a_088/063")?.personName, "페퍼");
  assert.equal(byCode.get("m2a_208/193")?.personName, "난천");
  assert.equal(byCode.get("sv4a_350/190")?.pokemonName, "님피아");
  assert.equal(byCode.get("sv4a_354/190")?.pokemonName, "마피티프");
  assert.equal(byCode.get("m4_118/083")?.pokemonName, "플라엣테");
  assert.equal(byCode.has("m1l_030/063"), false);
  assert.equal(byCode.has("s8b_081/184"), false);
  assert.equal(byCode.has("sv9a_091/063"), false);
  assert.equal(byCode.has("m2_034/080"), false);
  assert.equal(byCode.has("sv7_132/102"), false);
  assert.equal(byCode.has("m2a_244/193"), false);
  assert.equal(byCode.has("m3_115/080"), false);
  assert.equal(byCode.get("s8b_201/184")?.accountIndex, 1);
  assert.equal(data.audit.series.S.reviewed, 3236);
  assert.equal(data.audit.series.S.included, 112);
  assert.equal(data.audit.series.SM.reviewed, 2982);
  assert.equal(data.audit.series.SM.included, 54);
  assert.deepEqual(data.audit.series.SV, {
    reviewed: 3336,
    included: 60,
    added: 40,
    removed: 1,
    excluded: 3276,
  });
  assert.deepEqual(data.audit.series.M, {
    reviewed: 902,
    included: 16,
    added: 10,
    removed: 1,
    excluded: 886,
  });
  assert.deepEqual(data.audit.held, []);
});
