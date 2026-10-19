import assert from "node:assert/strict";
import test from "node:test";
import {compareRetailerStock} from "../scripts/card-radar-compare-stock.mjs";

const now=new Date("2026-10-20T01:00:00.000Z").toISOString();
const app=(items)=>({schemaVersion:1,source:"official-app-manually-verified",
  reviewed:true,reviewedAt:now,items});
const radar=(items)=>({schemaVersion:1,source:"card-radar-observation",items});
const row=(store,sku,quantity,observedAt=now)=>({
  retailerId:"emart24",providerStoreId:store,retailerItemCode:sku,
  quantity,observedAt
});

test("compare real store-SKU pairs only; unknown is not out of stock",()=>{
  const checked=app([row("S1","P1",4),row("S2","P2",0),row("S3","P3",2)]);
  const observed=radar([row("S1","P1",4),row("S2","P2",1),
    row("S4","P3",2)]);
  const c=compareRetailerStock(checked,observed);
  assert.equal(c.officialCompared,3);
  assert.equal(c.matched,1);
  assert.equal(c.mismatch,1);
  assert.equal(c.unobserved,1);
  assert.equal(c.stale,0);
  assert.equal(c.agreementRate,50);
  assert.equal(c.allChecked,false);
});
test("quantity comparison rejects data >15 min apart",()=>{
  const checked=app([row("S1","P1",4)]);
  const old=radar([row("S1","P1",4,"2026-10-20T00:44:00.000Z")]);
  const c=compareRetailerStock(checked,old);
  assert.equal(c.stale,1);
  assert.equal(c.agreementRate,null);
});
test("require operator-reviewed official baseline and valid quantity",()=>{
  const checked=app([row("S1","P1",3)]);
  const observed=radar([row("S1","P1",3)]);
  assert.equal(compareRetailerStock(checked,observed).agreementRate,100);
  assert.throws(()=>compareRetailerStock({...checked,reviewed:false},observed),
    /REVIEWED_OFFICIAL_APP_OBSERVATIONS_REQUIRED/);
  assert.throws(()=>compareRetailerStock(checked,radar([row("S1","P1",-1)])),
    /INVALID_RADAR_ROW/);
  assert.throws(()=>compareRetailerStock(checked,radar([row("S1","P1",3),row("S1","P1",4)])),
    /DUPLICATE_RADAR_IDENTITY/);
  assert.throws(()=>compareRetailerStock(checked,radar([{...row("S1","P1",3),
    retailerItemCode:""}])),/INVALID_RADAR_ROW/);
  assert.throws(()=>compareRetailerStock(checked,{...observed,source:"untrusted-scrape"}),
    /RADAR_OBSERVATIONS_REQUIRED/);
});
