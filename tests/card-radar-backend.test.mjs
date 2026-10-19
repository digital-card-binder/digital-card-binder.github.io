import assert from "node:assert/strict";
import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {gridCell,nearbyCells,distanceKm,parseSearchQuery,currentItems,selectNearbyStores,
  buildSearchResponse} from "../radar-service/lib/radar-query.mjs";
import {mappingDocId,verifySourceAndObservation,mergeLatestStock} from
  "../radar-service/lib/observation.mjs";

const now=Date.parse("2026-10-19T07:00:00.000Z");
const time=(offset)=>new Date(now+offset).toISOString();
const query=parseSearchQuery({lat:"38.191",lng:"128.596",radiusKm:"10",limit:"100"});
test("independent provider geocells always include center and respect 10km",()=>{
  assert.equal(gridCell(38.191,128.596),"381:1285");
  assert.ok(nearbyCells(38.191,128.596,10).includes(gridCell(38.191,128.596)));
  assert.throws(()=>nearbyCells(37,127,11),/INVALID_RADIUS/);
  assert.throws(()=>parseSearchQuery({lat:"NaN",lng:127}),/INVALID_COORDINATE/);
  assert.throws(()=>parseSearchQuery({lat:37,lng:127,radiusKm:20}),/INVALID_RADIUS/);
  assert.throws(()=>parseSearchQuery({lat:37,lng:127,kind:"unknown"}),/INVALID_KIND/);
  assert.throws(()=>parseSearchQuery({lat:37,lng:127,limit:1000}),/INVALID_LIMIT/);
  assert.equal(distanceKm({lat:37,lng:127},{lat:37,lng:127}),0);
});
test("public API never calls unknown 0 and never accepts unapproved, expired or future stock",()=>{
  const product={productId:"kr-m2-booster-pack",setId:"m2",name:"인페르노X 부스터 팩",
    quantity:6,observedAt:time(-30000),expiresAt:time(300000),sourceId:"cu-partner",
    sourcePermission:"approved",licenseReference:"TEST-CONTRACT-NO-IMPORT"};
  assert.equal(currentItems([product],now).length,1);
  assert.equal(currentItems([{...product,sourcePermission:"unverified"}],now).length,0);
  assert.equal(currentItems([{...product,expiresAt:time(-1000)}],now).length,0);
  assert.equal(currentItems([{...product,observedAt:time(-3600000)}],now).length,0);
  assert.equal(currentItems([{...product,observedAt:time(120000)}],now).length,0);
  assert.equal(currentItems([{...product,quantity:null}],now).length,0);
  assert.equal(currentItems([{...product,quantity:0}],now).length,1);
  const store={storeId:"emart-sokcho-1049",retailerId:"emart",name:"이마트 속초점",
    kind:"mart",lat:38.191,lng:128.596,locationStatus:"verified"};
  const result=buildSearchResponse([store],query,{now});
  assert.equal(result.count,1);
  assert.equal(result.stores[0].stockStatus,"unknown");
  assert.deepEqual(result.stores[0].items,[]);
  assert.equal(result.inventoryCompleteness,"partial");
  assert.equal(selectNearbyStores([store],{...query,onlyInStock:true},now).stores.length,0);
  const verified={...store,latestStock:[product]};
  assert.equal(selectNearbyStores([verified],{...query,onlyInStock:true},now).stores.length,1);
  assert.equal(selectNearbyStores([verified],{...query,onlyInStock:true,setId:"m6a"},now).stores.length,0);
});
test("pagination boundary signals partial results instead of claiming full coverage",()=>{
  const rows=Array.from({length:5},(_,i)=>({
    storeId:"shop-"+i,retailerId:"cu",name:"shop "+i,kind:"convenience",
    lat:38.191+i*.001,lng:128.596,address:""
  }));
  const result=buildSearchResponse(rows,{...query,limit:2},{now,sourceTruncated:true});
  assert.equal(result.count,2);
  assert.equal(result.coverageLimited,true);
});
test("dedicated source mappings validate ownership before ever persisting quantities",()=>{
  assert.notEqual(mappingDocId("cu","123"),mappingDocId("gs25","123"));
  assert.throws(()=>mappingDocId("cu",""),/INVALID_PROVIDER_IDENTITY/);
  const record={sourceId:"cu-source",retailerId:"cu",providerStoreId:"CU-1",
    retailerItemCode:"SKU-9",quantity:6,observedAt:time(-30000)};
  const source={permissionStatus:"approved",licenseReference:"VALID-PARTNER-CONTRACT",
    retailerId:"cu"};
  const alias={retailerId:"cu",providerStoreId:"CU-1",storeId:"shop-1",verified:true};
  const sku={retailerId:"cu",retailerItemCode:"SKU-9",productId:"kr-m2-booster-pack",
    setId:"m2",productName:"인페르노X 부스터 팩",verified:true};
  const approved=verifySourceAndObservation(record,source,alias,sku,
    {now,allowlist:["cu-source"]});
  assert.equal(approved.quantity,6);
  assert.equal(approved.stockStatus,"in_stock");
  assert.equal(approved.sourcePermission,"approved");
  assert.throws(()=>verifySourceAndObservation({...record,quantity:null},source,alias,sku,
    {now,allowlist:["cu-source"]}),/QUANTITY_UNAVAILABLE_IS_NOT_ZERO/);
  assert.throws(()=>verifySourceAndObservation(record,source,alias,sku,{now,allowlist:[]}),
    /UNAUTHORIZED_RETAILER_SOURCE/);
  assert.throws(()=>verifySourceAndObservation(record,source,{...alias,verified:false},sku,
    {now,allowlist:["cu-source"]}),/UNVERIFIED_PROVIDER_MAPPING/);
  assert.throws(()=>verifySourceAndObservation({...record,observedAt:time(-3600000)},
    source,alias,sku,{now,allowlist:["cu-source"]}),/STALE_OR_INVALID_OBSERVATION/);
  assert.equal(verifySourceAndObservation({...record,quantity:0},source,alias,sku,
    {now,allowlist:["cu-source"]}).stockStatus,"out_of_stock");
});
test("out-of-order updates never downgrade fresher stock and stale cache is removed",()=>{
  const fresh={productId:"a",observedAt:time(-10000),expiresAt:time(300000),quantity:3};
  const stale={productId:"a",observedAt:time(-30000),expiresAt:time(300000),quantity:0};
  const updated=mergeLatestStock([fresh],stale,now);
  assert.equal(updated.length,1);
  assert.equal(updated[0].quantity,3);
  assert.equal(mergeLatestStock([stale],fresh,now)[0].quantity,3);
  assert.equal(mergeLatestStock([{...fresh,expiresAt:time(-1)}],stale,now).length,1);
});
test("Stage 2 API is server only, uses named Firestore and fails closed",async()=>{
  const read=async(path)=>readFile(new URL(path,import.meta.url),"utf8");
  const db=await read("../radar-service/lib/db.mjs");
  const seed=await read("../radar-service/scripts/seed-master.mjs");
  const api=await read("../radar-service/api/v1/stores.js");
  const inventoryImport=await read("../radar-service/scripts/import-observations.mjs");
  const mappingImport=await read("../radar-service/scripts/import-mappings.mjs");
  const rules=await read("../radar-service/firestore.rules");
  assert.match(db,/RADAR_FIRESTORE_DATABASE!==DATABASE_ID/);
  assert.match(db,/getFirestore\(app,DATABASE_ID\)/);
  assert.match(db,/const DATABASE_ID = "\(default\)"/);
  assert.match(db,/COLLECTOR_FIREBASE_PROJECT_FORBIDDEN/);
  assert.match(db,/collection\("radarStores"\)/);
  assert.match(api,/dbStatus:"unavailable"/);
  assert.match(api,/parseSearchQuery/);
  assert.match(seed,/RADAR_ENABLE_INITIAL_SEED!=="yes"/);
  assert.match(seed,/WRONG_FIREBASE_PROJECT/);
  assert.match(inventoryImport,/RADAR_ALLOW_STOCK_IMPORT!=="yes"/);
  assert.match(mappingImport,/RADAR_ALLOW_MAPPING_IMPORT!=="yes"/);
  assert.match(rules,/allow read, write: if false/);
  assert.doesNotMatch(db,/getFirestore\(app\)(?!,)/);
});
