import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("generated asset and build versions are synchronized", () => {
  const result = spawnSync(
    process.execPath,
    [new URL("../scripts/sync-site-versions.mjs", import.meta.url).pathname, "--check"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("shared asset cache versions follow site-version.json", async () => {
  const manifest = JSON.parse(await source("site-version.json"));
  assert.match(manifest.version, /^b-[0-9a-f]{12}$/);
  assert.equal(manifest.algorithm, "git-blob-sha1-12");
  assert.ok(manifest.assets && typeof manifest.assets === "object");
  assert.ok(manifest.pages && typeof manifest.pages === "object");

  const nav = await source("collector-nav.js");
  assert.match(
    nav,
    new RegExp(`SITE_BUILD_VERSION = "${escapeRegExp(manifest.version)}"`),
  );

  const pwa = await source("pwa.js");
  assert.match(
    pwa,
    new RegExp(`sw[.]js[?]v=${escapeRegExp(manifest.assets["sw.js"])}`),
  );
});

test("PWA and news responsibilities stay separated", async () => {
  const manifest = JSON.parse(await source("site-version.json"));
  const index = await source("index.html");
  const newsPage = await source("news.html");
  const news = await source("news.js");
  const pwa = await source("pwa.js");

  assert.match(index, /rel="manifest" href="[.]\/manifest[.]webmanifest"/);
  assert.ok(index.includes(`pwa.css?v=${manifest.assets["pwa.css"]}`));
  assert.ok(index.includes(`pwa.js?v=${manifest.assets["pwa.js"]}`));
  assert.ok(newsPage.includes(`pwa.js?v=${manifest.assets["pwa.js"]}`));
  assert.equal(news.includes("pwa.js"), false);
  assert.equal(news.includes("serviceWorker"), false);
  assert.equal(pwa.includes(".collection-nav"), false);
});
