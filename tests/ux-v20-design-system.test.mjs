import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const style=read("styles.css");
test("20차: shared layout design uses restrained white/blue tokens and 44px tap targets",()=>{
  for(const x of ["--dcb-ux-surface: #ffffff","--dcb-ux-surface-soft: #f7f9fc","--dcb-ux-border: #dde6ee","--dcb-ux-panel-radius: 16px","--dcb-ux-touch: 44px"])
    assert.ok(style.includes(x),x);
  assert.match(style,/font-size:16px/);
  assert.match(style,/touch-action:manipulation/);
  assert.match(style,/:focus-visible/);
});
test("20차: all primary screens share base stylesheet without changing collector data",()=>{
  for(const name of ["index.html","series.html","custom.html","pokemon-search.html","studio.html"]){
    assert.match(read(name),/href="\.\/styles\.css\?v=[0-9a-f]{12}"/,name);
  }
  assert.match(read("custom.html"),/data-custom-grid-columns="2"/);
  assert.match(read("custom.html"),/data-columns="4"/);
  assert.match(read("pokemon-search.html"),/id="pokemon-search-advanced-filters"/);
});
test("20차: workflow runs Firebase tests and blocks protected data writes",()=>{
 const workflow=read(".github/workflows/ux-v17-v20-20261027.yml");
 assert.match(workflow,/npm run site:prepare/);
 assert.match(workflow,/npm test/);
 for(const target of ["data/","db/","firestore","android-app/","radar-service/"])
  assert.ok(workflow.includes(target),target);
});
