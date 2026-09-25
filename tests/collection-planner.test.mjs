import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("collection planner is retired from the site without deleting stored account data", () => {
  for (const path of [
    "planner.html",
    "planner.js",
    "planner.css",
    "collection-history.js",
  ]) {
    assert.throws(() => read(path), /ENOENT/);
  }

  const shell = read("scripts/sync-site-shell.mjs");
  const nav = read("collector-nav.js");
  const versions = read("scripts/sync-site-versions.mjs");

  assert.doesNotMatch(shell, /planner[.]html|수집 관리|위시 · 교환 · 히스토리/);
  assert.doesNotMatch(nav, /collection-history[.]js|["']planner["']/);
  assert.doesNotMatch(versions, /collection-history[.]js/);
});

test("planner removal does not add Firestore deletion or migration code", () => {
  for (const path of [
    "collector-nav.js",
    "collector-collection-registry.js",
    "firebase-page-manager.js",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /plannerV1\s*.*delete|historyV1\s*.*delete/);
  }
});
