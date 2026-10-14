import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("all standalone dexes use the shared quick control contract", () => {
  const nav = read("collector-nav.js");
  for (const id of [
    "national",
    "series",
    "ar",
    "pack",
    "pokemon",
    "artist",
    "people",
    "trainerPokemon",
    "fossil",
    "world",
    "artThemes",
  ]) {
    assert.match(nav, new RegExp(`\\b${id}: \\{`), `${id}: unified control config`);
  }

  for (const label of ["전체", "보유", "미보유"]) {
    assert.match(nav, new RegExp(`>${label}<`));
  }

  assert.match(nav, /function installUnifiedDexControls\(\)/);
  assert.match(nav, /target[?][.]click[?][.]\(\)/);
  assert.match(nav, /collector-status-source/);
  assert.match(nav, /collector-quick-filter-surface/);
  assert.match(nav, /installUnifiedDexControls\(\);/);
});

test("shared quick controls never write or merge collection ownership", () => {
  const nav = read("collector-nav.js");
  const start = nav.indexOf("const UNIFIED_DEX_CONTROL_CONFIG");
  const end = nav.indexOf("function addCardLayoutToggle", start);
  assert.ok(start >= 0 && end > start);
  const sharedControls = nav.slice(start, end);
  assert.doesNotMatch(sharedControls, /saveOwned|saveOverride|overrides|documentId/);
  assert.match(sharedControls, /button\[data-status=/);
});

test("all collection filters are directly available with three compact status buttons", () => {
  const css = read("collector.css");
  const nav = read("collector-nav.js");
  assert.match(css, /[.]collector-quick-controls/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /[.]collector-status-source \{\s*display: none !important/);
  assert.match(css, /[.]collector-filter-always-visible/);
  assert.match(nav, /surface[.]classList[.]add\("collector-filter-always-visible"\)/);
  assert.doesNotMatch(nav, /setFilterOpen\(/);
  assert.match(css, /@media \(max-width: 690px\)[\s\S]*?[.]collector-quick-controls/);
});

test("world exploration gets the same visual all-owned-missing filter without changing its data", () => {
  const nav = read("collector-nav.js");
  assert.match(nav, /worldVisualFilter: true/);
  assert.match(nav, /function applyWorldVisualStatus\(status\)/);
  assert.match(nav, /#world-binder-content [.]world-slot/);
  assert.match(nav, /classList[.]contains\("is-missing"\)/);
  assert.match(nav, /attributeFilter: \["class"\]/);
});


test("collection actions never create a second row inside search filters", () => {
  const nav = read("collector-nav.js");
  const quick = read("catalog.js");
  const css = read("collector.css");

  assert.match(nav, /actions[.]append\(layoutOptions\);\s*resultsBar[.]append\(actions\);/);
  assert.match(nav, /headerActions[.]children/);
  assert.doesNotMatch(nav, /filterSurface[.]append\(catalogActions\)/);
  assert.doesNotMatch(nav, /simpleFilterSurface[.]append\(actions\)/);
  assert.match(nav, /collector-redundant-filter-row/);

  assert.match(quick, /resultActions[.]prepend\(wrap\)/);
  assert.match(quick, /catalog-quick-collect--inline/);
  assert.doesNotMatch(quick, /simpleFilterSurface[.]append\(wrap\)/);
  assert.match(quick, /aria-label="빠른 수집 모드"/);

  assert.match(css, /Unified compact dex toolbars/);
  assert.match(css, /[.]catalog-filter-row[.]collector-redundant-filter-row/);
  assert.match(css, /[.]catalog-quick-collect--inline/);
  assert.match(css, /[.]pack-filter-panel/);
});

test("all 11 standalone dexes share the same collection action placement", () => {
  const nav = read("collector-nav.js");
  const start = nav.indexOf("const UNIFIED_DEX_CONTROL_CONFIG");
  const end = nav.indexOf("const SIMPLE_DEX_COLLECTIONS", start);
  const config = nav.slice(start, end);
  for (const id of [
    "national", "series", "ar", "pack", "pokemon",
    "artist", "people", "trainerPokemon", "fossil", "world", "artThemes",
  ]) {
    assert.match(config, new RegExp(`\\b${id}: \\{`));
  }
  assert.match(nav, /function addCardLayoutToggle\(\)/);
  assert.match(nav, /resultsBar[.]append\(actions\)/);
});
