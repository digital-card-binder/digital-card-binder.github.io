import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const mobile = readFileSync(new URL("../custom-mobile-ux.js", import.meta.url), "utf8");
const first = mobile.indexOf("  function showList() {");
const last = mobile.indexOf("  function selectSection(", first);
const historyStart = mobile.indexOf('    window.addEventListener("popstate",');
const historyEnd = mobile.indexOf('    $("custom-mobile-switch")', historyStart);
assert.ok(first >= 0 && last > first && historyStart > last && historyEnd > historyStart);

function screen() {
  let scroll = 420;
  const calls = [];
  const listeners = {};
  const body = { dataset: {customView:"list", customSection:"dex"} };
  const win = {
    location:{href:"https://digital-card-binder.github.io/custom.html"},
    get scrollY(){ return scroll; },
    scrollTo(_x,y){scroll=y; calls.push(["scroll",y]);},
    history:{
      state:{previous:"retained"},
      pushState(state){this.state=state;calls.push(["push",state.customDexMobileDetail]);}
    },
    addEventListener(type,listener){listeners[type]=listener;}
  };
  const context = {document:{body}, window:win, mobile:{matches:true},
    requestAnimationFrame:fn=>fn()};
  vm.runInNewContext(mobile.slice(first,last)+"\n"+mobile.slice(historyStart,historyEnd)+
    "\nglobalThis.screenApi={showList,showDetail};",context);
  return {win,body,listeners,calls,api:context.screenApi,get scroll(){return scroll}};
}

test("mobile personal dex keeps list scroll and preserves existing history fields",()=>{
  const f=screen();
  f.api.showDetail();
  assert.equal(f.body.dataset.customView,"detail");
  assert.equal(f.calls.filter(x=>x[0]==="push").length,1);
  assert.equal(f.win.history.state.previous,"retained");
  f.api.showDetail();
  assert.equal(f.calls.filter(x=>x[0]==="push").length,1);
  f.listeners.popstate({state:{previous:"retained"}});
  assert.equal(f.body.dataset.customView,"list");
  assert.equal(f.scroll,420);
});

test("mobile browser forward restores detail without adding duplicate history",()=>{
  const f=screen();
  f.api.showDetail();
  f.listeners.popstate({state:null});
  f.listeners.popstate({state:{customDexMobileDetail:true}});
  assert.equal(f.body.dataset.customView,"detail");
  assert.equal(f.calls.filter(x=>x[0]==="push").length,1);
  assert.equal(f.scroll,0);
});

test("desktop popstate never forces a mobile detail view",()=>{
  const f=screen();
  // Check the listener checks the media query before restoring mobile layout.
  assert.match(mobile, /event\.state\?\.customDexMobileDetail && mobile\.matches/);
  assert.match(mobile, /history\.state\?\.customDexMobileDetail/);
  assert.match(mobile, /list\.contains\(tile\) && mobile\.matches/);
  assert.ok(f.body.dataset.customSection==="dex");
});
