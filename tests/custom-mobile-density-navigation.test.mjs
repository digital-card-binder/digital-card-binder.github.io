import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const js = readFileSync(new URL("../custom-grid-density.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../custom.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../custom.css", import.meta.url), "utf8");

function runFixture(stored=null,storageThrows=false) {
  const controls = ["2","4"].map(value=>({
    dataset:{columns:value},
    classes:new Set(value==="2"?["is-active"]:[]),
    attributes:{"aria-pressed":value==="2"?"true":"false"},
    classList:{
      toggle(name,on){if(name!=="is-active")throw Error("unexpected class"); if(on)this.owner.classes.add(name);else this.owner.classes.delete(name)}
    },
    setAttribute(name,value){this.attributes[name]=value}
  }));
  for(const button of controls)button.classList.owner=button;
  const listeners=new Map();
  const writes=[];
  const document={
    body:{dataset:{customGridColumns:"2"}},
    readyState:"loading",
    querySelectorAll(selector){
      assert.equal(selector,"#custom-grid-density button[data-columns]");
      return controls;
    },
    getElementById(id){
      assert.equal(id,"custom-grid-density");
      return {addEventListener(name,fn){listeners.set(name,fn)}};
    },
    addEventListener(name,fn){listeners.set(name,fn)}
  };
  const localStorage={
    getItem(key){
      assert.equal(key,"dcb-custom-dex-mobile-columns");
      if(storageThrows)throw Error("blocked storage");
      return stored;
    },
    setItem(key,value){
      if(storageThrows)throw Error("blocked storage");
      writes.push({key,value});
    }
  };
  vm.runInNewContext(js,{document,localStorage});
  listeners.get("DOMContentLoaded")();
  const press=(value)=>listeners.get("click")({target:{closest(selector){
    assert.equal(selector,"button[data-columns]");
    return controls.find(button=>button.dataset.columns===value)||{dataset:{columns:value}};
  }}});
  return {document,controls,writes,press};
}

test("new visitors see two readable cards per mobile row",()=>{
  const f=runFixture();
  assert.equal(f.document.body.dataset.customGridColumns,"2");
  assert.equal(f.controls[0].attributes["aria-pressed"],"true");
  assert.equal(f.controls[1].attributes["aria-pressed"],"false");
  assert.equal(f.writes.length,0,"Simply opening the page must not overwrite a preference");
});

test("existing four-column preference survives without reset",()=>{
  const f=runFixture("4");
  assert.equal(f.document.body.dataset.customGridColumns,"4");
  assert.equal(f.controls[0].attributes["aria-pressed"],"false");
  assert.equal(f.controls[1].attributes["aria-pressed"],"true");
  assert.equal(f.writes.length,0);
  f.press("2");
  assert.equal(f.document.body.dataset.customGridColumns,"2");
  assert.deepEqual(f.writes,[{key:"dcb-custom-dex-mobile-columns",value:"2"}]);
  f.press("4");
  assert.equal(f.document.body.dataset.customGridColumns,"4");
  assert.equal(f.writes.at(-1).value,"4");
});

test("disabled storage keeps the two-column default and allows runtime toggles",()=>{
  const f=runFixture(null,true);
  assert.equal(f.document.body.dataset.customGridColumns,"2");
  f.press("4");
  assert.equal(f.document.body.dataset.customGridColumns,"4");
  f.press("3");
  assert.equal(f.document.body.dataset.customGridColumns,"4");
});

test("page initial DOM and accessible labels match the two-column default",()=>{
  assert.ok(html.includes('<body data-page="custom-dex" data-custom-grid-columns="2">'));
  assert.ok(html.includes('data-columns="2" class="is-active" aria-pressed="true" aria-label="카드를 한 줄에 두 장씩 크게 보기"'));
  assert.ok(html.includes('data-columns="4" aria-pressed="false" aria-label="카드를 한 줄에 네 장씩 작게 보기"'));
  assert.ok(css.includes('data-custom-grid-columns="2"] #custom-card-grid.card-grid'));
});

test("mobile dex-switch controls remain reachable and page jumps are not obscured",()=>{
  assert.ok(css.includes('data-custom-view="detail"] .custom-mobile-detail-nav {'));
  assert.ok(css.includes('position: sticky;'));
  assert.ok(css.includes('z-index: 21;'));
  assert.ok(css.includes('#custom-card-grid {\n    scroll-margin-top:'));
  assert.ok(css.includes('#custom-mobile-switch {\n    min-height: 44px;\n    font-size: 16px;'));
});
