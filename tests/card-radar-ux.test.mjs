import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const source = read("card-radar.js");

function harness() {
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
    "globalThis.__radarTests = {isCardProduct, inventoryLabel,",
    "parseRetail, inventoryJobs, updateProgress, completeProgressStep, filterStoresForDisplay, state};",
    "})();",
  ].join("\n"));
  assert.notEqual(body, source, "script test hook insertion");
  const sandbox = { document, window: {}, console, URLSearchParams, Date, Math };
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
  assert.equal((positive.message.match(/재고/g) || []).length, 1);
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
  assert.equal(inventoryJobs().length,12);
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
