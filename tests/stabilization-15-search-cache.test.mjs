import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../pokemon-search.js", import.meta.url),"utf8");
const start = source.indexOf("  function searchPageKey() {");
const end = source.indexOf("  function suggestionCandidates(",start);
assert.ok(start>0 && end>start);

function fixture(count=20000) {
  const items=Array.from({length:count},(_,index)=>({index}));
  const grid={children:[],replaceChildren(fragment){this.children=[...fragment.children];},
    append(fragment){this.children.push(...fragment.children);},setAttribute(){}};
  const nodes=new Map([
    ["pokemon-search-grid",grid],
    ["pokemon-search-pagination",{hidden:true}],
    ["pokemon-search-page-counter",{textContent:""}],
    ["pokemon-search-load-more",{hidden:true}],
    ["pokemon-search-result-count",{textContent:""}],
    ["pokemon-search-active-filter",{textContent:""}],
    ["pokemon-search-reset",{hidden:true}]
  ]);
  const state={query:"피카츄",scope:"NAME",era:"ALL",setCode:"ALL",status:"all",
    visibleCount:60,visiblePageKey:"",renderedCards:[]};
  let filters=0, created=0;
  const ctx={
    state,
    SEARCH_PAGE_SIZE:60, JSON, Math,
    document:{createDocumentFragment:()=>({children:[],append(node){this.children.push(node)}})},
    el:id=>nodes.get(id),
    filteredCards:()=>{filters++;return items;},
    makeCard:item=>{created++;return item;},
    formatNumber:value=>Number(value).toLocaleString("en-US"),
    activeFilterLabel:()=>"",clean:value=>String(value||""),
    renderEmpty:()=>{},updateSummary:()=>{}
  };
  vm.runInNewContext(source.slice(start,end)+"\nglobalThis.pager={render,loadMoreSearchCards};",ctx);
  return {state,items,grid,api:ctx.pager,get filters(){return filters;},get created(){return created;}};
}

test("15차: repeated show-more uses one filtered snapshot for 20,000 cards",()=>{
  const p=fixture();
  p.api.render();
  assert.equal(p.created,60);
  assert.equal(p.filters,1);
  const first=p.grid.children[0];
  for(let n=0;n<3;n++)p.api.loadMoreSearchCards();
  assert.equal(p.filters,1,"each show-more must not re-sort all matched cards");
  assert.equal(p.created,240);
  assert.equal(p.grid.children.length,240);
  assert.strictEqual(p.grid.children[0],first);
});

test("15차: filter changes cannot append stale cards from an old snapshot",()=>{
  const p=fixture(130);
  p.api.render();
  p.api.loadMoreSearchCards();
  assert.equal(p.grid.children.length,120);
  p.state.status="owned";
  p.api.loadMoreSearchCards();
  assert.equal(p.grid.children.length,60);
  assert.equal(p.filters,2);
  p.api.loadMoreSearchCards();
  assert.equal(p.grid.children.length,120);
  assert.equal(p.filters,2);
  p.api.loadMoreSearchCards();
  assert.equal(p.grid.children.length,130);
  assert.equal(p.filters,2);
});

test("15차: search result cache does not write collection or account state",()=>{
  assert.match(source,/renderedCards: \[\]/);
  assert.match(source,/state\.renderedCards = shown/);
  assert.match(source,/const shown = state\.renderedCards/);
  assert.match(source,/window\.addEventListener\("pageshow", async \(event\)/);
});
