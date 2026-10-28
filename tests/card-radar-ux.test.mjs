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
    ...(options.mockFetch ? ["fetchJson=globalThis.__mockRadarFetch;"] : []),
    ...(options.district ? ["retailerDistrictFallback="+JSON.stringify(options.district)+";"] : []),
    "globalThis.__radarTests = {isCardProduct, inventoryLabel, showGeolocate, geolocationErrorMessage,",
    "stockProductUnit,radarSnapshotKey,rememberRadarSnapshot,restoreRadarSnapshot,readCachedRetailer,saveCachedRetailer,parseRetail, matchesRequestedCardProduct, stockProductIdentity, groupInventoryRows, mergeInventory, sameRetailerForStock, officialStockApp, normalizeRetailerArea, normalizeRetailerDistrict, emart24FallbackArea, endpoint, inventoryJobs, updateProviderCircuit, providerFailureCategory, recordProviderOutcome, providerDiagnosticSummary, renderProviderDiagnostics, updateProgress, completeProgressStep, schedulePackRefresh, filterStoresForDisplay, category, parseShops, categoryQuery, parseCuStoreDirectory, storeCandidates, shouldOfferMapSearch, liveQueries, martBrand, martBrandLabel, selectedKind, stockProductCount, trustedMartLink, martLookup, parseApprovedMartFeed, fetchLiveInventory, packFromTitle, PRODUCTS, BOX_PRODUCTS, DEFAULT_PRODUCTS, parseOfficialVending, loadOfficialVending, state};",
    "})();",
  ].join("\n"));
  assert.notEqual(body, source, "script test hook insertion");
  const sandbox = { document, window: options.window || {}, navigator: options.navigator || {}, console, URL, URLSearchParams, Date, Math, __mockRadarFetch: options.mockFetch };
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
  assert.equal(inventoryJobs().length,48);
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
  assert.deepEqual([...liveQueries()], ["메가심포니아","사이버저지",
    "와일드포스","조로아&조로아크","30th CELEBRATION","스톰에메랄다",
    "어비스아이","닌자스피너","니힐제로","MEGA드림ex",
    "인페르노X","메가브레이브"]);
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
  assert.equal(inventoryJobs().length,12);
  assert.ok(inventoryJobs().every(x=>x.provider==="gs25"));
  state.convenienceBrand="emart24";
  assert.equal(inventoryJobs().length,12);
  assert.ok(inventoryJobs().every(x=>x.provider==="emart24"));
  state.convenienceBrand="other";
  assert.equal(inventoryJobs().length,0);
  state.convenienceBrand="all";
  assert.equal(inventoryJobs().length,48);
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
  assert.match(html,/자동탐색은 주요 12종부터 조회합니다/);
  assert.match(source,/product[.]addEventListener\("change",\(\)=>\{[\s\S]*?schedulePackRefresh\(\)/);
  assert.match(source,/if\(state[.]packRefreshPending\)\{[\s\S]*?void search\(\)/);
  assert.match(source,/state[.]hasSearched = true/);
  const {state,liveQueries}=harness();
  state.pack="starter-zoroark";
  assert.deepEqual([...liveQueries()],["조로아&조로아크"]);
  state.pack="m6";
  assert.deepEqual([...liveQueries()],["스톰에메랄다"]);
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
  assert.equal(directory[0].verifiedInventory.length,0,"merge must not mutate original location candidates");

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

test("all 12 supported products are searched without generic guessing",()=>{
  const {liveQueries,inventoryJobs,state}=harness();
  state.pack="";state.kind="all";
  const queries=[...liveQueries()];
  assert.equal(queries.length,12);
  assert.equal(new Set(queries).size,12);
  assert.ok(!queries.includes("포켓몬카드 부스터팩"));
  const jobs=[...inventoryJobs()];
  assert.equal(jobs.length,48);
  assert.equal(new Set(jobs.slice(0,4).map(x=>x.provider)).size,4,
    "distribute requests among providers instead of bursts");
  state.kind="convenience";state.convenienceBrand="cu";
  assert.equal(inventoryJobs().length,12);
  state.pack="m6a";
  assert.equal(inventoryJobs().length,1);
  state.kind="mart";
  assert.equal(inventoryJobs().length,0);
});
test("provider circuit breaker halts rate-limited, stock-unavailable, and repeated 5xx",()=>{
  const {updateProviderCircuit}=harness();
  const blocked=new Set(),failures=new Map();
  assert.equal(updateProviderCircuit(blocked,failures,"seveneleven",new Error("STOCK_UNAVAILABLE")),true);
  assert.equal(blocked.has("seveneleven"),true);
  assert.equal(updateProviderCircuit(blocked,failures,"gs25",new Error("HTTP 429")),true);
  assert.equal(blocked.has("gs25"),true);
  assert.equal(updateProviderCircuit(blocked,failures,"cu",new Error("HTTP 500")),false);
  assert.equal(updateProviderCircuit(blocked,failures,"cu",new Error("HTTP 502")),true);
  assert.equal(blocked.has("cu"),true);
  assert.equal(updateProviderCircuit(blocked,failures,"emart24",new Error("HTTP 503")),false);
  failures.set("emart24",0);
  assert.equal(updateProviderCircuit(blocked,failures,"emart24",new Error("HTTP 503")),false);
  assert.equal(updateProviderCircuit(blocked,failures,"emart24",new Error("HTTP 403")),false);
  assert.equal(blocked.has("emart24"),false);
  assert.match(source,/if\(brokenProviders[.]has\(task[.]provider\) \|\| Date[.]now\(\)>=deadline\)\{/);
  assert.match(source,/completeProgressStep\(false,"재고 조회 중",false\)/);
});


test("GS25 does not display keyword-only counts without a selected product SKU",()=>{
  const {parseRetail,state}=harness();
  state.center={lat:37.55,lng:127.05};state.radiusKm=3;
  const shop={storeCode:"GS-001",storeName:"GS25 검증점",
    latitude:37.5501,longitude:127.0501,searchItemName:"포켓몬카드 인페르노X",
    realStockQuantity:8};
  const payload={success:true,data:{
    itemCodeUsed:false,itemCode:null,
    product:{name:"포켓몬카드 인페르노X"},
    inventory:{stores:[shop]}
  }};
  const now=new Date().toISOString();
  assert.equal(parseRetail("gs25",payload,now,"인페르노X").length,0,
    "GS25 keyword fallback does not prove exact SKU stock");
  payload.data.itemCodeUsed=true;
  payload.data.itemCode="8800999201";
  assert.equal(parseRetail("gs25",payload,now,"인페르노X").length,1,
    "selected SKU and matching name support a qualified public stock reading");
  assert.equal(parseRetail("gs25",payload,now,"인페르노X")[0].items[0].retailerSku,"8800999201");
  payload.data.itemCode="???";
  assert.equal(parseRetail("gs25",payload,now,"인페르노X").length,0,
    "invalid resolved SKU must not be treated as confirmed");
});

test("GS25 returned selected product and per-store item may not disagree",()=>{
  const {parseRetail,state}=harness();
  state.center={lat:37.55,lng:127.05};state.radiusKm=3;
  const original={success:true,data:{
    itemCodeUsed:true,itemCode:"GS543210",
    product:{name:"포켓몬카드 메가브레이브 부스터팩"},
    inventory:{stores:[{storeCode:"S999",storeName:"GS25 검증점",
      latitude:37.5501,longitude:127.0501,
      searchItemName:"포켓몬카드 인페르노X 부스터팩",realStockQuantity:9}]}
  }};
  const now=new Date().toISOString();
  assert.equal(parseRetail("gs25",original,now,"인페르노X").length,0,
    "per-shop keyword cannot override different selected product");
  const matched={...original,data:{...original.data,
    product:{name:"포켓몬카드 인페르노X 부스터팩"}}};
  assert.equal(parseRetail("gs25",matched,now,"인페르노X").length,1);
  matched.data.inventory.stores[0].searchItemName="포켓몬카드 메가브레이브";
  assert.equal(parseRetail("gs25",matched,now,"인페르노X").length,0,
    "same selected SKU with conflicting store product must be quarantined");
});

test("Emart24 matching PLU with contradictory candidate and goods names is rejected",()=>{
  const {parseRetail,state}=harness();
  state.center={lat:37.55,lng:127.05};state.radiusKm=3;
  const base={success:true,data:{pluCd:"PLU5544",
    goodsInfo:{pluCd:"PLU5544",goodsName:"포켓몬카드 인페르노X 부스터팩"},
    productCandidates:[{pluCd:"PLU5544",goodsName:"포켓몬카드 메가브레이브 부스터팩"}],
    stores:[{bizNo:"ST1",storeName:"이마트24 검증점",bizQty:5,
      latitude:37.5501,longitude:127.0501}],nearbyStores:[]}};
  const now=new Date().toISOString();
  assert.equal(parseRetail("emart24",base,now,"인페르노X").length,0);
  base.data.productCandidates[0].goodsName="포켓몬카드 인페르노X 부스터팩";
  assert.equal(parseRetail("emart24",base,now,"인페르노X").length,1);
});


test("per-retailer progress distinguishes zero, unknown product, unavailable upstream and skipped work",()=>{
  const {state,element,providerFailureCategory,recordProviderOutcome,
    providerDiagnosticSummary,renderProviderDiagnostics,completeProgressStep}=harness();
  assert.equal(providerFailureCategory(new Error("STOCK_UNAVAILABLE")),"stock_unavailable");
  assert.equal(providerFailureCategory(new Error("PRODUCT_SKU_UNVERIFIED")),"product_unverified");
  assert.equal(providerFailureCategory(new Error("PRODUCT_SKU_CONFLICT")),"product_unverified");
  assert.equal(providerFailureCategory(new Error("HTTP 429")),"rate_limited");
  assert.equal(providerFailureCategory(new Error("HTTP 500")),"server_error");
  assert.equal(providerFailureCategory(new Error("HTTP 502")),"server_error");
  assert.equal(providerFailureCategory(new Error("HTTP 403")),"http_error");
  assert.equal(providerFailureCategory(new Error("network error")),"other_error");
  assert.match(providerDiagnosticSummary(),/검색 후 브랜드별/);
  recordProviderOutcome("cu","success",[
    {items:[{quantity:0}]},{items:[{quantity:3}]}]);
  recordProviderOutcome("cu","success",[]);
  recordProviderOutcome("cu","failure",[],new Error("HTTP 429"));
  recordProviderOutcome("cu","skipped");
  recordProviderOutcome("gs25","failure",[],new Error("PRODUCT_SKU_UNVERIFIED"));
  recordProviderOutcome("seveneleven","failure",[],new Error("STOCK_UNAVAILABLE"));
  const summary=providerDiagnosticSummary();
  assert.match(summary,/CU: 조회 3건/);
  assert.match(summary,/양수 재고 응답 1행/);
  assert.match(summary,/수량 0 응답 1행/);
  assert.match(summary,/상품 일치 응답 없음 1건/);
  assert.match(summary,/호출 제한 1건/);
  assert.match(summary,/자동 생략 1건/);
  assert.match(summary,/GS25: 조회 1건/);
  assert.match(summary,/상품코드 검증 실패 1건/);
  assert.match(summary,/세븐일레븐: 조회 1건/);
  assert.match(summary,/재고 데이터 미제공 1건/);
  renderProviderDiagnostics();
  assert.equal(element("radar-provider-diagnostics").textContent,summary);
  state.progress={total:4,completed:0,successes:0,failures:0,active:true,skipped:1};
  completeProgressStep(true,"재고 조회 중");
  completeProgressStep(false,"재고 조회 중",false);
  assert.match(element("radar-progress-detail").textContent,/재고 확인 처리 1건/);
  assert.match(element("radar-progress-detail").textContent,/자동 생략 1건/);
  assert.equal(state.progress.failures,0,"skipped work is not a failed API response");
});

test("the mobile coverage panel explains retailer source status and stock age honestly",()=>{
  const {state,inventoryLabel}=harness();
  const html=read("card-radar.html"),css=read("card-radar.css");
  assert.match(html,/id="radar-provider-diagnostics"/);
  assert.match(html,/판매처별 공개 재고 조회 응답/);
  assert.match(html,/수량 0 응답은 해당 상품을 조회한 응답/);
  assert.match(css,/rada[r]-provider-diagnostics/);
  const shop={verifiedInventory:[{name:"포켓몬카드 인페르노X",
    code:"m2",provider:"GS25",inventorySource:"public-aggregator",
    quantity:2,checkedAt:new Date().toISOString()}]};
  state.pack="";
  const label=inventoryLabel(shop);
  assert.equal(label.known,true);
  assert.match(label.detail,/응답 수신/);
  assert.match(label.detail,/원본 갱신시각 미확인/);
  assert.doesNotMatch(label.detail,/공식 판매처 실시간 갱신/);
});

test("default 10km and bounded 12-product full scan",()=>{
  const {state,inventoryJobs,liveQueries,stockProductUnit}=harness();
  assert.equal(state.radiusKm,10);
  assert.equal(liveQueries().length,12);
  assert.equal(inventoryJobs().length,48);
  assert.equal(stockProductUnit("확장팩"),"팩");
  assert.equal(stockProductUnit("부스터 박스"),"박스");
  state.pack="sv10";assert.equal(inventoryJobs().length,4);
});

test("retailer reply cache preserves original timestamp and expires",()=>{
  const {readCachedRetailer,saveCachedRetailer}=harness();
  const now=Date.now(),key="10|test";
  saveCachedRetailer(key,{success:true,data:{}},new Date(now).toISOString(),now);
  assert.equal(readCachedRetailer(key,now+1000).checkedAt,new Date(now).toISOString());
  assert.equal(readCachedRetailer(key,now+60001),null);
});

test("previous snapshot cannot count as current positive stock",()=>{
  const {state,radarSnapshotKey,rememberRadarSnapshot,restoreRadarSnapshot,inventoryLabel}=harness();
  state.center={lat:37.5,lng:127};state.radiusKm=10;
  state.shops=[];state.retailerShops=[];state.publicShops=[];state.masterShops=[];
  state.inventory=[{inventorySource:"public-aggregator",items:[{
    name:"포켓몬카드 인페르노X 확장팩",code:"m2",quantity:3,
    checkedAt:new Date().toISOString(),inventorySource:"public-aggregator"
  }]}];
  const key=radarSnapshotKey(),now=Date.now();
  rememberRadarSnapshot(key,now);
  state.inventory=[];assert.equal(restoreRadarSnapshot(key,now+1000),true);
  const summary=inventoryLabel({verifiedInventory:state.inventory[0].items});
  assert.equal(summary.known,false);assert.match(summary.detail,/이전 조회/);
});


test("multi-retailer scan never overlaps requests from the same retailer", async () => {
  const active=new Map();
  const counts=new Map();
  let sameRetailerOverlap=false;
  let peakProviders=0;
  const fakeFetch=async (url)=>{
    const provider=new URL(url).pathname.split("/")[2];
    const current=(active.get(provider)||0)+1;
    active.set(provider,current);
    if(current>1)sameRetailerOverlap=true;
    peakProviders=Math.max(peakProviders,[...active.values()].filter(Boolean).length);
    await new Promise(resolve=>setImmediate(resolve));
    active.set(provider,current-1);
    counts.set(provider,(counts.get(provider)||0)+1);
    return {success:true,data:{
      inventory:{available:true,stores:[]},nearbyStores:{stores:[]},
      itemCodeUsed:true,itemCode:"880001",product:{name:"포켓몬카드 인페르노X"}
    }};
  };
  const {fetchLiveInventory,state}=harness({stubView:true,mockFetch:fakeFetch});
  state.center={lat:37.5,lng:127.0};state.radiusKm=3;
  state.progress={completed:0,total:4,successes:0,failures:0,active:true};
  const jobs=[
    {provider:"cu",keyword:"인페르노X"},
    {provider:"gs25",keyword:"인페르노X"},
    {provider:"cu",keyword:"닌자스피너"},
    {provider:"gs25",keyword:"닌자스피너"}
  ];
  await fetchLiveInventory(jobs,Promise.resolve(""));
  assert.equal(sameRetailerOverlap,false);
  assert.ok(peakProviders>=2,"independent retailers can be queried concurrently");
  assert.equal(counts.get("cu"),2);
  assert.equal(counts.get("gs25"),2);
  assert.equal(state.progress.completed,4);
});

test("scan completion clearly distinguishes partial coverage from zero stock",()=>{
  assert.match(source,/stockAttempted<stockRequested/);
  assert.match(source,/stockSkipped>0/);
  assert.match(source,/외부 조회 수량은 공식 실재고를 보장하지 않으며/);
});

test("radar overview shows only nearby stores and positive-stock stores, not request counts",()=>{
  const html=read("card-radar.html");
  const summary=html.slice(html.indexOf('<div class="radar-metrics"'),html.indexOf('<details class="radar-coverage"'));
  assert.match(summary,/주변 매장/);
  assert.match(summary,/재고 있는 매장/);
  assert.match(summary,/카드 재고 1개 이상 조회된 곳/);
  assert.doesNotMatch(summary,/재고 확인|검색 완료|검색 실패/);
  const details=html.slice(html.indexOf('<details class="radar-coverage"'),html.indexOf("</details>"));
  assert.match(details,/id="radar-search-completed"/);
  assert.match(details,/id="radar-search-failed"/);
  assert.match(details,/id="radar-coverage-search-note"/);
  const render=source.slice(source.indexOf("  function render() {"),source.indexOf("  async function search()"));
  assert.match(render,/byId\("radar-stock-checked"\)[.]textContent = state[.]kind==="vending"\?"—":\s*hasResults \? String\(inStockStores[.]length\)/);
  assert.doesNotMatch(render,/filter\(\(store\) => inventoryLabel\(store\)[.]checked\)[.]length/);
});

test("radar hides redundant result-banner and map advisory without losing details or errors",()=>{
  const html=read("card-radar.html");
  const css=read("card-radar.css");
  assert.doesNotMatch(html,/id="radar-map-mode-note"/);
  assert.doesNotMatch(source,/byId\("radar-map-mode-note"\)/);
  assert.match(html,/<p id="radar-status" class="radar-status" role="status" aria-live="polite"><\/p>/);
  assert.match(css,/[.]radar-status:empty\{display:none\}/);
  assert.match(source,/byId\("radar-coverage-search-note"\)[.]textContent/);
  assert.match(source,/setStatus\("",false\)/);
});

test("Yangyang public Emart24 starter-set SKU is included in full search and can render",()=>{
  const {state,liveQueries,parseRetail,inventoryLabel,mergeInventory,stockProductUnit}=harness();
  state.center={lat:38.15,lng:128.60};
  state.radiusKm=10;
  state.kind="all";
  state.pack="";
  state.masterShops=[];state.retailerShops=[];state.publicShops=[];
  state.shops=[];state.curatedShops=[];state.martInventory=[];
  assert.ok(liveQueries().includes("조로아&조로아크"));
  const sample={success:true,data:{
    pluCd:"8800286279914",
    goodsInfo:{pluCd:"8800286279914",
      goodsName:"포켓몬)포켓몬카드(메가스타터세트 조로아&조로아크ex)"},
    productCandidates:[{pluCd:"8800286279914",
      goodsName:"포켓몬)포켓몬카드(메가스타터세트 조로아&조로아크ex)"}],
    stores:[{bizNo:"27927",storeName:"양양물치항점",
      latitude:38.1501,longitude:128.6001,bizQty:1}],
    nearbyStores:[{storeCode:"27927",storeName:"양양물치항점",
      latitude:38.1501,longitude:128.6001}]
  }};
  const results=parseRetail("emart24",sample,new Date().toISOString(),"조로아&조로아크");
  assert.equal(results.length,1);
  assert.equal(results[0].items[0].code,"starter-zoroark");
  assert.equal(stockProductUnit(results[0].items[0].name),"덱");
  state.inventory=results;
  const merged=mergeInventory([]);
  assert.equal(merged.length,1);
  assert.equal(inventoryLabel(merged[0]).known,true);
  state.pack="starter-zoroark";
  assert.deepEqual([...liveQueries()],["조로아&조로아크"]);
  assert.equal(inventoryLabel(merged[0]).known,true);
  state.pack="m6";
  assert.equal(inventoryLabel(merged[0]).known,false);
});

test("older packs visible on public store screens join default named-product search",()=>{
  const {liveQueries,state}=harness();
  state.pack="";
  assert.ok(liveQueries().includes("사이버저지"));
  assert.ok(liveQueries().includes("와일드포스"));
  assert.ok(liveQueries().includes("메가심포니아"));
  assert.equal(new Set([...liveQueries()]).size,12);
});

test("Myeongdong Seven-Eleven publicly returned 30, 240, 30; parser and stock counter preserve values",()=>{
  const {parseRetail,state,liveQueries,mergeInventory,inventoryLabel}=harness();
  state.center={lat:37.5633,lng:126.9837};state.radiusKm=3;
  state.kind="all";state.pack="";
  state.masterShops=[];state.retailerShops=[];state.publicShops=[];
  state.shops=[];state.curatedShops=[];state.martInventory=[];
  const names=[["메가심포니아",30,"m1S"],["사이버저지",240,"sv5m"],["와일드포스",30,"sv5k"]];
  const now=new Date().toISOString();
  const rows=[];
  for(const [name,quantity,code] of names){
    const payload={success:true,data:{
      stockAvailable:true,product:{itemName:"비젼)포켓몬확장팩("+name+")_H",itemCode:"880-"+code},
      inventory:{stores:[{storeName:"명동스카이호텔점",storeCode:"777",
        latitude:37.5634,longitude:126.9838,stockQuantity:quantity}]}
    }};
    const parsed=parseRetail("seveneleven",payload,now,name);
    assert.equal(parsed.length,1,name);
    assert.equal(parsed[0].items[0].code,code);
    assert.equal(parsed[0].items[0].quantity,quantity);
    rows.push(...parsed);
  }
  state.inventory=rows;
  const merged=mergeInventory([]);
  assert.equal(merged.length,1,"three positive products in one store count as one store");
  assert.equal(merged[0].verifiedInventory.length,3);
  assert.equal(inventoryLabel(merged[0]).known,true);
  state.pack="sv5m";
  assert.equal(inventoryLabel(merged[0]).known,true);
  assert.match(inventoryLabel(merged[0]).message,/240개/);
  state.pack="";
  const lookups=liveQueries();
  assert.deepEqual([...lookups].slice(0,4),["메가심포니아","사이버저지","와일드포스","조로아&조로아크"]);
});

test("Emart24 retries district when neighborhood search misses a stock-positive store",async()=>{
  const urls=[];
  const product="포켓몬)포켓몬카드(메가스타터세트 조로아&조로아크ex)";
  const fakeFetch=async url=>{
    urls.push(url);
    const area=new URL(url).searchParams.get("storeKeyword");
    const data={pluCd:"8800286279914",
      productCandidates:[{pluCd:"8800286279914",goodsName:product}],
      goodsInfo:{pluCd:"8800286279914",goodsName:product},
      stores:area==="양양"?[{
        bizNo:"27927",storeName:"양양물치항점",
        latitude:38.1501,longitude:128.6001,bizQty:1}]:[],
      nearbyStores:[]};
    return {success:true,data};
  };
  const {state,fetchLiveInventory,mergeInventory,inventoryLabel}=harness({
    mockFetch:fakeFetch,stubView:true,district:"양양"
  });
  state.center={lat:38.15,lng:128.60};state.radiusKm=10;
  state.progress={completed:0,total:1,successes:0,failures:0,active:true};
  await fetchLiveInventory([{provider:"emart24",keyword:"조로아&조로아크"}],
    Promise.resolve("물치리"));
  assert.deepEqual(urls.map(url=>new URL(url).searchParams.get("storeKeyword")),
    ["물치리","양양"]);
  assert.equal(state.inventory.length,1);
  const joined=mergeInventory([]);
  assert.equal(joined.length,1);
  assert.equal(inventoryLabel(joined[0]).known,true);
  assert.match(inventoryLabel(joined[0]).message,/1개/);
});


test("publicly listed retail stock catalog covers 62 unique pack box and starter selections",()=>{
  const {PRODUCTS,BOX_PRODUCTS,DEFAULT_PRODUCTS}=harness();
  assert.equal(PRODUCTS.length,62);
  assert.equal(DEFAULT_PRODUCTS.length,12);
  assert.equal(BOX_PRODUCTS.length,18);
  assert.equal(new Set(PRODUCTS.map(([code])=>code)).size,62);
  assert.equal(new Set(PRODUCTS.map(([,title])=>title)).size,62);
  const names=PRODUCTS.map(([,name])=>name);
  for(const title of ["30th CELEBRATION","스톰에메랄다","메가심포니아",
    "사이버저지","와일드포스","클레이버스트","이브이 히어로즈",
    "VSTAR 유니버스","스타버스","마천퍼펙트","백은의 랜스",
    "칠흑의 가이스트","MEGA 스타트 덱 100 배틀컬렉션",
    "MEGA 스타터 세트 ex 나오하&마스카나 ex",
    "MEGA 스타터 세트 ex 이브이 ex",
    "MEGA 스타터 세트 ex 조로아&조로아크 ex",
    "MEGA 스페셜 카드 세트 메가엘레이드 ex",
    "MEGA ex 스페셜 세트",
    "배틀파트너즈 박스","어비스아이 박스",
    "테라스탈 페스타 ex 박스","나이트원더러 박스"]){
    assert.ok(names.includes(title),"missing public retail listing: "+title);
  }
  const html=read("card-radar.html");
  assert.match(html,/62종에서 선택/);
  assert.match(source,/make\("optgroup",""\)/);
  assert.match(source,/확장팩 · 낱팩/);
  assert.match(source,/부스터 박스/);
});

test("retailer package types never inflate boxes from individual packs",()=>{
  const {state,packFromTitle,parseRetail,stockProductUnit,inventoryLabel}=harness();
  state.center={lat:37.5633,lng:126.9837};state.radiusKm=5;
  assert.equal(packFromTitle("포켓몬확장팩(메가심포니아)"),"m1S");
  assert.equal(packFromTitle("포켓몬카드 메가심포니아 박스"),"m1S-box");
  assert.equal(packFromTitle("메가심포니아 30팩입"),"m1S-box");
  assert.equal(packFromTitle("포켓몬카드 MEGA 스타터세트 조로아&조로아크 ex"),
    "starter-zoroark");
  assert.equal(packFromTitle("포켓몬카드 MEGA 스타트덱 100 배틀컬렉션"),
    "retail-start100");
  assert.equal(stockProductUnit("포켓몬 확장팩 메가심포니아 박스"),"박스");
  const time=new Date().toISOString();
  const response=(name,qty)=>({success:true,data:{
    stockAvailable:true,product:{itemName:name,itemCode:name.includes("박스")?"BOX01":"PACK01"},
    inventory:{stores:[{storeCode:"S000",storeName:"명동스카이호텔점",
      latitude:37.5634,longitude:126.9838,stockQuantity:qty}]}
  }});
  const loose=parseRetail("seveneleven",
    response("비젼)포켓몬확장팩(메가심포니아)",30),time,"메가심포니아");
  assert.equal(loose[0].items[0].code,"m1S");
  state.pack="m1S-box";
  assert.equal(inventoryLabel({verifiedInventory:loose[0].items}).known,false);
  const box=parseRetail("seveneleven",
    response("포켓몬카드 메가심포니아 박스",2),time,"메가심포니아");
  assert.equal(box[0].items[0].code,"m1S-box");
  assert.equal(inventoryLabel({verifiedInventory:box[0].items}).known,true);
  assert.match(inventoryLabel({verifiedInventory:box[0].items}).message,/2개/);
  state.pack="m1S";
  assert.equal(inventoryLabel({verifiedInventory:box[0].items}).known,false);
});

test("every selectable retail product schedules an actual targeted query, not a generic fallback",()=>{
  const {state,PRODUCTS,liveQueries,inventoryJobs}=harness();
  state.kind="convenience";state.convenienceBrand="emart24";
  for(const [code,title] of PRODUCTS){
    state.pack=code;
    assert.equal(liveQueries().length,1,code);
    assert.ok(liveQueries()[0] && typeof liveQueries()[0]==="string",code);
    const jobs=inventoryJobs();
    assert.equal(jobs.length,1,code);
    assert.equal(jobs[0].provider,"emart24");
    assert.equal(jobs[0].keyword,liveQueries()[0]);
  }
  state.pack="m1S-box";
  assert.deepEqual([...liveQueries()],["메가심포니아"]);
  state.pack="starter-zoroark";
  assert.deepEqual([...liveQueries()],["조로아&조로아크"]);
});


test("Emart24 selected booster box resolves its own PLU and never uses loose-pack stock",async()=>{
  const called=[];
  const packName="포켓몬카드 메가심포니아 확장팩";
  const boxName="포켓몬카드 메가심포니아 박스";
  const store={bizNo:"MARKET1",storeName:"이마트24 테스트",
    latitude:37.5501,longitude:127.0501};
  const fakeFetch=async url=>{
    const u=new URL(url);
    called.push(u);
    const requestedPlu=u.searchParams.get("pluCd");
    if(requestedPlu==="BOX22"){
      return {success:true,data:{pluCd:"BOX22",
        goodsInfo:{pluCd:"BOX22",goodsName:boxName},
        productCandidates:[],
        stores:[{...store,bizQty:2}],nearbyStores:[]}};
    }
    return {success:true,data:{pluCd:"PACK11",
      goodsInfo:{pluCd:"PACK11",goodsName:packName},
      productCandidates:[
        {pluCd:"PACK11",goodsName:packName},
        {pluCd:"BOX22",goodsName:boxName}],
      stores:[{...store,bizQty:30}],nearbyStores:[]}};
  };
  const {state,fetchLiveInventory,inventoryJobs}=harness({mockFetch:fakeFetch,stubView:true});
  state.center={lat:37.55,lng:127.05};state.radiusKm=3;
  state.kind="convenience";state.convenienceBrand="emart24";state.pack="m1S-box";
  state.progress={total:1,completed:0,successes:0,failures:0,active:true};
  await fetchLiveInventory(inventoryJobs(),Promise.resolve("명동"));
  assert.equal(called.length,2);
  assert.equal(called[1].searchParams.get("pluCd"),"BOX22");
  assert.equal(state.inventory.length,1);
  assert.equal(state.inventory[0].items[0].code,"m1S-box");
  assert.equal(state.inventory[0].items[0].quantity,2);
  assert.notEqual(state.inventory[0].items[0].quantity,30);
});

test("Emart24 unknown box SKU never converts pack stock into box stock",async()=>{
  let queries=0;
  const fakeFetch=async url=>{
    queries++;
    if(new URL(url).pathname.endsWith("/products"))
      return {success:true,data:{products:[]}};
    return {success:true,data:{pluCd:"PACK1",
      productCandidates:[{pluCd:"PACK1",
        goodsName:"포켓몬카드 메가심포니아 확장팩"}],
      goodsInfo:{goodsName:"포켓몬카드 메가심포니아 확장팩"},
      stores:[{bizNo:"S01",storeName:"이마트24",
        latitude:37.55,longitude:127.05,bizQty:99}],nearbyStores:[]}};
  };
  const {state,fetchLiveInventory,inventoryJobs}=harness({mockFetch:fakeFetch,stubView:true});
  state.center={lat:37.55,lng:127.05};state.radiusKm=3;
  state.kind="convenience";state.convenienceBrand="emart24";state.pack="m1S-box";
  state.progress={total:1,completed:0,successes:0,failures:0,active:true};
  await fetchLiveInventory(inventoryJobs(),Promise.resolve("명동"));
  assert.equal(queries,2);
  assert.equal(state.inventory.length,0);
  assert.equal(state.progress.successes,0);
  assert.equal(state.progress.failures,1);
});


test("official Pokémon vending locations are parsed accurately without card stock",()=>{
  const {state,parseOfficialVending,selectedKind,inventoryJobs}=harness();
  const result=parseOfficialVending([
    {id:"cgv-구로점",brand:"CGV",name:"CGV 구로점",
      kind:"cinema",addr:"서울특별시 구로구 구로중앙로 152",
      lat:37.50147,lng:126.882261},
    {id:"lotte-김포공항",brand:"롯데마트",name:"롯데마트 김포공항점",
      addr:"서울특별시 강서구 하늘길 38",lat:37.566,lng:126.8},
    {id:"unknown",name:"정보 없는 자판기",addr:"서울",lat:null,lng:null},
    {id:"cgv-구로점",brand:"CGV",name:"CGV 구로점",
      addr:"서울특별시 구로구 구로중앙로 152",lat:37.50147,lng:126.882261},
  ]);
  assert.equal(result.length,2);
  assert.equal(result[0].kind,"vending");
  assert.equal(result[0].origin,"official-vending-directory");
  assert.equal(result[0].lat,37.50147);
  assert.equal(result[0].lng,126.882261);
  assert.equal(result[0].verifiedInventory.length,0);
  assert.equal(result[0].sourceUrl,"https://pokemonkorea.co.kr/card_vending_machine");
  state.kind="vending";
  assert.equal(selectedKind(result[0]),true);
  assert.equal(inventoryJobs().length,0,"a vending locator must never invent product stock calls");
  state.kind="all";
  assert.equal(selectedKind(result[0]),false,"vending installation should not inflate the store count");
});

test("vending-machine filter and official source are available in the public radar",()=>{
  const html=read("card-radar.html");
  const css=read("card-radar.css");
  assert.match(html,/<option value="vending">공식 카드 자판기<\/option>/);
  assert.match(html,/id="radar-vending-source-note"/);
  assert.match(source,/calendar-1ut[.]pages[.]dev\/scripts\/venderlist[.]json/);
  assert.match(source,/loadOfficialVending\(\)/);
  assert.match(source,/state[.]vendingShops[.]map\(store/);
  assert.match(source,/store[.]kind==="vending"/);
  assert.match(css,/body[.]radar-vending-mode [.]radar-stock-filter/);
  assert.match(css,/body[.]radar-vending-mode [.]radar-metric-in-stock/);
});
