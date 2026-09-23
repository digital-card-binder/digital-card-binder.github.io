import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy theme navigation can no longer overwrite the shared navigation", async () => {
  const navigation = await source("theme-navigation.js");
  assert.match(navigation, /Navigation is owned exclusively by collector-nav[.]js/);
  assert.equal(navigation.includes("replaceChildren"), false);
  assert.equal(navigation.includes("도감 갤러리"), false);
  assert.equal(navigation.includes("팩 도감"), false);
  assert.equal(navigation.includes("테마 도감"), false);
});

test("theme hub contains only the grouped special dex entries", async () => {
  const theme = await source("theme.html");
  const hrefs = ["ar.html", "artists.html", "trainer-pokemon.html", "people.html", "world.html", "fossil.html"];
  for (const href of hrefs) assert.match(theme, new RegExp(`href="[.]\\/${href.replace(".", "[.]")}"`));
  assert.equal(/class="theme-card" href="[.]\/custom[.]html"/.test(theme), false);
});
