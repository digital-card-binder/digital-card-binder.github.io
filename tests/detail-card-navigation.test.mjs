import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const pages = [
  { html: "fossil.html", script: "fossil.js", grid: "fossil-card-grid", dialog: "fossil-dialog", trigger: "fossil-card-button" },
  { html: "trainer-pokemon.html", script: "trainer-pokemon.js", grid: "tp-card-grid", dialog: "tp-dialog", trigger: "pokemon-card-button" },
  { html: "pokemon-search.html", script: "pokemon-search.js", grid: "pokemon-search-grid", dialog: "pokemon-search-dialog", trigger: "pokemon-card-button" },
  { html: "artists.html", script: "artists.js", grid: "artist-card-grid", dialog: "artist-dialog", trigger: "artist-card-button" },
  { html: "art-themes.html", script: "art-themes.js", grid: "art-theme-card-grid", dialog: "art-theme-dialog", trigger: "art-theme-card-open" },
  { html: "people.html", script: "people.js", grid: "people-grid", dialog: "people-dialog", trigger: "pokemon-card-button" },
  { html: "world.html", script: "world.js", grid: "world-binder-content", dialog: "world-card-dialog", trigger: "world-card-open" },
  { html: "national.html", script: "app.js", grid: "card-grid", dialog: "card-dialog", trigger: "pokemon-card-button" },
  { html: "series.html", script: "catalog.js", grid: "catalog-grid", dialog: "catalog-dialog", trigger: "pokemon-card-button" },
  { html: "pokemon-collections.html", script: "catalog.js", grid: "catalog-grid", dialog: "catalog-dialog", trigger: "pokemon-card-button" },
  { html: "ar.html", script: "ar.js", grid: "catalog-grid", dialog: "catalog-dialog", trigger: "pokemon-card-button" },
];

test("shared detail navigation is wired to the real grid, dialog and card trigger on every target dex", async () => {
  const helper = await read("detail-card-navigation.js");
  for (const page of pages) {
    const html = await read(page.html);
    const script = await read(page.script);
    assert.match(html, new RegExp(`id=["']${page.grid}["']`), `${page.html}: grid exists`);
    assert.match(html, new RegExp(`id=["']${page.dialog}["']`), `${page.html}: dialog exists`);
    assert.match(html, /detail-card-navigation\.js/, `${page.html}: shared helper loaded`);
    assert.ok(helper.includes(`grid: "#${page.grid}"`), `${page.html}: grid configured`);
    assert.ok(helper.includes(`dialog: "#${page.dialog}"`), `${page.html}: dialog configured`);
    assert.ok(helper.includes(`trigger: ".${page.trigger}"`), `${page.html}: correct trigger configured`);
    assert.ok(script.includes(page.trigger), `${page.script}: trigger class is generated`);
    if (page.script === "app.js") {
      assert.match(script, /cardTemplate\.content\.firstElementChild\.cloneNode\(true\)/, `${page.script}: card template articles are cloned`);
    } else {
      assert.match(script, /article\.className\s*=|article\.className\s*=/, `${page.script}: card articles are generated`);
    }
  }
});

test("navigation follows currently rendered cards and supports keyboard and horizontal touch gestures", async () => {
  const helper = await read("detail-card-navigation.js");
  assert.match(helper, /querySelectorAll\("article"\)/);
  assert.match(helper, /event\.key === "ArrowLeft"/);
  assert.match(helper, /event\.key === "ArrowRight"/);
  assert.match(helper, /addEventListener\("touchstart"/);
  assert.match(helper, /addEventListener\("touchend"/);
  assert.match(helper, /Math\.abs\(dx\) < 55/);
  assert.match(helper, /Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.25/);
  assert.match(helper, /requestAnimationFrame\(\(\) => target\.click\(\)\)/);
});

test("navigation helper does not write collection ownership or account data", async () => {
  const helper = await read("detail-card-navigation.js");
  assert.doesNotMatch(helper, /localStorage|sessionStorage|firebase|firestore|\.owned\s*=|setItem\(/i);
});
