import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const pages = [
  { html: "fossil.html", script: "fossil.js", grid: "fossil-card-grid", dialog: "fossil-dialog", trigger: "fossil-card-button" },
  { html: "trainer-pokemon.html", script: "trainer-pokemon.js", grid: "tp-card-grid", dialog: "tp-dialog", trigger: "pokemon-card-button" },
  { html: "pokemon-search.html", script: "pokemon-search.js", grid: "pokemon-search-grid", dialog: "pokemon-search-dialog", trigger: "pokemon-card-button" },
  { html: "artists.html", script: "artists.js", grid: "artist-card-grid", dialog: "artist-dialog", trigger: "artist-card-button" },
  { html: "art-themes.html", script: "art-themes.js", grid: "art-theme-card-grid", dialog: "art-theme-dialog", trigger: "art-theme-card-open" },
  { html: "people.html", script: "people.js", grid: "people-grid", dialog: "people-dialog", trigger: "pokemon-card-button" },
  { html: "world.html", script: "world.js", grid: "world-binder-content", dialog: "world-card-dialog", trigger: "world-card-open" },
  { html: "national.html", script: "app.js", grid: "card-grid", dialog: "card-dialog", trigger: "pokemon-card-button" },
  { html: "series.html", script: "catalog.js", grid: "catalog-grid", dialog: "catalog-dialog", trigger: "pokemon-card-button" },
  { html: "pokemon-collections.html", script: "catalog.js", grid: "catalog-grid", dialog: "catalog-dialog", trigger: "pokemon-card-button" },
  { html: "ar.html", script: "ar.js", grid: "catalog-grid", dialog: "catalog-dialog", trigger: "pokemon-card-button" },
];

test("shared detail navigation is wired to the real grid, dialog and card trigger on every target dex", async () => {
  const helper = await read("detail-card-navigation.js");
  for (const page of pages) {
    const html = await read(page.html);
    const script = await read(page.script);
    assert.match(html, new RegExp(`id=["']${page.grid}["']`), `${page.html}: grid exists`);
    assert.match(html, new RegExp(`id=["']${page.dialog}["']`), `${page.html}: dialog exists`);
    assert.match(html, /detail-card-navigation\.js/, `${page.html}: shared helper loaded`);
    assert.ok(helper.includes(`grid: "#${page.grid}"`), `${page.html}: grid configured`);
    assert.ok(helper.includes(`dialog: "#${page.dialog}"`), `${page.html}: dialog configured`);
    assert.ok(helper.includes(`trigger: ".${page.trigger}"`), `${page.html}: correct trigger configured`);
    assert.ok(script.includes(page.trigger), `${page.script}: trigger class is generated`);
    if (page.script === "app.js") {
      assert.match(script, /cardTemplate\.content\.firstElementChild\.cloneNode\(true\)/, `${page.script}: card template articles are cloned`);
    } else {
      assert.match(script, /article\.className\s*=|article\.className\s*=/, `${page.script}: card articles are generated`);
    }
  }
});

test("navigation follows currently rendered cards and supports keyboard and horizontal touch gestures", async () => {
  const helper = await read("detail-card-navigation.js");
  assert.match(helper, /querySelectorAll\("article"\)/);
  assert.match(helper, /dialog\.querySelector\("\.dialog-card-copy, \.art-theme-dialog-copy"\)/, "navigation only attaches to dialogs that have a detail pane");
  assert.match(helper, /event\.key === "ArrowLeft"/);
  assert.match(helper, /event\.key === "ArrowRight"/);
  assert.match(helper, /addEventListener\("touchstart"/);
  assert.match(helper, /addEventListener\("touchend"/);
  assert.match(helper, /Math\.abs\(dx\) < 55/);
  assert.match(helper, /Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.25/);
  assert.match(helper, /requestAnimationFrame\(\(\) => target\.click\(\)\)/);
});

test("navigation helper does not write collection ownership or account data", async () => {
  const helper = await read("detail-card-navigation.js");
  assert.doesNotMatch(helper, /localStorage|sessionStorage|firebase|firestore|\.owned\s*=|setItem\(/i);
});

test("batched dex lists keep detail navigation going past the first loaded batch", async () => {
  const helper = await read("detail-card-navigation.js");
  for (const page of [
    { html: "national.html", grid: "card-grid", more: "load-more", total: "result-count" },
    { html: "people.html", grid: "people-grid", more: "people-load-more", total: "people-result-count" },
    { html: "pokemon-search.html", grid: "pokemon-search-grid", more: "pokemon-search-load-more", total: "pokemon-search-result-count" },
  ]) {
    const html = await read(page.html);
    assert.match(html, new RegExp(`id=["']${page.more}["']`), `${page.html}: load-more button exists`);
    assert.match(html, new RegExp(`id=["']${page.total}["']`), `${page.html}: total counter exists`);
    assert.ok(helper.includes(`grid: "#${page.grid}", more: "#${page.more}", total: "#${page.total}",`), `${page.html}: batch loading configured`);
  }
  assert.match(helper, /more\.click\(\);\s*items = cardsInGrid/);
  const catalog = await read("catalog.js");
  assert.match(catalog, /pokemonVisibleLimit \+= 96;\s*render\(\);\s*index = renderedCards\.indexOf\(activeCard\);/);
  assert.match(catalog, /total: matchedCardTotal/);
});

test("previous and next buttons are pinned to the bottom of every detail dialog", async () => {
  const helper = await read("detail-card-navigation.js");
  assert.match(helper, /\.detail-card-navigation\{display:flex!important;[^}]*position:sticky;bottom:0/);
  assert.match(helper, /dialog\.append\(nav\)/, "navigation is a direct child of the dialog, not the end of a long description");
  assert.match(helper, /classList\.add\("has-pinned-nav"\)/);
  assert.match(helper, /min-height:0!important;max-height:100%;overflow-y:auto/, "desktop panes scroll instead of being clipped");
  assert.match(helper, /pins-on-mobile>\.detail-card-navigation\{order:9;margin-top:auto\}/);
  assert.doesNotMatch(helper, /#art-theme-dialog \.detail-card-navigation/, "no dex-specific navigation styling");
});

test("the other-dex list stays inside the detail pane so dialogs do not scroll sideways", async () => {
  const nav = await read("collector-nav.js");
  assert.match(nav, /dialog\.querySelector\("\.art-theme-dialog-copy"\) \|\|\s*dialog;/);
  const css = await read("collector.css");
  assert.match(css, /margin-right: calc\(-1 \* var\(--related-bleed, 18px\)\);\s*padding-right: var\(--related-bleed, 18px\);/);
  const world = await read("world.css");
  assert.match(world, /\.world-card-dialog \.dialog-card-copy \{[^}]*--related-bleed: 16px;/);
});

test("long set names cannot stretch the card search filters past the page", async () => {
  const css = await read("pokemon-search.css");
  assert.match(css, /\.pokemon-search-advanced-grid \.catalog-select\{min-width:0;grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.pokemon-search-advanced-grid \.catalog-select select\{width:100%;min-width:0;max-width:100%\}/);
});
