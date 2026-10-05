import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("recent dex resume stores navigation only and never merges ownership", () => {
  const nav = read("collector-nav.js");
  const helperStart = nav.indexOf('const RECENT_DEX_STORAGE_KEY = "digitalCardBinderRecentDexV1"');
  const helperEnd = nav.indexOf("async function refreshStaleShell", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = nav.slice(helperStart, helperEnd);
  assert.match(helper, /localStorage[.]setItem\(RECENT_DEX_STORAGE_KEY/);
  assert.match(helper, /recentDex = Object[.]freeze/);
  assert.doesNotMatch(helper, /saveOwned|saveOverride|documentId|overrides/);
});

test("series and Pokemon collection resume exact standalone group", () => {
  const catalog = read("catalog.js");
  assert.match(catalog, /get\("group"\)/);
  assert.match(catalog, /collectionId: "series"/);
  assert.match(catalog, /href: `[.]\/series[.]html\?\$\{params[.]toString\(\)\}`/);
  assert.match(catalog, /collectionId: "pokemon"/);
  assert.match(catalog, /[.]\/pokemon-collections[.]html\?group=/);
  assert.match(catalog, /requestedGroup \? seriesEra\(requestedGroup\) : "ALL"/);
});

test("theme resume preserves the selected independent theme", () => {
  const themes = read("art-themes.js");
  assert.match(themes, /collectionId: "artThemes"/);
  assert.match(themes, /[.]\/art-themes[.]html\?theme=/);
  assert.match(themes, /rememberCurrentTheme\(\)/);
});

test("home exposes compact search scan and resume actions", () => {
  const html = read("index.html");
  const dashboard = read("dashboard.js");
  const css = read("home-preview.css");

  assert.match(html, /class="home-primary-actions"/);
  assert.match(html, /id="home-scan-action"/);
  assert.match(html, /id="home-continue-action"/);
  assert.doesNotMatch(html, /id="home-resume-section"/);
  assert.match(dashboard, /function renderRecentDex\(\)/);
  assert.match(dashboard, /recentDex[?][.]read[?][.]\(\)/);
  assert.match(dashboard, /function initializeHomePrimaryActions\(\)/);
  assert.match(dashboard, /#card-scan-fab/);
  assert.match(css, /[.]home-primary-actions/);
  assert.match(css, /[.]home-primary-action/);
});

test("mobile home prioritizes actions over decorative card fan", () => {
  const css = read("home-preview.css");
  assert.match(
    css,
    /@media \(max-width: 690px\)[\s\S]*?[.]home-card-fan\s*\{[\s\S]*?display:\s*none/,
  );
  assert.match(
    css,
    /@media \(max-width: 690px\)[\s\S]*?[.]home-primary-actions[\s\S]*?repeat\(3/,
  );
});
