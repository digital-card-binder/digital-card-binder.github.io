import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../ui-consistency.css",import.meta.url),"utf8");
const root=new URL("../",import.meta.url);
const pages=["series.html","packs.html","pokemon-search.html","studio.html","custom.html"];

test("all five main workflows load shared control standards",()=>{
  for(const page of pages){
    const source=readFileSync(new URL(page,root),"utf8");
    assert.match(source,/<link rel="stylesheet" href="\.\/ui-consistency\.css(?:\?v=[^"]+)?"\s*\/>/,
      page+" must load the shared stylesheet");
    assert.equal((source.match(/ui-consistency\.css/g)||[]).length,1);
  }
});

test("large touch targets and keyboard focus are consistently available on mobile",()=>{
  assert.match(css,/--dcb-control-touch:44px/);
  assert.match(css,/--dcb-control-focus:#168895/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/min-height:var\(--dcb-control-touch\)/);
  assert.match(css,/outline:3px solid var\(--dcb-control-focus\)/);
  assert.match(css,/outline-offset:2px/);
  assert.match(css,/font-size:16px/);
  assert.match(css,/touch-action:manipulation/);
});

test("shared scope covers every page's existing filter/workspace classes",()=>{
  for(const token of [
    ".catalog-toolbar",".catalog-filter-row",".catalog-era-filter",
    ".pack-filter-row",".promo-catalog-panel",".pokemon-search-box",
    ".pokemon-search-filters",".custom-workspace-filter",
    ".studio-control-card",".studio-tabs"
  ]) assert.ok(css.includes(token),token);
});

test("checkboxes, radio inputs and card imagery remain outside global control styles",()=>{
  assert.doesNotMatch(css,/input\[type="radio"\]|input\[type="checkbox"\]/);
  assert.doesNotMatch(css,/\bimg\b|\bcard-image\b|#custom-card-grid/);
  assert.doesNotMatch(css,/position:\s*(fixed|sticky)/);
  assert.doesNotMatch(css,/display:\s*(none|grid|flex)/);
});

test("mobile styles are localized; desktop workspace layout is not overridden",()=>{
  assert.ok(css.indexOf("min-height:var(--dcb-control-touch)")>css.indexOf("@media(max-width:760px)"));
  assert.ok(css.indexOf("font-size:16px")>css.indexOf("@media(max-width:760px)"));
  assert.ok(css.includes("row-gap:12px"));
});
