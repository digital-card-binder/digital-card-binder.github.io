import assert from "node:assert/strict";
import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {preparedBootstrapDocuments,bootstrapMasterOnce} from
  "../radar-service/lib/bootstrap.mjs";
import {MASTER_SEED} from "../radar-service/lib/master-seed.mjs";

class FakeFirestore {
  documents=new Map();
  collection(name){
    return {doc:(id)=>({path:name+"/"+id})};
  }
  async runTransaction(work){
    const additions=[];
    const transaction={
      get:async(ref)=>({exists:this.documents.has(ref.path),data:()=>this.documents.get(ref.path)}),
      create:(ref,data)=>{
        if(this.documents.has(ref.path)||additions.some(x=>x.ref.path===ref.path))
          throw new Error("DOCUMENT_EXISTS");
        additions.push({ref,data});
      }
    };
    const answer=await work(transaction);
    for(const {ref,data} of additions)this.documents.set(ref.path,data);
    return answer;
  }
}
test("initial seed is identical to reviewed master data (no actual stock)",async()=>{
  const dirs={sets:"sets.json",retailers:"retailers.json",products:"products.json",stores:"stores.json"};
  for(const [kind,path] of Object.entries(dirs)){
    const master=JSON.parse(await readFile(new URL("../data/radar-master/"+path,import.meta.url),"utf8"));
    assert.equal(MASTER_SEED[kind].length,master.items.length);
  }
  assert.equal(MASTER_SEED.sets.length,151);
  const entries=preparedBootstrapDocuments();
  assert.equal(entries.length,164);
  assert.equal(entries.filter(e=>e.collection==="radarRetailers").length,10);
  assert.equal(entries.filter(e=>e.collection==="radarSets").length,151);
  assert.equal(entries.filter(e=>e.collection==="radarProducts").length,2);
  assert.equal(entries.filter(e=>e.collection==="radarStores").length,1);
  assert.ok(entries.every(e=>!Object.hasOwn(e.body,"quantity") &&
    !Object.hasOwn(e.body,"latestStock")));
  assert.equal(entries.find(e=>e.collection==="radarStores").body.cell,"381:1285");
});
test("wrong project or missing one-time flag can never modify data",async()=>{
  const db=new FakeFirestore();
  const args={enabled:true,projectId:"digital-card-radar-db",databaseId:"(default)"};
  assert.deepEqual(await bootstrapMasterOnce(db,{...args,enabled:false}),{outcome:"disabled"});
  assert.equal(db.documents.size,0);
  await assert.rejects(()=>bootstrapMasterOnce(db,{...args,projectId:"pokemon-dex-40e92"}),
    /RADAR_BOOTSTRAP_REFUSED_WRONG_PROJECT/);
  await assert.rejects(()=>bootstrapMasterOnce(db,{...args,databaseId:"card-radar"}),
    /RADAR_BOOTSTRAP_REFUSED_WRONG_PROJECT/);
  assert.equal(db.documents.size,0);
});
test("seed atomically registers reviewed masters once without overwriting records",async()=>{
  const db=new FakeFirestore();
  const opts={enabled:true,projectId:"digital-card-radar-db",databaseId:"(default)"};
  const created=await bootstrapMasterOnce(db,opts);
  assert.equal(created.outcome,"seeded");
  assert.equal(created.documentCount,164);
  assert.equal(db.documents.size,165);
  const status=db.documents.get("radarSystem/status");
  assert.equal(status.masterReady,true);
  assert.equal(status.confirmedStock,0);
  assert.deepEqual(status.seedCollectionCounts,{retailers:10,sets:151,products:2,stores:1});
  assert.equal(db.documents.get("radarProducts/kr-m2-booster-pack").identityStatus,
    "internal_catalog_only");
  db.documents.set("radarRetailers/cu",{name:"user-intentionally-edited"});
  const repeated=await bootstrapMasterOnce(db,opts);
  assert.equal(repeated.outcome,"already_seeded");
  assert.equal(db.documents.size,165);
  assert.equal(db.documents.get("radarRetailers/cu").name,"user-intentionally-edited");
});
test("health is readable without enabling one-time seeding",async()=>{
  const source=await readFile(new URL("../radar-service/api/v1/health.js",import.meta.url),"utf8");
  assert.match(source,/RADAR_BOOTSTRAP_ONCE==="yes"/);
  assert.match(source,/if\(!snap.exists && process\.env\./);
  assert.match(source,/bootstrapMasterOnce\(db\)/);
  assert.match(source,/dbStatus:"not_seeded"/);
});
