import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("29차: narrow mobile home search cannot protrude into fixed tab bar",()=>{
 const css=read("home-preview.css").slice(read("home-preview.css").lastIndexOf("/* 29차"));
 assert.match(css,/\.home-search\{\s*width:100%;\s*max-width:100%/);
 assert.match(css,/\.home-feature-content > strong/);
 assert.match(css,/-webkit-line-clamp:2/);
 assert.match(css,/\.home-mobile-tabbar\{\s*max-width:100vw/);
});
test("29차: collection dialogs and personal import layout fit small screens",()=>{
 assert.match(read("styles.css"),/\/\* 29차:[\s\S]*?\.card-dialog\[open\]\{\s*max-width:calc\(100vw - 16px\)/);
 assert.match(read("custom.css"),/\/\* 29차:[\s\S]*?width:calc\(100vw - 16px\)/);
 assert.match(read("custom.html"),/id="card-picker-dialog"/);
});
test("29차: browser QA loads real pages, checks overflow, captures evidence",()=>{
 const script=read("scripts/qa-v29-v32-visual.mjs");
 const wf=read(".github/workflows/v29-v32-visual-qa.yml");
 for(const p of ["/index.html","/pokemon-search.html","/custom.html","/series.html","/packs.html","/theme.html"])assert.ok(script.includes(p),p);
 assert.match(script,/horizontalOverflow>12/);
 assert.match(wf,/playwright install --with-deps chromium/);
 assert.match(wf,/upload-artifact/);
 assert.match(script,/page.screenshot/);
});
