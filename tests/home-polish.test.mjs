import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, statSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const size = (file) => statSync(new URL(`../${file}`, import.meta.url)).size;

function pngSize(file) {
  const buf = readFileSync(new URL(`../${file}`, import.meta.url));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("the home progress track is a block so its height and clipping apply", () => {
  const css = read("home-preview.css");
  const rule = css.match(/\.home-progress-track \{([^}]*)\}/)?.[1] || "";
  assert.match(rule, /display:\s*block/, "span.home-progress-track must not stay inline");
});

test("the mobile account button no longer lets its label overflow a fixed 40px box", () => {
  const css = read("home-preview.css");
  const tail = css.slice(css.lastIndexOf("홈 모바일 다듬기"));
  assert.match(tail, /\.home-account-trigger \{[^}]*display: inline-flex !important/);
  assert.match(tail, /\.home-account-trigger \{[^}]*width: auto/);
  assert.match(tail, /max-width: 380px[\s\S]*\.home-account-label \{\s*display: none/);
});

test("brand logos stay small enough for every page (they load on all 27 pages)", () => {
  const limits = { "assets/brand/logo-symbol.png": [60, 400], "assets/brand/logo-horizontal.png": [120, 1000] };
  for (const [file, [maxKb, maxWidth]] of Object.entries(limits)) {
    assert.ok(size(file) <= maxKb * 1024, `${file} is ${Math.round(size(file) / 1024)}KB, limit ${maxKb}KB`);
    assert.ok(pngSize(file).width <= maxWidth, `${file} is wider than ${maxWidth}px`);
  }
});
