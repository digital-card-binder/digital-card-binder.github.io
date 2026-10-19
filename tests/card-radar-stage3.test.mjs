import assert from "node:assert/strict";
import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";

const source=await readFile(new URL("../card-radar.js",import.meta.url),"utf8");
function harness(){
  const document={readyState:"loading",addEventListener(){},getElementById(){
    return {textContent:"",classList:{toggle(){}},style:{},setAttribute(){}};
  }};
  const body=source.replace(/\}\)\(\);\s*$/,'globalThis.__radarStage3={parseSelfDbDirectory,storeCandidates,isCardProduct,inventoryLabel,state};\n})();');
  assert.notEqual(body,source);
  const sandbox={document,window:{},Date,URL,URLSearchParams,console};
  runInNewContext(body,sandbox);
  return sandbox.__radarStage3;
}
const center={lat:38.191,lng:128.596};
const sample=(items=[])=>({schemaVersion:2,dbStatus:"connected",stores:[
  {storeId:"emart-sokcho-1049",retailerId:"emart",name:"이마트 속초점",
   kind:"mart",lat:38.1910179,lng:128.5957863,
   address:"강원특별자치도 속초시 설악금강대교로 12",stockStatus:"unknown",items}
]});
test("separate Firestore map entry retains its chain and does not invent stock",()=>{
  const {state,parseSelfDbDirectory,storeCandidates,inventoryLabel}=harness();
  state.center=center;state.radiusKm=3;
  const rows=parseSelfDbDirectory(sample());
  assert.equal(rows.length,1);
  assert.equal(rows[0].chain,"emart");
  assert.equal(rows[0].verifiedInventory.length,0);
  state.masterShops=rows;state.mapChecked=true;state.searching=true;
  const merged=storeCandidates([]);
  assert.equal(merged.length,1);
  assert.equal(merged[0].origin,"self-db");
  assert.equal(inventoryLabel(merged[0]).known,false);
});
test("OpenStreetMap duplicates do not create more stores when self DB confirms location",()=>{
  const {state,parseSelfDbDirectory,storeCandidates}=harness();
  state.center=center;state.radiusKm=3;state.masterShops=parseSelfDbDirectory(sample());
  const rows=storeCandidates([{
    id:"osm:987",name:"이마트 속초점",chain:"이마트",kind:"mart",
    lat:38.1911,lng:128.5958,distance:0.02,origin:"osm",verifiedInventory:[]
  }]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].storeId,"emart-sokcho-1049");
  assert.equal(rows[0].origin,"self-db");
});
test("fake statuses, wrong retailer kinds, and invalid locations rejected",()=>{
  const {state,parseSelfDbDirectory}=harness();state.center=center;state.radiusKm=3;
  assert.throws(()=>parseSelfDbDirectory({schemaVersion:2,dbStatus:"unavailable",stores:[]}),
    /INVALID_SELF_DB_RESPONSE/);
  assert.throws(()=>parseSelfDbDirectory({schemaVersion:2,dbStatus:"connected",stores:null}),
    /INVALID_SELF_DB_RESPONSE/);
  const wrong=sample();wrong.stores[0].kind="convenience";
  assert.equal(parseSelfDbDirectory(wrong).length,0);
  const far=sample();far.stores[0].lat=37.4;
  assert.equal(parseSelfDbDirectory(far).length,0);
});
test("backend zero inventory never becomes in-stock; bad transit products ignored",()=>{
  const {state,parseSelfDbDirectory,inventoryLabel}=harness();
  state.center=center;state.radiusKm=3;
  const observedAt=new Date().toISOString();
  const items=[
    {quantity:55,name:"이즐 포켓몬교통카드",setId:"m6a",observedAt,productId:"fake"},
    {quantity:2,name:"포켓몬빵 교통카드",setId:"m2",observedAt,productId:"bad"},
    {quantity:0,name:"인페르노X 부스터 팩",setId:"m2",observedAt,productId:"zero"}
  ];
  const rows=parseSelfDbDirectory(sample(items));
  assert.equal(rows[0].verifiedInventory.length,1);
  assert.equal(inventoryLabel(rows[0]).checked,true);
  assert.equal(inventoryLabel(rows[0]).known,false);
  assert.doesNotMatch(inventoryLabel(rows[0]).message,/이즐|교통카드/);
});
test("only actual original observation time counts and selected pack respected",()=>{
  const {state,parseSelfDbDirectory,inventoryLabel}=harness();
  state.center=center;state.radiusKm=3;
  const old=new Date(Date.now()-16*60000).toISOString();
  const now=new Date().toISOString();
  const p=(quantity,at)=>({quantity,name:"인페르노X 부스터 팩",setId:"m2",
    observedAt:at,productId:"kr-m2-booster-pack"});
  const rows=parseSelfDbDirectory(sample([p(3,old),p(2,now)]));
  assert.equal(rows[0].verifiedInventory.length,1);
  assert.equal(inventoryLabel(rows[0]).known,true);
  state.pack="m6a";
  assert.equal(inventoryLabel(rows[0]).known,false);
  state.pack="";
});
test("production uses standalone API and counts one additional settled data-source query",()=>{
  assert.match(source,/SELF_DB_API="https:\/\/digital-card-radar-api\.vercel\.app\/api\/v1\/stores"/);
  assert.match(source,/state\.masterShops = \[\]/);
  assert.match(source,/state\.progress = \{completed:0,total:jobs\.length\+2\+/);
  assert.match(source,/const dbTask=loadSelfDbStores\(\)/);
  assert.match(source,/dbTask,stockTask,martFeedTask/);
  assert.match(source,/재고 별도 확인/);
});
