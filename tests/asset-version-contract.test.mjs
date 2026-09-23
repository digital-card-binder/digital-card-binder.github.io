import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("shared asset cache versions follow site-version.json", async () => {
  const manifest = JSON.parse(await source("site-version.json"));
  assert.equal(manifest.version, "20260923-8");
  assert.ok(manifest.assets && typeof manifest.assets === "object");

  const htmlFiles = (await readdir(root)).filter((name) => name.endsWith(".html"));
  for (const page of htmlFiles) {
    const html = await source(page);
    for (const [asset, version] of Object.entries(manifest.assets)) {
      const marker = `${asset}?v=`;
      if (!html.includes(marker)) continue;
      assert.ok(
        html.includes(`${asset}?v=${version}`),
        `${page}: ${asset} must use v=${version}`,
      );
    }
  }

  const pwa = await source("pwa.js");
  assert.match(
    pwa,
    new RegExp(`sw[.]js[?]v=${manifest.assets["sw.js"].replaceAll(".", "[.]")}`),
  );

  const nav = await source("collector-nav.js");
  assert.match(
    nav,
    new RegExp(`SITE_BUILD_VERSION = "${manifest.version}"`),
  );
});

test("PWA and news responsibilities stay separated", async () => {
  const index = await source("index.html");
  const newsPage = await source("news.html");
  const news = await source("news.js");
  const pwa = await source("pwa.js");

  assert.match(index, /rel="manifest" href="[.]\/manifest[.]webmanifest"/);
  assert.match(index, /pwa[.]css[?]v=20260915-2/);
  assert.match(index, /pwa[.]js[?]v=20260923-2/);
  assert.match(newsPage, /pwa[.]js[?]v=20260923-2/);
  assert.equal(news.includes("pwa.js"), false);
  assert.equal(news.includes("serviceWorker"), false);
  assert.equal(pwa.includes(".collection-nav"), false);
});
