import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("mobile card dialogs use the shared bottom-sheet layout", async () => {
  const css = await read("styles.css");

  assert.match(css, /Mobile card detail bottom sheet/);
  assert.match(
    css,
    /@media \(max-width: 690px\)[\s\S]*?\.card-dialog\[open\]\s*\{[\s\S]*?inset:\s*auto 0 0 0;[\s\S]*?max-height:\s*min\(88dvh, 760px\)/,
  );
  assert.match(css, /\.card-dialog\[open\]::before\s*\{[\s\S]*?width:\s*42px;[\s\S]*?height:\s*5px/);
  assert.match(css, /\.mobile-card-sheet-actions\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?bottom:\s*0/);
  assert.match(css, /\.mobile-card-sheet-nav\s*\{/);
});

test("catalog detail sheet keeps one-tap ownership and verified version access", async () => {
  const js = await read("catalog.js");

  assert.match(js, /function ensureMobileCardSheetControls\(/);
  assert.match(js, /data-sheet-collect/);
  assert.match(js, /toggleCatalogCompletion\(activeCard, control\)/);
  assert.match(js, /data-sheet-variant/);
  assert.match(js, /openQuickVariantPicker\(activeCard\)/);
  assert.match(js, /renderedCards = visibleCards/);
  assert.match(js, /shown[.]slice\(0, pokemonVisibleLimit\)/);
});

test("catalog detail sheet supports previous-next buttons and horizontal swipe", async () => {
  const js = await read("catalog.js");

  assert.match(js, /function openAdjacentCard\(direction\)/);
  assert.match(js, /data-sheet-prev/);
  assert.match(js, /data-sheet-next/);
  // 좌우 스와이프는 공통 모듈(detail-card-navigation.js) 한 곳에서만 처리한다.
  assert.doesNotMatch(js, /Math\.abs\(dx\) >= 56/);
  assert.doesNotMatch(js, /openAdjacentCard\(dx < 0 \? 1 : -1\)/);
  assert.match(js, /DetailCardNavigationAdapters/);
  assert.match(js, /step: \(direction\) => openAdjacentCard\(direction\)/);
  assert.match(js, /dy >= 90/);
  assert.match(js, /closeCatalogDialog\(\)/);
});

test("AR card details use the same bottom-sheet navigation contract", async () => {
  const js = await read("ar.js");

  assert.match(js, /function ensureMobileCardSheetControls\(/);
  assert.match(js, /renderedCards = shown/);
  assert.match(js, /toggleCard\(activeCard, control\)/);
  assert.doesNotMatch(js, /openAdjacentCard\(dx < 0 \? 1 : -1\)/);
  assert.match(js, /DetailCardNavigationAdapters/);
  assert.match(js, /closeArDialog\(\)/);
});

test("sheet controls are hidden outside the mobile layout and the duplicate bar cannot override the mobile hide", async () => {
  const css = await read("styles.css");
  const helper = await read("detail-card-navigation.js");
  const beforeMobile = css.slice(0, css.indexOf("/* Mobile card detail bottom sheet */"));
  assert.match(beforeMobile, /\.mobile-card-sheet-nav,\s*\.mobile-card-sheet-actions\s*\{\s*display:\s*none;/);
  assert.match(helper, /\.detail-card-navigation\.is-duplicate-mobile\{display:none!important\}/);
  assert.match(css, /\.card-dialog \.dialog-card-image\s*\{\s*touch-action:\s*pan-y;/);
});

test("series and AR navigation share one position source with the common helper", async () => {
  const helper = await read("detail-card-navigation.js");
  assert.match(helper, /window\.DetailCardNavigationAdapters/);
  assert.match(helper, /adapter\.step\(direction\)/);
  for (const file of ["catalog.js", "ar.js"]) {
    const js = await read(file);
    assert.match(js, /\["#catalog-dialog"\] = \{\s*state: \(\) =>/, `${file}: adapter registered`);
    assert.match(js, /window\.DetailCardNavigation\?\.sync\("#catalog-dialog"\)/, `${file}: bar refreshed after a sheet move`);
  }
});
