import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("Binder Studio keeps physical print sizes and lossless page splitting", async () => {
  const html = await read("studio.html");
  const js = await read("studio-custom.js");

  assert.match(js, /const CARD_WIDTH_MM = 63;/);
  assert.match(js, /const CARD_HEIGHT_MM = 88;/);
  assert.match(js, /const SLEEVE_WIDTH_MM = 65;/);
  assert.match(js, /const SLEEVE_HEIGHT_MM = 90;/);
  assert.match(js, /const PRINT_MARGIN_MM = 7;/);
  assert.match(js, /const pageCols = Math\.max\(1, Math\.floor\(availableWidth \/ cellWidth\)\)/);
  assert.match(js, /const pageRows = Math\.max\(1, Math\.floor\(availableHeight \/ cellHeight\)\)/);
  assert.match(js, /pageCount: Math\.ceil\(slotCount \/ perPage\)/);
  assert.match(js, /for \(let start = 0; start < plan\.slotCount; start \+= plan\.perPage\)/);
  assert.match(js, /sheet\.style\.pageBreakInside = "avoid"/);
  assert.match(js, /sheet\.style\.breakInside = "avoid-page"/);
  assert.match(html, /value="fit"/);
  assert.match(html, /value="card"/);
  assert.match(html, /value="sleeve"/);
});

test("Binder Studio keeps schema-v2 multi-page persistence and public binder references", async () => {
  const js = await read("studio-custom.js");

  assert.match(js, /const BINDER_SCHEMA_VERSION = 2;/);
  assert.match(js, /const MAX_BINDER_PAGES = 60;/);
  assert.match(js, /"customBinders"/);
  assert.match(js, /function binderPageRef\(/);
  assert.match(js, /function publicBinderRef\(/);
  assert.match(js, /function publicBinderPageRef\(/);
  assert.match(js, /function publicBinderChunkRef\(/);
  assert.match(js, /async function saveCurrentBinder\(/);
  assert.match(js, /async function loadSavedBinder\(/);
  assert.match(js, /async function publishCurrentBinder\(/);
  assert.match(js, /async function unpublishCurrentBinder\(/);
});

test("Binder Studio keeps scan, slot editing, variant picking and dex bridge together", async () => {
  const html = await read("studio.html");
  const js = await read("studio-custom.js");

  for (const id of [
    "studio-quick-card",
    "studio-quick-slot-photo",
    "studio-quick-empty",
    "studio-quick-page-scan",
    "studio-quick-variant",
    "studio-quick-advanced",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }

  assert.match(js, /async function importBinderPhoto\(/);
  assert.match(js, /await recognizeImportedPhotoCards\(\)/);
  assert.match(js, /function clearQuickSlot\(/);
  assert.match(js, /function openQuickVariants\(/);
  assert.match(js, /function readPendingCardTransfer\(/);
  assert.match(js, /function confirmPendingCardPlacement\(/);
});

test("Binder Studio leaves collection ownership independent from binder placement", async () => {
  const js = await read("studio-custom.js");

  const directAddBlock = js.slice(
    js.indexOf("function readPendingCardTransfer"),
    js.indexOf("function updateArtUi"),
  );
  assert.ok(directAddBlock.length > 0);
  assert.doesNotMatch(
    directAddBlock,
    /saveOwned|saveOverride|saveCollection|seriesOwned\s*=|owned\s*=/,
  );
});
