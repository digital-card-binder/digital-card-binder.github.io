import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("phase 1 mobile menu uses a local modal and preserves all core destinations", () => {
  const nav = read("site-mobile-nav.js");
  const style = read("styles.css");
  assert.match(nav, /link[.]onclick = [(]event[)] => openLocalMenu[(]event, link[)]/);
  assert.match(nav, /event[.]preventDefault[(][)]/);
  assert.match(nav, /dialog[.]showModal[(][)]/);
  assert.match(nav, /dialog[.]addEventListener[(]"close"/);
  for (const href of ["series.html", "theme.html", "custom.html", "studio.html", "card-radar.html", "collectors.html"]) {
    assert.ok(nav.includes("./" + href), href);
  }
  assert.match(style, /[.]dcb-site-menu-dialog::backdrop/);
  assert.match(style, /env[(]safe-area-inset-bottom/);
});

test("phase 1 series density keeps catalog controls and card data intact", () => {
  const series = read("series.html");
  const css = read("catalog.css");
  for (const id of ["catalog-era", "series-dashboard", "catalog-select", "catalog-search", "catalog-status", "catalog-grid"]) {
    assert.equal((series.match(new RegExp('id="' + id + '"', "g")) || []).length, 1, id);
  }
  assert.match(css, /body\[data-catalog="series"\] [.]catalog-era-tabs \{/);
  assert.match(css, /scroll-snap-type:x proximity/);
  assert.match(css, /body\[data-catalog="series"\] [.]stats-grid/);
});

test("phase 1 theme discovery filters rendered links only; search has a clear empty state", () => {
  const html = read("theme.html");
  const js = read("theme-discovery.js");
  const css = read("theme.css");
  assert.match(html, /id="theme-discovery-search"/);
  assert.match(html, /data-theme-scope="story"/);
  assert.match(html, /data-theme-scope="pokemon"/);
  assert.match(html, /data-theme-scope="special"/);
  assert.match(html, /id="theme-discovery-empty"/);
  assert.match(html, /src="[.]\/theme-discovery[.]js(?:\?v=[^"]+)?"/);
  assert.match(js, /entry[.]card[.]hidden = !match/);
  assert.doesNotMatch(js, /saveOwned|saveOverride|deleteDoc|setDoc|fetch[(]/);
  assert.match(css, /[.]theme-card\[hidden\] \{display:none!important\}/);
});

test("phase 1 shared search UI keeps core owned/missing controls", () => {
  const css = read("ui-consistency.css");
  for (const page of ["series", "pokemon-search", "custom-dex"]) {
    assert.ok(css.includes(page));
  }
  assert.match(css, /min-height:44px;border-radius:10px/);
  assert.match(read("pokemon-search.html"), /id="pokemon-search-advanced-filters"[^>]*open/);
});
