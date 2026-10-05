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

  for (const label of ["전체", "보유", "미보유", "필터"]) {
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

test("mobile filter surfaces collapse behind one shared Filter button", () => {
  const css = read("collector.css");
  assert.match(css, /[.]collector-quick-controls/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /[.]collector-status-source \{\s*display: none !important/);
  assert.match(css, /[.]collector-quick-filter-surface[.]is-quick-filter-collapsed/);
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
