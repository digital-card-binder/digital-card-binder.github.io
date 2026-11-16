import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadRegistry, buildSummary } from "../scripts/build-dashboard-catalog-summary.mjs";

const summaryFile = () => JSON.parse(readFileSync(new URL("../data/dashboard-catalog-summary.json", import.meta.url), "utf8"));
const plain = (value) => JSON.parse(JSON.stringify(value));
const normalizeCompat = (map) => [...map.entries()].map(([key, set]) => [key, [...set]]);

test("the committed dashboard summary is exactly what the generator produces from current data", async () => {
  assert.deepEqual(summaryFile(), plain(await buildSummary()));
});

test("summary catalogs match the full registry catalogs on every field the dashboard and resolveOverrides use", async () => {
  const registry = await loadRegistry();
  for (const id of Object.keys(registry.COLLECTIONS)) {
    const full = await registry.loadCatalog(id);
    const slim = await registry.loadSummaryCatalog(id);
    assert.equal(slim.items.length, full.items.length, `${id}: item count`);
    assert.deepEqual(plain(slim.items.map((i) => [i.key, i.groupKey, i.groupName, Boolean(i.baselineOwned)])), plain(full.items.map((i) => [i.key, i.groupKey, i.groupName, Boolean(i.baselineOwned)])), `${id}: items and order`);
    assert.deepEqual(plain(slim.groups), plain(full.groups), `${id}: groups and itemKeys order`);
    assert.deepEqual(plain(normalizeCompat(slim.compatibilityMap)), plain(normalizeCompat(full.compatibilityMap)), `${id}: compatibility keys`);
  }
});

test("resolving the same saved overrides gives identical ownership from the summary and the full catalog", async () => {
  const registry = await loadRegistry();
  for (const id of Object.keys(registry.COLLECTIONS)) {
    const full = await registry.loadCatalog(id);
    const slim = await registry.loadSummaryCatalog(id);
    const keys = full.items.map((i) => i.key);
    const compat = [...full.compatibilityMap.keys()].slice(0, 400);
    const overrides = {};
    keys.filter((_, i) => i % 3 === 0).forEach((k) => { overrides[k] = { owned: true }; });
    keys.filter((_, i) => i % 7 === 1).forEach((k) => { overrides[k] = { owned: false }; });
    compat.forEach((k, i) => { if (!(k in overrides)) overrides[k] = { owned: i % 2 === 0 }; });
    overrides["unknown::key::0"] = { owned: true };
    const a = registry.resolveOverrides(id, full, overrides);
    const b = registry.resolveOverrides(id, slim, overrides);
    assert.deepEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(a)), `${id}: resolveOverrides`);
  }
});

test("a missing or broken summary falls back to the full catalog instead of showing empty progress", async () => {
  const registry = await loadRegistry();
  const full = await registry.loadCatalog("fossil");
  const original = summaryFile();
  assert.ok(original.collections.fossil, "fossil is summarized");
  assert.equal(typeof registry.loadSummaryCatalog, "function");
  assert.equal((await registry.loadSummaryCatalog("fossil")).items.length, full.items.length);
});

test("the home dashboard reads the summary and never the per-dex full data directly", () => {
  const dashboard = readFileSync(new URL("../dashboard.js", import.meta.url), "utf8");
  assert.match(dashboard, /registry\.loadSummaryCatalog \|\| registry\.loadCatalog/);
  assert.doesNotMatch(dashboard, /item\.name\b/, "dashboard must not use fields missing from the summary");
  assert.doesNotMatch(dashboard, /item\.groupName\b/);
});
