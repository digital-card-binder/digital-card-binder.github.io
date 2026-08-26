import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = JSON.parse(readFileSync(new URL("../data/ar.json", import.meta.url), "utf8"));
const supplement = JSON.parse(
  readFileSync(new URL("../data/ar-supplement.json", import.meta.url), "utf8"),
);

const byCode = new Map(base.map((group) => [String(group.code).toLowerCase(), group]));
for (const group of supplement) byCode.set(String(group.code).toLowerCase(), group);
const merged = [...byCode.values()];
const total = merged.reduce((sum, group) => sum + (group.cards || []).length, 0);

assert.equal(base.length, 32);
assert.equal(base.reduce((sum, group) => sum + (group.cards || []).length, 0), 498);
assert.equal(base.some((group) => String(group.code).toLowerCase() === "m5"), true);
assert.equal(merged.length, 33);
assert.equal(total, 510);
assert.equal(merged.some((group) => String(group.code).toLowerCase() === "m6"), true);

console.log("AR current baseline is 33 sets / 510 cards");
