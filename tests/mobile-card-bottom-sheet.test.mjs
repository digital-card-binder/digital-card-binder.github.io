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
  assert.match(js, /renderedCards = shown/);
});

test("catalog detail sheet supports previous-next buttons and horizontal swipe", async () => {
  const js = await read("catalog.js");

  assert.match(js, /function openAdjacentCard\(direction\)/);
  assert.match(js, /data-sheet-prev/);
  assert.match(js, /data-sheet-next/);
  assert.match(js, /Math\.abs\(dx\) >= 56/);
  assert.match(js, /openAdjacentCard\(dx < 0 \? 1 : -1\)/);
  assert.match(js, /dy >= 90/);
  assert.match(js, /closeCatalogDialog\(\)/);
});

test("AR card details use the same bottom-sheet navigation contract", async () => {
  const js = await read("ar.js");

  assert.match(js, /function ensureMobileCardSheetControls\(/);
  assert.match(js, /renderedCards = shown/);
  assert.match(js, /toggleCard\(activeCard, control\)/);
  assert.match(js, /openAdjacentCard\(dx < 0 \? 1 : -1\)/);
  assert.match(js, /closeArDialog\(\)/);
});
