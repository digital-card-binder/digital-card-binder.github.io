import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../home-preview.css", import.meta.url), "utf8");

test("community is the seventh home feature, directly after Binder Studio", () => {
  const browseStart = page.indexOf('<div class="home-feature-grid">');
  const browseEnd = page.indexOf('</section>', browseStart);
  assert.ok(browseStart >= 0 && browseEnd > browseStart);
  const area = page.slice(browseStart, browseEnd);
  const names = [...area.matchAll(/home-feature-card home-feature-card--([a-z-]+)"/g)]
    .map(match => match[1]);
  assert.deepEqual(names, [
    "series", "national", "theme", "pack", "custom", "studio", "community"
  ]);
  assert.match(area, /home-feature-card--community" href="\.\/collectors\.html"/);
  assert.match(area, /home-feature-scene--community/);
  assert.doesNotMatch(area, /home-community-banner/);
});

test("community uses the same feature-card family and fits desktop and mobile", () => {
  assert.match(css, /\.home-feature-grid\s*\{\s*grid-template-columns:\s*repeat\(4,/);
  assert.match(css, /home-feature-card--community\s*\{/);
  assert.match(css, /home-feature-scene--community/);
  assert.match(css, /@media\s*\(max-width:\s*690px\)\s*\{[\s\S]*?\.home-feature-grid\s*>\s*\.home-feature-card--community\s*\{\s*grid-column:\s*1\s*\/\s*-1;/);
  assert.match(css, /@media\s*\(max-width:\s*340px\)\s*\{[\s\S]*?\.home-feature-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
