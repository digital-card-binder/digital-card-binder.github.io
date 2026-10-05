import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("series and Pokemon collection pages expose one-tap quick collection", async () => {
  const catalog = await read("catalog.js");
  const css = await read("catalog.css");

  assert.match(catalog, /const QUICK_COLLECT_STORAGE_KEY = "pokemonDexQuickCollectV1"/);
  assert.match(catalog, /function renderQuickCollectControl\(/);
  assert.match(catalog, /카드를 한 번 눌러 보유 · 미보유를 바로 바꿉니다/);
  assert.match(catalog, /if \(quickCollectMode\) \{[\s\S]*?quickToggleCatalogCard\(card, completionButton\)/);
  assert.match(catalog, /className = "catalog-card-detail-button"/);
  assert.match(catalog, /card\.quickCollectSaving/);
  assert.match(css, /body\.is-quick-collect \.catalog-card \.collection-complete-button\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /body\.is-quick-collect \.catalog-card-detail-button\s*\{[\s\S]*?display:\s*block/);
});

test("quick collection keeps details available and opens a compact verified variant picker", async () => {
  const catalog = await read("catalog.js");
  const css = await read("catalog.css");

  assert.match(catalog, /function openQuickVariantPicker\(card\)/);
  assert.match(catalog, /card\.verifiedPrintVariants\.length/);
  assert.match(catalog, /name = "quick-print-variant"/);
  assert.match(catalog, /account\.saveOverride\(card\.accountKey, \{[\s\S]*?owned: true,[\s\S]*?printVariants: variants/);
  assert.match(catalog, /detailButton\.addEventListener\("click"/);
  assert.match(catalog, /openDialog\(card\)/);
  assert.match(css, /\.catalog-quick-variant\s*\{/);
  assert.match(css, /bottom:max\(14px, env\(safe-area-inset-bottom\)\)/);
});

test("AR dex shares the same quick collection preference and interaction", async () => {
  const ar = await read("ar.js");

  assert.match(ar, /const QUICK_COLLECT_STORAGE_KEY = "pokemonDexQuickCollectV1"/);
  assert.match(ar, /function renderQuickCollectControl\(/);
  assert.match(ar, /quickCollectMode = readQuickCollectPreference\(\) && quickCollectCanEdit\(\)/);
  assert.match(ar, /function quickToggleCard\(card, button\)/);
  assert.match(ar, /card\.quickCollectSaving/);
  assert.match(ar, /if \(quickCollectMode\) \{[\s\S]*?quickToggleCard\(card, complete\)/);
  assert.match(ar, /className = "catalog-card-detail-button"/);
});

test("quick collection still writes through the existing account ownership APIs", async () => {
  const catalog = await read("catalog.js");
  const ar = await read("ar.js");

  assert.match(catalog, /account\.saveOwned\(card\.accountKey, nextOwned\)/);
  assert.match(ar, /account\.saveOwned\(card\.accountKey, nextOwned\)/);
  assert.doesNotMatch(catalog, /localStorage\.setItem\([^\n]+owned/);
  assert.doesNotMatch(ar, /localStorage\.setItem\([^\n]+owned/);
});
