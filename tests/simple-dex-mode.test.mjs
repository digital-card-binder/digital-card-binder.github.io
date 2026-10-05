import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("standalone dex screens use the shared card-first simple mode", () => {
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
    assert.match(nav, new RegExp(`"${id}"`), `${id}: simple dex support`);
  }
  assert.match(nav, /function installSimpleDexLayout\(\)/);
  assert.match(nav, /classList[?][.]add[?][.]\("collector-simple-dex"\)/);
  assert.match(nav, /installUnifiedDexControls\(\);[\s\S]*?installSimpleDexLayout\(\);/);
});

test("simple dex filters stay closed until the user asks for them", () => {
  const nav = read("collector-nav.js");
  const start = nav.indexOf("function installUnifiedDexControls");
  const end = nav.indexOf("const SIMPLE_DEX_COLLECTIONS", start);
  assert.ok(start >= 0 && end > start);
  const controls = nav.slice(start, end);

  assert.match(controls, /const syncFilterLayout = \(\) => \{\s*setFilterOpen\(false\);\s*\};/);
  assert.match(controls, /data-quick-status="all"/);
  assert.match(controls, /data-quick-status="owned"/);
  assert.match(controls, /data-quick-status="missing"/);
  assert.match(controls, /data-quick-filter/);
});

test("secondary print and layout tools remain available inside Filter", () => {
  const nav = read("collector-nav.js");
  assert.match(nav, /collector-simple-secondary-actions/);
  assert.match(nav, /filterSurface[.]append\(catalogActions\)/);
  assert.match(nav, /collector-simple-view-actions/);
  assert.match(nav, /simpleFilterSurface[.]append\(actions\)/);
});

test("simple dex CSS removes chrome and keeps cards visually first", () => {
  const css = read("collector.css");

  assert.match(css, /Simple dex mode: card-first, low-chrome collection screens/);
  assert.match(css, /body[.]collector-simple-dex > [.]site-layout [.]stats-grid \{\s*display: none !important/);
  assert.match(css, /body[.]collector-simple-dex [.]hero-description/);
  assert.match(css, /body[.]collector-simple-dex [.]series-dashboard,[\s\S]*?[.]people-generation-overview/);
  assert.match(css, /body[.]collector-simple-dex [.]catalog-era-tabs [.]era-card-thumb \{\s*display: none !important/);
  assert.match(css, /body[.]collector-simple-dex [.]card-grid,[\s\S]*?[.]art-theme-card-grid \{\s*gap: 9px/);
  assert.match(css, /@media \(max-width: 690px\)[\s\S]*?body[.]collector-simple-dex [.]hero \{[\s\S]*?min-height: 62px/);
});

test("selected group summaries stay immediately above quick status controls", () => {
  const nav = read("collector-nav.js");
  for (const selector of [
    ".catalog-summary",
    ".artist-selection-summary",
    ".tp-selection-summary",
    ".fossil-selection-summary",
    ".art-theme-selected-summary",
  ]) {
    assert.ok(nav.includes(selector), selector);
  }
  assert.match(nav, /controls[.]insertAdjacentElement\("beforebegin", summary\)/);
});
