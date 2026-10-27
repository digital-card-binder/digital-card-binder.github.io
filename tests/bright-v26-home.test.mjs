import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=n=>readFileSync(new URL("../"+n,import.meta.url),"utf8");
const css=read("home-preview.css"),html=read("index.html");
test("26차: dashboard dark navy is overridden with light backgrounds and accessible ink",()=>{
 const latest=css.slice(css.lastIndexOf("/* 26차"));
 assert.ok(latest.length>4000);
 for(const value of ["--home-bg:#f7fbff","background:rgba(255,255,255,.96)","color:#20354f","linear-gradient(130deg,#fff 0%,#edf7ff 100%)"])
  assert.ok(latest.includes(value),value);
 assert.match(latest,/\.home-feature-card--theme\{background:linear-gradient\(135deg,#f7efff,#e9defa\)/);
 assert.match(latest,/\.home-feature-card\s+\.home-feature-shade/);
 assert.match(latest,/\.home-mobile-tabbar a\.is-active/);
});
test("26차: search, scan, collection, tabbar and radar links are unchanged",()=>{
 for(const id of ["home-scan-action","home-continue-action","home-series-owned","home-series-total","home-dex-section"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/class="dashboard-search home-search"/);
 assert.match(html,/class="home-mobile-tabbar"/);
 assert.match(html,/class="home-radar-trigger"/);
});
