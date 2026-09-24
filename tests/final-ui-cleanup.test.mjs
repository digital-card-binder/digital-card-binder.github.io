import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("dashboard keeps compact feedback and app actions while public traffic stays hidden", () => {
  const index = read("index.html");
  const metrics = read("site-metrics.js");
  const pwa = read("pwa.js");

  assert.match(index, /id="feedback-open"[^>]*>건의하기<\/button>/);
  assert.match(index, /platform-app-logo--android/);
  assert.match(index, /<strong>안드로이드<\/strong>/);
  assert.match(index, /android-app-download-button"[^>]*>다운로드<\/button>/);
  assert.match(index, /id="ios-pwa-title">아이폰<\/strong>/);
  assert.match(index, /id="ios-pwa-button"[^>]*>설치<\/button>/);
  assert.match(pwa, /if \(isAndroidNativeApp\(\)\) \{\s*grid\.hidden = true;/);
  assert.match(metrics, /const DISPLAY_PUBLIC_METRICS = false;/);
  assert.doesNotMatch(index, /id="dashboard-traffic"/);
});

test("decorative English navigation initials are retired from the generated shell", () => {
  const shell = read("scripts/sync-site-shell.mjs");
  assert.doesNotMatch(shell, /icon: "(?:DB|MY|CM)"/);
  assert.match(shell, /icon: "홈", title: "통합 대시보드"/);
  assert.match(shell, /icon: "나", title: "나만의 도감"/);
  assert.match(shell, /icon: "모", title: "커뮤니티"/);

  for (const file of readdirSync(root).filter((name) => name.endsWith(".html"))) {
    const html = read(file);
    assert.doesNotMatch(
      html,
      /class="collection-icon[^"]*"[^>]*>(?:DB|MY|CM)<\/span>/,
      file,
    );
  }
});

test("Pokemon search uses Korean progress copy without a platform-specific shortcut badge", () => {
  const page = read("pokemon-search.html");
  const client = read("pokemon-search.js");

  assert.match(page, /id="search-rate">—<\/strong><span>보유율<\/span>/);
  assert.doesNotMatch(page, /<kbd>/);
  assert.doesNotMatch(page, />OWNED</);
  assert.match(client, /event\.metaKey \|\| event\.ctrlKey/);
});

test("obsolete Android v0.8 website migration references are retired", () => {
  const workflow = read(".github/workflows/build-android-apk.yml");
  const readme = read("android-app/README.md");

  assert.doesNotMatch(workflow, /v0\.8|DigitalCardBinder_v0\.8/);
  assert.doesNotMatch(readme, /v0\.8|DigitalCardBinder_v0\.8/);
  assert.match(workflow, /git add -- DigitalCardBinder_v0\.9\.apk/);
});
