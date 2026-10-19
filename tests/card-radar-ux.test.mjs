import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const source = read("card-radar.js");

function harness(options = {}) {
  const nodes = new Map();
  const element = (id) => {
    if (!nodes.has(id)) {
      nodes.set(id, {
        textContent: "",
        style: {},
        attrs: {},
        classList: { toggle() {} },
        setAttribute(key, value) { this.attrs[key] = value; },
      });
    }
    return nodes.get(id);
  };
  const document = {
    readyState: "loading",
    addEventListener() {},
    getElementById: element,
  };
  // Keep production internals private; expose pure calculations only in the test VM.
  const body = source.replace(/\}\)\(\);\s*$/, [
    ...(options.stubView ? ["render=()=>{};centerMap=()=>{};updateProgress=()=>{};"] : []),
    "globalThis.__radarTests = {isCardProduct, inventoryLabel, showGeolocate, geolocationErrorMessage,",
    "parseRetail, matchesRequestedCardProduct, stockProductIdentity, groupInventoryRows, mergeInventory, sameRetailerForStock, officialStockApp, normalizeRetailerArea, normalizeRetailerDistrict, emart24FallbackArea, endpoint, inventoryJobs, updateProgress, completeProgressStep, schedulePackRefresh, filterStoresForDisplay, category, parseShops, categoryQuery, parseCuStoreDirectory, storeCandidates, shouldOfferMapSearch, liveQueries, martBrand, martBrandLabel, selectedKind, stockProductCount, trustedMartLink, martLookup, parseApprovedMartFeed, state};",
    "})();",
  ].join("\n"));
  assert.notEqual(body, source, "script test hook insertion");
  const sandbox = { document, window: options.window || {}, navigator: options.navigator || {}, console, URL, URLSearchParams, Date, Math };
  runInNewContext(body, sandbox, { filename: "card-radar.js" });
  return { ...sandbox.__radarTests, element };
}

test("stock only recognizes Pokemon TCG packs and decks, never bakery or merch", () => {
  const { isCardProduct } = harness();
  for (const item of [
    "포켓몬카드 나이트원더러", "포켓몬 카드 30주년 팩",
    "포켓몬스터 트레이딩카드 확장팩", "포켓몬카드 닌자스피너",
    "메가심포니아 확장팩", "30th CELEBRATION",
  ]) assert.equal(isCardProduct(item), true, item);
  for (const item of [
    "포켓몬빵", "포켓몬 나이트원더러 빵 카드", "포켓몬 샘플링 카드",
    "포켓몬카드 띠부씰", "포켓몬카드 슬리브", "포켓몬 스낵",
    "포켓몬 피규어", "포켓몬", "포켓몬카드 키링", "랜덤씰 포켓몬 카드",
  ]) assert.equal(isCardProduct(item), false, item);
});

test("positive stock is exactly one item and older stock is not shown as current", () => {
  const { inventoryLabel, state } = harness();
  const time = new Date().toISOString();
  const store = { verifiedInventory: [
    {name:"포켓몬빵 카드 스티커",quantity:25,checkedAt:time,code:"m6a"},
    {name:"포켓몬카드 닌자스피너",quantity:0,checkedAt:time,code:"m4"},
    {name:"포켓몬카드 메가심포니아",quantity:3,checkedAt:time,code:"m1S",provider:"GS25"},
    {name:"포켓몬카드 어비스아이",quantity:7,checkedAt:time,code:"m5",provider:"CU"},
  ]};
  const positive = inventoryLabel(store);
  assert.equal(positive.known, true);
  assert.equal(positive.checked, true);
  assert.equal((positive.message.match(/조회 수량/g) || []).length, 1);
  assert.match(positive.message, /어비스아이/);
  assert.doesNotMatch(positive.message, /포켓몬빵|닌자스피너/);
  state.pack="m4";
  const zero = inventoryLabel(store);
  assert.equal(zero.known, false);
  assert.equal(zero.message, "");
  assert.equal(zero.checked, true);
  state.pack = "m1S";
  const chosen = inventoryLabel(store);
  assert.match(chosen.message, /메가심포니아/);
  state.pack = "";
  const stale = inventoryLabel({ verifiedInventory: [
    { name:"포켓몬카드 메가심포니아", code:"m1S", quantity:12,
      checkedAt:new Date(Date.now()-30*60000).toISOString() }
  ]});
  assert.equal(stale.known,false);
  assert.equal(stale.checked,false);
  assert.equal(stale.message,"");
});

test("retailer integration discards food even if API returns positive quantities", () => {
  const { parseRetail, state } = harness();
  state.center = { lat:37.5,lng:127 };
  state.radiusKm=10;
  const api=(name, quantity)=>({success:true,data:{
    inventory:{available:true},nearbyStores:{
      stockItemName:name,stores:[{storeCode:"shop1",storeName:"CU 테스트점",
      latitude:37.5002,longitude:127.0002,stock:quantity}]
    }
  }});
  assert.equal(parseRetail("cu",api("포켓몬빵",18),new Date().toISOString()).length,0);
  assert.equal(parseRetail("cu",api("포켓몬카드 닌자스피너",4),new Date().toISOString()).length,1);
});

test("progress tracks settled API attempts rather than pretending stores were checked", () => {
  const { state, element, completeProgressStep, updateProgress, inventoryJobs } = harness();
  assert.equal(inventoryJobs().length,20);
  state.progress={total:5,completed:0,successes:0,failures:0,active:true};
  updateProgress("검색 중");
  completeProgressStep(true,"재고 조회 중");
  completeProgressStep(false,"재고 조회 중");
  completeProgressStep(true,"지도 조회 중",false);
  assert.equal(element("radar-progress").attrs["aria-valuenow"],"60");
  assert.equal(element("radar-progress-percent").textContent,"60%");
  assert.equal(element("radar-search-completed").textContent,"1");
  assert.equal(element("radar-search-failed").textContent,"1");
  completeProgressStep(true,"재고 조회 중");
  completeProgressStep(true,"검색 종료");
  state.progress.active=false;
  updateProgress("검색 종료");
  assert.equal(element("radar-progress-percent").textContent,"100%");
});

test("radar has a dedicated top-right mobile entry, clear counts and limited-stock CSS", () => {
  const index = read("index.html");
  const header=index.slice(index.indexOf('<header class="site-header">'),index.indexOf("</header>"));
  assert.match(header, /class="home-radar-trigger" href="[.]\/card-radar[.]html"/);
  assert.ok(header.indexOf("home-radar-trigger") < header.indexOf("home-account-trigger"));
  const css=read("home-preview.css");
  assert.match(css, /@media \(max-width: 690px\)[\s\S]*?home-radar-trigger/);
  const radarHtml=read("card-radar.html");
  for(const id of ["radar-progress", "radar-progress-percent", "radar-total-stores",
      "radar-stock-checked", "radar-search-completed", "radar-search-failed"]) {
    assert.match(radarHtml,new RegExp('id="'+id+'"'));
  }
  assert.match(read("card-radar.css"), /[.]radar-stock[.]in-stock/);
  const nav=read("collector-nav.js");
  assert.doesNotMatch(nav, /queryAll\('[.]home-menu nav, [.]home-top-nav'\)/);
});
test("stock-only toggle filters current positive card inventory, never unknown, zero or stale", () => {
  const { state, filterStoresForDisplay } = harness();
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  const stores = [
    {name:"confirmed",verifiedInventory:[{name:"포켓몬카드 닌자스피너",code:"m4",quantity:4,checkedAt:now}]},
    {name:"zero",verifiedInventory:[{name:"포켓몬카드 닌자스피너",code:"m4",quantity:0,checkedAt:now}]},
    {name:"old",verifiedInventory:[{name:"포켓몬카드 닌자스피너",code:"m4",quantity:3,checkedAt:stale}]},
    {name:"food",verifiedInventory:[{name:"포켓몬빵",code:"m4",quantity:30,checkedAt:now}]},
    {name:"unknown",verifiedInventory:[]},
  ];
  assert.equal(filterStoresForDisplay(stores).length, 5, "OFF retains every nearby store");
  state.onlyInStock = true;
  assert.deepEqual([...filterStoresForDisplay(stores)].map(s=>s.name), ["confirmed"],
    "ON includes only fresh, positive Pokémon-card inventory");
  state.pack = "m1S";
  assert.equal(filterStoresForDisplay(stores).length, 0,
    "stock must belong to the currently selected card pack");
  state.pack = "";
  state.onlyInStock = false;
  assert.equal(filterStoresForDisplay(stores).length, 5, "OFF restores every nearby store");
});

test("stock-only filter is shared by map and list, saved, accessible and responsive", () => {
  const html = read("card-radar.html");
  const css = read("card-radar.css");
  assert.match(html, /id="radar-only-in-stock" type="checkbox"/);
  assert.match(html, /재고 있는 매장만 보기/);
  assert.match(html, /id="radar-stock-filter-count"/);
  assert.match(css, /[.]radar-stock-filter[.]is-active/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?[.]radar-result-top [.]radar-stock-filter/);
  const render = source.slice(source.indexOf("  function render() {"),source.indexOf("  async function search()"));
  assert.match(render, /currentSummary\(nearbyStores[.]length, displayedStores[.]length\)/);
  assert.match(render, /renderMapMarkers\(displayedStores\)/);
  assert.match(render, /for \(const store of displayedStores\) addStoreCard\(list,store\)/);
  assert.match(render, /radar-stock-filter-count/);
  assert.match(render, /현재 재고 있는 매장이 확인되지 않았습니다/);
  assert.match(source, /digitalCardBinderRadarOnlyInStockV1/);
  assert.match(source, /stockFilter[.]addEventListener\("change"/);
  assert.match(source, /savedStockOnly = localStorage[.]getItem/);
});


test("transit cards and keyword-matched unrelated products never enter Pokemon TCG stock", () => {
  const { isCardProduct, liveQueries } = harness();
  for (const name of [
    "포켓몬 이즐카드 1만원", "포켓몬 T머니 교통카드",
    "포켓몬 캐시비카드", "포켓몬 EZL 카드", "포켓몬 선불카드",
    "포켓몬 카드지갑", "포켓몬카드 기프트카드", "포켓몬 카드",
  ]) assert.equal(isCardProduct(name), false, name);
  for (const name of [
    "인페르노X 부스터 팩", "포켓몬카드 인페르노X 부스터 팩",
    "포켓몬 카드 30주년 팩", "포켓몬카드 닌자스피너",
  ]) assert.equal(isCardProduct(name), true, name);
  assert.deepEqual([...liveQueries()], ["인페르노X","닌자스피너",
    "30th CELEBRATION","메가심포니아","포켓몬카드 부스터팩"]);
});

test("CU store directory contributes locations without inventing inventory", () => {
  const { parseCuStoreDirectory, storeCandidates, state } = harness();
  state.center={lat:36.98,lng:127.04};
  state.radiusKm=10;
  state.searching=true;
  const source={success:true,data:{stores:[
    {storeCode:"cu123",storeName:"CU 팽성남산로점",latitude:36.98,longitude:127.04,
      address:"경기도 평택시 팽성읍 사거리길 35",stock:6},
    {storeCode:"far",storeName:"CU 먼곳",latitude:37.40,longitude:127.04},
  ]}};
  const shops=parseCuStoreDirectory(source);
  assert.equal(shops.length,1);
  assert.equal(shops[0].kind,"convenience");
  assert.equal(shops[0].verifiedInventory.length,0,
    "store location response must never be interpreted as confirmed stock");
  state.retailerShops=shops;
  assert.equal(storeCandidates([]).length,1);
  const duplicate={id:"osm:1",name:"씨유 팽성남산로점",kind:"convenience",
    lat:36.9801,lng:127.0401,origin:"osm",verifiedInventory:[]};
  assert.equal(storeCandidates([duplicate]).length,1,
    "same retailer store from map and CU directory should not be duplicated");
});

test("map pan exposes explicit search action only beyond search center", () => {
  const { state, shouldOfferMapSearch } = harness();
  state.center={lat:37.5,lng:127.0};
  assert.equal(shouldOfferMapSearch({lat:37.5,lng:127.0}),false);
  assert.equal(shouldOfferMapSearch({lat:37.501,lng:127.0}),false);
  assert.equal(shouldOfferMapSearch({lat:37.52,lng:127.0}),true);
  assert.equal(shouldOfferMapSearch({lat:Infinity,lng:127.0}),false);
  const html=read("card-radar.html");
  assert.match(html,/id="radar-search-map-area"/);
  assert.match(html,/이 지도에서 다시 검색/);
  const css=read("card-radar.css");
  assert.match(css,/[.]radar-map-area-search\[hidden\]/);
  assert.match(source,/state[.]map[.]on\("moveend"/);
  assert.match(source,/const point = state[.]map[.]getCenter\(\)/);
  assert.match(source,/byId\("radar-search-map-area"\)[.]addEventListener\("click",searchCurrentMapArea\)/);
});

test("map/retail sources classify shops and official mart correctly", () => {
  const {category}=harness();
  assert.equal(category({shop:"convenience",name:"CU 팽성남산로점"}),"convenience");
  assert.equal(category({shop:"supermarket",name:"이마트 속초점"}),"mart");
  assert.equal(category({shop:"games",name:"카드 상점"}),null);
  const data=JSON.parse(read("data/card-radar-stores.json"));
  const target=data.stores.find(s=>s.name==="이마트 속초점");
  assert.ok(target);
  assert.equal(target.kind,"mart");
  assert.equal(target.inventoryStatus,"not_connected");
  assert.ok(target.lat>37 && target.lat<39);
  assert.ok(target.lng>127 && target.lng<130);
});

test("multiple mart chains receive distinct labels and precise subfilters", () => {
  const { martBrand, martBrandLabel, selectedKind, state, category } = harness();
  const cases = [
    ["이마트 속초점","emart","이마트"],
    ["트레이더스 홀세일 클럽 안성점","traders","트레이더스"],
    ["롯데마트 송도점","lottemart","롯데마트"],
    ["홈플러스 평택점","homeplus","홈플러스"],
    ["코스트코 하남점","costco","코스트코"],
    ["농협 하나로마트 고양점","hanaro","하나로마트"],
    ["동네마트","other","기타 마트"],
  ];
  for(const [name,id,label] of cases) {
    assert.equal(martBrand(name),id,name);
    assert.equal(martBrandLabel(id),label,name);
  }
  assert.equal(category({shop:"wholesale",name:"트레이더스"}),"mart");
  assert.equal(category({shop:"supermarket",name:"롯데마트"}),"mart");
  assert.equal(category({shop:"convenience",name:"이마트24"}),"convenience");
  state.kind="mart";
  state.martBrand="traders";
  assert.equal(selectedKind({kind:"mart",name:"트레이더스 월평점"}),true);
  assert.equal(selectedKind({kind:"mart",name:"이마트 속초점"}),false);
  assert.equal(selectedKind({kind:"convenience",name:"GS25"}),false);
  state.martBrand="all";
  assert.equal(selectedKind({kind:"mart",name:"이마트 속초점"}),true);
  state.kind="all";
  assert.equal(selectedKind({kind:"convenience",name:"GS25"}),true);
});

test("stock map pins count only currently confirmed unique card products", () => {
  const {state,stockProductCount,filterStoresForDisplay} = harness();
  const current=new Date().toISOString();
  const old=new Date(Date.now()-40*60000).toISOString();
  const store={name:"GS25 샘플",verifiedInventory:[
    {name:"포켓몬카드 인페르노X 부스터팩",quantity:4,checkedAt:current,code:"m2"},
    {name:"포켓몬카드 인페르노X 부스터팩",quantity:4,checkedAt:current,code:"m2"},
    {name:"포켓몬카드 닌자스피너 부스터팩",quantity:1,checkedAt:current,code:"m4"},
    {name:"포켓몬카드 메가심포니아",quantity:0,checkedAt:current,code:"m1S"},
    {name:"포켓몬카드 배틀파트너즈",quantity:8,checkedAt:old,code:""},
    {name:"포켓몬 이즐 교통카드",quantity:12,checkedAt:current,code:""},
  ]};
  assert.equal(stockProductCount(store),2);
  state.onlyInStock=true;
  assert.equal(filterStoresForDisplay([store,{name:"unknown",verifiedInventory:[]}]).length,1);
  state.pack="m4";
  assert.equal(stockProductCount(store),1);
  state.pack="m1S";
  assert.equal(stockProductCount(store),0);
});

test("inventory map controls reuse the same stock filter, without fabricated national stock", () => {
  const html=read("card-radar.html");
  assert.match(html,/data-map-mode="all"/);
  assert.match(html,/data-map-mode="stock"/);
  assert.match(html,/id="radar-map-mode-count"/);
  assert.match(html,/id="radar-mart-brand"/);
  for(const id of ["emart","traders","lottemart","homeplus","costco","hanaro"]) {
    assert.match(html,new RegExp('value="'+id+'"'));
  }
  const css=read("card-radar.css");
  assert.match(css,/[.]radar-stock-marker-bubble/);
  assert.match(css,/[.]radar-map-mode button\[data-map-mode="stock"\][.]selected/);
  assert.match(source,/document[.]querySelectorAll\("\[data-map-mode\]"\)[.]forEach/);
  assert.match(source,/renderMapMarkers\(displayedStores\)/);
  assert.match(source,/if\(state[.]onlyInStock && hasStock\)/);
  assert.match(source,/state[.]onlyInStock && hasStock && window[.]L[.]divIcon/);
  assert.match(source,/stockProductCount\(store\)/);
  assert.match(source,/state[.]onlyInStock\?"stock":"all"/);
  assert.match(source,/byId\("radar-map-mode-count"\)[.]textContent/);
});

test("official retailer links are restricted to known HTTPS hosts", () => {
  const {trustedMartLink,martLookup,state}=harness();
  assert.equal(trustedMartLink("https://eapp.emart.com/webapp/product/search"),
    "https://eapp.emart.com/webapp/product/search");
  assert.equal(trustedMartLink("https://company.lottemart.com/mobiledowa/"),
    "https://company.lottemart.com/mobiledowa/");
  for(const bad of ["http://company.lottemart.com/","https://fraud.test/",
      "javascript:alert(1)","https://company.lottemart.com.evil.test/"]) {
    assert.equal(trustedMartLink(bad),"",bad);
  }
  const source=JSON.parse(read("data/card-radar-mart-providers.json"));
  assert.equal(source.schemaVersion,1);
  assert.ok(source.providers.length>=6);
  for(const row of source.providers) {
    assert.equal(row.inventoryApiConnected,false,row.id);
    if(row.lookupUrl)assert.ok(trustedMartLink(row.lookupUrl));
  }
  state.martProviders=Object.fromEntries(source.providers.map(p=>[p.id,p]));
  assert.equal(martLookup({kind:"mart",name:"롯데마트 서울점"}).lookupLabel,"롯데마트 공식 도와센터");
  assert.equal(martLookup({kind:"convenience",name:"이마트24"}),null);
});

test("licensed feed rejects unconnected, unauthorized, future and stale records", () => {
  const {parseApprovedMartFeed}=harness();
  const data=JSON.parse(read("data/card-radar-mart-inventory.json"));
  assert.deepEqual([...parseApprovedMartFeed(data)],[]);
  const now=Date.now();
  const iso=t=>new Date(t).toISOString();
  const feed={
    schemaVersion:1,
    source:{status:"connected",authorized:true,licenseRef:"TEST-AGREEMENT-REFERENCE",
      providerId:"lottemart",generatedAt:iso(now-1000),expiresAt:iso(now+200000)},
    stores:[{
      id:"store-1",name:"롯데마트 테스트점",kind:"mart",chain:"롯데마트",lat:37.1,lng:127.1,
      items:[
        {code:"m2",name:"포켓몬카드 인페르노X 부스터팩",quantity:2,checkedAt:iso(now-50000)},
        {code:"m2",name:"포켓몬빵",quantity:7,checkedAt:iso(now-50000)},
        {code:"m2",name:"포켓몬카드 인페르노X 부스터팩",quantity:5,checkedAt:iso(now-3600000)},
        {code:"m2",name:"포켓몬카드 인페르노X 부스터팩",quantity:-1,checkedAt:iso(now-50000)}
      ]
    }]
  };
  const good=parseApprovedMartFeed(feed,now);
  assert.equal(good.length,1);
  assert.equal(good[0].items.length,1);
  assert.equal(good[0].items[0].quantity,2);
  assert.equal(good[0].items[0].provider,"lottemart");
  feed.source.authorized=false;
  assert.equal(parseApprovedMartFeed(feed,now).length,0);
  feed.source.authorized=true;
  feed.source.expiresAt=iso(now-1000);
  assert.equal(parseApprovedMartFeed(feed,now).length,0);
  feed.source.expiresAt=iso(now+200000);
  feed.source.providerId="emart";
  assert.equal(parseApprovedMartFeed(feed,now).length,0,"no cross-chain data reuse");
});

test("unconnected mart has official verification link but is not a stock claim", () => {
  const radar=read("card-radar.js");
  assert.match(radar,/loadMartProviders\(\)/);
  assert.match(radar,/loadMartInventory\(\)/);
  assert.match(radar,/radar-mart-lookup-note/);
  assert.match(radar,/공식 웹사이트로 이동합니다/);
  assert.match(radar,/inventoryApiConnected:false/);
  const providers=JSON.parse(read("data/card-radar-mart-providers.json"));
  assert.equal(providers.providers.some(p=>p.inventoryApiConnected),false);
});

test("selected convenience brand only queries its retailer, avoiding wasted third-party API quota",()=>{
  const {state,inventoryJobs}=harness();
  state.kind="convenience";
  state.convenienceBrand="gs25";
  assert.equal(inventoryJobs().length,5);
  assert.ok(inventoryJobs().every(x=>x.provider==="gs25"));
  state.convenienceBrand="emart24";
  assert.equal(inventoryJobs().length,5);
  assert.ok(inventoryJobs().every(x=>x.provider==="emart24"));
  state.convenienceBrand="other";
  assert.equal(inventoryJobs().length,0);
  state.convenienceBrand="all";
  assert.equal(inventoryJobs().length,20);
});

test("changing a pack after a search schedules pack-specific refresh, never only filters old stock",()=>{
  const {schedulePackRefresh,state}=harness();
  let requests=0;
  const refresh=()=>{requests++;};
  assert.equal(schedulePackRefresh(refresh),false,"before first search, selection is just a choice");
  assert.equal(requests,0);
  state.hasSearched=true;
  assert.equal(schedulePackRefresh(refresh),true,"after first search it refreshes automatically");
  assert.equal(requests,1);
  assert.equal(state.packRefreshPending,false);
  state.searching=true;
  assert.equal(schedulePackRefresh(refresh),false,"avoid overlapping 20-job searches");
  assert.equal(requests,1);
  assert.equal(state.packRefreshPending,true,"queue one refresh for the final selected pack");
  assert.equal(schedulePackRefresh(refresh),false);
  assert.equal(requests,1,"multiple option changes during search only queue one retry");
});

test("pack selector discloses bounded keyword coverage and code schedules refresh on change",()=>{
  const html=read("card-radar.html");
  assert.match(html,/id="radar-pack-coverage-note"/);
  assert.match(html,/전체 카드팩은 주요 상품부터 검색합니다/);
  assert.match(source,/product[.]addEventListener\("change",\(\)=>\{[\s\S]*?schedulePackRefresh\(\)/);
  assert.match(source,/if\(state[.]packRefreshPending\)\{[\s\S]*?void search\(\)/);
  assert.match(source,/state[.]hasSearched = true/);
  assert.match(source,/if\(state[.]pack\) return \[PACK_TITLES[.]get\(state[.]pack\)\]/);
});

test("radar results include only convenience stores and marts regardless of feed type",()=>{
  const {state,category,parseShops,storeCandidates,filterStoresForDisplay}=harness();
  state.center={lat:37.42,lng:127.1};
  state.radiusKm=3;
  const elements=[
    {type:"node",id:1,lat:37.42,lon:127.1,tags:{shop:"convenience",name:"CU 테스트"}},
    {type:"node",id:2,lat:37.4201,lon:127.1,tags:{shop:"supermarket",name:"이마트 테스트"}},
    {type:"node",id:3,lat:37.4202,lon:127.1,tags:{shop:"games",name:"포켓몬 카드샵"}},
    {type:"node",id:4,lat:37.4203,lon:127.1,tags:{shop:"bakery",name:"빵집"}}
  ];
  assert.equal(category(elements[2].tags),null);
  assert.equal(category(elements[3].tags),null);
  const map=parseShops(elements);
  assert.deepEqual([...map].map(x=>x.kind),["convenience","mart"]);
  state.masterShops=[
    {storeId:"test-cardshop",name:"카드샵 지점",kind:"cardshop",lat:37.42,lng:127.1,verifiedInventory:[]},
    {storeId:"mart-store",name:"롯데마트 테스트",kind:"mart",lat:37.425,lng:127.1,verifiedInventory:[]}
  ];
  state.publicShops=[];
  state.retailerShops=[];
  state.curatedShops=[];
  const merged=storeCandidates([...map,{name:"우연히 들어온 카드샵",kind:"cardshop",lat:37.42,lng:127.1}]);
  assert.ok(merged.every(x=>x.kind==="convenience"||x.kind==="mart"));
  assert.equal(filterStoresForDisplay(merged).length,merged.length);
});

test("store query never requests game/card shops and compact UI has just one visit notice",()=>{
  const {categoryQuery}=harness();
  const query=categoryQuery(3000,37.42,127.1);
  assert.ok(!query.includes('shop"="games"'),"no unnecessary card shop query");
  assert.match(query,/convenience/);
  assert.match(query,/supermarket/);
  const html=read("card-radar.html");
  const css=read("card-radar.css");
  assert.doesNotMatch(html,/value="cardshop"|is-cardshop|radar-explain|카드샵/);
  assert.doesNotMatch(css,/radar-explain|is-cardshop|kind--cardshop/);
  assert.doesNotMatch(source,/cardshop|카드샵/);
  assert.match(html,/class="radar-visit-note">방문 전 매장 재고를 다시 확인해 주세요/);
  assert.equal((html.match(/class="radar-visit-note"/g)||[]).length,1);
  assert.match(html,/재고 확인 범위 <span>자세히<\/span>/);
  assert.match(html,/id="radar-db-status"/);
  assert.match(html,/id="radar-public-status"/);
});

test("named card-pack queries reject approximate-search false positives",()=>{
  const {matchesRequestedCardProduct}=harness();
  assert.equal(matchesRequestedCardProduct("포켓몬카드 인페르노X 확장팩","인페르노X"),true);
  assert.equal(matchesRequestedCardProduct("포켓몬카드 닌자스피너 부스터팩","인페르노X"),false);
  assert.equal(matchesRequestedCardProduct("포켓몬카드 30주년 팩","30th CELEBRATION"),true);
  assert.equal(matchesRequestedCardProduct("포켓몬카드 30th CELEBRATION 부스터팩","30th CELEBRATION"),true);
  assert.equal(matchesRequestedCardProduct("포켓몬카드 피카츄 30주년 키링","30th CELEBRATION"),false);
  assert.equal(matchesRequestedCardProduct("포켓몬카드 메가심포니아","메가심포니아"),true);
  assert.equal(matchesRequestedCardProduct("포켓몬카드 메가브레이브","메가심포니아"),false);
  assert.equal(matchesRequestedCardProduct("포켓몬카드 메가브레이브","포켓몬카드 부스터팩"),true);
});

test("all four convenience parsers discard unrelated products returned for a keyword",()=>{
  const {parseRetail,state}=harness();
  state.center={lat:37.52,lng:127.02};state.radiusKm=3;
  const now=new Date().toISOString();
  const store={storeCode:"S01",storeName:"GS25 테스트",latitude:37.5201,longitude:127.0201};
  const responses=[
    ["cu",{success:true,data:{inventory:{available:true},nearbyStores:{
      stockItemName:"포켓몬카드 메가브레이브",stores:[{...store,stock:6}]
    }}}],
    ["gs25",{success:true,data:{product:{name:"포켓몬카드 메가브레이브"},inventory:{
      stores:[{...store,searchItemName:"포켓몬카드 메가브레이브",realStockQuantity:4}]
    }}}],
    ["seveneleven",{success:true,data:{stockAvailable:true,product:{itemName:"포켓몬카드 메가브레이브"},inventory:{
      stores:[{...store,stockQuantity:3}]
    }}}],
    ["emart24",{success:true,data:{goodsInfo:{goodsName:"포켓몬카드 메가브레이브"},
      stores:[{bizNo:"S01",storeName:"이마트24 테스트",bizQty:7}],
      nearbyStores:[{storeCode:"S01",latitude:37.5201,longitude:127.0201}]}}]
  ];
  for(const [provider,payload] of responses){
    assert.equal(parseRetail(provider,payload,now,"메가심포니아").length,0,provider);
    const broad=parseRetail(provider,payload,now,"포켓몬카드 부스터팩");
    assert.equal(broad.length,1,provider);
    assert.equal(broad[0].inventorySource,"public-aggregator");
    assert.equal(broad[0].items[0].inventorySource,"public-aggregator");
    assert.equal(broad[0].items[0].quantity,[6,4,3,7][responses.findIndex(x=>x[0]===provider)]);
  }
});

test("external inventory remains labeled as public source and does not become authorized feed",()=>{
  const {parseRetail,mergeInventory,inventoryLabel,state}=harness();
  state.center={lat:37.54,lng:127.05};state.radiusKm=3;
  state.kind="all";state.pack="";state.martBrand="all";state.convenienceBrand="all";
  state.masterShops=[];state.retailerShops=[];state.publicShops=[];state.curatedShops=[];
  state.searching=true;state.mapChecked=false;state.martInventory=[];
  const raw={success:true,data:{inventory:{available:true},nearbyStores:{
    stockItemName:"포켓몬카드 인페르노X",stores:[{
      storeCode:"C701",storeName:"CU 공개조회점",latitude:37.5401,longitude:127.0501,stock:4
    }]}}};
  state.inventory=parseRetail("cu",raw,new Date().toISOString(),"인페르노X");
  const stores=mergeInventory([]);
  assert.equal(stores.length,1);
  assert.equal(stores[0].origin,"public-aggregator");
  assert.equal(stores[0].verifiedInventory[0].inventorySource,"public-aggregator");
  const summary=inventoryLabel(stores[0]);
  assert.equal(summary.known,true);
  assert.match(summary.detail,/공개 재고 조회 응답/);
  assert.doesNotMatch(summary.detail,/공식|승인|실시간/);
});

test("zero from a partial all-pack query is not presented as all card products sold out",()=>{
  const {inventoryLabel,state}=harness();
  const store={verifiedInventory:[{name:"포켓몬카드 닌자스피너",
    quantity:0,code:"m4",checkedAt:new Date().toISOString(),provider:"CU"}]};
  state.pack="";
  const summary=inventoryLabel(store);
  assert.equal(summary.checked,true);
  assert.equal(summary.known,false);
  assert.match(summary.detail,/다른 카드팩은 미확인/);
  state.pack="m4";
  assert.match(inventoryLabel(store).detail,/선택한 카드팩 조회 수량 0개/);
});

test("Emart24 branch labels are all recognized as convenience stores, not supermarkets",()=>{
  const {category,categoryQuery,state,selectedKind}=harness();
  for(const name of ["이마트24 판교점","이마트 24 서현점","emart24 정자점","E-Mart24 강남점","E Mart 24 미금점"]){
    assert.equal(category({shop:"convenience",name}),"convenience",name);
    assert.equal(category({shop:"supermarket",name}),"convenience",name);
    assert.equal(category({shop:"shop",name}),"convenience",name);
  }
  assert.equal(category({shop:"supermarket",name:"이마트 판교점"}),"mart");
  assert.equal(category({shop:"wholesale",name:"트레이더스 홀세일"}),"mart");
  state.kind="convenience";state.convenienceBrand="emart24";
  assert.equal(selectedKind({kind:"convenience",name:"E-Mart24 강남점"}),true);
  assert.equal(selectedKind({kind:"mart",name:"이마트 강남점"}),false);
  const query=categoryQuery(3000,37.5,127.02);
  assert.match(query,/nwr\["shop"="convenience"\]\["brand"/);
  assert.match(query,/이마트 \?24/);
});

test("GPS selection immediately starts nearby search after positioning the map",()=>{
  let requested=0,calls=0,opts=null;
  const geo=harness({stubView:true,navigator:{geolocation:{
    getCurrentPosition(ok,fail,options){
      calls++;
      opts=options;
      ok({coords:{latitude:37.3589,longitude:127.1077}});
    }
  }}});
  geo.state.center={lat:37.5665,lng:126.978};
  geo.state.shops=[{name:"old shop"}];
  geo.element("radar-place").value="강남역";
  geo.showGeolocate(()=>{requested++;});
  assert.equal(calls,1);
  assert.equal(requested,1,"successful GPS must automatically search new surroundings");
  assert.equal(geo.state.locationChosen,true);
  assert.equal(geo.state.locationLabel,"내 위치");
  assert.equal(geo.state.center.lat,37.3589);
  assert.equal(geo.state.center.lng,127.1077);
  assert.equal(geo.state.shops.length,0,"old area results are removed");
  assert.equal(geo.element("radar-place").value,"","stale text search must not constrain Seven-Eleven");
  assert.equal(geo.element("radar-geolocate").disabled,false,"GPS button is restored");
  assert.match(geo.element("radar-location-feedback").textContent,/주변 편의점과 마트를 검색합니다/);
  assert.equal(opts.enableHighAccuracy,true);
  assert.ok(opts.timeout>=12000);
});

test("GPS failures show actionable, local permission/location messages",()=>{
  for(const [errorCode,expected] of [
    [1,/위치 권한이 차단/],[2,/기기 위치 서비스/],[3,/시간이 초과/],[99,/위치를 확인하지 못/]
  ]){
    let started=0;
    const geo=harness({stubView:true,navigator:{geolocation:{
      getCurrentPosition(ok,fail){fail({code:errorCode});}
    }}});
    geo.showGeolocate(()=>started++);
    assert.equal(started,0);
    assert.equal(geo.element("radar-geolocate").disabled,false);
    assert.match(geo.element("radar-location-feedback").textContent,expected);
  }
  const denied=harness({stubView:true,navigator:{}});
  denied.showGeolocate(()=>{throw Error("must not search");});
  assert.match(denied.element("radar-location-feedback").textContent,/브라우저에서는 위치 확인을 사용할 수 없습니다/);
  const insecure=harness({stubView:true,window:{isSecureContext:false},navigator:{geolocation:{}}});
  insecure.showGeolocate(()=>{throw Error("must not search");});
  assert.match(insecure.element("radar-location-feedback").textContent,/HTTPS/);
});

test("GPS button reports pending searches instead of silently ignoring taps",()=>{
  let calls=0;
  const geo=harness({stubView:true,navigator:{geolocation:{
    getCurrentPosition(){calls++;}
  }}});
  geo.state.searching=true;
  geo.showGeolocate(()=>{throw Error("search must not overlap");});
  assert.equal(calls,0);
  assert.match(geo.element("radar-location-feedback").textContent,/검색이 끝나면/);
  const html=read("card-radar.html"),css=read("card-radar.css");
  assert.match(html,/id="radar-location-feedback"/);
  assert.match(css,/\.radar-location-feedback:empty\{display:none\}/);
  assert.match(source,/byId\("radar-geolocate"\)\.addEventListener\("click",\(\)=>showGeolocate\(\)\)/);
});

test("nearby text locality routes Seven-Eleven and Emart24 to the selected district",()=>{
  const {normalizeRetailerArea,endpoint,state}=harness();
  state.center={lat:37.35,lng:127.10};
  const area=normalizeRetailerArea({address:{
    city:"성남시",city_district:"분당구",suburb:"금곡동",state:"경기도"
  }});
  assert.equal(area,"금곡동","prefer the selected neighborhood over wide district");
  assert.equal(normalizeRetailerArea({address:{city_district:"분당구"}}),"분당");
  assert.equal(normalizeRetailerArea({address:{town:"서현동",state:"경기도"}}),"서현동");
  assert.equal(normalizeRetailerArea({address:{state:"Gyeonggi-do"}}),"");
  const seven=new URL(endpoint("seveneleven","인페르노X",area));
  assert.equal(seven.searchParams.get("storeKeyword"),"금곡동");
  assert.equal(seven.searchParams.get("keyword"),"인페르노X");
  assert.equal(seven.searchParams.get("lat"),null,"Seven-Eleven ignores lat/lng upstream");
  const emart=new URL(endpoint("emart24","인페르노X",area));
  assert.equal(emart.searchParams.get("storeKeyword"),"금곡동");
  assert.equal(emart.searchParams.get("lat"),"37.35000");
  const gs25=new URL(endpoint("gs25","인페르노X",area));
  assert.equal(gs25.searchParams.get("storeKeyword"),null);
  assert.equal(gs25.searchParams.get("lat"),"37.35000");
  assert.match(source,/const stockTask = fetchLiveInventory\(jobs,areaTask\)/);
  assert.match(source,/SEVENELEVEN_LOCALITY_UNAVAILABLE/);
  assert.match(source,/nominatim[.]openstreetmap[.]org\/reverse/);
});

test("public stock rows cannot attach to a different convenience or mart chain",()=>{
  const {sameRetailerForStock,state,mergeInventory}=harness();
  state.kind="all";state.center={lat:37.35,lng:127.1};
  state.radiusKm=3;state.martBrand="all";state.convenienceBrand="all";
  state.masterShops=[];state.publicShops=[];state.retailerShops=[];state.curatedShops=[];
  state.martInventory=[];
  const known={id:"STORE123",kind:"convenience",retailerId:"cu",
    name:"중앙점",chain:"CU",lat:37.3501,lng:127.1001,
    items:[{name:"포켓몬카드 인페르노X",code:"m2",quantity:2,checkedAt:new Date().toISOString(),provider:"CU"}]};
  const different={id:"osm:gs",kind:"convenience",name:"중앙점",
    chain:"GS25",lat:37.35012,lng:127.10012,verifiedInventory:[]};
  assert.equal(sameRetailerForStock(different,known),false);
  const same={id:"osm:cu",kind:"convenience",name:"중앙점",
    chain:"CU",lat:37.3502,lng:127.1002,verifiedInventory:[]};
  assert.equal(sameRetailerForStock(same,known),true);
  assert.equal(sameRetailerForStock(
    {kind:"mart",chain:"롯데마트",name:"중앙점"},known),false);
  state.inventory=[known];
  const stores=mergeInventory([different,same]);
  assert.equal(stores.length,2,"same retailer should merge, different retailer should stay separate");
  assert.equal(stores.find(x=>x.chain==="GS25").verifiedInventory.length,0);
  assert.equal(stores.find(x=>x.chain==="CU").verifiedInventory.length,1);
});

test("Emart24 resolves PLU candidate by selected code and keeps store coordinates",()=>{
  const {parseRetail,state}=harness();
  state.center={lat:37.35391,lng:127.11091};state.radiusKm=3;
  const time=new Date().toISOString();
  const base={success:true,data:{
    pluCd:"SKU-224",goodsInfo:null,
    productCandidates:[
      {pluCd:"SKU-111",goodsName:"포켓몬카드 메가브레이브 부스터팩"},
      {pluCd:"SKU-224",goodsName:"포켓몬카드 인페르노X 부스터팩"}],
    stores:[{bizNo:"42",storeName:"이마트24 금곡점",bizQty:6,
      latitude:37.35392,longitude:127.11092}],
    nearbyStores:[]}};
  const matches=parseRetail("emart24",base,time,"인페르노X");
  assert.equal(matches.length,1);
  assert.equal(matches[0].items[0].retailerSku,"SKU-224");
  assert.equal(matches[0].items[0].quantity,6);
  assert.equal(matches[0].lat,37.35392);
  assert.equal(parseRetail("emart24",base,time,"메가브레이브").length,0);
  const wronglyLinked=JSON.parse(JSON.stringify(base));
  wronglyLinked.data.goodsInfo={pluCd:"SKU-111",goodsNm:"포켓몬카드 인페르노X 부스터팩"};
  assert.equal(parseRetail("emart24",wronglyLinked,time,"인페르노X").length,0,
    "do not show counts when source product and selected SKU disagree");
});

test("Emart24 preserves fallback location when only stock row is geocoded",()=>{
  const {parseRetail,state}=harness();
  state.center={lat:37.35,lng:127.1};state.radiusKm=3;
  const payload={success:true,data:{
    pluCd:"9909",goodsInfo:{goodsNm:"포켓몬카드 닌자스피너"},
    nearbyStores:{stores:[{storeCode:"x",latitude:36.0,longitude:127.1}]},
    stores:[{bizNo:"701",storeName:"이마트24 지점",latitude:37.3501,
      longitude:127.1002,bizQty:0}]}};
  const parsed=parseRetail("emart24",payload,new Date().toISOString(),"닌자스피너");
  assert.equal(parsed.length,1);
  assert.equal(parsed[0].items[0].quantity,0,"actual zero is preserved, not invented");
  assert.equal(parsed[0].lat,37.3501);
});

test("stock product identity uses retailer SKU when present and normalized name otherwise",()=>{
  const {groupInventoryRows,stockProductIdentity,stockProductCount,state}=harness();
  const now=new Date().toISOString();
  const older=new Date(Date.now()-60000).toISOString();
  const productA={name:"포켓몬카드 인페르노X 팩",retailerSku:"88000123",quantity:2,
    code:"m2",provider:"이마트24",checkedAt:older};
  const productB={name:"포켓몬카드 인페르노X 부스터팩",retailerSku:"88000123",quantity:5,
    code:"m2",provider:"이마트24",checkedAt:now};
  const first={id:"701",kind:"convenience",retailerId:"emart24",name:"테스트점",
    items:[productA]};
  const second={...first,items:[productB]};
  const grouped=groupInventoryRows([first,second]);
  assert.equal(grouped.length,1);
  assert.equal(grouped[0].items.length,1,"same retailer SKU must count once");
  assert.equal(grouped[0].items[0].quantity,5,"keep latest observation");
  assert.equal(stockProductIdentity(productA),stockProductIdentity(productB));
  assert.equal(stockProductIdentity({name:"포켓몬카드 닌자스피너  팩"}),
    stockProductIdentity({name:" 포켓몬카드 닌자스피너팩 "}));
  state.pack="";
  assert.equal(stockProductCount({verifiedInventory:[productA,productB]}),1);
});

test("Emart24 retries district after local neighborhood 500 but not after 403/429",()=>{
  const {normalizeRetailerArea,normalizeRetailerDistrict,emart24FallbackArea}=harness();
  const address={address:{suburb:"금곡동",city_district:"분당구",city:"성남시"}};
  assert.equal(normalizeRetailerArea(address),"금곡동");
  assert.equal(normalizeRetailerDistrict(address),"분당");
  assert.equal(emart24FallbackArea("emart24",new Error("HTTP 500"),"금곡동","분당"),"분당");
  assert.equal(emart24FallbackArea("emart24",new Error("HTTP 503"),"금곡동","분당"),"분당");
  assert.equal(emart24FallbackArea("emart24",new Error("HTTP 403"),"금곡동","분당"),"");
  assert.equal(emart24FallbackArea("emart24",new Error("HTTP 429"),"금곡동","분당"),"");
  assert.equal(emart24FallbackArea("seveneleven",new Error("HTTP 500"),"금곡동","분당"),"");
  assert.equal(emart24FallbackArea("emart24",new Error("HTTP 500"),"분당","분당"),"");
  assert.equal(emart24FallbackArea("emart24",new Error("HTTP 500"),"금곡동",""),"");
  assert.match(source,/const wider=emart24FallbackArea\(task\.provider,error,/);
  assert.match(source,/emart24PreferDistrict=true/);
  assert.match(source,/retailerAreaCache\.set\(key,\{keyword,district:/);
  assert.match(source,/const keyword=input[.]length>1[?]input:normalizeRetailerArea\(data\)/);
  assert.match(source,/return input[.]length>1[?]input:""/);
});

test("official stock app links map to verified retailer applications only",()=>{
  const {officialStockApp}=harness();
  assert.equal(officialStockApp({kind:"convenience",retailerId:"cu"}),
    "https://play.google.com/store/apps/details?id=com.bgfcu.membership");
  assert.equal(officialStockApp({kind:"convenience",retailerId:"gs25"}),
    "https://play.google.com/store/apps/details?id=com.gsr.gs25");
  assert.equal(officialStockApp({kind:"convenience",retailerId:"seveneleven"}),
    "https://play.google.com/store/apps/details?id=kr.co.kork7app");
  assert.equal(officialStockApp({kind:"convenience",retailerId:"emart24"}),
    "https://play.google.com/store/apps/details?id=kr.co.emart24.everse");
  assert.equal(officialStockApp({kind:"convenience",retailerId:"other"}),"");
  assert.equal(officialStockApp({kind:"mart",retailerId:"emart24"}),"");
  assert.match(source,/공식 앱에서 확인/);
  assert.match(source,/이 상품과 매장을 직접 검색해 확인하세요/);
});

test("same CU shop code joins source stock despite name aliases; wrong brands or far codes do not",()=>{
  const {parseCuStoreDirectory,mergeInventory,state}=harness();
  state.center={lat:37.35,lng:127.1};state.radiusKm=3;
  state.kind="all";state.convenienceBrand="all";state.martBrand="all";
  state.masterShops=[];state.publicShops=[];state.retailerShops=[];state.curatedShops=[];
  state.martInventory=[];state.mapChecked=false;state.searching=true;
  const directory=parseCuStoreDirectory({success:true,data:{stores:[{
    storeCode:"CU-9223",storeName:"CU 금곡역사점",
    latitude:37.35011,longitude:127.10011
  }]}});
  assert.equal(directory.length,1);
  assert.equal(directory[0].storeId,"CU-9223");
  const observedAt=new Date().toISOString();
  state.inventory=[{id:"CU-9223",kind:"convenience",retailerId:"cu",
    chain:"CU",name:"CU 역사점",lat:37.35014,lng:127.10014,
    inventorySource:"public-aggregator",
    items:[{name:"포켓몬카드 인페르노X 부스터팩",provider:"CU",code:"m2",
      quantity:3,checkedAt:observedAt,inventorySource:"public-aggregator"}]}];
  let joined=mergeInventory(directory);
  assert.equal(joined.length,1,"exact retailer store code should override name variations");
  assert.equal(joined[0].verifiedInventory[0].quantity,3);

  const wrongChain={...directory[0],retailerId:"gs25",chain:"GS25"};
  joined=mergeInventory([wrongChain]);
  assert.equal(joined.length,2,"wrong retailer's identical store ID must not be joined");
  assert.equal(joined.find(x=>x.retailerId==="gs25").verifiedInventory.length,0);

  const remote={...directory[0],lat:37.36,lng:127.10};
  joined=mergeInventory([remote]);
  assert.equal(joined.length,2,"code collisions far apart must not merge");
});

test("inventory merging uses retailer product code for same-SKU aliases",()=>{
  const {mergeInventory,state}=harness();
  state.center={lat:37.35,lng:127.1};state.radiusKm=3;
  state.kind="all";state.convenienceBrand="all";state.martBrand="all";
  state.masterShops=[];state.publicShops=[];state.retailerShops=[];state.curatedShops=[];
  const when=new Date().toISOString();
  const first={name:"포켓몬카드 인페르노X 팩",retailerSku:"123456789",
    provider:"이마트24",code:"m2",quantity:4,checkedAt:when};
  const second={...first,name:"포켓몬카드 인페르노X 부스터팩",quantity:2};
  const store={id:"external-221",kind:"convenience",retailerId:"emart24",
    name:"이마트24 금곡점",chain:"이마트24",lat:37.3502,lng:127.1002,
    verifiedInventory:[{...first}]};
  state.inventory=[{id:"external-221",kind:"convenience",retailerId:"emart24",
    name:"이마트24 금곡점",chain:"이마트24",lat:37.3502,lng:127.1002,
    inventorySource:"public-aggregator",items:[second]}];
  state.martInventory=[];
  const result=mergeInventory([store]);
  assert.equal(result.length,1);
  assert.equal(result[0].verifiedInventory.length,1,"one retailer SKU cannot count twice");
});
