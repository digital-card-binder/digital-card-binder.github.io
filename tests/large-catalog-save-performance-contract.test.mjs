import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("series and AR use single-entry Firestore writes without migrating user data", async () => {
  const manager = await read("firebase-page-manager.js");
  const start = manager.indexOf("async function saveOverride");
  const end = manager.indexOf("async function saveOwned", start);
  const block = manager.slice(start, end);

  assert.ok(start >= 0 && end > start, "saveOverride block must exist");
  assert.match(block, /const isLargeFixedCatalog = mode === "series" \|\| mode === "ar"/);
  assert.match(block, /firestoreModule\.updateDoc\(/);
  assert.match(block, /new firestoreModule\.FieldPath\("overrides", key\)/);
  assert.match(block, /const savedItem = \{[\s\S]*?\.\.\.item,[\s\S]*?updatedAt:[\s\S]*?updatedBy:/);
  assert.match(block, /remoteOverrides = nextOverrides/);
  assert.equal(block.includes("deleteField"), false, "must not delete override entries");
  assert.equal(block.includes("deleteDoc"), false, "must not delete user documents");
  assert.equal(block.includes("migration"), false, "must not migrate stored user data");
  assert.equal(block.includes("compact"), false, "must not compact stored user data");
});

test("normal series and AR completion saves do not wait for public projection sync", async () => {
  const manager = await read("firebase-page-manager.js");
  assert.match(manager, /const backgroundPublicSync =\s*mode === "series" \|\| Boolean\(options\.backgroundPublicSync\)/);
  assert.match(manager, /if \(isLargeFixedCatalog && backgroundPublicSync\) \{\s*queueLargeCatalogPublicSync\(\)/);
  assert.match(manager, /\{ backgroundPublicSync: mode === "ar" \}/);
});

test("AR actual-card editor keeps its existing awaited sync guarantee", async () => {
  const manager = await read("firebase-page-manager.js");
  const editor = await read("ar-card-editor.js");

  assert.match(editor, /await account\.saveOverride\(activeCard\.accountKey, \{/);
  assert.equal(editor.includes("backgroundPublicSync"), false);
  assert.match(manager, /if \(isLargeFixedCatalog && backgroundPublicSync\)[\s\S]*?else \{[\s\S]*?await window\.CollectorPublicSync\?\.syncCollectionWithRetry/);
});

test("series and AR pages load the optimized manager cache version", async () => {
  const [series, ar] = await Promise.all([read("series.html"), read("ar.html")]);
  const expected = './firebase-page-manager.js?v=20260820-1';
  assert.ok(series.includes(expected));
  assert.ok(ar.includes(expected));
});
