import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {GOV_DIRECTORY_ENDPOINT,normalizeGovernmentPayload,
  recognizedGovernmentStore,queryGovernmentDirectory} from
  "../radar-service/lib/government-directory.mjs";

const center={lat:37.39,lng:127.11,radiusKm:3};
const item=(name,bizesId,lat=37.39,lon=127.11)=>({
  bizesNm:name,bizesId,lat,lon,rdnmAdr:"경기도 성남시 분당구 예시로 1"
});
const fixture=(rows,totalCount=rows.length)=>({
  response:{header:{resultCode:"00",stdrYm:"202609"},
    body:{items:{item:rows},totalCount}}
});
test("government public merchant API URL is v2 business list, never a stock endpoint",()=>{
  assert.equal(GOV_DIRECTORY_ENDPOINT,
    "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius");
  assert.doesNotMatch(GOV_DIRECTORY_ENDPOINT,/storeZoneInRadius/);
});
test("convenience chains and large mart names are classified separately, without sales stock",()=>{
  const vendors=[
    ["CU 백현점","cu","convenience"],["씨유 백현역","cu","convenience"],
    ["GS25 백현중앙점","gs25","convenience"],
    ["GS 25 백현동점","gs25","convenience"],
    ["세븐일레븐 백현점","seveneleven","convenience"],
    ["이마트24 판교점","emart24","convenience"],
    ["이마트 판교점","emart","mart"],["트레이더스 구성점","traders","mart"],
    ["롯데마트 판교점","lottemart","mart"],
    ["홈플러스 분당점","homeplus","mart"],
    ["코스트코 양재점","costco","mart"],
    ["하나로마트 성남점","hanaro","mart"]
  ];
  for(const [name,expected,kind] of vendors){
    const row=recognizedGovernmentStore(item(name,"123456"));
    assert.equal(row?.retailerId,expected,name);
    assert.equal(row?.kind,kind,name);
    assert.equal(row?.stockStatus,"unknown",name);
    assert.deepEqual(row?.items,[]);
    assert.equal(row?.locationStatus,"candidate",name);
    assert.equal(row?.origin,"government-business-registry",name);
    assert.equal(row?.storeId,null,name);
  }
  for(const name of ["이즐 포켓몬 교통카드","CU 근처 빵집","포켓몬카드 매장",
    "GS25주차장","대형마트할인샵","롯데마트 앞 카페"]){
    assert.equal(recognizedGovernmentStore(item(name,"111111")),null,name);
  }
});
test("partial government coverage never claims full 3km or 10km; ID dedup and filtering",()=>{
  const rows=[item("GS25 백현점","A1B2C3"),item("GS25 백현점","A1B2C3"),
    item("이마트24 백현점","EMART123"),item("GS25 아주 먼 지점","OUTSIDE",38.1,127.11)];
  const response=normalizeGovernmentPayload(fixture(rows,2000),center);
  assert.equal(response.status,"ok");
  assert.equal(response.count,2);
  assert.equal(response.coverageLimited,true);
  assert.equal(response.queriedRadiusKm,2);
  assert.equal(response.requestedRadiusKm,3);
  assert.equal(response.observedStock,false);
  assert.ok(response.stores.every(x=>x.items.length===0));
  const filtered=normalizeGovernmentPayload(fixture(rows),{...center,kind:"convenience",retailer:"gs25"});
  assert.equal(filtered.count,1);
  const onlyMart=normalizeGovernmentPayload(fixture(rows),{...center,kind:"mart"});
  assert.equal(onlyMart.count,0);
  assert.equal(normalizeGovernmentPayload(fixture([]),{...center,radiusKm:1}).count,0);
  assert.equal(normalizeGovernmentPayload(fixture([]),{...center,radiusKm:1}).coverageLimited,false);
});
test("misconfigured or rejected upstream response fails closed, never interprets errors as zero shops",()=>{
  assert.throws(()=>normalizeGovernmentPayload({response:{header:{resultCode:"30"},body:{items:[]}}},center),
    /GOV_API_ERROR/);
  assert.throws(()=>normalizeGovernmentPayload({},center),/GOV_API_ERROR/);
  assert.throws(()=>normalizeGovernmentPayload({response:{header:{resultCode:"00"}}},center),
    /GOV_INVALID_BODY/);
});
test("without private API key no upstream call and explicit not-configured response",async()=>{
  let called=false;
  const output=await queryGovernmentDirectory(center,{serviceKey:"",fetchImpl:async()=>{called=true;}});
  assert.equal(called,false);
  assert.equal(output.status,"not_configured");
  assert.equal(output.coverageLimited,true);
  assert.deepEqual(output.stores,[]);
});
test("configured mode sends a single capped region lookup and retains key server side",async()=>{
  let received;
  const response=await queryGovernmentDirectory({...center,lat:37.3881},{
    serviceKey:"TEST-SECRET-123",now:Date.parse("2026-10-19T10:00:00Z"),
    fetchImpl:async(url,opts)=>{
      received=new URL(url);
      assert.equal(opts.method,"GET");
      return {ok:true,json:async()=>fixture([item("CU 백현점","STORE-1")])};
    }
  });
  assert.equal(response.count,1);
  assert.equal(received.hostname,"apis.data.go.kr");
  assert.equal(received.searchParams.get("radius"),"2000");
  assert.equal(received.searchParams.get("cx"),"127.110000");
  assert.equal(received.searchParams.get("cy"),"37.388100");
  assert.equal(received.searchParams.get("serviceKey"),"TEST-SECRET-123");
  assert.doesNotMatch(JSON.stringify(response),/TEST-SECRET-123/);
});
test("public API is read-only and never inserts shops or stock",async()=>{
  const route=await readFile(new URL("../radar-service/api/v1/public-shops.js",import.meta.url),"utf8");
  assert.match(route,/queryGovernmentDirectory/);
  assert.doesNotMatch(route,/radarDatabase|firebase-admin|\.set\(|\.create\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(route,/RADAR_SERVICE_ACCOUNT_JSON/);
});
test("front-end merges government candidates with base map, never categorizes as verified inventory",async()=>{
  const js=await readFile(new URL("../card-radar.js",import.meta.url),"utf8");
  const html=await readFile(new URL("../card-radar.html",import.meta.url),"utf8");
  assert.match(js,/state\.publicShops/);
  assert.match(js,/origin:"government-business-registry",verifiedInventory:\[\]/);
  assert.match(js,/const govTask=loadPublicShopLocations/);
  assert.match(js,/govTask,stockTask/);
  assert.match(html,/id="radar-public-status"/);
  const transformed=js.replace(/\}\)\(\);\s*$/,
    'globalThis.__public={state,parsePublicShopLocations,storeCandidates};\n})();');
  assert.notEqual(transformed,js);
  const context={document:{readyState:"loading",addEventListener(){}},window:{},Date,URL,URLSearchParams};
  runInNewContext(transformed,context);
  const {state,parsePublicShopLocations,storeCandidates}=context.__public;
  state.center={lat:37.39,lng:127.11};state.radiusKm=3;
  const input={schemaVersion:1,status:"ok",stores:[
    {id:"public:123",name:"CU 백현점",retailerId:"cu",kind:"convenience",
      lat:37.39,lng:127.11,origin:"government-business-registry",
      locationStatus:"candidate",address:"경기",stockStatus:"unknown",items:[{quantity:100}]}]};
  const parsed=parsePublicShopLocations(input);
  assert.equal(parsed.stores.length,1);
  assert.equal(parsed.stores[0].verifiedInventory.length,0);
  state.publicShops=parsed.stores;
  assert.equal(storeCandidates([]).length,1);
  assert.equal(storeCandidates([{id:"osm:01",kind:"convenience",name:"CU 백현점",
    lat:37.39,lng:127.11,origin:"osm",verifiedInventory:[]}]).length,1);
  assert.equal(parsePublicShopLocations({status:"not_configured",
    schemaVersion:1,stores:[]}).configured,false);
  assert.throws(()=>parsePublicShopLocations({schemaVersion:1,status:"unavailable",stores:[]}),
    /INVALID_GOV_STORE_RESPONSE/);
});

test("accepts official JSON with header/body at root and items as an array",()=>{
  const response={
    header:{resultCode:"00",stdrYm:"202610"},
    body:{items:[item("GS25 금곡점","MA010123456789")],totalCount:1}
  };
  const output=normalizeGovernmentPayload(response,{...center,radiusKm:2});
  assert.equal(output.count,1);
  assert.equal(output.stores[0].retailerId,"gs25");
  assert.equal(output.sourceYearMonth,"202610");
  assert.equal(output.coverageLimited,false);
});
test("an encoded data.go.kr service key is decoded once before query encoding",async()=>{
  let parsed;
  const out=await queryGovernmentDirectory({lat:37.3911,lng:127.1122,radiusKm:1},{
    serviceKey:"abc%2Bdef%2Fghi%3D",
    now:Date.parse("2026-10-19T09:10:00Z"),
    fetchImpl:async(url)=>{
      parsed=new URL(url);
      return {ok:true,json:async()=>({header:{resultCode:"00"},body:{items:[],totalCount:0}})};
    }
  });
  assert.equal(out.status,"ok");
  assert.equal(parsed.searchParams.get("serviceKey"),"abc+def/ghi=");
  assert.doesNotMatch(JSON.stringify(out),/abc%2Bdef/);
});
