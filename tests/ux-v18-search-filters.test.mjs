import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const get=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=get("pokemon-search.html"),css=get("pokemon-search.css"),js=get("pokemon-search.js");
test("18차: all original search controls retained and ownership filter visible first",()=>{
  for(const id of ["pokemon-search-scope","pokemon-search-era","pokemon-search-set","pokemon-search-status"])
    assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id);
  assert.ok(html.indexOf('id="pokemon-search-status"')<html.indexOf('id="pokemon-search-advanced-filters"'));
  assert.match(html,/<details id="pokemon-search-advanced-filters"[^>]*open>/);
  assert.match(html,/id="pokemon-search-advanced-count" aria-live="polite"/);
  assert.match(css,/\.pokemon-search-advanced-grid\{display:grid/);
  assert.match(css,/@media\(max-width:690px\)/);
});
test("18차: desktop expanded by default, mobile collapsed and reversible",()=>{
  const start=js.indexOf("  function initAdvancedFilterDisclosure() {");
  const end=js.indexOf("  async function init() {",start);
  assert.ok(start>0&&end>start);
  const listeners={};
  let mobile=true;
  const details={open:true};
  const context={window:{matchMedia:()=>({get matches(){return mobile;},addEventListener(t,f){listeners[t]=f;}})},
    el:id=>id==="pokemon-search-advanced-filters"?details:null};
  vm.runInNewContext(js.slice(start,end)+"\nglobalThis.activate=initAdvancedFilterDisclosure;",context);
  context.activate();
  assert.equal(details.open,false);
  mobile=false;listeners.change();assert.equal(details.open,true);
  mobile=true;listeners.change();assert.equal(details.open,false);
});
test("18차: existing search and pagination logic is not replaced",()=>{
  assert.match(js,/function loadMoreSearchCards\(\)/);
  assert.match(js,/window\.addEventListener\("pagehide", saveSearchResume\)/);
  assert.match(js,/advancedCount\.textContent = active \? active \+ "개 적용" : ""/);
});
