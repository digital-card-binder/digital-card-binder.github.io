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
  assert.match(workflow, /git add -- DigitalCardBinder_v1\.0\.apk/);
});


test("stage 7 keeps dashboard interactions keyboard-visible and mobile touch targets comfortable", () => {
  const dashboardCss = read("dashboard.css");
  const pwaCss = read("pwa.css");

  assert.match(
    dashboardCss,
    /[.]dashboard-collection-card:focus-visible,[\s\S]*?[.]dashboard-shortcut-card:focus-visible,[\s\S]*?[.]dashboard-theme-summary:focus-visible/,
  );
  assert.match(
    dashboardCss,
    /@media \(max-width: 690px\)[\s\S]*?[.]feedback-action \{[\s\S]*?min-height: 44px/,
  );
  assert.match(
    dashboardCss,
    /@media \(max-width: 690px\)[\s\S]*?[.]dashboard-search button \{[\s\S]*?min-height: 44px/,
  );
  assert.match(
    dashboardCss,
    /[.]dashboard-section-heading > a \{[\s\S]*?min-height: 44px/,
  );
  assert.match(
    pwaCss,
    /@media \(max-width: 690px\)[\s\S]*?[.]android-app-download-button,[\s\S]*?[.]ios-pwa-button \{[\s\S]*?min-height: 44px/,
  );
});


test("stage 8 removes retired traffic UI and keeps metrics collection off the critical path", () => {
  const dashboardCss = read("dashboard.css");
  const metrics = read("site-metrics.js");

  assert.doesNotMatch(dashboardCss, /dashboard-traffic/);
  assert.doesNotMatch(dashboardCss, /dashboard-hero/);
  assert.match(metrics, /const DISPLAY_PUBLIC_METRICS = false;/);
  assert.doesNotMatch(metrics, /function loadMetrics/);
  assert.doesNotMatch(metrics, /site-header-metrics/);
  assert.match(metrics, /DAILY_RECORDED_STORAGE_KEY/);
  assert.match(metrics, /dailyVisitRecorded\(day, id\)/);
  assert.match(metrics, /requestIdleCallback/);
  assert.match(metrics, /setTimeout\(run, 450\)/);
});


test("community stays outside theme accordion and remains the final navigation item", () => {
  const shell = read("scripts/sync-site-shell.mjs");
  const nav = read("collector-nav.js");
  const styles = read("styles.css");

  assert.match(
    shell,
    /href: "[.]\/collectors[.]html"[\s\S]*?standalone: true/,
  );
  assert.match(
    nav,
    /candidate[.]dataset[.]navStandalone === "true"/,
  );
  assert.match(
    nav,
    /collection-link\[data-nav-standalone="true"\][.]is-active/,
  );
  assert.match(
    styles,
    /[.]collection-link\[data-nav-standalone="true"\]/,
  );
});

test("stage 9 trims page-specific assets and prevents duplicate metrics loading", () => {
  const index = read("index.html");
  const news = read("news.html");
  const legal = read("legal.js");
  const nav = read("collector-nav.js");

  for (const retired of [
    "collection-manager.css",
    "card-image-cdn.js",
    "image-protection.js",
    "core/catalog/card-lookup.js",
  ]) {
    assert.equal(index.includes(retired), false, retired);
  }

  assert.equal(news.includes("collector.css"), false);
  assert.match(legal, /CURRENT_METRICS_SCRIPT = "[.]\/site-metrics[.]js"/);
  assert.match(legal, /pathname[.]endsWith\("\/site-metrics[.]js"\)/);
  assert.doesNotMatch(legal, /site-metrics[.]js[?]v=20260813-2/);
  assert.match(nav, /"operations", "news"/);
});


test("stage 10 keeps cached clients and deployment verification synchronized", () => {
  const pwa = read("pwa.js");
  const nav = read("collector-nav.js");
  const verify = read(".github/workflows/verify.yml");
  const syncWorkflow = read(".github/workflows/sync-site-versions.yml");
  const versionScript = read("scripts/sync-site-versions.mjs");

  assert.match(pwa, /serviceWorker[.]addEventListener\("controllerchange"/);
  assert.match(pwa, /window[.]location[.]replace\(url[.]href\)/);
  assert.match(pwa, /manifest[.]href = MANIFEST_URL/);
  assert.match(nav, /window[.]addEventListener\("pageshow"/);
  assert.match(nav, /document[.]addEventListener\("visibilitychange"/);
  assert.match(nav, /BUILD_CHECK_MIN_INTERVAL_MS = 15_000/);
  assert.match(
    verify,
    /Prepare generated site state for push verification[\s\S]*?github[.]event_name == 'push'[\s\S]*?versions:sync/,
  );
  assert.match(syncWorkflow, /assets\/brand\/[*][*]/);
  assert.match(versionScript, /MANIFEST_ICON_RE/);
  assert.match(versionScript, /manifest[.]webmanifest/);
});


test("shared account header styling remains available without collection manager CSS", () => {
  const index = read("index.html");
  const collectorCss = read("collector.css");

  assert.equal(index.includes("collection-manager.css"), false);
  assert.match(index, /collector[.]css[?]v=/);
  assert.match(collectorCss, /[.]firebase-auth-panel \{/);
  assert.match(collectorCss, /[.]owner-sheets-status \{/);
  assert.match(collectorCss, /[.]owner-sheets-link \{/);
  assert.match(
    collectorCss,
    /[.]owner-sheets-status\[data-state="loading"\][\s\S]*?background: #eef5fc/,
  );
});
