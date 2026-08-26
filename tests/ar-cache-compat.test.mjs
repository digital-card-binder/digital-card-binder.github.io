import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../ar.html", import.meta.url), "utf8");
const ar = readFileSync(new URL("../ar.js", import.meta.url), "utf8");
const supplement = readFileSync(
  new URL("../ar-mega-supplement.js", import.meta.url),
  "utf8",
);
const editor = readFileSync(
  new URL("../ar-card-editor.js", import.meta.url),
  "utf8",
);
const baseData = JSON.parse(
  readFileSync(new URL("../data/ar.json", import.meta.url), "utf8"),
);
const supplementData = JSON.parse(
  readFileSync(new URL("../data/ar-supplement.json", import.meta.url), "utf8"),
);
const manager = readFileSync(
  new URL("../firebase-page-manager.js", import.meta.url),
  "utf8",
);

assert.match(html, /ar-mega-supplement\.js\?v=20260826-4/);
assert.match(html, /ar-card-editor\.js\?v=20260826-2/);
assert.match(html, /ar\.js\?v=20260826-4/);
assert.match(ar, /const EXPECTED_GROUPS = 33;/);
assert.match(ar, /const EXPECTED_TOTAL = 510;/);
assert.match(ar, /const SUPPLEMENT_URL = "\.\/data\/ar-supplement\.json";/);
assert.match(ar, /fetchJson\(DATA_URL, true\)/);
assert.match(ar, /fetchJson\(SUPPLEMENT_URL, false\)/);
assert.match(ar, /normalizeGroups\(mergeGroups\(baseData, supplementData \|\| \[\]\)\)/);
assert.match(ar, /buildSelect\(\);\s*refreshCounts\(\);\s*render\(\);\s*bindUi\(\);/s);
assert.match(ar, /await applyAccountState\(\);/);
assert.doesNotMatch(supplement, /window\.fetch\s*=/);
assert.doesNotMatch(supplement, /response\.json\s*=/);
assert.doesNotMatch(supplement, /new Response\(/);
assert.doesNotMatch(editor, /account\.applyGroups\s*=/);

assert.equal(baseData.length, 32);
assert.equal(
  baseData.reduce((total, group) => total + group.cards.length, 0),
  498,
);
assert.equal(
  baseData.some((group) => String(group.code).toLowerCase() === "m5"),
  true,
  "M5 is already part of the 498-card base catalog",
);
assert.equal(supplementData.length, 2);
assert.equal(
  supplementData.reduce((total, group) => total + group.cards.length, 0),
  24,
);
assert.equal(supplementData[0].code, "m5");
assert.equal(supplementData[1].code, "m6");

const mergedByCode = new Map(
  baseData.map((group) => [String(group.code).toLowerCase(), group]),
);
for (const group of supplementData) {
  mergedByCode.set(String(group.code).toLowerCase(), group);
}
const mergedGroups = [...mergedByCode.values()];
assert.equal(mergedGroups.length, 33);
assert.equal(
  mergedGroups.reduce((total, group) => total + group.cards.length, 0),
  510,
);
assert.equal(
  mergedGroups.some((group) => String(group.code).toLowerCase() === "m6"),
  true,
);
assert.match(manager, /ar:\s*\{ documentId: "arDex" \}/);

console.log("AR staged loader regression contract passed: 33 sets / 510 cards");
