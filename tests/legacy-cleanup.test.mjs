import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const url = (path) => new URL(`../${path}`, import.meta.url);
const source = (path) => readFile(url(path), "utf8");

test("retired navigation and temporary diagnostic artifacts stay removed", async () => {
  for (const path of [
    "theme-navigation.js",
    "deploy-diagnostic-20260923.html",
    "latest-20260923.html",
  ]) {
    await assert.rejects(access(url(path)));
  }
});

test("collector-nav is the only runtime navigation writer", async () => {
  const collectorNav = await source("collector-nav.js");
  assert.match(collectorNav, /nav[.]replaceChildren\(/);
  assert.match(collectorNav, /navigationSection\("주요 도감"\)/);
  assert.match(collectorNav, /navigationSection\("테마 도감"\)/);

  for (const path of [
    "firebase-config.js",
    "news.js",
    "pwa.js",
    "dashboard.js",
    "collector-public-sync.js",
  ]) {
    const content = await source(path);
    assert.equal(content.includes("theme-navigation.js"), false, path);
    assert.equal(content.includes("nav.replaceChildren"), false, path);
    assert.equal(content.includes("ensureGalleryNavigation"), false, path);
  }
});

test("retired navigation labels cannot return through runtime helpers", async () => {
  for (const path of ["firebase-config.js", "news.js", "pwa.js", "dashboard.js"]) {
    const content = await source(path);
    assert.equal(content.includes("도감 갤러리"), false, path);
    assert.equal(content.includes("PUBLIC BOARD"), false, path);
  }
});

test("theme hub remains a compatibility page, not a navigation owner", async () => {
  const theme = await source("theme.html");
  const hrefs = [
    "ar.html",
    "artists.html",
    "trainer-pokemon.html",
    "people.html",
    "world.html",
    "fossil.html",
  ];
  for (const href of hrefs) {
    assert.match(theme, new RegExp(`href="[.]\\/${href.replace(".", "[.]")}"`));
  }
  assert.equal(/class="theme-card" href="[.]\/custom[.]html"/.test(theme), false);
});
