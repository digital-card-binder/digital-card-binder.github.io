import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const custom=read("custom.js"), search=read("pokemon-search.js");
test("31차: personal card picker caches repeated same-query rendering over 20,000 cards",()=>{
 const start=custom.indexOf("  function pickerMatches(query) {");
 const end=custom.indexOf("  function renderPicker() {",start);
 assert.ok(start>0&&end>start);
 const cards=Array.from({length:21000},(_,i)=>({key:String(i),search:i%2?"pikachu":"eevee"}));
 let scans=0;
 const state={catalog:cards,pickerMatchCache:null};
 const ctx={state,normalize:q=>String(q).toLowerCase(),PICKER_PAGE_SIZE:50,
   searchMatches:(card,q)=>{scans++;return card.search.includes(q)}};
 vm.runInNewContext(custom.slice(start,end)+"\nglobalThis.pick=pickerMatches;",ctx);
 let first=ctx.pick("Pika");
 assert.equal(first.length,10500);
 assert.equal(scans,21000);
 assert.strictEqual(ctx.pick("Pika"),first);
 assert.equal(scans,21000,"repeat selection must not rescan 21,000 items");
 assert.equal(ctx.pick("Eevee").length,10500);
 assert.equal(scans,42000);
 state.catalog=cards.slice(0,80);
 assert.equal(ctx.pick("Eevee").length,40);
 assert.equal(scans,42080,"catalog replacement invalidates cached search");
});
test("31차: sorted global search retains exact order, owned/missing and identity semantics",()=>{
 const begin=search.indexOf("  function filteredCards() {");
 const end=search.indexOf("  function updateSummary()",begin);
 assert.ok(begin>0&&end>begin);
 const states=[
  {era:"ALL",setCode:"ALL",status:"all"},
  {era:"SV",setCode:"ALL",status:"owned"},
  {era:"ALL",setCode:"S2",status:"missing"}
 ];
 const cards=Array.from({length:21000},(_,i)=>({
  era:["SV","M","S"][i%3],setCode:["S1","S2"][i%2],groupIndex:i%7,
  card:{owned:i%4===0,num:i%150}
 }));
 const rank={ORIGIN:0,ADV:1,DP:2,BW:3,XY:4,SM:5,S:6,SV:7,M:8};
 const ctx={state:{},ERA_RANK:rank,targetCards:()=>cards,cardNumber:c=>c.num};
 vm.runInNewContext(search.slice(begin,end)+"\nglobalThis.filtered=filteredCards;",ctx);
 for(const opts of states){
  Object.assign(ctx.state,opts);
  const actual=ctx.filtered();
  const expected=cards.filter(i=>(opts.era==="ALL"||i.era===opts.era)
    &&(opts.setCode==="ALL"||i.setCode===opts.setCode)
    &&(opts.status==="all"||(opts.status==="owned"?i.card.owned:!i.card.owned)))
   .sort((a,b)=>rank[a.era]-rank[b.era]||a.groupIndex-b.groupIndex||a.card.num-b.card.num);
  assert.equal(actual.length,expected.length);
  assert.deepEqual(actual.map(i=>cards.indexOf(i)).slice(0,120),expected.map(i=>cards.indexOf(i)).slice(0,120));
 }
});
test("31차: viewport rendering remains paginated, images lazy and asynchronously decoded",()=>{
 assert.match(search,/SEARCH_PAGE_SIZE = 60/);
 assert.match(search,/state\.renderedCards = shown/);
 assert.match(search,/image\.decoding = "async"/);
 assert.match(custom,/image\.decoding = "async"/);
 assert.match(custom,/CUSTOM_CARD_PAGE_SIZE = 50/);
 assert.match(custom,/state\.pickerMatchCache = null/);
});
