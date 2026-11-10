import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(name)=>fs.readFileSync(path.join(root,name),"utf8");

test("phase 5: image exceptions are classified read-only, never treated as 3377 broken images",()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"dcb-phase5-triage-"));
  try{
    const reportFile=path.join(temp,"triage.json");
    execFileSync(process.execPath,[path.join(root,"scripts/triage-card-image-sources.mjs"),
      "--output="+reportFile],{cwd:root,stdio:"pipe"});
    const report=JSON.parse(fs.readFileSync(reportFile,"utf8"));
    assert.equal(report.schemaVersion,1);
    assert.ok(report.totalCards>20_000);
    assert.equal(report.totalCards,report.routedCards+report.exceptions);
    assert.equal(report.criticalCount,0,JSON.stringify(report.criticalSample));
    const categories=Object.values(report.byCategory).reduce((sum,item)=>sum+item.count,0);
    assert.equal(categories,report.exceptions);
    assert.ok(report.exceptions>0,"previously unroutable original sources need category-level review");
    assert.ok(report.caveats.some(s=>s.includes("not necessarily")||s.includes("may be a valid")));
    for(const entry of Object.values(report.byHost)){
      assert.ok(entry.examples.length<=4,"bound report size for huge catalog");
    }
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test("phase 6: repeat filtering 21k search results never sorts or changes ownership",()=>{
  const source=read("pokemon-search.js");
  const begin=source.indexOf("  function filteredCards() {");
  const end=source.indexOf("  function updateSummary()",begin);
  assert.ok(begin>0&&end>begin);
  const cards=Array.from({length:21_100},(_,i)=>({
    era:["SV","M","S"][i%3],groupIndex:i%5,
    setCode:["SV1","SV2"][i%2],
    card:{num:(i*17)%201,owned:i%7===0}
  }));
  const state={era:"ALL",setCode:"ALL",status:"all",sortedSearchCache:null};
  let ordered=cards,numberReads=0;
  const env={state,targetCards:()=>ordered,
    ERA_RANK:{S:6,SV:7,M:8},
    cardNumber:c=>{numberReads++;return c.num}};
  vm.runInNewContext(source.slice(begin,end)+"\nglobalThis.filter=filteredCards;",env);
  const initial=env.filter();
  const firstSortReads=numberReads;
  assert.equal(initial.length,21_100);
  assert.ok(firstSortReads>0);
  Object.assign(state,{era:"SV",setCode:"SV1",status:"owned"});
  const filtered=env.filter();
  assert.equal(numberReads,firstSortReads,
    "changing era, set and owned status must only filter the sorted matches");
  assert.ok(filtered.every(item=>item.era==="SV"&&item.setCode==="SV1"&&item.card.owned));
  assert.equal(initial.filter(x=>x.card.owned).length,cards.filter(x=>x.card.owned).length);
  ordered=cards.slice(0,500);
  env.filter();
  assert.ok(numberReads>firstSortReads,"a new query result invalidates the order cache");
});

test("phase 6: restore-file validation finishes before any writes, rejects >120MB input",async()=>{
  const source=read("operations.js");
  const begin=source.indexOf("  async function readRestoreFile(file) {");
  const end=source.indexOf("  async function restoreBackup()",begin);
  assert.ok(begin>0&&end>begin);
  let validations=0,preflights=0;
  const ctx={validateBackup:payload=>{validations++;
    if(payload?.accountUid!=="same-owner")throw Error("account mismatch");
    return payload;
  },restoreDocumentWrites:payload=>{preflights++;
    if(payload?.unsafe)throw Error("unsafe write size");
    return [];
  },JSON,Error,Promise};
  vm.runInNewContext(source.slice(begin,end)+"\nglobalThis.check=readRestoreFile;",ctx);
  await assert.rejects(ctx.check({size:121*1024*1024,text:async()=>"{ }"}),/120MB/);
  assert.equal(validations,0);
  await assert.rejects(ctx.check({size:100,text:async()=>JSON.stringify({accountUid:"other"})}),/account mismatch/);
  assert.equal(preflights,0);
  await assert.rejects(ctx.check({size:100,text:async()=>JSON.stringify({accountUid:"same-owner",unsafe:true})}),/unsafe write size/);
  const payload=await ctx.check({size:100,text:async()=>JSON.stringify({accountUid:"same-owner",documents:{}})});
  assert.equal(payload.accountUid,"same-owner");
  assert.equal(preflights,2);
});

test("phase 6: interrupted server backup aborts download rather than issuing partial success",async()=>{
  const source=read("operations.js");
  const begin=source.indexOf("  async function makeBackup() {");
  const end=source.indexOf("  function validBackupGrid(",begin);
  assert.ok(begin>0&&end>begin);
  const button={disabled:false},status={textContent:"",dataset:{}};
  let created=0,clicked=0;
  const context={
    state:{user:{uid:"same-owner"},firebase:{}},DOCUMENT_IDS:["nationalDex","seriesDex"],
    $:id=>id==="operations-backup"?button:status,
    setStatus:(el,message,type="")=>{el.textContent=message;el.dataset.state=type},
    readCollection:async()=>{throw Error("remote Firestore unavailable")},
    Blob:class{constructor(){created++}},
    URL:{createObjectURL:()=>"",revokeObjectURL:()=>{}},
    document:{body:{append(){}},createElement:()=>({click(){clicked++},remove(){}})},
    console:{error(){}},Error,Promise,
  };
  vm.runInNewContext(source.slice(begin,end)+"\nglobalThis.backup=makeBackup;",context);
  await context.backup();
  assert.equal(created,0);assert.equal(clicked,0);
  assert.equal(button.disabled,false);
  assert.equal(status.dataset.state,"error");
  assert.match(status.textContent,/remote Firestore unavailable/);
});

test("phase 6: production backup remains explicitly owner-bound and manual",()=>{
  const source=read("operations.js");
  assert.match(source,/accountUid:\s*state[.]user[.]uid/);
  assert.match(source,/getDocsFromServer|getDocFromServer/);
  assert.match(source,/validateBackup\(payload\)/);
  assert.match(source,/if \(!confirm\(/);
  assert.match(source,/await batch[.]commit\(\)/);
  assert.doesNotMatch(read("scripts/triage-card-image-sources.mjs"),/writeFileSync\([^,]*(?:series[.]json|series-legacy[.]json)/);
});
