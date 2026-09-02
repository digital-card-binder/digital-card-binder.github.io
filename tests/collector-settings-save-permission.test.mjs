import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settings = await readFile(new URL("../collector-settings.js", import.meta.url), "utf8");
const page = await readFile(new URL("../collector-settings.html", import.meta.url), "utf8");

test("settings batch does not depend on public directory write permission", () => {
  const batchCommit = settings.indexOf("await batch.commit();");
  const directoryCall = settings.indexOf("await reconcileDirectoryEntry();", batchCommit);
  assert.ok(batchCommit >= 0);
  assert.ok(directoryCall > batchCommit);
  const between = settings.slice(Math.max(0, batchCommit - 500), batchCommit);
  assert.doesNotMatch(between, /syncDirectoryInBatch\(batch, collectionId, next\)/);
});

test("collector settings assets are cache busted after permission fix", () => {
  assert.match(page, /collector-settings\.js\?v=20260903-2/);
  assert.match(page, /collector-settings-legacy-share-migration\.js\?v=20260903-2/);
});
