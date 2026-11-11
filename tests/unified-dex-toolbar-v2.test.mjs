import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("series and AR show one set heading and retain the native functional selector", () => {
  const nav = read("collector-nav.js");
  const style = read("collector.css");

  assert.match(nav, /series: "[.]catalog-toolbar [.]catalog-select"/);
  assert.match(nav, /ar: "[.]catalog-toolbar [.]catalog-select"/);
  assert.match(nav, /summary[.]append[(]primarySelector[)]/);
  assert.match(nav, /summary[.]classList[.]add[(]"collector-summary-with-switcher"[)]/);
  assert.match(nav, /primarySelector[.]classList[.]add[(]"collector-set-switcher"[)]/);
  assert.match(nav, /select[.]setAttribute[(][\s\S]*?"aria-label"/);
  assert.match(nav, /caption[.]textContent = "다른 세트"/);
  assert.doesNotMatch(nav, /primaryWrap[.]append[(]primarySelector[)]/);

  assert.match(style, /[.]collector-summary-with-switcher/);
  assert.match(style, /[.]collector-set-switcher select/);
  assert.match(style, /[.]collector-set-switcher:focus-within/);

  for (const page of ["series.html", "ar.html"]) {
    const html = read(page);
    for (const id of ["catalog-select", "catalog-search", "catalog-status", "selected-name", "selected-progress"]) {
      assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `${page}: ${id}`);
    }
  }
});

test("all established collection status filters, card actions and accessibility are preserved", () => {
  const nav = read("collector-nav.js");
  const style = read("collector.css");
  for (const id of [
    "national", "series", "ar", "pack", "pokemon", "artist",
    "people", "trainerPokemon", "fossil", "world", "artThemes",
  ]) {
    assert.match(nav, new RegExp(`\\b${id}: \\{`));
  }
  for (const status of ["all", "owned", "missing"]) {
    assert.ok(nav.includes(`data-quick-status="${status}"`));
  }
  assert.match(nav, /target[?][.]click[?][.][(][)]/);
  assert.match(nav, /installUnifiedDexControls[(][)]/);
  assert.match(nav, /addCardLayoutToggle[(][)]/);
  assert.match(style, /grid-template-columns: repeat[(]3, minmax[(]0, 1fr[)][)]/);
  assert.match(style, /min-height: 44px/);
});

test("collection UI asset references are cache-safe on every participating page", () => {
  const manifest = JSON.parse(read("site-version.json"));
  for (const page of Object.keys(manifest.pages)) {
    const html = read(page);
    for (const asset of ["collector-nav.js", "collector.css"]) {
      if (!html.includes(`./${asset}`)) continue;
      assert.ok(
        html.includes(`./${asset}?v=${manifest.assets[asset]}`),
        `${page}: stale ${asset} cache version`,
      );
    }
  }
});
