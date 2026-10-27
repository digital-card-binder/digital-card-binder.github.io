import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const css=read("home-preview.css");
const html=read("index.html");
test("17차: mobile home prioritizes search and two genuine next actions",()=>{
  assert.match(html,/class="dashboard-search home-search"/);
  assert.match(html,/id="home-scan-action"/);
  assert.match(html,/id="home-continue-action"/);
  assert.match(css,/17차: mobile home/);
  assert.match(css,/\.home-primary-action:first-child\s*\{\s*display:\s*none/);
  assert.match(css,/\.home-primary-actions\s*\{\s*grid-template-columns:\s*repeat\(2/);
  assert.match(css,/\.home-collection-snapshot/);
  assert.match(css,/\.home-hero h1/);
});
test("17차: desktop retains card-find action and all source nodes",()=>{
  assert.match(html,/href="\.\/pokemon-search\.html"[^>]*>\s*<span class="home-primary-action-icon/);
  assert.match(css,/@media \(max-width: 690px\)/);
  assert.doesNotMatch(css.slice(css.lastIndexOf("17차: mobile home")),/visibility:\s*hidden/);
});
