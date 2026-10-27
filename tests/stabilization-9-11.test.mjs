import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const search=read("pokemon-search.js");
const ops=read("operations.js");
const searchHtml=read("pokemon-search.html");
const backupHtml=read("operations.html");

const searchBegin=search.indexOf("  function searchPageKey() {");
const searchEnd=search.indexOf("  function suggestionCandidates(",searchBegin);
assert.ok(searchBegin>0&&searchEnd>searchBegin);
const searchFns=search.slice(searchBegin,searchEnd)+
  "\nglobalThis.__pager={render,loadMoreSearchCards};";

function fakePager(total=20000){
  const cards=Array.from({length:total},(_,i)=>({index:i}));
  const grid={
    children:[],attrs:{},
    replaceChildren(...n){this.children=n.flatMap(x=>x.fragment ? x.children : [x])},
    append(n){this.children.push(...(n.fragment?n.children:[n]))},
    setAttribute(k,v){this.attrs[k]=v}
  };
  const nodes=new Map([
    ["pokemon-search-grid",grid],
    ["pokemon-search-pagination",{hidden:true}],
    ["pokemon-search-page-counter",{textContent:""}],
    ["pokemon-search-load-more",{hidden:true}],
    ["pokemon-search-result-count",{textContent:""}],
    ["pokemon-search-active-filter",{textContent:""}],
    ["pokemon-search-advanced-count",{textContent:""}],
    ["pokemon-search-reset",{hidden:false}]
  ]);
  const state={query:"피카츄",scope:"NAME",era:"ALL",setCode:"ALL",status:"all",visibleCount:60,visiblePageKey:""};
  let rendered=0;
  const ctx={
    state,
    document:{createDocumentFragment:()=>({fragment:true,children:[],append(x){this.children.push(x)}})},
    el:k=>{if(!nodes.has(k))throw Error("Unknown control "+k);return nodes.get(k)},
    filteredCards:()=>cards,
    makeCard:item=>{rendered++;return {index:item.index}},
    formatNumber:n=>Number(n).toLocaleString("en-US"),
    activeFilterLabel:()=>"",
    clean:v=>String(v||""),
    renderEmpty:()=>{},
    updateSummary:()=>{},
    JSON,Math,SEARCH_PAGE_SIZE:60
  };
  vm.runInNewContext(searchFns,ctx);
  return {state,nodes,grid,get rendered(){return rendered},api:ctx.__pager};
}

test("20k search cards render only 60 initially, then append 60 without discarding prior nodes",()=>{
  const x=fakePager();
  x.api.render();
  assert.equal(x.grid.children.length,60);
  assert.equal(x.rendered,60);
  assert.equal(x.nodes.get("pokemon-search-result-count").textContent,"20,000");
  assert.equal(x.nodes.get("pokemon-search-pagination").hidden,false);
  const first=x.grid.children[0];
  x.api.loadMoreSearchCards();
  assert.equal(x.grid.children.length,120);
  assert.equal(x.rendered,120);
  assert.equal(x.grid.children[0],first);
  assert.equal(x.grid.children.at(-1).index,119);
  assert.equal(x.nodes.get("pokemon-search-page-counter").textContent,"120 / 20,000장 표시");
});

test("search/filter change resets progressive rendering to 60",()=>{
  const x=fakePager(143);
  x.api.render();
  x.api.loadMoreSearchCards();
  assert.equal(x.grid.children.length,120);
  x.state.status="owned";
  x.api.render();
  assert.equal(x.grid.children.length,60);
  x.api.loadMoreSearchCards();
  assert.equal(x.grid.children.length,120);
  x.api.loadMoreSearchCards();
  assert.equal(x.grid.children.length,143);
  assert.equal(x.nodes.get("pokemon-search-load-more").hidden,true);
  x.state.query="이브이";
  x.api.render();
  assert.equal(x.grid.children.length,60);
});

test("small result sets stay fully visible without pagination",()=>{
  const x=fakePager(12);
  x.api.render();
  assert.equal(x.grid.children.length,12);
  assert.equal(x.nodes.get("pokemon-search-pagination").hidden,true);
});

test("search result controls are accessible and only images in the visible batch are created",()=>{
  assert.match(searchHtml,/id="pokemon-search-pagination"[^>]*hidden/);
  assert.match(searchHtml,/id="pokemon-search-page-counter" aria-live="polite"/);
  assert.match(searchHtml,/id="pokemon-search-load-more"/);
  assert.match(search,/for \(const item of shown\.slice\(0, state\.visibleCount\)\) fragment\.append\(makeCard\(item\)\)/);
  assert.match(search,/el\("pokemon-search-load-more"\)\.addEventListener\("click", loadMoreSearchCards\)/);
});

const backupBegin=ops.indexOf("  function validateBackup(payload) {");
const backupEnd=ops.indexOf("  function restoreDocumentWrites(payload) {",backupBegin);
assert.ok(backupBegin>0 && backupEnd>backupBegin);
const validated=ops.slice(backupBegin,backupEnd)+
  "\nglobalThis.__validate=validateBackup;";
function backupValidator(uid="uid-123"){
 const context={
    state:{user:{uid}},
    LEGACY_BACKUP_FORMAT:"digital-card-binder-backup-v1",
    BACKUP_FORMAT:"digital-card-binder-backup-v2",
    DOCUMENT_IDS:["seriesDex","pokemonCollectionsDex"],
    WORLD_KEYS:["world"],
    worldLocalKeys:()=>[],
    accountCore:{usesOverrideShards:()=>false},
    validateCustomBinderBackup:()=>{},
    JSON
 };
 vm.runInNewContext(validated,context);
 return context.__validate;
}
const minimalBackup=(accountUid)=>({format:"digital-card-binder-backup-v2",
 schemaVersion:2,documents:{seriesDex:{overrides:{}}},overrideShards:{},
 ...(accountUid===undefined?{}:{accountUid}),customBinders:[]});

test("new backups refuse cross-account restore, legacy backup files remain readable",()=>{
 const validate=backupValidator();
 assert.doesNotThrow(()=>validate(minimalBackup("uid-123")));
 assert.throws(()=>validate(minimalBackup("uid-another")),/계정이 다릅니다/);
 assert.doesNotThrow(()=>validate(minimalBackup(undefined)));
 assert.throws(()=>validate({...minimalBackup("uid-123"),documents:{arbitrary:{}}}),/지원하지 않는 도감 문서/);
});

test("backup exports server-only snapshots and preflights restore before mutation",()=>{
 assert.match(ops,/function readServerDocument\(reference\) \{\s*return state\.firebase\.firestoreModule\.getDocFromServer\(reference\)/);
 assert.match(ops,/function readServerCollection\(reference\) \{\s*return state\.firebase\.firestoreModule\.getDocsFromServer\(reference\)/);
 assert.match(ops,/const snapshot = await readServerDocument\(ref\)/);
 const binderReader=ops.slice(ops.indexOf("async function readCustomBinders()"),ops.indexOf("async function makeBackup()"));
 assert.ok(binderReader.includes("await readServerCollection("));
 assert.doesNotMatch(binderReader,/await firestoreModule\.getDocs\(/);
 assert.match(ops,/accountUid: state\.user\.uid/);
 assert.match(ops,/const shardSnapshot = await readServerCollection\(state\.firebase\.firestoreModule\.collection\(reference, "overrideShards"\)\)/);
 assert.match(ops,/if \(file\.size > 120 \* 1024 \* 1024\)/);
 assert.match(ops,/const payload = validateBackup\(JSON\.parse\(text\)\);/);
 assert.match(ops,/restoreDocumentWrites\(payload\);/);
 assert.match(backupHtml,/서버의 최신 데이터만 백업/);
});
