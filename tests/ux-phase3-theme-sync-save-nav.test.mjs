import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("phase 3: crying cards are available in one shared index for hub and viewer", () => {
  const manifest = JSON.parse(read("data/art-theme-supplements.json"));
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(Array.isArray(manifest.feeds));
  const seen = new Set();
  for (const { code, path } of manifest.feeds) {
    assert.match(code, /^[a-z0-9-]{2,40}$/);
    assert.match(path, /^\.\/data\/art-themes-[a-z0-9-]+\.json$/);
    assert.equal(seen.has(code), false, "supplements may not repeat codes");
    seen.add(code);
    const dataset = JSON.parse(read(path.replace(/^\.\//, "")));
    assert.equal(dataset.group.code, code);
    assert.ok(dataset.group.name);
    assert.ok(dataset.group.cards.length > 0);
  }
  const crying = JSON.parse(read("data/art-themes-crying.json"));
  assert.equal(crying.group.cards.length, 115);
  assert.ok(seen.has("crying"));
  const hub = read("theme-discovery.js");
  const viewer = read("art-themes.js");
  assert.match(hub, /fetch\("\.\/data\/art-theme-supplements[.]json"/);
  assert.match(viewer, /fetch\("\.\/data\/art-theme-supplements[.]json"/);
  assert.match(hub, /entries[.]push/);
  assert.match(hub, /render\(\);\s*\}\s*catch/);
  assert.match(viewer, /!dataset[.]groups[.]some/);
  assert.doesNotMatch(hub, /saveOwned|saveOverride|deleteDoc|setDoc/);
});

test("phase 3: public sync success is recorded only after confirmed projection publication", () => {
  const js = read("collector-public-sync.js");
  assert.match(js, /const result = await syncCollection\(options\);/);
  assert.match(js, /if \(result\?\.synced\) recordSuccessfulSync\(options\);/);
  assert.match(js, /"dcb-public-sync-v1:" \+ user[.]uid \+ ":" \+ collectionId/);
  assert.match(js, /pokemon-dex:public-sync-success/);
  assert.match(js, /pokemon-dex:public-sync-error/);
  assert.match(js, /const payload = \{ [.]\.\.projection \};/);
  assert.doesNotMatch(js, /syncedAt:\s*serverTimestamp|lastSyncedAt:\s*serverTimestamp/);
});

test("phase 3: settings refresh fetches latest owner data and never auto-publishes draft switches", () => {
  const html=read("collector-settings.html");
  const js=read("collector-settings.js");
  const css=read("collector.css");
  for (const id of ["collector-public-sync-panel", "collector-public-sync-summary",
    "collector-public-sync-feedback", "collector-public-sync-refresh"]) {
    assert.match(html,new RegExp('id="' + id + '"'));
  }
  assert.match(html, /이 기기에서 성공이 확인된 기록/);
  assert.match(js, /elements[.]settingsGrid[.]querySelector\("\.is-dirty"\)/);
  assert.match(js, /preferServer:true/);
  assert.match(js, /await sync[.]syncCollectionWithRetry/);
  assert.match(js, /recordSuccessfulSync/);
  assert.match(css, /[.]collector-public-sync-panel\[hidden\]/);
});

test("phase 3: dashboard and other dex pages share one menu and all three save outcomes", () => {
  const nav=read("site-mobile-nav.js");
  const dashboard=read("dashboard.js");
  const index=read("index.html");
  const styles=read("styles.css");
  assert.match(nav, /window[.]DcbMobileMenu=\{open:openLocalMenu\}/);
  assert.match(dashboard, /window[.]DcbMobileMenu[.]open\(event, menuTrigger\)/);
  assert.match(index, /id="home-mobile-menu-trigger"[^>]+aria-haspopup="dialog"/);
  assert.match(nav, /window[.]DcbSaveFeedback=\{show:showSaveFeedback\}/);
  for (const file of ["catalog.js", "pokemon-search.js", "custom.js"]) {
    const code=read(file);
    for (const state of ["saving", "success", "error"]) {
      assert.match(code,new RegExp('DcbSaveFeedback[?][.]show[?][.]\\("'+state+'"'),file+":"+state);
    }
  }
  assert.match(styles, /[.]dcb-save-feedback\[hidden\]/);
  assert.match(styles, /\[data-state="error"\]/);
  assert.match(styles, /env\(safe-area-inset-bottom/);
  assert.ok(styles.indexOf("/* UX phase 3:") < styles.indexOf("/* 28차 — final legibility"));
});
