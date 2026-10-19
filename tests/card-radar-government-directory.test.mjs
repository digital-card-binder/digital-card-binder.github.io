import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {GOV_DIRECTORY_ENDPOINT,normalizeGovernmentPayload,
  recognizedGovernmentStore,queryGovernmentDirectory,supplementalGovernmentCenters} from
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
  const response=await queryGovernmentDirectory({...center,lat:37.3881,radiusKm:2},{
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

test("three pages fill 1km registry gap without claiming inventory or duplicates",async()=>{
  const loc={lat:37.4327,lng:127.2117,radiusKm:1};
  const ordinary=(i)=>({...item("일반 식료품점",String(100000+i),loc.lat,loc.lng)});
  const base=Array.from({length:1000},(_,i)=>ordinary(i));
  const p1=[...base.slice(1),item("CU 분당점","CU-GEO-1",loc.lat,loc.lng)];
  const p2=[...base.slice(1),item("CU 분당점","CU-GEO-1",loc.lat,loc.lng)];
  const p3=[...base.slice(1,501),item("GS25 분당점","GS-GEO-2",loc.lat,loc.lng)];
  let calls=0;
  const result=await queryGovernmentDirectory(loc,{serviceKey:"FAKE-TEST-KEY",
    fetchImpl:async url=>{
      const page=Number(new URL(url).searchParams.get("pageNo"));
      calls++;
      assert.ok(page<=3,"the API must never exceed three pages");
      const rows=[p1,p2,p3][page-1];
      return {ok:true,json:async()=>fixture(rows,2501)};
    }});
  assert.equal(calls,3);
  assert.equal(result.status,"ok");
  assert.equal(result.pagesFetched,3);
  assert.equal(result.sourceRowsExamined,2501);
  assert.equal(result.sourceTotalCount,2501);
  assert.equal(result.coverageLimited,false);
  assert.equal(result.count,2);
  assert.equal(new Set(result.stores.map(s=>s.id)).size,2);
  assert.ok(result.stores.every(s=>s.stockStatus==="unknown"&&s.items.length===0));
  const repeat=await queryGovernmentDirectory(loc,{serviceKey:"FAKE-TEST-KEY",
    fetchImpl:async()=>{throw Error("CACHED_EXPECTED");}});
  assert.equal(repeat.count,2);
});
test("quota cap explicitly reports partial government coverage when more than three pages",async()=>{
  const loc={lat:37.4211,lng:127.2199,radiusKm:1};
  const ordinary=Array.from({length:1000},(_,i)=>
    item("일반 소매업",String(200000+i),loc.lat,loc.lng));
  let calls=0;
  const value=await queryGovernmentDirectory(loc,{serviceKey:"KEY",
    fetchImpl:async()=>{
      calls++;
      return {ok:true,json:async()=>fixture(ordinary,9000)};
    }});
  assert.equal(calls,3);
  assert.equal(value.pagesFetched,3);
  assert.equal(value.sourceRowsExamined,3000);
  assert.equal(value.sourceTotalCount,9000);
  assert.equal(value.coverageLimited,true);
  assert.equal(value.count,0,"no Pokemon stock or shop inferred from generic businesses");
});
test("later page failures retain earlier discovered candidates but mark incomplete",async()=>{
  const loc={lat:37.4199,lng:127.2222,radiusKm:1};
  let calls=0;
  const value=await queryGovernmentDirectory(loc,{serviceKey:"KEY",
    fetchImpl:async()=>{
      calls++;
      if(calls>1)return {ok:false,status:429};
      return {ok:true,json:async()=>fixture([
        item("CU 분당검증점","CU-GEO-3",loc.lat,loc.lng)],2000)};
    }});
  assert.equal(calls,2);
  assert.equal(value.count,1);
  assert.equal(value.coverageLimited,true);
  assert.equal(value.pagesFetched,1);
  assert.equal(value.sourceRowsExamined,1);
});
test("government quota and source age are explicit in front-end status",async()=>{
  const js=await readFile(new URL("../card-radar.js",import.meta.url),"utf8");
  assert.match(js,/sourceRowsExamined/);
  assert.match(js,/sourceYearMonth/);
});

test("different nearby map centers do not share a rounded government lookup cache",async()=>{
  // Both centers rounded to 37.415 in the old 3-decimal key, despite
  // being 33m apart. The API receives six decimals and must not reuse data.
  const a={lat:37.415161,lng:127.188161,radiusKm:1};
  const b={lat:37.415461,lng:127.188161,radiusKm:1};
  let calls=0;
  const fetchImpl=async url=>{
    calls++;
    const lat=Number(new URL(url).searchParams.get("cy"));
    const id=lat===a.lat?"CENTER-A":"CENTER-B";
    return {ok:true,json:async()=>fixture([item("GS25 위치후보",id,lat,a.lng)])};
  };
  const first=await queryGovernmentDirectory(a,{serviceKey:"TEST-KEY",fetchImpl});
  const second=await queryGovernmentDirectory(b,{serviceKey:"TEST-KEY",fetchImpl});
  assert.equal(calls,2);
  assert.deepEqual(first.stores.map(s=>s.id),["public:CENTER-A"]);
  assert.deepEqual(second.stores.map(s=>s.id),["public:CENTER-B"]);
});

test("simultaneous same-center requests share one upstream call without sharing credentials",async()=>{
  const location={lat:37.416181,lng:127.189191,radiusKm:1};
  let calls=0;
  const fetchImpl=async()=>{
    calls++;
    await new Promise(resolve=>setTimeout(resolve,20));
    return {ok:true,json:async()=>fixture([item("CU 동시조회점","COALESCE-01",location.lat,location.lng)])};
  };
  const [one,two,three]=await Promise.all(Array.from({length:3},()=>
    queryGovernmentDirectory(location,{serviceKey:"HIDDEN-KEY",fetchImpl})));
  assert.equal(calls,1);
  assert.equal(one.count,1);
  assert.deepEqual(one,two);
  assert.deepEqual(two,three);
  assert.doesNotMatch(JSON.stringify(one),/HIDDEN-KEY/);
});

test("later page failures use short cache TTL so a retry can recover missing candidates",async()=>{
  const location={lat:37.416271,lng:127.190291,radiusKm:1};
  const baseTime=Date.parse("2026-10-19T12:00:00Z");
  let calls=0;
  const fetchImpl=async()=>{
    calls++;
    if(calls===2)return {ok:false,status:429};
    const total=calls===1?2000:1;
    return {ok:true,json:async()=>fixture([
      item("이마트24 재시도점","RETRY-01",location.lat,location.lng)],total)};
  };
  const first=await queryGovernmentDirectory(location,{
    serviceKey:"KEY",fetchImpl,now:baseTime});
  assert.equal(first.coverageLimited,true);
  assert.equal(calls,2);
  const cached=await queryGovernmentDirectory(location,{
    serviceKey:"KEY",fetchImpl,now:baseTime+29000});
  assert.equal(calls,2);
  assert.equal(cached.coverageLimited,true);
  const recovered=await queryGovernmentDirectory(location,{
    serviceKey:"KEY",fetchImpl,now:baseTime+31000});
  assert.equal(calls,3);
  assert.equal(recovered.coverageLimited,false);
  assert.equal(recovered.count,1);
});

test("3km search checks bounded outer compass areas and finds stores beyond the center 2km",async()=>{
  const loc={lat:37.42721,lng:127.17221,radiusKm:3};
  const centers=supplementalGovernmentCenters(loc.lat,loc.lng,loc.radiusKm);
  assert.equal(centers.length,4);
  const north=centers[0];
  let calls=0;
  const result=await queryGovernmentDirectory(loc,{serviceKey:"KEY-OUTER",
    fetchImpl:async url=>{
      calls++;
      const params=new URL(url).searchParams;
      assert.ok(Number(params.get("radius"))<=2000);
      assert.equal(Number(params.get("numOfRows")),1000);
      const isNorth=params.get("cy")===north.lat.toFixed(6);
      // Only the northern outer circle includes this fixture.
      const rows=isNorth?[item("CU 외곽점","NORTH-123",north.lat,north.lng)]:[];
      return {ok:true,json:async()=>fixture(rows,rows.length)};
    }});
  assert.equal(calls,5,"one center page plus four outer pages");
  assert.equal(result.count,1);
  assert.equal(result.stores[0].id,"public:NORTH-123");
  assert.equal(result.stores[0].stockStatus,"unknown");
  assert.deepEqual(result.stores[0].items,[]);
  assert.equal(result.coverageLimited,true,"outer sampling is not exhaustive");
  assert.equal(result.pagesFetched,1,"core-only page count remains meaningful");
  assert.equal(result.supplementalCentersAttempted,4);
  assert.equal(result.supplementalCentersFetched,4);
  assert.equal(result.supplementalRowsExamined,1);
});
test("5km and 10km scans never claim whole-area coverage or include beyond-radius candidates",async()=>{
  for(const radiusKm of [5,10]){
    const loc={lat:37.46437+radiusKm/10000,lng:127.16837,radiusKm};
    const east=supplementalGovernmentCenters(loc.lat,loc.lng,radiusKm)[2];
    const radiusDegrees=radiusKm/(111.32*Math.cos(loc.lat*Math.PI/180));
    const outside={lat:loc.lat,lng:loc.lng+radiusDegrees*1.02};
    const inside={lat:loc.lat,lng:east.lng};
    // For 10km, the outside point may also be outside the sampled 2km.
    const observed=await queryGovernmentDirectory(loc,{serviceKey:"KEY-"+radiusKm,
      fetchImpl:async url=>{
        const params=new URL(url).searchParams;
        const isEast=params.get("cx")===east.lng.toFixed(6);
        return {ok:true,json:async()=>fixture(isEast?[
          item("GS25 외곽지점","INSIDE-"+radiusKm,inside.lat,inside.lng),
          item("GS25 범위바깥","OUTSIDE-"+radiusKm,outside.lat,outside.lng)]:[],2)};
      }});
    assert.equal(observed.coverageLimited,true);
    assert.equal(observed.supplementalCentersAttempted,4);
    assert.ok(observed.stores.some(s=>s.id==="public:INSIDE-"+radiusKm));
    assert.ok(!observed.stores.some(s=>s.id==="public:OUTSIDE-"+radiusKm));
    assert.ok(observed.stores.every(s=>s.items.length===0));
  }
});
test("outer API 429 does not remove center data; report partial and permit earlier retry",async()=>{
  const loc={lat:37.47517,lng:127.17817,radiusKm:3};
  const now=Date.parse("2026-10-19T13:00:00Z");
  let calls=0;
  let fail=true;
  const fetchImpl=async url=>{
    calls++;
    if(new URL(url).searchParams.get("cy")===loc.lat.toFixed(6) &&
      new URL(url).searchParams.get("cx")===loc.lng.toFixed(6))
      return {ok:true,json:async()=>fixture([item("CU 중심","CORE-SAFE",loc.lat,loc.lng)])};
    if(fail)return {ok:false,status:429};
    return {ok:true,json:async()=>fixture([])};
  };
  const first=await queryGovernmentDirectory(loc,{serviceKey:"KEY",fetchImpl,now});
  assert.equal(calls,5);
  assert.equal(first.count,1);
  assert.equal(first.coverageLimited,true);
  assert.equal(first.supplementalCentersFetched,0);
  await queryGovernmentDirectory(loc,{serviceKey:"KEY",fetchImpl,now:now+10000});
  assert.equal(calls,5,"retry should respect short cache");
  fail=false;
  const later=await queryGovernmentDirectory(loc,{serviceKey:"KEY",fetchImpl,now:now+31000});
  assert.equal(calls,10);
  assert.equal(later.supplementalCentersFetched,4);
  assert.equal(later.count,1);
});
test("the public UI reports extra directions and remains explicit about incomplete coverage",async()=>{
  const js=await readFile(new URL("../card-radar.js",import.meta.url),"utf8");
  assert.match(js,/supplementalCentersAttempted/);
  assert.match(js,/supplementalRowsExamined/);
  assert.match(js,/부분 조회\(전체 범위 보장 안 됨\)/);
});
