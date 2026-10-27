import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src=fs.readFileSync(new URL("../custom.js",import.meta.url),"utf8");
const start=src.indexOf("  // Update only the changed card and ownership counters");
const end=src.indexOf("  function makeCustomCard(entry, index, dex)",start);
assert.ok(start>0 && end>start,"ownership helper functions must be present");
const isolated=src.slice(start,end)+"\nglobalThis.__owned={setCustomOwnershipSaving,refreshCustomOwnershipUi,toggleCustomCardOwned};";

function classSet(...names){
  const values=new Set(names);
  return {values,
    toggle(name,on){if(on)values.add(name);else values.delete(name);},
    contains(name){return values.has(name);}
  };
}

function scenario({owned=false,filter="all",saved=true,delayed=false,visibleKey="A"}={}){
  const entry={key:"A",owned};
  const dex={id:"dex1",title:"Test",cards:[entry,{key:"B",owned:true}],updatedAt:"before"};
  const own={disabled:false,textContent:owned?"✓ 보유":"○ 미보유",attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
  const badge={classList:classSet(owned?"is-owned":"is-missing"),textContent:owned?"보유":"미보유"};
  let overlay=owned?null:{className:"missing-overlay",textContent:"미보유",remove(){overlay=null;}};
  const image={
    querySelector(q){assert.equal(q,".missing-overlay");return overlay;},
    append(n){overlay=n;}
  };
  const card={
    dataset:{cardKey:visibleKey},
    classList:classSet("custom-card",owned?"is-owned":"is-missing"),
    querySelector(q){
      if(q===".custom-owned-toggle")return own;
      if(q===".status-badge")return badge;
      if(q===".custom-card-image")return image;
      throw Error(q);
    }
  };
  const counter={textContent:"1 / 2장 보유"};
  const tile={dataset:{dexId:"dex1"},querySelector(q){assert.equal(q,".custom-dex-tile-copy small");return counter;}};
  const progress={textContent:""};
  let workspaceRenders=0,summaryRenders=0,saveCount=0;
  let finish;
  const saveGate=delayed?new Promise((resolve)=>{finish=resolve;}):Promise.resolve();
  const alerts=[];
  const doc={
    querySelectorAll(q){
      if(q==="#custom-card-grid .custom-owned-toggle")return [own];
      if(q==="#custom-dex-list .custom-dex-tile")return [tile];
      if(q==="#custom-card-grid .custom-card")return [card];
      throw Error("Unexpected query "+q);
    },
    createElement(q){assert.equal(q,"span");return {className:"",textContent:""};}
  };
  const context={
    state:{filter,ownershipSaving:false},
    document:doc,
    renderSummary(){summaryRenders++;},
    renderWorkspace(){workspaceRenders++;},
    currentDex:()=>dex,
    $:(name)=>{assert.equal(name,"selected-dex-progress");return progress;},
    saveDexes:async()=>{saveCount++;await saveGate;if(!saved)throw Error("Firebase error");},
    alert:(x)=>alerts.push(x),
    Date
  };
  vm.runInNewContext(isolated,context);
  return {
    entry,dex,own,badge,image,card,progress,counter,alerts,ctx:context,
    api:context.__owned,
    get overlay(){return overlay;},
    get saveCount(){return saveCount;},
    get workspaceRenders(){return workspaceRenders;},
    get summaryRenders(){return summaryRenders;},
    finish:()=>finish?.()
  };
}

test("owned toggle changes one card and counters without rebuilding page or dex list",async()=>{
  const t=scenario({owned:false});
  await t.api.toggleCustomCardOwned(t.entry,t.dex);
  assert.equal(t.entry.owned,true);
  assert.equal(t.dex.cards[0],t.entry,"Stored card identity must survive");
  assert.equal(t.card.classList.contains("is-owned"),true);
  assert.equal(t.card.classList.contains("is-missing"),false);
  assert.equal(t.badge.textContent,"보유");
  assert.equal(t.own.textContent,"✓ 보유");
  assert.equal(t.overlay,null,"Previous missing overlay must be removed");
  assert.equal(t.counter.textContent,"2 / 2장 보유");
  assert.equal(t.progress.textContent,"2 / 2장 보유");
  assert.equal(t.summaryRenders,1);
  assert.equal(t.workspaceRenders,0,"Unfiltered view must not recreate card DOM");
  assert.equal(t.saveCount,1);
  assert.equal(t.own.disabled,false);

  await t.api.toggleCustomCardOwned(t.entry,t.dex);
  assert.equal(t.entry.owned,false);
  assert.equal(t.card.classList.contains("is-missing"),true);
  assert.equal(t.own.textContent,"○ 미보유");
  assert.equal(t.badge.textContent,"미보유");
  assert.equal(t.overlay.textContent,"미보유","Missing overlay must return");
  assert.equal(t.workspaceRenders,0);
  assert.equal(t.saveCount,2);
});

test("status-filtered view rerenders workspace only, not entire dex or sidebar",async()=>{
  const t=scenario({filter:"missing"});
  await t.api.toggleCustomCardOwned(t.entry,t.dex);
  assert.equal(t.entry.owned,true);
  assert.equal(t.workspaceRenders,1);
  assert.equal(t.counter.textContent,"2 / 2장 보유");
  assert.equal(t.saveCount,1);
});

test("failed persistence restores status, timestamp and UI without full rerender",async()=>{
  const t=scenario({saved:false});
  await t.api.toggleCustomCardOwned(t.entry,t.dex);
  assert.equal(t.entry.owned,false);
  assert.equal(t.dex.updatedAt,"before");
  assert.equal(t.badge.textContent,"미보유");
  assert.equal(t.overlay.textContent,"미보유");
  assert.equal(t.counter.textContent,"1 / 2장 보유");
  assert.equal(t.workspaceRenders,0);
  assert.deepEqual(t.alerts,["Firebase error"]);
  assert.equal(t.own.disabled,false);
  assert.equal(t.ctx.state.ownershipSaving,false);
});

test("rapid double taps are serialized while Firestore save is pending",async()=>{
  const t=scenario({delayed:true});
  const first=t.api.toggleCustomCardOwned(t.entry,t.dex);
  assert.equal(t.ctx.state.ownershipSaving,true);
  assert.equal(t.own.disabled,true);
  assert.equal(t.own.attrs["aria-busy"],"true");
  await t.api.toggleCustomCardOwned(t.entry,t.dex);
  assert.equal(t.entry.owned,true,"Second tap cannot undo unsaved first tap");
  assert.equal(t.saveCount,1);
  t.finish();
  await first;
  assert.equal(t.ctx.state.ownershipSaving,false);
  assert.equal(t.own.attrs["aria-busy"],"false");
  assert.equal(t.own.disabled,false);
});

test("off-screen cards do not cause visible card changes",async()=>{
  const t=scenario({visibleKey:"some-other-visible-card"});
  await t.api.toggleCustomCardOwned(t.entry,t.dex);
  assert.equal(t.entry.owned,true);
  assert.equal(t.own.textContent,"○ 미보유");
  assert.equal(t.badge.textContent,"미보유");
  assert.equal(t.workspaceRenders,0);
  assert.equal(t.saveCount,1);
});

test("card button event uses targeted helper and never invokes renderAll",()=>{
  const snippet=src.slice(src.indexOf('    own.className = "custom-owned-toggle";'),src.indexOf('    const up = document.createElement("button");',src.indexOf('    own.className = "custom-owned-toggle";')));
  assert.match(snippet,/toggleCustomCardOwned\(entry, dex\)/);
  assert.doesNotMatch(snippet,/renderAll\(\)/);
  assert.match(snippet,/own.disabled = state.ownershipSaving/);
});
