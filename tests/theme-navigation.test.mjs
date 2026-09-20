import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("top navigation follows the agreed collection order", async () => {
  const navigation = await source("theme-navigation.js");
  const labels = ["대시보드", "도감 갤러리", "포켓몬 검색", "전국 도감", "시리즈 도감", "테마 도감", "나만의 도감", "새소식"];
  let cursor = -1;
  for (const label of labels) {
    const index = navigation.indexOf(`title: "${label}"`);
    assert.ok(index > cursor, `${label} should follow the agreed top navigation order`);
    cursor = index;
  }
});

test("theme hub contains only the grouped special dex entries", async () => {
  const theme = await source("theme.html");
  const hrefs = ["ar.html", "artists.html", "trainer-pokemon.html", "people.html", "world.html", "fossil.html"];
  for (const href of hrefs) assert.match(theme, new RegExp(`href="[.]\\/${href.replace(".", "[.]")}"`));
  assert.equal(/class="theme-card" href="[.]\/custom[.]html"/.test(theme), false);
});
