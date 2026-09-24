import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("collection planner provides missing, wishlist, trade, duplicate and history views", () => {
  const page = read("planner.html");
  const client = read("planner.js");

  assert.match(page, /data-filter="wishlist"/);
  assert.match(page, /data-filter="missing"/);
  assert.match(page, /data-filter="trade"/);
  assert.match(page, /data-filter="duplicate"/);
  assert.match(page, /id="planner-history-list"/);
  assert.match(client, /plannerV1/);
  assert.match(client, /historyV1/);
  assert.match(client, /pokemonSearchIndex/);
  assert.match(client, /digitalCardBinderTradeDraftV2/);
  assert.match(client, /"pokemon-dex:collection-changed"/);
  assert.match(client, /pokemonCollectionsDex/);
});

test("planner metadata is merged into the existing Pokemon collections document without replacing ownership", () => {
  const client = read("planner.js");
  assert.match(client, /setDoc\(ref, payload, \{ merge: true \}\)/);
  assert.match(client, /plannerVersion: 1/);
  assert.doesNotMatch(client, /deleteDoc\(/);
  assert.doesNotMatch(client, /overrides:\s*\{/);
});

test("shared collection history captures existing collection change events and batches them safely", () => {
  const history = read("collection-history.js");
  const nav = read("collector-nav.js");
  const versions = read("scripts/sync-site-versions.mjs");

  assert.match(history, /pokemon-dex:collection-changed/);
  assert.match(history, /historyV1/);
  assert.match(history, /runTransaction/);
  assert.match(history, /digitalCardBinderPendingHistoryV1/);
  assert.match(nav, /collection-history[.]js\?v=\$\{SITE_BUILD_VERSION\}/);
  assert.match(versions, /"collection-history[.]js"/);
});
