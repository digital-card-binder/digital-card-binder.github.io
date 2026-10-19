import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {prepareVerifiedStoreImport,writeVerifiedStoreImport} from
  "../radar-service/lib/store-import.mjs";

const when="2026-10-19T09:00:00.000Z";
const now=Date.parse(when);
const sample=()=>({
 schemaVersion:1,reviewed:true,reviewer:"verified-human-reviewer",
 reviewedAt:when,
 stores:[{storeId:"emart-sokcho-1050",retailerId:"emart",kind:"mart",
    name:"이마트 속초점 가상 검토 사례",address:"강원특별자치도 속초시 설악금강대교로 12",
    lat:38.1910179,lng:128.5957863,locationReviewed:true,
    locationEvidenceUrl:"https://eapp.emart.com/branch/view.do?id=1049",
    coordinateEvidenceUrl:"https://findby.co.kr/details/24885-512103223027-st-652b35338c641f9e389aa240",
    latestStock:[{quantity:999}],providerStoreId:"fake-provider-code"}]
});
function mockDb({occupied=false,allowRetailer=true}={}){
 const state={writes:[],commits:0};
 const db={
  collection(name){return {doc(id){return {path:name+"/"+id,get:async()=>({
    exists:name==="radarRetailers"?allowRetailer && id==="emart":occupied,
    data:()=>({kind:"mart"})
  })}}};},
  batch(){return {create:(ref,body)=>state.writes.push([ref.path,body]),
    commit:async()=>{state.commits++;}};}
 };
 return {db,state};
}
test("operator-approved location batches strip all stock and external identifiers",()=>{
 const rows=prepareVerifiedStoreImport(sample(),{now});
 assert.equal(rows.length,1);
 assert.equal(rows[0].body.cell,"381:1285");
 assert.equal(rows[0].body.locationStatus,"verified");
 assert.equal(rows[0].body.inventoryStatus,"not_connected");
 assert.deepEqual(rows[0].body.latestStock,[]);
 assert.equal(Object.hasOwn(rows[0].body,"providerStoreId"),false);
});
test("batch rejects insufficient provenance, wrong chain, duplicates, future date",()=>{
 const cases=[
  s=>s.reviewed=false,
  s=>s.stores[0].locationReviewed=false,
  s=>s.stores[0].lat=0,
  s=>s.stores[0].lng=0,
  s=>s.stores[0].kind="convenience",
  s=>s.stores[0].retailerId="cu",
  s=>s.stores[0].locationEvidenceUrl="https://github.com/hmmhmmhm/daiso-mcp",
  s=>s.stores[0].coordinateEvidenceUrl="http://example.com/coordinates/id/11",
  s=>s.stores.push({...s.stores[0]}),
  s=>s.reviewedAt="2099-01-01T00:00:00Z",
  s=>s.reviewer=""
 ];
 for(const mutate of cases){
  const payload=sample();mutate(payload);
  assert.throws(()=>prepareVerifiedStoreImport(payload,{now}),/STORE_/);
 }
});
test("unapproved dry run never writes and existing canonical records are immutable",async()=>{
 const docs=prepareVerifiedStoreImport(sample(),{now});
 const clean=mockDb();
 assert.deepEqual(await writeVerifiedStoreImport(clean.db,docs,{dryRun:true}),
   {wouldCreate:1,created:0,mode:"dry_run"});
 assert.equal(clean.state.commits,0);
 const existed=mockDb({occupied:true});
 await assert.rejects(()=>writeVerifiedStoreImport(existed.db,docs,{dryRun:false}),
   /STORE_IMPORT_CONFLICT_EXISTING_RECORD/);
 assert.equal(existed.state.commits,0);
 const noRetailer=mockDb({allowRetailer:false});
 await assert.rejects(()=>writeVerifiedStoreImport(noRetailer.db,docs,{dryRun:false}),
   /STORE_RETAILER_NOT_REGISTERED/);
 assert.equal(noRetailer.state.commits,0);
 const created=mockDb();
 assert.deepEqual(await writeVerifiedStoreImport(created.db,docs,{dryRun:false}),
   {created:1,mode:"create_only"});
 assert.equal(created.state.writes.length,1);
 assert.equal(created.state.commits,1);
});
test("coverage API counts approved sources rather than public adapter count",async()=>{
 const api=await readFile(new URL("../radar-service/api/v1/coverage.js",import.meta.url),"utf8");
 assert.match(api,/approvedSourceCount/);
 assert.match(api,/where\("permissionStatus","==","approved"\)/);
 assert.match(api,/retailers,/);
 assert.match(api,/stockStatus:approvedSourceCount===0/);
 assert.doesNotMatch(api,/\.set\(|\.update\(|\.create\(|\.delete\(/);
});
test("UI fetches coverage only on opt-in and exposes explicit failed lookup state",async()=>{
 const html=await readFile(new URL("../card-radar.html",import.meta.url),"utf8");
 const js=await readFile(new URL("../card-radar.js",import.meta.url),"utf8");
 assert.match(html,/<details class="radar-coverage" id="radar-coverage">/);
 assert.match(html,/id="radar-coverage-refresh"/);
 assert.match(html,/id="radar-coverage-retailers"/);
 assert.match(js,/COVERAGE_API="https:\/\/digital-card-radar-api\.vercel\.app\/api\/v1\/coverage"/);
 assert.match(js,/if\(byId\("radar-coverage"\)\.open\)void loadCoverage\(\)/);
 assert.match(js,/연결 실패를 재고 0개로 해석하지 않습니다/);
 const stub={document:{readyState:"loading",addEventListener(){}},window:{},Date,URL,URLSearchParams};
 const testSrc=js.replace(/\}\)\(\);\s*$/,'globalThis._cover=normalizeCoverage;\n})();');
 assert.notEqual(testSrc,js);
 runInNewContext(testSrc,stub);
 const v=stub._cover({schemaVersion:1,dbStatus:"connected",retailers:[
  {retailerId:"gs25",name:"GS25",kind:"convenience",inventoryPermission:"unverified"}
 ],registeredStoreCount:1,verifiedStoreAliasCount:0,verifiedRetailerSkuCount:0,
 registeredSourceCount:0,approvedSourceCount:0});
 assert.equal(v.retailers.length,1);
 assert.equal(v.retailers[0].permission,"unverified");
 assert.throws(()=>stub._cover({schemaVersion:1,dbStatus:"unavailable",retailers:[]}),
   /INVALID_COVERAGE_RESPONSE/);
});
