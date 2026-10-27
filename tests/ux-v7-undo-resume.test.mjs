import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const custom=fs.readFileSync(new URL("../custom.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../custom.html",import.meta.url),"utf8");
const search=fs.readFileSync(new URL("../pokemon-search.js",import.meta.url),"utf8");
const style=fs.readFileSync(new URL("../custom.css",import.meta.url),"utf8");
const start=search.indexOf('  const SEARCH_RESUME_KEY = ');
const end=search.indexOf("  function bindEvents() {",start);
assert.ok(start>0&&end>start);
const code=search.slice(start,end)+"\nglobalThis.__resume={saveSearchResume,restoreSearchResume};";

function harness(persisted=null,blocked=false){
  const storage=new Map(persisted?[["dcb-pokemon-search-resume-v1",JSON.stringify(persisted)]]:[]);
  const controls={
    "pokemon-search-input":{value:""},
    "pokemon-search-scope":{value:"ALL"},
    "pokemon-search-era":{value:"ALL"},
    "pokemon-search-set":{value:"ALL",options:[{value:"ALL"},{value:"m6a"}]},
    "pokemon-search-status":{querySelectorAll:()=>["all","owned","missing"].map(v=>({
      dataset:{status:v},classList:{toggle(name,on){controls["status:"+v]=on}}
    }))}
  };
  let renders=0,scrolled=null;
  const state={query:"피카츄",scope:"NAME",era:"SV",setCode:"m6a",status:"owned",target:null};
  const context={
    state,
    window:{
      scrollY:345,
      sessionStorage:{
        setItem(k,v){if(blocked)throw Error("blocked");storage.set(k,v)},
        getItem(k){if(blocked)throw Error("blocked");return storage.get(k)}
      },
      requestAnimationFrame(fn){fn();},
      scrollTo(x,y){scrolled={x,y}}
    },
    el:id=>controls[id],
    exactPokemon:q=>({nameKo:q}),
    syncSearchPlaceholder:()=>{},
    populateSetFilter:()=>{controls["pokemon-search-set"].options=[{value:"ALL"},{value:"m6a"}]},
    render:()=>renders++,
    JSON,Number,Math
  };
  vm.runInNewContext(code,context);
  return {api:context.__resume,state,storage,controls,get renders(){return renders},get scrolled(){return scrolled}};
}

test("search retains text, scope, era, set, owned filter and scroll by tab",()=>{
  const h=harness();
  h.api.saveSearchResume();
  const value=JSON.parse(h.storage.get("dcb-pokemon-search-resume-v1"));
  assert.equal(value.query,"피카츄");
  assert.equal(value.scope,"NAME");
  assert.equal(value.era,"SV");
  assert.equal(value.setCode,"m6a");
  assert.equal(value.status,"owned");
  assert.equal(value.scrollY,345);
  const restored=harness(value);
  restored.api.restoreSearchResume();
  assert.equal(restored.controls["pokemon-search-input"].value,"피카츄");
  assert.equal(restored.controls["pokemon-search-era"].value,"SV");
  assert.equal(restored.controls["pokemon-search-set"].value,"m6a");
  assert.equal(restored.controls["status:owned"],true);
  assert.equal(restored.renders,1);
  assert.deepEqual(restored.scrolled,{x:0,y:345});
});

test("unknown filter values are rejected without breaking search",()=>{
  const h=harness({query:"Eevee",scope:"evil",era:"UNKNOWN",setCode:"nope",status:"invalid",scrollY:-5});
  h.api.restoreSearchResume();
  assert.equal(h.state.scope,"ALL");
  assert.equal(h.state.era,"ALL");
  assert.equal(h.state.setCode,"ALL");
  assert.equal(h.state.status,"all");
  assert.equal(h.scrolled,null);
  assert.equal(h.renders,1);
});

test("restricted storage degrades safely, and URL query overrides saved resume",()=>{
  const h=harness(null,true);
  assert.doesNotThrow(()=>h.api.saveSearchResume());
  assert.doesNotThrow(()=>h.api.restoreSearchResume());
  assert.match(search,/if \(!requested\) restoreSearchResume\(\)/);
  assert.match(search,/window\.addEventListener\("pagehide", saveSearchResume\)/);
});

test("ownership undo only becomes available after successful Firestore persistence",()=>{
  assert.match(custom,/await saveDexes\(\);\s*if \(offerUndo && typeof window !== "undefined"\) offerCustomOwnershipUndo\(entry, dex\);/);
  assert.match(custom,/await toggleCustomCardOwned\(entry, dex, false\)/);
  assert.match(custom,/state\.undoTimer = window\.setTimeout\(dismissCustomOwnershipUndo, 8000\)/);
  assert.match(custom,/if \(state\.ownershipSaving \|\| !dex\.cards\.includes\(entry\)\) return;/);
  assert.match(custom,/entry\.owned = previousOwned;\s*dex\.updatedAt = previousUpdatedAt;/);
  assert.match(html,/id="custom-undo-toast"[^>]*role="status"[^>]*hidden/);
  assert.match(html,/id="custom-undo-button"[^>]*>실행 취소/);
  assert.match(style,/\.custom-undo-toast\[hidden\]\{display:none!important\}/);
});
