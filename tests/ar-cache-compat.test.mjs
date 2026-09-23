import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../ar.html", import.meta.url), "utf8");
const ar = readFileSync(new URL("../ar.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../ar.css", import.meta.url), "utf8");
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
const registry = readFileSync(
  new URL("../collector-collection-registry.js", import.meta.url),
  "utf8",
);

assert.doesNotMatch(html, /ar-count-ui-fix[.]js/);
assert.doesNotMatch(html, /ar-mega-supplement[.]js/);
assert.match(html, /ar-card-editor[.]js[?]v=[0-9a-f]{12}/);
assert.match(html, /ar[.]js[?]v=[0-9a-f]{12}/);
assert.match(ar, /const EXPECTED_GROUPS = 33;/);
assert.match(ar, /const EXPECTED_TOTAL = 510;/);
assert.match(ar, /const SUPPLEMENT_URL = "[.]\/data\/ar-supplement[.]json";/);
assert.match(ar, /const AR_VIEW = new URLSearchParams/);
assert.match(ar, /function scopedNationalGroups/);
assert.match(ar, /code: `national::/);
assert.match(ar, /function installViewTabs/);
assert.match(ar, /function applyViewMode/);
assert.match(ar, /fetchJson\(DATA_URL, true\)/);
assert.match(ar, /fetchJson\(SUPPLEMENT_URL, false\)/);
assert.match(ar, /normalizeGroups\(mergeGroups\(baseData, supplementData \|\| \[\]\)\)/);
assert.match(ar, /await applyAccountState\(\);/);
assert.match(css, /[.]ar-view-tabs/);
assert.match(css, /[.]ar-view-national [.]catalog-select/);
assert.doesNotMatch(editor, /account[.]applyGroups\s*=/);

assert.equal(baseData.length, 32);
assert.equal(
  baseData.reduce((total, group) => total + group.cards.length, 0),
  498,
);
assert.equal(supplementData.length, 2);

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
assert.match(registry, /ar:\s*\{[\s\S]*?documentId: "arDex"/);
assert.match(manager, /registry[.]COLLECTIONS[?][.]\[mode\]/);

console.log("AR integrated loader regression contract passed: 33 sets / 510 cards");
