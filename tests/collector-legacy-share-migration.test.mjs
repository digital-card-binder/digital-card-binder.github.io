import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("collector settings migrates legacy unlisted shares before saving", async () => {
  const migration = await source("collector-settings-legacy-share-migration.js");

  assert.match(migration, /data[.]visibility !== "unlisted"/);
  assert.match(migration, /visibility: "private"/);
  assert.match(migration, /"sharedCollections"/);
  assert.match(migration, /"collectorShareOwners"/);
  assert.match(migration, /batch[.]commit[(][)]/);
  assert.match(migration, /saveButton[.]click[(][)]/);
});

test("legacy migration runs after granular custom settings interception", async () => {
  const page = await source("collector-settings.html");
  const granular = page.indexOf("custom-granular-settings.js?v=20260813-2");
  const migration = page.indexOf(
    "collector-settings-legacy-share-migration.js?v=20260903-2",
  );

  assert.ok(granular >= 0, "granular custom settings script must be loaded");
  assert.ok(migration > granular, "legacy migration must run after granular settings");
});
