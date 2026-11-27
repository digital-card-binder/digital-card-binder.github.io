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
  assert.match(area, /home-feature-collage--community/);
  assert.doesNotMatch(area, /ui-icon--community/);
  assert.doesNotMatch(area, /home-community-banner/);
});

test("community uses the same feature-card family and fits desktop and mobile", () => {
  assert.match(css, /\.home-feature-grid\s*\{\s*grid-template-columns:\s*repeat\(4,/);
  assert.match(css, /home-feature-card--community\s*\{/);
  assert.match(css, /\.home-feature-card \.home-binder-page\s*\{[^}]*scale\(\.86\)/);
  assert.match(css, /\.home-feature-card \.home-studio-window\s*\{[^}]*scale\(\.84\)/);
  assert.match(css, /@media\s*\(max-width:\s*690px\)\s*\{[\s\S]*?\.home-feature-grid\s*>\s*\.home-feature-card--community\s*\{\s*grid-column:\s*1\s*\/\s*-1;/);
  assert.match(css, /@media\s*\(max-width:\s*340px\)\s*\{[\s\S]*?\.home-feature-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("home feature artwork stays clear of the button text on desktop and tablet", () => {
  assert.match(css, /\.home-feature-grid\s*\{\s*grid-auto-rows:\s*208px;/);
  assert.match(css, /@media\s*\(min-width:\s*921px\)\s*and\s*\(max-width:\s*1099px\)\s*\{[\s\S]*?\.home-feature-collage\s*\{[\s\S]*?scale\(\.86\)/);
});
