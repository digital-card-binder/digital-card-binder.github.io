import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../custom.js", import.meta.url), "utf8");
const markup = readFileSync(new URL("../custom.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../custom.css", import.meta.url), "utf8");
const start = source.indexOf("  function updateCustomCardsPagination(");
const end = source.indexOf("  function renderAll()", start);
assert.ok(start > 0 && end > start, "Personal dex pagination helpers must be present");
const helperCode = source.slice(start, end)
  + "\n globalThis.__test = { updateCustomCardsPagination, loadMoreCustomCards, jumpToCustomCardPage, renderWorkspace };";

function harness(total = 125) {
  const cards = Array.from({length:total},(_,i)=>({key:"card-"+i,owned:i%3===0}));
  const dex = {title:"테스트 도감",description:"도감 검색",cards};
  const grid = {
    children:[],
    replaceChildren(){this.children=[];},
    append(item){
      if (item.__fragment) this.children.push(...item.children);
      else this.children.push(item);
    }
  };
  const nodes = new Map([
    ["custom-workspace",{hidden:true}],
    ["custom-no-selection",{hidden:false}],
    ["selected-dex-title",{textContent:""}],
    ["selected-dex-description",{textContent:""}],
    ["selected-dex-progress",{textContent:""}],
    ["custom-result-count",{textContent:""}],
    ["custom-card-grid",grid],
    ["custom-card-empty",{hidden:false}],
    ["custom-cards-pagination",{hidden:true}],
    ["custom-cards-visible-counter",{textContent:""}],
    ["custom-cards-load-more",{textContent:"",hidden:false}],
    ["custom-cards-page-jump",{options:[],value:"0",replaceChildren(){this.options=[];},append(option){this.options.push(option);}}]
  ]);
  const state={customCardVisibleCount:50,customCardPageStart:0,bulkOrderMode:false,query:"",filter:"all"};
  const context={state,CUSTOM_CARD_PAGE_SIZE:50,
    $:(name)=>nodes.get(name),
    currentDex:()=>dex,
    filteredEntries:()=>dex.cards.filter(x=>
      (!state.query || x.key.includes(state.query)) &&
      (state.filter==="all" || (state.filter==="owned"?x.owned:!x.owned))),
    renderBulkToolbar:()=>{},
    makeCustomCard:(item,index)=>({key:item.key,index}),
    document:{
      createElement:()=>({value:"",textContent:""}),
      createDocumentFragment:()=>({
        __fragment:true,children:[],append(item){this.children.push(item);}
      })
    }
  };
  vm.runInNewContext(helperCode,context);
  return {state,dex,nodes,grid,api:context.__test};
}
test("personal dex renders 50, then appends 50 without replacing previous cards",()=>{
 const h=harness(125);
 h.api.renderWorkspace();
 assert.equal(h.grid.children.length,50);
 assert.equal(h.nodes.get("custom-cards-visible-counter").textContent,"50 / 125장 표시");
 assert.equal(h.nodes.get("custom-cards-load-more").textContent,"50장 더보기");
 const old=h.grid.children[0];
 h.api.loadMoreCustomCards();
 assert.equal(h.grid.children.length,100);
 assert.equal(h.grid.children[0],old,"Previously rendered cards must keep identity");
 h.api.loadMoreCustomCards();
 assert.equal(h.grid.children.length,125);
 assert.equal(h.nodes.get("custom-cards-pagination").hidden,false);
 assert.equal(h.nodes.get("custom-cards-load-more").hidden,true);
 h.api.loadMoreCustomCards();
 assert.equal(h.grid.children.length,125,"Repeated pagination cannot duplicate cards");
 assert.equal(new Set(h.grid.children.map(x=>x.key)).size,125);
});
test("search and status can re-render first page and preserve stored order",()=>{
 const h=harness(129);
 h.api.renderWorkspace();
 h.state.query="card-12";
 h.state.customCardVisibleCount=50;
 h.api.renderWorkspace();
 assert.deepEqual(h.grid.children.map(x=>x.key),["card-12","card-120","card-121","card-122","card-123","card-124","card-125","card-126","card-127","card-128"]);
 assert.equal(h.nodes.get("custom-cards-pagination").hidden,true);
 h.state.query="";
 h.state.filter="owned";
 h.api.renderWorkspace();
 assert.equal(h.grid.children.length,43);
 assert.equal(h.nodes.get("custom-cards-pagination").hidden,true);
 assert.equal(h.dex.cards.length,129,"Master custom dex must never be truncated");
});
test("sort mode intentionally shows every card so no drag targets are lost",()=>{
 const h=harness(151);
 h.state.bulkOrderMode=true;
 h.api.renderWorkspace();
 assert.equal(h.grid.children.length,151);
 assert.equal(h.nodes.get("custom-cards-pagination").hidden,true);
 h.state.bulkOrderMode=false;
 h.api.renderWorkspace();
 assert.equal(h.grid.children.length,50);
 assert.equal(h.nodes.get("custom-cards-pagination").hidden,false);
});
test("pager markup and styling remain accessible and mobile-compatible",()=>{
 assert.match(markup,/id="custom-cards-pagination"[^>]*hidden/);
 assert.match(markup,/id="custom-cards-load-more"[^>]*type="button"|id="custom-cards-load-more"/);
 assert.match(css,/\.custom-cards-pagination\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.custom-cards-pagination button\{[\s\S]*?min-height:44px/);
 assert.match(css,/\.custom-workspace-filter input\[type="search"\]\{font-size:16px\}/);
 assert.match(source,/state\.customCardVisibleCount = CUSTOM_CARD_PAGE_SIZE;\s*renderWorkspace\(\);/);
});

test("direct jump displays only the selected 50-card window, not every preceding card",()=>{
 const h=harness(1500);
 h.api.renderWorkspace();
 const selector=h.nodes.get("custom-cards-page-jump");
 assert.equal(selector.options.length,30);
 assert.equal(selector.options[19].value,"950");
 assert.equal(selector.options[19].textContent,"951–1000장");
 h.api.jumpToCustomCardPage("950");
 assert.equal(h.grid.children.length,50);
 assert.equal(h.grid.children[0].key,"card-950");
 assert.equal(h.grid.children.at(-1).key,"card-999");
 assert.equal(h.nodes.get("custom-cards-visible-counter").textContent,"951–1000 / 1500장 표시");
 assert.equal(selector.value,"950");
 h.api.loadMoreCustomCards();
 assert.equal(h.grid.children.length,100);
 assert.equal(h.grid.children.at(-1).key,"card-1049");
 h.api.jumpToCustomCardPage("1450");
 assert.equal(h.grid.children.length,50);
 assert.equal(h.grid.children[0].key,"card-1450");
 assert.equal(h.grid.children.at(-1).key,"card-1499");
 assert.equal(h.nodes.get("custom-cards-load-more").hidden,true);
 assert.equal(h.nodes.get("custom-cards-pagination").hidden,false);
 assert.equal(h.dex.cards.length,1500);
});
test("page jump rejects out-of-range values and filter shrinking resets safely",()=>{
 const h=harness(151);
 h.api.renderWorkspace();
 h.api.jumpToCustomCardPage("-50");
 assert.equal(h.state.customCardPageStart,0);
 h.api.jumpToCustomCardPage("25");
 assert.equal(h.state.customCardPageStart,0);
 h.api.jumpToCustomCardPage("9999");
 assert.equal(h.state.customCardPageStart,0);
 h.api.jumpToCustomCardPage("100");
 assert.equal(h.grid.children.length,50);
 h.state.query="card-14";
 h.api.renderWorkspace();
 assert.equal(h.state.customCardPageStart,0);
 assert.equal(h.grid.children.length,11);
});
test("page-jump controls are accessible and sorting retains full-list access",()=>{
 assert.match(markup,/id="custom-cards-page-jump" aria-label="표시할 카드 번호 구간 선택"/);
 assert.match(css,/\.custom-card-page-selector select\{[\s\S]*?height:44px/);
 assert.match(source,/jumpToCustomCardPage\(event\.currentTarget\.value\)/);
 const h=harness(155);
 h.api.jumpToCustomCardPage("100");
 h.state.bulkOrderMode=true;
 h.api.renderWorkspace();
 assert.equal(h.grid.children.length,155);
 assert.equal(h.nodes.get("custom-cards-pagination").hidden,true);
});
