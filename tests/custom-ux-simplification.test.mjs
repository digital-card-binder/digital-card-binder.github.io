import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

const html=fs.readFileSync(new URL("../custom.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../custom.css",import.meta.url),"utf8");
const source=fs.readFileSync(new URL("../custom-mobile-ux.js",import.meta.url),"utf8");
const loader=fs.readFileSync(new URL("../custom-loader.js",import.meta.url),"utf8");
const start=source.indexOf("  function prepareCard(article) {");
const end=source.indexOf("  function prepareCards() {",start);
assert.ok(start>0 && end>start);
const isolated=source.slice(start,end)+"\nglobalThis.__ux={prepareCard,setCardImportMode};";

function button(){
  const events=new Map();
  return {
    className:"",type:"",disabled:false,innerHTML:"",textContent:"",attrs:{},
    dataset:{},classList:{toggle(){}},
    setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(event,fn){events.set(event,fn);},
    click(){if(!this.disabled)events.get("click")?.();},
    focus(){this.focused=true;}
  };
}
function fixture(){
  let owns=0,closes=0,shows=0;
  const own=button(),up=button(),down=button(),remove=button();
  own.click=()=>{if(!own.disabled)owns++;};
  const items={'.custom-owned-toggle':own,'[title="앞으로 이동"]':up,
    '[title="뒤로 이동"]':down,'.custom-remove-card':remove};
  const actions={
    nodes:[],querySelector(k){return items[k]},
    replaceChildren(...nodes){this.nodes=nodes}
  };
  const manage=button();
  const article={
    dataset:{},classList:{contains:(x)=>x==="is-owned"},
    querySelector(k){if(k===".custom-card-actions")return actions;
      if(k===".card-name-ko")return {textContent:"피카츄"};
      throw Error("selector "+k);}
  };
  const dialog={close(){closes++;},showModal(){shows++;}};
  const controls={nodes:[],replaceChildren(...nodes){this.nodes=nodes;},append(...nodes){this.nodes.push(...nodes)}};
  const searchTab=button(),photoTab=button();
  searchTab.dataset.importMode="search";
  photoTab.dataset.importMode="photo";
  const pickerDialog={
    dataset:{customImportMode:"search"},
    querySelectorAll(k){
      assert.equal(k,".custom-import-methods button[data-import-mode]");
      return [searchTab,photoTab];
    }
  };
  const pickerSearch=button(),photoTrigger=button();
  const nodes={
    "custom-card-menu-dialog":dialog,"custom-card-menu-actions":controls,
    "custom-card-menu-title":manage,"card-picker-dialog":pickerDialog,
    "card-picker-search":pickerSearch,"custom-photo-trigger":photoTrigger
  };
  const context={
    document:{createElement:(name)=>{assert.equal(name,"button");return button();}},
    $:(id)=>nodes[id],
    documentBody:null
  };
  context.document.body={classList:{contains:()=>false}};
  vm.runInNewContext(isolated,context);
  return {ui:context.__ux,article,actions,own,controls,dialog,
    pickerDialog,searchTab,photoTab,pickerSearch,photoTrigger,
    get owns(){return owns;},get closes(){return closes;},get shows(){return shows;}}
}

test("the 4-up management menu provides a full-size ownership action",()=>{
  const f=fixture();
  f.ui.prepareCard(f.article);
  assert.equal(f.article.dataset.compactReady,"1");
  assert.equal(f.actions.nodes.length,2);
  const more=f.actions.nodes[1];
  assert.match(more.innerHTML,/custom-more-label/);
  more.click();
  assert.equal(f.shows,1);
  assert.equal(f.controls.nodes.length,2,"Owned and remove actions are available");
  const ownAction=f.controls.nodes[0];
  assert.equal(ownAction.textContent,"✓ 보유 취소");
  ownAction.click();
  assert.equal(f.closes,1);
  assert.equal(f.owns,1,"Own action should reuse existing Firestore/rollback handler");
});

test("an in-flight ownership save disables menu action too",()=>{
  const f=fixture();
  f.ui.prepareCard(f.article);
  f.own.disabled=true;
  f.actions.nodes[1].click();
  assert.equal(f.controls.nodes[0].disabled,true);
  f.controls.nodes[0].click();
  assert.equal(f.owns,0);
});

test("search and photo modes separate interfaces and preserve accessible pressed states",()=>{
  const f=fixture();
  f.ui.setCardImportMode("photo",true);
  assert.equal(f.pickerDialog.dataset.customImportMode,"photo");
  assert.equal(f.photoTab.attrs["aria-pressed"],"true");
  assert.equal(f.searchTab.attrs["aria-pressed"],"false");
  assert.equal(f.photoTrigger.focused,true);
  f.ui.setCardImportMode("search",true);
  assert.equal(f.pickerDialog.dataset.customImportMode,"search");
  assert.equal(f.searchTab.attrs["aria-pressed"],"true");
  assert.equal(f.pickerSearch.focused,true);
  f.ui.setCardImportMode("invalid",true);
  assert.equal(f.pickerDialog.dataset.customImportMode,"search");
});

test("personal dex management actions retain original element IDs and no separate inline delete",()=>{
  assert.match(html,/<details id="custom-dex-manage"/);
  assert.match(html,/<summary>도감 관리<\/summary>/);
  const from=html.indexOf('<details id="custom-dex-manage"');
  const to=html.indexOf("</details>",from);
  assert.ok(from>0 && to>from);
  const menu=html.slice(from,to);
  assert.match(menu,/id="edit-dex-button"/);
  assert.match(menu,/id="delete-dex-button"/);
  assert.equal((html.match(/id="delete-dex-button"/g)||[]).length,1);
  assert.match(css,/\.custom-dex-manage-actions button\{width:100%;min-height:44px!important/);
});

test("card import methods are separated into clearly named accessible panels",()=>{
  assert.match(html,/id="card-picker-dialog"[^>]+data-custom-import-mode="search"/);
  assert.match(html,/id="custom-import-search-tab"[^>]*aria-controls="custom-import-search-section"/);
  assert.match(html,/id="custom-import-photo-tab"[^>]*aria-controls="custom-import-photo-section"/);
  assert.match(html,/id="custom-import-photo-section" data-custom-import-section="photo"/);
  assert.match(html,/id="custom-import-search-section" data-custom-import-section="search"/);
  assert.match(css,/\[data-custom-import-mode="photo"\] \[data-custom-import-section="search"\]/);
  assert.match(css,/\[data-custom-import-mode="search"\] \[data-custom-import-section="photo"\]/);
  assert.match(source,/setCardImportMode\("search"\)/);
});

test("four-column view has one at least 44px action; accessible 2-column toggle is preserved",()=>{
  assert.match(css,/\.custom-card\[data-compact-ready="1"\] \.custom-owned-toggle\s*\{\s*display:none!important/);
  assert.match(css,/\.custom-card-actions \.custom-card-more\s*\{\s*flex:1 1 100%!important;width:100%!important;\s*min-height:44px!important/);
  assert.match(css,/#custom-card-menu-actions \.custom-card-menu-owned\{min-height:48px\}/);
  assert.match(html,/data-columns="2" class="is-active"/);
  assert.match(html,/data-columns="4" aria-pressed="false"/);
});

test("mobile script is cache-busted to exact git blob hash",()=>{
  const buffer=Buffer.from(source,"utf8");
  const sha=crypto.createHash("sha1").update(Buffer.concat([
    Buffer.from("blob "+buffer.length+"\0"),buffer])).digest("hex").slice(0,12);
  assert.ok(loader.includes('src === "./custom-mobile-ux.js" ? "'+sha+'"'),
    "dynamic loader must fetch latest card management menu rather than stale cached JS");
});
