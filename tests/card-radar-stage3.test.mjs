import assert from "node:assert/strict";
import {test} from "node:test";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";

const source=await readFile(new URL("../card-radar.js",import.meta.url),"utf8");
function harness(){
  const document={readyState:"loading",addEventListener(){},getElementById(){
    return {textContent:"",classList:{toggle(){}},style:{},setAttribute(){}};
  }};
  const body=source.replace(/\}\)\(\);\s*$/,'globalThis.__radarStage3={parseSelfDbDirectory,storeCandidates,isCardProduct,inventoryLabel,convenienceChain,selectedKind,parseCuStoreDirectory,state};\n})();');
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
test("production uses standalone and optional government location APIs with settled request count",()=>{
  assert.match(source,/SELF_DB_API="https:\/\/digital-card-radar-api\.vercel\.app\/api\/v1\/stores"/);
  assert.match(source,/state\.masterShops = \[\]/);
  assert.match(source,/state\.progress = \{completed:0,total:jobs\.length\+3\+/);
  assert.match(source,/const dbTask=loadSelfDbStores\(\)/);
  assert.match(source,/dbTask,govTask,stockTask,martFeedTask/);
  assert.match(source,/재고 별도 확인/);
});

test("CU / GS25 / 7-Eleven / emart24 vendor filter works on the list and map data",()=>{
  const {state,selectedKind,convenienceChain}=harness();
  const vendors=[
    ["CU 팽성남산로점","cu"],
    ["GS25 평택중앙점","gs25"],
    ["세븐일레븐 평택역점","seveneleven"],
    ["이마트24 동탄점","emart24"]
  ].map(([name,retailerId])=>({kind:"convenience",name,retailerId}));
  state.kind="convenience";
  state.convenienceBrand="gs25";
  assert.deepEqual(vendors.filter(selectedKind).map(x=>x.retailerId),["gs25"]);
  state.convenienceBrand="seveneleven";
  assert.deepEqual(vendors.filter(selectedKind).map(x=>x.retailerId),["seveneleven"]);
  state.convenienceBrand="emart24";
  assert.deepEqual(vendors.filter(selectedKind).map(x=>x.retailerId),["emart24"]);
  state.convenienceBrand="cu";
  assert.equal(convenienceChain({name:"팽성남산로점",retailerId:"cu"}),"cu");
  assert.equal(convenienceChain({name:"CU 팽성남산로점"}),"cu");
  assert.equal(convenienceChain({name:"GS 25 서울역"}),"gs25");
  state.convenienceBrand="all";
  assert.equal(vendors.filter(selectedKind).length,4);
  state.kind="all";state.convenienceBrand="gs25";
  assert.equal(vendors.filter(selectedKind).length,4,"other kinds are not filtered by inactive chain selection");
});
test("CU store code is authoritative even if point name omits CU prefix",()=>{
  const {state,parseCuStoreDirectory,convenienceChain}=harness();
  state.center={lat:36.98,lng:127.04};state.radiusKm=10;
  const p={success:true,data:{stores:[{storeCode:"C123",storeName:"팽성남산로점",
    latitude:36.98,longitude:127.04}]}};
  const rows=parseCuStoreDirectory(p);
  assert.equal(rows.length,1);
  assert.equal(rows[0].retailerId,"cu");
  assert.equal(convenienceChain(rows[0]),"cu");
});

test("convenience filter UI is present, accessible, and ready for re-rendering",async()=>{
  const html=await readFile(new URL("../card-radar.html",import.meta.url),"utf8");
  for(const value of ["cu","gs25","seveneleven","emart24","other"])
    assert.match(html,new RegExp('<option value="'+value+'">'));
  assert.match(html,/id="radar-convenience-brand"/);
  assert.match(source,/convenienceSelect\.addEventListener\("change"/);
  assert.match(source,/convenienceChain\(store\)/);
});
