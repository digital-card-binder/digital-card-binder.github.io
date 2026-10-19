import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import {loadMaster,checkMaster} from "../scripts/check-card-radar-master.mjs";
import {validateMaster,latestConfirmedStock,normalizedStoreKey,normalizedSkuKey,isFresh} from "../lib/radar-master.mjs";

const now=Date.parse("2026-10-19T05:00:00Z");
const checked=new Date(now-30000).toISOString();
const expires=new Date(now+300000).toISOString();
const clone=obj=>structuredClone(obj);

function mapped(master){
  const next=clone(master);
  next.stores.items.push({
    storeId:"test-store",retailerId:"lottemart",name:"테스트 롯데마트",kind:"mart",
    latitude:37.5,longitude:127.01,address:"테스트 전용",phone:null,
    providerStoreId:null,verifiedLocationSource:"tests only",locationStatus:"verified",inventoryStatus:"connected"
  });
  next.aliases.items.push({retailerId:"lottemart",providerStoreId:"L-001",storeId:"test-store",verifiedSource:"test fixture"});
  next.skus.items.push({retailerId:"lottemart",retailerItemCode:"12345",productId:"kr-m2-booster-pack",verifiedSource:"test fixture"});
  return next;
}
const observation=(fields={})=>({
  observationId:"evt1",sourceId:"partner-lottemart",retailerId:"lottemart",
  providerStoreId:"L-001",retailerItemCode:"12345",
  stockStatus:"in_stock",quantity:3,sourcePermission:"approved",licenseReference:"TEST-CONTRACT-01",
  observedAt:checked,expiresAt:expires,...fields
});
test("master catalogue has no invented retailer SKUs, inventory or unknown as 0",async()=>{
  const report=await checkMaster();
  assert.equal(report.counts.sets,151);
  assert.equal(report.counts.retailers,10);
  assert.equal(report.counts.stores,1);
  assert.equal(report.counts.products,2);
  assert.equal(report.counts.skuMappings,0);
  assert.equal(report.counts.aliases,0);
  assert.equal(report.counts.observations,0);
  assert.equal(report.confirmedStockRows,0);
  assert.equal(report.hostedDatabaseConfigured,false);
  const master=await loadMaster();
  assert.equal(latestConfirmedStock(master,now).length,0);
  assert.ok(master.products.items.every(p=>!p.retailerItemCode&&!p.barcode&&!p.claimOfCurrentStock));
  assert.equal(master.stores.items[0].name,"이마트 속초점");
});
test("explicit provider/store SKU IDs use stable namespace, not ambiguous concatenation",()=>{
  assert.notEqual(normalizedStoreKey("cu","12:3"),normalizedStoreKey("cu","12|3"));
  assert.notEqual(normalizedSkuKey("gs25","a:b"),normalizedSkuKey("gs25","ab"));
  assert.throws(()=>normalizedStoreKey("cu",""),/INVALID_STORE_ALIAS/);
});
test("unknown/failed, out-of-stock and positive are three distinct stock states",async()=>{
  const master=mapped(await loadMaster());
  master.observations.items=[observation()];
  assert.equal(validateMaster(master).observations,1);
  assert.equal(latestConfirmedStock(master,now)[0].quantity,3);
  const zero=clone(master);
  zero.observations.items[0]={...observation({quantity:0,stockStatus:"out_of_stock"})};
  assert.equal(validateMaster(zero).observations,1);
  assert.equal(latestConfirmedStock(zero,now)[0].quantity,0);
  const unknown=clone(master);
  unknown.observations.items[0]={...observation({quantity:null,stockStatus:"unknown"})};
  assert.equal(validateMaster(unknown).observations,1);
  assert.equal(latestConfirmedStock(unknown,now).length,0);
  unknown.observations.items[0].quantity=0;
  assert.throws(()=>validateMaster(unknown),/OBS_UNKNOWN_NOT_NULL/);
});
test("stale, future or expired observations never become a confirmed stock signal",async()=>{
  const master=mapped(await loadMaster());
  master.observations.items=[observation()];
  assert.equal(isFresh(checked,expires,now),true);
  assert.equal(latestConfirmedStock(master,now).length,1);
  assert.equal(latestConfirmedStock(master,now+20*60*1000).length,0);
  assert.equal(isFresh(new Date(now+1000000).toISOString(),expires,now),false);
  assert.equal(isFresh(checked,new Date(now-10).toISOString(),now),false);
});
test("observations cannot attach to an unknown store, product or unauthorized source",async()=>{
  const master=mapped(await loadMaster());
  master.observations.items=[observation()];
  const broken=clone(master);
  broken.observations.items[0].providerStoreId="UNKNOWN";
  assert.throws(()=>validateMaster(broken),/OBS_UNMAPPED_STORE/);
  broken.observations.items[0]=observation({retailerItemCode:"UNMAPPED"});
  assert.throws(()=>validateMaster(broken),/OBS_UNMAPPED_PRODUCT/);
  broken.observations.items[0]=observation({sourcePermission:"unverified"});
  assert.throws(()=>validateMaster(broken),/OBS_UNAUTHORIZED_SOURCE/);
});
test("PostgreSQL DDL exists but isn't mistaken for a live deployed database",async()=>{
  const ddl=await readFile(new URL("../db/migrations/001_card_radar_master.sql",import.meta.url),"utf8");
  for(const table of ["retailers","card_sets","products","stores","store_aliases",
    "retailer_skus","data_sources","inventory_observations"]) {
    assert.match(ddl,new RegExp("CREATE TABLE IF NOT EXISTS radar\\."+table+"\\b"));
  }
  assert.match(ddl,/CREATE OR REPLACE VIEW radar[.]current_confirmed_inventory/);
  assert.match(ddl,/source_observed_at >= now\(\) - interval '15 minutes'/);
});
