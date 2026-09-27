import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("series print variants stay inside one ownership override", async () => {
  const manager = await read("firebase-page-manager.js");

  assert.match(manager, /SERIES_PRINT_VARIANTS = new Set\(\["normal", "holo", "mirror", "other"\]\)/);
  assert.match(manager, /item\.printVariants = normalizePrintVariants\(value\.printVariants, owned\)/);
  assert.match(manager, /card\.printVariants =[\s\S]*?normalizePrintVariants\(override\?\.printVariants, card\.owned\)/);
  assert.match(manager, /printVariants: nextOwned[\s\S]*?normalizePrintVariants\(current\.printVariants, true\)/);
  assert.doesNotMatch(manager, /printVariants.*accountKey/);
});

test("series dialog offers base holo mirror and other without creating extra cards", async () => {
  const catalog = await read("catalog.js");

  assert.match(catalog, /\{ id: "normal", label: "기본" \}/);
  assert.match(catalog, /\{ id: "holo", label: "홀로" \}/);
  assert.match(catalog, /\{ id: "mirror", label: "미러" \}/);
  assert.match(catalog, /\{ id: "other", label: "기타" \}/);
  assert.match(catalog, /name="series-print-variant"/);
  assert.match(catalog, /const printVariants = owned \? seriesEditorPrintVariants\(\) : \[\]/);
  assert.match(catalog, /saveOverride\(activeCard\.accountKey, \{\s*owned,\s*printVariants,/);
});

test("search index remains one record per canonical series card", async () => {
  const searchBuilder = await read("scripts/build-pokemon-search-index.mjs");

  assert.match(searchBuilder, /\(group\?\.cards \|\| \[\]\)\.map\(\(card\) => compactCard\(card, group, metadata\)\)/);
  assert.doesNotMatch(searchBuilder, /printVariants/);
});
