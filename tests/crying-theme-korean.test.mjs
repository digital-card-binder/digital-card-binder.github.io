import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const root = new URL("../", import.meta.url);
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, root), "utf8"));
const data = read("data/art-themes-crying.json");
const sources = read("data/audits/crying-theme-reference-pool-20261108.json");
const audit = read("data/audits/crying-theme-korean-matches-20261108.json");
const master = [...read("data/series.json"), ...read("data/series-legacy.json")];
test("source counts are grounded and do not imply all 94 Illudex entries were exposed", () => {
  assert.deepEqual(sources.sources.map((s) => s.list.length), [35,31,42]);
  assert.equal(audit.notEnumeratedFromIlludex, 52);
  assert.equal(sources.sources[2].claimedCount, 94);
});
test("crying theme only includes unique identified Korean master prints", () => {
  assert.equal(data.group.code, "crying");
  assert.equal(data.group.name, "우는 포켓몬 도감");
  assert.equal(data.group.cards.length, 9);
  const ids = new Set();
  for (const card of data.group.cards) {
    assert.ok(card.code && !ids.has(card.code));
    ids.add(card.code);
    const group = master.find((g) => String(g.code).toLowerCase() === card.set.toLowerCase());
    assert.ok(group, "set " + card.set);
    const num = card.cardNumber.match(/^([0-9]+)/)?.[1];
    const exact = (group.cards || []).filter((c) => {
      const codeNum = String(c.code || "").match(/_([0-9]+)(?:[/ ]|$)/)?.[1];
      return codeNum && Number(codeNum) === Number(num);
    });
    assert.equal(exact.length, 1, card.code + " unique print");
    assert.equal(card.name, exact[0].name, card.code + " Korean name");
    assert.equal(card.image, exact[0].image, card.code + " own master image");
  }
  assert.equal(audit.importedKoreanCards, data.group.cards.length);
});
test("site adds supplemental theme before applying existing account ownership", () => {
  const js = fs.readFileSync(new URL("art-themes.js", root), "utf8");
  assert.ok(js.includes('data/art-themes-crying.json?v=20261108'));
  assert.ok(js.indexOf("dataset.groups.push(extra.group)") < js.indexOf("manager.applyGroups(dataset.groups)"));
  assert.ok(js.includes('group.code === "crying"'));
});
