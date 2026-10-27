import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const custom=fs.readFileSync(new URL("../custom.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../custom.html",import.meta.url),"utf8");
const search=fs.readFileSync(new URL("../pokemon-search.js",import.meta.url),"utf8");
const searchHtml=fs.readFileSync(new URL("../pokemon-search.html",import.meta.url),"utf8");
const start=custom.indexOf("  function selectVisiblePickerCards()");
const end=custom.indexOf("  async function addCatalogCard(",start);
assert.ok(start>0&&end>start);
const isolated=custom.slice(start,end)+"\nglobalThis.__v6={selectVisiblePickerCards,selectAllPickerCards,requestedQuickAddCard};";

function fixture(query="pik",visible=50,total=130,capacity=1500){
  const catalog=Array.from({length:total},(_,i)=>({key:"m6a::m6a_"+i,setCode:"m6a",name:"pik-"+i}));
  const selected=new Set(),messages=[], elements={
    "card-picker-search":{value:query},
    "custom-photo-status":{textContent:""}
  };
  const context={
    state:{
      catalog, catalogMap:new Map(catalog.map(c=>[c.key,c])),pickerVisibleCount:visible,
      pickedCatalogKeys:selected
    },
    $:(key)=>elements[key],
    currentDex:()=>({cards:Array.from({length:1500-capacity},(_,i)=>({key:"already-owned-"+i}))}),
    pickerMatches:(q)=>q?catalog:catalog.slice(0,50),
    MAX_CARDS_PER_DEX:1500,
    renderPicker:()=>{context.renders=(context.renders||0)+1;},
    normalize:x=>String(x).toLowerCase(),
    clean:x=>String(x||"").trim(),
    window:{location:{search:""}},
    URLSearchParams,
    alert:(msg)=>messages.push(msg)
  };
  vm.runInNewContext(isolated,context);
  return{context,selected,messages,catalog,api:context.__v6};
}

test("visible select chooses only displayed 50, all select can choose full 130",()=>{
 const h=fixture();
 h.api.selectVisiblePickerCards();
 assert.equal(h.selected.size,50);
 assert.equal(h.context.renders,1);
 h.api.selectAllPickerCards();
 assert.equal(h.selected.size,130);
});

test("all matching card selection never silently exceeds binder capacity",()=>{
 const h=fixture("pik",50,130,100);
 h.api.selectAllPickerCards();
 assert.equal(h.selected.size,0);
 assert.match(h.messages[0],/추가 가능한 카드가 100장/);
});

test("direct search handoff resolves exact Korean set and card code",()=>{
 const h=fixture();
 h.context.window.location.search="?addSet=m6a&addCode=m6a_25";
 assert.equal(h.api.requestedQuickAddCard()?.key,"m6a::m6a_25");
 h.context.window.location.search="?addSet=sm6a&addCode=m6a_25";
 assert.equal(h.api.requestedQuickAddCard(),null);
 h.context.window.location.search="?addSet=m6a&addCode=m6a_2500";
 assert.equal(h.api.requestedQuickAddCard(),null);
});

test("search result never silently stores ownership, only navigates to choice dialog",()=>{
 assert.match(searchHtml,/id="pokemon-search-add-custom"/);
 assert.match(search,/new URLSearchParams\(\{ addSet: setCode, addCode: code \}\)/);
 assert.match(search,/location\.assign\("\.\/custom\.html\?" \+ params\.toString\(\)\)/);
 assert.match(html,/id="custom-quick-add-dialog"/);
 assert.match(html,/id="custom-quick-add-dex" required/);
 assert.match(custom,/dex\.cards\.some\(\(entry\) => entry\.key === card\.key\)/);
 assert.match(custom,/dex\.cards\.push\(added\)/);
 assert.match(custom,/dex\.cards = dex\.cards\.filter\(\(entry\)=>entry!==added\)/);
 assert.match(custom,/await saveDexes\(\)/);
 assert.match(custom,/history\.replaceState/);
});

test("selection UI clearly differentiates visible vs entire query and preserves disabled state",()=>{
 assert.match(html,/id="card-picker-select-visible"[^>]*>현재 표시된 카드 선택<\/button>/);
 assert.match(html,/id="card-picker-select-all"[^>]*>검색 결과 전체 선택<\/button>/);
 assert.match(custom,/state\.pickerVisibleCount\)\.forEach/);
 assert.match(custom,/state\.pickedCatalogKeys\.size/);
 assert.match(custom,/state\.bulkSaving/);
});
