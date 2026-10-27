import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const board=read("dashboard-compact.css"),custom=read("custom.css"),search=read("pokemon-search.css");
test("27차: dashboard tiles stay distinct by category while adopting light surfaces",()=>{
 assert.match(board,/\/\* 27차: light/);
 assert.match(board,/background:linear-gradient\(155deg,#fff 12%,color-mix\(in srgb,var\(--collection-accent\) 10%,#fff\) 100%\)/);
 assert.match(board,/\.dashboard-card-progress\{\s*background:#dce9f4/);
 assert.match(board,/\.dashboard-news-row-title\{color:#253d5b/);
 assert.match(board,/font-size:\.62rem/);
});
test("27차: personal and search surfaces are light without losing ownership UI",()=>{
 assert.match(custom,/\.custom-dex-tile\.is-active\{\s*border-color:#8fb8e4/);
 assert.match(custom,/\.custom-card\.is-owned \.custom-owned-toggle/);
 assert.match(search,/\.pokemon-search-advanced-filters\{\s*border-color:#d8e6f5/);
 assert.match(search,/#pokemon-search-dialog \.dialog-card-image/);
 assert.match(read("custom.html"),/id="custom-grid-density"/);
 assert.match(read("pokemon-search.html"),/id="pokemon-search-toggle-owned"/);
});
