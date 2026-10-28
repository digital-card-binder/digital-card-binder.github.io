import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {inspectWorkflows,classifyWorkflow} from "../scripts/audit-workflow-inventory.mjs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const ops=read("operations.js");
const start=ops.indexOf("  async function makeBackup() {"),end=ops.indexOf("  function validBackupGrid(",start);
assert.ok(start>0&&end>start);
function makeBackupFixture(invalid=false){
 const status={textContent:"",dataset:{}},button={disabled:false};
 let linkClicked=0,blobs=0,serverReads=0,validated=0;
 const context={
   state:{user:{uid:"my-account"},firebase:{db:{},firestoreModule:{
     collection:()=>({}),getDocsFromServer:async()=>({docs:[]})
   }}},
   DOCUMENT_IDS:["nationalDex","seriesDex","arDex","worldDex"],
   BACKUP_FORMAT:"digital-card-binder-backup-v2",
   accountCore:{usesOverrideShards:x=>["seriesDex","arDex"].includes(x),documentRef:()=>({})},
   $:id=>id==="operations-backup"?button:status,
   setStatus:(el,message,kind="")=>{el.textContent=message;el.dataset.state=kind;},
   readCollection:async id=>{serverReads++;return {id,overrides:{}};},
   readServerCollection:async()=>({docs:[]}),
   readCustomBinders:async()=>[],
   worldLocalKeys:()=>[],
   localStorage:{getItem:()=>null},
   fetch:async()=>({ok:true,json:async()=>({version:"test-version"})}),
   validateBackup:payload=>{validated++;if(invalid)throw Error("corrupt restore format");return payload;},
   Blob:class{constructor(){blobs++}},
   URL:{createObjectURL:()=> "blob:fake",revokeObjectURL:()=>{}},
   document:{body:{append:()=>{}},createElement:()=>({click:()=>{linkClicked++},remove:()=>{},href:"",download:""})},
   Date,JSON,Object,Promise,String,console:{error(){}}
 };
 vm.runInNewContext(ops.slice(start,end)+"\nglobalThis.__test=makeBackup;",context);
 return {run:context.__test,button,status,
  get downloads(){return linkClicked},
  get blobs(){return blobs},
  get serverReads(){return serverReads},
  get validated(){return validated}};
}
test("backup includes server documents/shards and validates the complete payload before download",async()=>{
 const f=makeBackupFixture();
 await f.run();
 assert.equal(f.serverReads,4);
 assert.equal(f.validated,1,`backup status: ${f.status.textContent}`);
 assert.equal(f.downloads,1);
 assert.equal(f.blobs,1);
 assert.equal(f.button.disabled,false);
 assert.equal(f.status.dataset.state,"success");
});
test("a backup which cannot pass restore validation never offers an unusable JSON file",async()=>{
 const f=makeBackupFixture(true);
 await f.run();
 assert.equal(f.validated,1,`backup status: ${f.status.textContent}`);
 assert.equal(f.downloads,0);
 assert.equal(f.blobs,0);
 assert.equal(f.button.disabled,false);
 assert.equal(f.status.dataset.state,"error");
 assert.match(f.status.textContent,/corrupt restore format/);
});
test("backup validation rejects mismatched owner, unsupported collections and malformed shards",()=>{
 const a=ops.indexOf("  function validateBackup(payload) {");
 const b=ops.indexOf("  function restoreDocumentWrites(",a);
 assert.ok(a>0&&b>a);
 const ctx={
   state:{user:{uid:"owner-A"}},BACKUP_FORMAT:"digital-card-binder-backup-v2",
   LEGACY_BACKUP_FORMAT:"digital-card-binder-backup-v1",
   DOCUMENT_IDS:["nationalDex","seriesDex"],
   accountCore:{usesOverrideShards:id=>id==="seriesDex"},
   worldLocalKeys:()=>[],validateCustomBinderBackup:()=>{},JSON,Object,Array,Set
 };
 vm.runInNewContext(ops.slice(a,b)+"\nglobalThis.check=validateBackup;",ctx);
 const base={format:ctx.BACKUP_FORMAT,schemaVersion:2,accountUid:"owner-A",documents:{nationalDex:{overrides:{}}},customBinders:[]};
 assert.equal(ctx.check(structuredClone(base)).accountUid,"owner-A");
 assert.throws(()=>ctx.check({...base,accountUid:"other-account"}),/계정이 다릅니다/);
 assert.throws(()=>ctx.check({...base,documents:{private:{}}}),/지원하지 않는 도감 문서/);
 assert.throws(()=>ctx.check({...base,overrideShards:{seriesDex:[{id:"../invalid",schemaVersion:1,overrides:{}}]}}),/손상되었습니다/);
});
test("workflow inventory preserves critical production jobs and exposes legacy manual review candidates",async()=>{
 const inv=await inspectWorkflows(new URL("../.github/workflows/",import.meta.url).pathname);
 assert.ok(inv.aggregate.total>=500,"existing audit history should be inventoried, not erased");
 for(const item of ["verify.yml","watch-official-card-updates.yml","deploy-card-images.yml"])
   assert.ok(inv.aggregate.protectedCore.includes(item),item);
 const watch=inv.workflows.find(x=>x.file==="watch-official-card-updates.yml");
 assert.ok(watch.events.includes("schedule"));
 assert.equal(watch.writeAccess,true);
 assert.equal(watch.group,"protect-operational");
 assert.ok(inv.aggregate.mainWriteAccess>0,"main-writing audits require explicit review");
 assert.equal(inv.aggregate.notAutomaticallyDeactivated,inv.aggregate.total);
});
test("classification identifies branch-only historic jobs without disabling them",async()=>{
 const tmp=await mkdtemp(path.join(tmpdir(),"dcb-workflow-safety-"));
 try{
  await writeFile(path.join(tmp,"test-20261020.yml"),"on:\n  push:\n    branches: [audit/old-20261020]\n  workflow_dispatch:\njobs:\n  a:\n    runs-on: ubuntu-latest\n");
  await writeFile(path.join(tmp,"run.yml"),"on:\n  workflow_dispatch:\njobs:\n  a:\n    runs-on: ubuntu-latest\n");
  const a=await inspectWorkflows(tmp);
  assert.equal(a.aggregate.total,2);
  assert.equal(a.aggregate.historicalBranchOnly,1);
  assert.equal(a.aggregate.manualOnly,1);
  assert.equal(classifyWorkflow("verify.yml","on:\n  push:\n    branches: [main]\n").group,"protect-operational");
 }finally{await rm(tmp,{recursive:true,force:true});}
});
