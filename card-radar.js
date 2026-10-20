"use strict";
(function () {
  const PRODUCTS = [
    ["m6a", "30th CELEBRATION"], ["m6", "스톰에메랄다"],
    ["m5", "어비스아이"], ["m4", "닌자스피너"],
    ["m3", "니힐제로"], ["m2a", "MEGA드림ex"],
    ["m2", "인페르노X"], ["m1S", "메가심포니아"], ["m1L", "메가브레이브"]
  ];
  const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };
  const MAX_SHOPS = 250;
  const state = {
    center: { ...DEFAULT_CENTER }, locationLabel: "서울시청 (기본 지도)",
    radiusKm: 3, kind: "all", martBrand: "all", convenienceBrand: "all", pack: "", view: "list", onlyInStock: false,
    shops: [], curatedShops: [], retailerShops: [], masterShops: [], publicShops: [], inventory: [], martInventory: [], martProviders: {}, providerNotes: [], providerOutcomes: {}, map: null, radiusCircle: null, pinLayer: null,
    searching: false, hasSearched:false, packRefreshPending:false, locationChosen: false, mapChecked: false,
    progress: { completed: 0, total: 0, successes: 0, failures: 0, active: false }
  };
  const byId = (id) => document.getElementById(id);
  const number = (value) => Number(value);
  const validCoord = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  const rad = (d) => (d * Math.PI) / 180;
  const distanceKm = (a, b) => {
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  function setStatus(message, error) {
    const element = byId("radar-status");
    element.textContent = message;
    element.classList.toggle("error", Boolean(error));
  }
  function errorMessage(error, fallback) {
    return error && error.name === "AbortError" ? "요청 시간이 초과되었습니다. 다시 시도해 주세요." : fallback;
  }
  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function recordCoords(raw) {
    const lat = number(raw.lat !== undefined ? raw.lat : raw.center && raw.center.lat);
    const lng = number(raw.lon !== undefined ? raw.lon : (raw.lng !== undefined ? raw.lng : raw.center && raw.center.lon));
    return validCoord(lat, lng) ? {lat, lng} : null;
  }
  function safeStoreName(tags) {
    return String(tags.name || tags["name:ko"] || tags.brand || tags.operator || "").trim().slice(0,90);
  }
  function category(tags) {
    const name = [tags.name, tags["name:ko"], tags.brand, tags.operator].filter(Boolean).join(" ");
    const shop = String(tags.shop || "");
    // E-Mart24 is a convenience store, including spaced/hyphenated map labels.
    // Check the store brand first: OSM entries sometimes incorrectly use supermarket.
    if (/이마트\s*24|e[\s._-]*mart\s*24/i.test(name)) return "convenience";
    if (shop === "convenience" || /(?:CU|GS\s?25|세븐일레븐|7.?Eleven)/i.test(name) &&
      !/이마트(?!24)|E-?Mart(?!24)/i.test(name)) return "convenience";
    if (["supermarket","department_store","wholesale"].includes(shop) || /이마트(?!24)|E[ -]?mart(?!24)|롯데마트|Lotte Mart|홈플러스|Homeplus/i.test(name)) return "mart";
    return null;
  }
  function martBrand(name) {
    const nameKey=String(name||"").toLowerCase().replace(/[\s._-]+/g,"");
    // Order matters: Traders is operated by Emart but must have its own filter.
    if(/트레이더스|traders/.test(nameKey))return "traders";
    if(/이마트24|emart24/.test(nameKey))return "other";
    if(/코스트코|costco/.test(nameKey))return "costco";
    if(/하나로마트|하나로|hanaromart|nhmart/.test(nameKey))return "hanaro";
    if(/롯데마트|lottemart/.test(nameKey))return "lottemart";
    if(/홈플러스|homeplus/.test(nameKey))return "homeplus";
    if(/이마트|emart/.test(nameKey))return "emart";
    return "other";
  }
  function martBrandLabel(brand) {
    return {emart:"이마트",traders:"트레이더스",lottemart:"롯데마트",
      homeplus:"홈플러스",costco:"코스트코",hanaro:"하나로마트",
      other:"기타 마트"}[brand] || "기타 마트";
  }
  const CONVENIENCE_CHAIN_LABELS={cu:"CU",gs25:"GS25",seveneleven:"세븐일레븐",
    emart24:"이마트24",other:"기타 편의점"};
  function convenienceChain(store) {
    const fromDb=String(store.retailerId||"").toLowerCase();
    if(CONVENIENCE_CHAIN_LABELS[fromDb] && fromDb!=="other")return fromDb;
    const label=String(store.chain||store.name||"").toLowerCase().replace(/[\s._-]+/g,"");
    if(/이마트24|emart24/.test(label))return "emart24";
    if(/세븐일레븐|7eleven|seveneleven/.test(label))return "seveneleven";
    if(/gs25/.test(label))return "gs25";
    if(/(?:^|[^a-z])cu|씨유/.test(label))return "cu";
    return "other";
  }
  function selectedKind(store) {
    // Only locations for convenience stores and marts belong on the radar.
    if(!["convenience","mart"].includes(store.kind))return false;
    if(state.kind!=="all" && store.kind!==state.kind)return false;
    if(state.kind==="mart" && state.martBrand!=="all")
      return martBrand(store.chain||store.name)===state.martBrand;
    if(state.kind==="convenience" && state.convenienceBrand!=="all")
      return convenienceChain(store)===state.convenienceBrand;
    return true;
  }
  function currentSummary(count, displayedCount = count) {
    const hasResults = state.mapChecked || state.inventory.length > 0 || state.shops.length > 0 || state.retailerShops.length > 0 || state.masterShops.length > 0 || state.publicShops.length > 0;
    byId("radar-summary").textContent = state.locationLabel + " · 반경 " + state.radiusKm + "km" +
      (hasResults ? " · " + (state.onlyInStock ? "재고 보유 " : "전체 ") + displayedCount + "곳 표시" : "");
    byId("radar-map-caption").textContent = "반경 " + state.radiusKm + "km";
    byId("radar-location-label").textContent = "검색 중심: " + state.locationLabel +
      " · " + state.center.lat.toFixed(4) + ", " + state.center.lng.toFixed(4);
    const visible = hasResults;
    byId("radar-total-stores").textContent = visible ? String(count) : "—";
    byId("radar-search-completed").textContent = String(state.progress.successes);
    byId("radar-search-failed").textContent = String(state.progress.failures);
  }
  function updateProgress(stage = "") {
    const { completed, total, active } = state.progress;
    const percent = total > 0 ? Math.min(100, Math.floor(completed / total * 100)) : 0;
    const panel = byId("radar-progress");
    panel.setAttribute("aria-valuenow", String(percent));
    panel.classList.toggle("is-running", active);
    panel.classList.toggle("is-finished", !active && completed > 0 && completed === total);
    byId("radar-progress-fill").style.width = percent + "%";
    byId("radar-progress-percent").textContent = percent + "%";
    byId("radar-progress-stage").textContent = stage || (active ? "재고 조회 중" : completed ? "검색 종료" : "검색 대기");
    const skipped=state.progress.skipped||0;
    byId("radar-progress-detail").textContent = total > 0
      ? "진행 " + completed + " / " + total + "단계 · 재고 API 요청 " +
        (state.progress.successes+state.progress.failures) +
        "건 · 자동 생략 " + skipped + "건"
      : "검색을 시작하면 재고 조회와 매장 검색 진행 상황이 표시됩니다.";
  }
  function completeProgressStep(success, stage, isApi = true) {
    const p = state.progress;
    p.completed += 1;
    if (isApi && success) p.successes += 1;
    else if (isApi && !success) p.failures += 1;
    updateProgress(stage);
    byId("radar-search-completed").textContent = String(p.successes);
    byId("radar-search-failed").textContent = String(p.failures);
  }
  const PROVIDER_LABELS={cu:"CU",gs25:"GS25",seveneleven:"세븐일레븐",emart24:"이마트24"};
  // Keep these summaries separate from retailer feeds. A successful transport
  // is NOT evidence that every nearby shop was checked or that zero means sold out.
  function providerFailureCategory(error){
    const message=String(error?.message||"");
    if(message==="STOCK_UNAVAILABLE")return "stock_unavailable";
    if(message==="PRODUCT_SKU_UNVERIFIED"||message==="PRODUCT_SKU_CONFLICT")
      return "product_unverified";
    if(message==="SEVENELEVEN_LOCALITY_UNAVAILABLE")return "area_unavailable";
    if(/^HTTP 429\b/.test(message))return "rate_limited";
    if(/^HTTP 5\d\d\b/.test(message))return "server_error";
    if(/^HTTP 4\d\d\b/.test(message))return "http_error";
    return "other_error";
  }
  function recordProviderOutcome(provider,status,rows=[],error=null){
    if(!PROVIDER_LABELS[provider])return;
    const counters=state.providerOutcomes[provider]||
      (state.providerOutcomes[provider]={
        attempts:0,matched:0,zeroRows:0,positiveRows:0,
        unmatched:0,skipped:0,failures:0,reasons:{}
      });
    if(status==="skipped"){counters.skipped++;return;}
    counters.attempts++;
    if(status==="failure"){
      counters.failures++;
      const reason=providerFailureCategory(error);
      counters.reasons[reason]=(counters.reasons[reason]||0)+1;
      return;
    }
    if(!rows.length){counters.unmatched++;return;}
    counters.matched++;
    for(const row of rows){
      const quantity=row?.items?.[0]?.quantity;
      if(Number.isSafeInteger(quantity)&&quantity>0)counters.positiveRows++;
      else if(quantity===0)counters.zeroRows++;
    }
  }
  function providerDiagnosticSummary(){
    const providers=Object.keys(PROVIDER_LABELS).filter(provider=>
      state.providerOutcomes[provider]);
    if(!providers.length)return "검색 후 브랜드별 결과가 표시됩니다.";
    const names={
      stock_unavailable:"재고 데이터 미제공",product_unverified:"상품코드 검증 실패",
      area_unavailable:"지역명 확인 실패",rate_limited:"호출 제한",
      server_error:"판매처 서버 오류",http_error:"HTTP 요청 오류",
      other_error:"조회 오류"
    };
    return providers.map(provider=>{
      const a=state.providerOutcomes[provider];
      const reason=Object.entries(a.reasons).map(([code,n])=>
        (names[code]||"오류")+" "+n+"건").join(", ");
      return PROVIDER_LABELS[provider]+": 조회 "+a.attempts+"건 · "+
        "양수 재고 응답 "+a.positiveRows+"행 · "+
        "수량 0 응답 "+a.zeroRows+"행 · "+
        "상품 일치 응답 없음 "+a.unmatched+"건 · "+
        (a.failures?"조회 불가 "+a.failures+"건"+(reason?" ("+reason+")":""):"조회 오류 0건")+
        (a.skipped?" · 자동 생략 "+a.skipped+"건":"");
    }).join("\n");
  }
  function renderProviderDiagnostics(){
    const display=byId("radar-provider-diagnostics");
    if(display)display.textContent=providerDiagnosticSummary();
  }
  function shouldOfferMapSearch(mapCenter) {
    return !!mapCenter && Number.isFinite(mapCenter.lat) && Number.isFinite(mapCenter.lng) &&
      validCoord(mapCenter.lat,mapCenter.lng) &&
      distanceKm(state.center,{lat:mapCenter.lat,lng:mapCenter.lng}) > .12;
  }
  function searchCurrentMapArea() {
    if (state.searching) return setStatus("현재 검색이 끝난 후 지도를 다시 검색해 주세요.");
    if (!state.map) return setStatus("지도를 사용할 수 없습니다.",true);
    const point = state.map.getCenter();
    if (!validCoord(point.lat,point.lng)) return setStatus("지도 중심 위치가 올바르지 않습니다.",true);
    state.center = {lat:point.lat,lng:point.lng};
    state.locationLabel = "지도에서 선택한 위치";
    state.locationChosen = true;
    state.shops=[];
    state.retailerShops=[];
    state.masterShops=[];
    state.publicShops=[];
    state.inventory=[];
    state.mapChecked=false;
    state.progress={completed:0,total:0,successes:0,failures:0,active:false};
    byId("radar-search-map-area").hidden=true;
    if (state.radiusCircle) {
      state.radiusCircle.setLatLng([point.lat,point.lng]);
      state.radiusCircle.setRadius(state.radiusKm*1000);
    }
    updateProgress("검색 대기");
    render();
    void search();
  }
  function centerMap() {
    if (!state.map) return;
    const center = [state.center.lat, state.center.lng];
    const zoom = state.radiusKm >= 10 ? 11 : state.radiusKm >= 5 ? 12 : state.radiusKm >= 3 ? 13 : 14;
    state.map.setView(center, zoom, {animate:false});
    if (state.radiusCircle) {
      state.radiusCircle.setLatLng(center);
      state.radiusCircle.setRadius(state.radiusKm * 1000);
    }
  }
  function initMap() {
    if (!window.L) {
      byId("radar-map").hidden = true;
      byId("radar-map-fallback").hidden = false;
      return;
    }
    try {
      state.map = window.L.map("radar-map", {scrollWheelZoom:false}).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom:19,
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(state.map);
      state.radiusCircle = window.L.circle([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
        radius: 3000, color:"#456be7",fillColor:"#688bf8",fillOpacity:0.07,weight:2
      }).addTo(state.map);
      state.pinLayer = window.L.layerGroup().addTo(state.map);
      state.map.on("moveend", () => {
        const at = state.map.getCenter();
        byId("radar-search-map-area").hidden = !shouldOfferMapSearch(at);
      });
    } catch (_) {
      byId("radar-map").hidden = true;
      byId("radar-map-fallback").hidden = false;
    }
  }
  function setRadius(value) {
    if (![1,3,5,10].includes(value) || state.searching) return;
    const changed = value !== state.radiusKm;
    if (changed) {
      state.shops=[];state.retailerShops=[];state.masterShops=[];state.publicShops=[];state.inventory=[];state.mapChecked=false;
      state.progress={completed:0,total:0,successes:0,failures:0,active:false};
      updateProgress("검색 대기");
    }
    state.radiusKm = value;
    document.querySelectorAll("[data-radius]").forEach((button) => {
      const active = Number(button.dataset.radius) === value;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    try { localStorage.setItem("digitalCardBinderRadarRadiusV1", String(value)); } catch (_) {}
    centerMap();
    render();
    if (changed) setStatus("검색 반경이 변경되었습니다. ‘이 지역 매장 탐색’을 눌러 새 범위를 조회해 주세요.");
  }
  function setView(view) {
    if (!["list","map"].includes(view)) return;
    state.view = view;
    byId("radar-main").querySelector(".radar-result-grid").dataset.view = view;
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (view === "map" && state.map) setTimeout(() => state.map.invalidateSize(), 0);
  }
  function geolocationErrorMessage(error) {
    if(error && error.code === 1)
      return "위치 권한이 차단되어 있습니다. 브라우저의 이 사이트 위치 권한을 허용하거나 지역명을 입력해 주세요.";
    if(error && error.code === 2)
      return "현재 위치를 확인할 수 없습니다. 기기 위치 서비스를 켜거나 지역명을 입력해 주세요.";
    if(error && error.code === 3)
      return "위치 확인 시간이 초과됐습니다. 다시 시도하거나 지역명을 입력해 주세요.";
    return "위치를 확인하지 못했습니다. 다시 시도하거나 지역명을 입력해 주세요.";
  }
  function showGeolocate(runSearch=search) {
    const button=byId("radar-geolocate");
    const feedback=byId("radar-location-feedback");
    const report=(message,error=false)=>{
      feedback.textContent=message;
      feedback.classList.toggle("error",error);
      setStatus(message,error);
    };
    if(state.searching){
      report("현재 검색이 끝나면 내 위치를 다시 눌러 주세요.");
      return;
    }
    if(button.disabled)return;
    if(typeof window!=="undefined" && window.isSecureContext===false){
      report("위치는 보안 연결(HTTPS)에서만 확인할 수 있습니다. 브라우저에서 사이트를 직접 열어 주세요.",true);
      return;
    }
    if(typeof navigator==="undefined" || !navigator.geolocation){
      report("이 브라우저에서는 위치 확인을 사용할 수 없습니다. 지역명을 입력해 주세요.",true);
      return;
    }
    button.disabled=true;
    button.textContent="위치 확인 중…";
    report("현재 위치를 확인하고 있습니다. 위치 권한 요청이 나타나면 허용해 주세요.");
    const finish=()=>{
      button.disabled=false;
      button.textContent="◎ 내 위치";
    };
    try{
      navigator.geolocation.getCurrentPosition((position)=>{
        finish();
        const lat=Number(position?.coords?.latitude),lng=Number(position?.coords?.longitude);
        if(!validCoord(lat,lng)){
          report("위치 좌표를 확인하지 못했습니다. 다시 시도해 주세요.",true);
          return;
        }
        state.center={lat,lng};
        state.locationLabel="내 위치";
        state.locationChosen=true;
        state.shops=[];
        state.retailerShops=[];
        state.masterShops=[];
        state.publicShops=[];
        state.inventory=[];
        state.mapChecked=false;
        state.progress={completed:0,total:0,successes:0,failures:0,active:false};
        // A previous text search must not restrict Seven-Eleven results near GPS.
        byId("radar-place").value="";
        updateProgress("검색 대기");
        centerMap();
        render();
        report("내 위치를 찾았습니다. 주변 편의점과 마트를 검색합니다.");
        void runSearch();
      },(error)=>{
        finish();
        report(geolocationErrorMessage(error),true);
      },{
        enableHighAccuracy:true,maximumAge:30000,timeout:16000
      });
    }catch(error){
      finish();
      report(geolocationErrorMessage(error),true);
    }
  }
  async function fetchJson(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 20000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  async function findPlace() {
    if(state.searching) return setStatus("검색 종료 후 새 지역을 선택해 주세요.");
    const query = byId("radar-place").value.trim();
    if (query.length < 2) return setStatus("지역명은 두 글자 이상 입력해 주세요.", true);
    const button = byId("radar-find-place");
    button.disabled = true;
    setStatus("지역 좌표를 찾는 중입니다.");
    try {
      const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=" + encodeURIComponent(query);
      const places = await fetchJson(url, {headers:{"Accept":"application/json"}}, 12000);
      if (!Array.isArray(places) || !places.length) throw new Error("NOT_FOUND");
      const lat = Number(places[0].lat), lng = Number(places[0].lon);
      if (!validCoord(lat,lng)) throw new Error("INVALID");
      state.center = {lat,lng};
      state.locationLabel = String(places[0].display_name || query).split(",").slice(0,3).join(", ");
      state.locationChosen = true;
      state.shops = [];
      state.retailerShops = [];
      state.masterShops = [];
      state.publicShops = [];
      state.inventory = [];
      state.mapChecked = false;
      state.progress={completed:0,total:0,successes:0,failures:0,active:false};
      updateProgress("검색 대기");
      centerMap();
      render();
      setStatus("지역을 설정했습니다. ‘이 지역 매장 탐색’을 눌러 주세요.");
    } catch (error) {
      setStatus(errorMessage(error, "지역을 찾지 못했습니다. 다른 지역명으로 다시 검색해 주세요."), true);
    } finally {button.disabled = false;}
  }
  function categoryQuery(radius, lat, lng) {
    const around = "(around:" + radius + "," + lat.toFixed(5) + "," + lng.toFixed(5) + ")";
    return "[out:json][timeout:22];(" +
      'nwr["shop"="convenience"]["name"~"CU|GS25|GS 25|세븐일레븐|7-Eleven|이마트 ?24|E[ -]?Mart ?24",i]' + around + ";" +
      'nwr["shop"="convenience"]["brand"~"이마트 ?24|E[ -]?Mart ?24",i]' + around + ";" +
      'nwr["shop"="supermarket"]' + around + ";" +
      'nwr["shop"="wholesale"]' + around + ";" +
      'nwr["brand"~"이마트|E-?Mart|롯데마트|Lotte Mart|홈플러스|Homeplus|트레이더스|Traders|코스트코|Costco|하나로마트",i]' + around + ";" +
      'nwr["name"~"트레이더스|Traders|코스트코|Costco|하나로마트|롯데마트|홈플러스|이마트",i]' + around + ";" +
       ");out center " + MAX_SHOPS + ";";
  }
  function parseShops(elements) {
    const seen = new Set(), shops = [];
    for (const element of elements || []) {
      const tags = element.tags || {};
      const coords = recordCoords(element);
      const name = safeStoreName(tags);
      const kind = category(tags);
      if (!coords || !name || !kind) continue;
      const distance = distanceKm(state.center, coords);
      if (distance > state.radiusKm + 0.03) continue;
      const key = element.type + ":" + element.id;
      if (seen.has(key)) continue;
      seen.add(key);
      shops.push({
        id:key, name, lat:coords.lat, lng:coords.lng,
        kind, chain:String(tags.brand||tags.operator||"").slice(0,45),
        distance, origin:"osm",
        addr: String(tags["addr:full"] || tags["addr:street"] || tags["addr:city"] || "").slice(0,120),
        verifiedInventory:[]
      });
    }
    return shops.sort((a,b) => a.distance - b.distance);
  }
  function normalizeShopName(name) {
    return String(name || "").toLowerCase().replace(/^(씨유|cu)\s*/i,"cu")
      .replace(/[\s._-]+/g,"");
  }
  function parseCuStoreDirectory(payload) {
    if (!payload || payload.success !== true || !Array.isArray(payload.data?.stores)) {
      throw new Error("INVALID_CU_STORES_RESPONSE");
    }
    return payload.data.stores.flatMap((raw) => {
      const lat = Number(raw.latitude), lng = Number(raw.longitude);
      const name = String(raw.storeName || raw.name || "").trim().slice(0,90);
      if (!name || !validCoord(lat,lng)) return [];
      const distance = distanceKm(state.center,{lat,lng});
      if (distance > state.radiusKm+.03) return [];
      return [{id:"cu:"+String(raw.storeCode||name).slice(0,90),
        storeId:String(raw.storeCode||"").trim().slice(0,90),
        name,lat,lng,distance,retailerId:"cu",chain:"CU",kind:"convenience",addr:String(raw.address||"").slice(0,120),
        origin:"retailer-directory",verifiedInventory:[]}];
    });
  }
  function retailChain(name) {
    const text = String(name || "").toLowerCase().replace(/[\s_-]/g,"");
    if (/이마트24|emart24/.test(text)) return "emart24";
    if (/이마트|emart/.test(text)) return "emart";
    if (/롯데마트|lottemart/.test(text)) return "lottemart";
    if (/홈플러스|homeplus/.test(text)) return "homeplus";
    if (/gs25/.test(text)) return "gs25";
    if (/세븐일레븐|7eleven/.test(text)) return "7eleven";
    return text;
  }
  // Our independent Firebase master is location evidence, not automatic stock confirmation.
  // Never create "in-stock" results without the server's approved current observations.
  function parseSelfDbDirectory(payload) {
    if(!payload || payload.schemaVersion!==2 || payload.dbStatus!=="connected" ||
      !Array.isArray(payload.stores))throw Error("INVALID_SELF_DB_RESPONSE");
    const kinds={cu:"convenience",gs25:"convenience",seveneleven:"convenience",
      emart24:"convenience",emart:"mart",traders:"mart",lottemart:"mart",
      homeplus:"mart",costco:"mart",hanaro:"mart"};
    return payload.stores.slice(0,250).flatMap((record)=>{
      if(!record || !kinds[record.retailerId] || record.kind!==kinds[record.retailerId] ||
        !record.storeId || typeof record.name!=="string" || !record.name.trim())return [];
      const lat=Number(record.lat),lng=Number(record.lng);
      if(!validCoord(lat,lng))return [];
      const distance=distanceKm(state.center,{lat,lng});
      if(distance>state.radiusKm+.03)return [];
      const items=Array.isArray(record.items)?record.items.slice(0,80).flatMap((p)=>{
        if(!p || !Number.isSafeInteger(p.quantity) || p.quantity<0 ||
          !isCardProduct(p.name) || typeof p.observedAt!=="string" ||
          !Number.isFinite(Date.parse(p.observedAt)) ||
          typeof p.setId!=="string" || !/^[a-z0-9+_-]{1,35}$/i.test(p.setId))return [];
        const age=Date.now()-Date.parse(p.observedAt);
        if(age< -60000 || age>=15*60000)return [];
        return [{code:p.setId.toLowerCase(),name:p.name.slice(0,90),quantity:p.quantity,
          checkedAt:p.observedAt,provider:"자체 DB",productId:String(p.productId||"").slice(0,90)}];
      }):[];
      return [{id:"db:"+String(record.storeId).slice(0,90),storeId:String(record.storeId).slice(0,90),
        name:record.name.slice(0,90),lat,lng,distance,chain:record.retailerId,
        retailerId:record.retailerId,kind:record.kind,
        addr:String(record.address||"").slice(0,120),
        origin:"self-db",verifiedInventory:items}];
    });
  }
  const SELF_DB_API="https://digital-card-radar-api.vercel.app/api/v1/stores";

  const COVERAGE_API="https://digital-card-radar-api.vercel.app/api/v1/coverage";
  function normalizeCoverage(payload) {
    if(!payload || payload.dbStatus!=="connected"||payload.schemaVersion!==1 ||
      !Array.isArray(payload.retailers))throw Error("INVALID_COVERAGE_RESPONSE");
    const keys=["registeredStoreCount","verifiedStoreAliasCount",
      "verifiedRetailerSkuCount","registeredSourceCount","approvedSourceCount"];
    const counts={};
    for(const key of keys){
      const value=payload[key];
      if(!Number.isSafeInteger(value)||value<0)throw Error("INVALID_COVERAGE_COUNT");
      counts[key]=value;
    }
    const knownIds=new Set(["cu","gs25","seveneleven","emart24",
      "emart","traders","lottemart","homeplus","costco","hanaro"]);
    const retailers=payload.retailers.slice(0,20).flatMap(r=>{
      if(!r || !knownIds.has(r.retailerId))return [];
      return [{
        id:r.retailerId,
        name:String(r.name||r.retailerId).slice(0,35),
        permission:r.inventoryPermission==="approved"?"approved":"unverified",
        kind:r.kind==="convenience"?"편의점":"대형마트"
      }];
    });
    return {counts,retailers};
  }
  let coverageFetching=false;
  async function loadCoverage() {
    if(coverageFetching)return;
    coverageFetching=true;
    const refresh=byId("radar-coverage-refresh");
    refresh.disabled=true;
    byId("radar-coverage-intro").textContent="판매처별 자체 DB 연동 현황을 확인하고 있습니다…";
    try {
      const response=await fetchJson(COVERAGE_API,
        {cache:"no-store",headers:{Accept:"application/json"}},14000);
      const {counts,retailers}=normalizeCoverage(response);
      byId("radar-coverage-intro").textContent=
        "자체 DB 등록 판매처 "+retailers.length+"종 · 승인된 재고 공급원 "+
        counts.approvedSourceCount+"개 (공개 조회 API와 별개)";
      const metricList=byId("radar-coverage-metrics");
      metricList.replaceChildren();
      for(const [label,key] of [["등록 매장","registeredStoreCount"],
        ["검증된 매장코드 연결","verifiedStoreAliasCount"],
        ["검증된 상품코드 연결","verifiedRetailerSkuCount"],
        ["승인된 재고 소스","approvedSourceCount"]]){
        const item=make("div","radar-coverage-metric");
        item.append(make("span","",label),make("strong","",String(counts[key])));
        metricList.append(item);
      }
      const ul=byId("radar-coverage-retailers");
      ul.replaceChildren();
      for(const retailer of retailers){
        const li=make("li","");
        li.append(make("strong","",retailer.name),
          make("small","",retailer.kind),
          make("span",retailer.permission==="approved"?"radar-permission-approved":"",
            retailer.permission==="approved"?"판매처 사용 권한 확인":"자체 DB 재고 사용 권한 미확인"));
        ul.append(li);
      }
    }catch(_){
      byId("radar-coverage-intro").textContent=
        "자체 DB 연동 현황을 지금 조회할 수 없습니다. 연결 실패를 재고 0개로 해석하지 않습니다.";
      byId("radar-coverage-metrics").replaceChildren();
      byId("radar-coverage-retailers").replaceChildren();
    }finally{
      refresh.disabled=false;
      coverageFetching=false;
    }
  }

  async function loadSelfDbStores() {
    const params=new URLSearchParams({lat:state.center.lat.toFixed(6),
      lng:state.center.lng.toFixed(6),radiusKm:String(state.radiusKm),limit:"250"});
    if(state.kind==="mart" || state.kind==="convenience")params.set("kind",state.kind);
    if(state.kind==="convenience"&&state.convenienceBrand!=="all"&&
      state.convenienceBrand!=="other")params.set("retailer",state.convenienceBrand);
    if(state.kind==="mart"&&state.martBrand!=="all"&&
      state.martBrand!=="other")params.set("retailer",state.martBrand);
    const payload=await fetchJson(SELF_DB_API+"?"+params.toString(),
      {cache:"no-store",headers:{Accept:"application/json"}},15000);
    return parseSelfDbDirectory(payload);
  }
  const PUBLIC_SHOPS_API="https://digital-card-radar-api.vercel.app/api/v1/public-shops";
  function parsePublicShopLocations(payload){
    if(!payload || payload.schemaVersion!==1 ||
      !["ok","not_configured"].includes(payload.status) ||
      !Array.isArray(payload.stores))throw Error("INVALID_GOV_STORE_RESPONSE");
    if(payload.status==="not_configured")
      return {configured:false,stores:[],coverageLimited:true};
    const allowed={cu:"convenience",gs25:"convenience",
      seveneleven:"convenience",emart24:"convenience",
      emart:"mart",traders:"mart",lottemart:"mart",homeplus:"mart",
      costco:"mart",hanaro:"mart"};
    const stores=payload.stores.slice(0,250).flatMap(p=>{
      if(!p || !allowed[p.retailerId] || p.kind!==allowed[p.retailerId] ||
        p.locationStatus!=="candidate" || p.origin!=="government-business-registry" ||
        typeof p.name!=="string" || !p.name.trim())return [];
      const lat=Number(p.lat),lng=Number(p.lng);
      if(!validCoord(lat,lng) || distanceKm(state.center,{lat,lng})>state.radiusKm+.03)return [];
      return [{id:String(p.id||"").slice(0,90),name:p.name.slice(0,90),
        lat,lng,distance:distanceKm(state.center,{lat,lng}),
        kind:p.kind,retailerId:p.retailerId,chain:p.retailerId,
        addr:String(p.address||"").slice(0,120),
        origin:"government-business-registry",verifiedInventory:[]}];
    });
    return {configured:true,stores,coverageLimited:payload.coverageLimited===true,
      queriedRadiusKm:Number(payload.queriedRadiusKm)||2,
      pagesFetched:Number.isSafeInteger(payload.pagesFetched)?payload.pagesFetched:1,
      sourceRowsExamined:Number.isSafeInteger(payload.sourceRowsExamined)?
        payload.sourceRowsExamined:0,
      supplementalCentersAttempted:Number.isSafeInteger(payload.supplementalCentersAttempted)?
        payload.supplementalCentersAttempted:0,
      supplementalCentersFetched:Number.isSafeInteger(payload.supplementalCentersFetched)?
        payload.supplementalCentersFetched:0,
      supplementalRowsExamined:Number.isSafeInteger(payload.supplementalRowsExamined)?
        payload.supplementalRowsExamined:0,
      sourceYearMonth:/^20[0-9]{4}$/.test(String(payload.sourceYearMonth||""))?
        payload.sourceYearMonth:""};
  }
  async function loadPublicShopLocations(){
    const params=new URLSearchParams({lat:state.center.lat.toFixed(6),
      lng:state.center.lng.toFixed(6),radiusKm:String(state.radiusKm),limit:"250"});
    if(["mart","convenience"].includes(state.kind))params.set("kind",state.kind);
    if(state.kind==="convenience"&&state.convenienceBrand!=="all"&&state.convenienceBrand!=="other")
      params.set("retailer",state.convenienceBrand);
    if(state.kind==="mart"&&state.martBrand!=="all"&&state.martBrand!=="other")
      params.set("retailer",state.martBrand);
    const payload=await fetchJson(PUBLIC_SHOPS_API+"?"+params.toString(),
      {cache:"no-store",headers:{Accept:"application/json"}},14500);
    return parsePublicShopLocations(payload);
  }
  function storeCandidates(shops) {
    const merged = shops.filter(selectedKind).map((store)=>({ ...store }));
    // Independently verified stores are included even when OSM lacks the chain.
    for(const official of state.masterShops){
      if(!selectedKind(official) || distanceKm(state.center,official)>state.radiusKm+.03)continue;
      const existing=merged.find((candidate)=>
        (candidate.storeId && official.storeId &&
          candidate.storeId===official.storeId &&
          candidate.kind===official.kind &&
          candidate.retailerId===official.retailerId &&
          distanceKm(candidate,official)<.5) ||
        (candidate.kind===official.kind &&
          (!candidate.retailerId||candidate.retailerId===official.retailerId) &&
          distanceKm(candidate,official)<.10 &&
          (normalizeShopName(candidate.name)===normalizeShopName(official.name) ||
          ((retailChain(candidate.chain||candidate.name)===official.retailerId) &&
            distanceKm(candidate,official)<.03))));
      if(!existing){merged.push({...official});continue;}
      if(!existing.addr)existing.addr=official.addr;
      existing.storeId=official.storeId;
      existing.retailerId=official.retailerId;
      if(official.kind==="mart")existing.chain=official.chain;
      existing.origin="self-db";
      const inventory=existing.verifiedInventory||[];
      for(const item of official.verifiedInventory){
        const idx=inventory.findIndex(x=>x.productId&&x.productId===item.productId);
        if(idx<0)inventory.push(item);
        else if(Date.parse(inventory[idx].checkedAt)<Date.parse(item.checkedAt))
          inventory[idx]=item;
      }
      existing.verifiedInventory=inventory;
    }
    // Public business registry results are location candidates only. The source
    // never supplies retailer-authorized stock or internal product observations.
    for(const publicStore of state.publicShops){
      if(!selectedKind(publicStore))continue;
      const existing=merged.find(candidate=>candidate.kind===publicStore.kind &&
        distanceKm(candidate,publicStore)<.06 &&
        normalizeShopName(candidate.name).replace(/점$/,"")===
          normalizeShopName(publicStore.name).replace(/점$/,""));
      if(!existing){merged.push({...publicStore});continue;}
      if(!existing.addr)existing.addr=publicStore.addr;
    }
    for (const retailer of state.retailerShops) {
      if(!selectedKind(retailer))continue;
      const existing=merged.find((store)=>
        store.kind === retailer.kind &&
        distanceKm(store,retailer)<.12 &&
        normalizeShopName(store.name)===normalizeShopName(retailer.name));
      if (!existing) merged.push({...retailer});
      else if (!existing.addr && retailer.addr) existing.addr=retailer.addr;
    }
    // Verify the actual store directory independently of community map names.
    // The directory does NOT supply stock quantities.
    if (!state.mapChecked && !state.searching) return merged;
    for (const official of state.curatedShops) {
      if (!selectedKind(official) || distanceKm(state.center,official) > state.radiusKm + .03) continue;
      const existing = merged.find((store)=>
        store.kind === official.kind &&
        retailChain(store.name) === retailChain(official.chain || official.name) &&
        distanceKm(store,official) < .18);
      if (existing) {
        existing.name = official.name;
        existing.addr = official.addr;
        existing.chain = official.chain;
        existing.sourceUrl = official.sourceUrl;
        existing.phone = official.phone;
        if(existing.origin!=="self-db")existing.origin = "official-directory";
      } else merged.push({...official, distance:distanceKm(state.center,official)});
    }
    return merged;
  }
  async function loadStoreCatalog() {
    try {
      const data=await fetchJson("./data/card-radar-stores.json",{cache:"no-store"},9000);
      if (!data || !Array.isArray(data.stores)) return;
      state.curatedShops=data.stores.map((store)=>({
        id:"directory:"+String(store.id||"").slice(0,90),
        name:String(store.name||"").slice(0,90),
        chain:String(store.chain||"").slice(0,40),
        lat:Number(store.lat),lng:Number(store.lng),
        addr:String(store.address||"").slice(0,120),
        kind:["convenience","mart"].includes(store.kind)?store.kind:null,
        phone:String(store.phone||"").slice(0,30),
        sourceUrl:typeof store.sourceUrl==="string"&&/^https:\/\//.test(store.sourceUrl)?store.sourceUrl:"",
        origin:"official-directory",verifiedInventory:[]
      })).filter((store)=>store.kind && store.name && validCoord(store.lat,store.lng));
    } catch (_) {
      // Missing directory data never fabricates stores or stock.
      state.curatedShops=[];
    }
    render();
  }
  const MART_OFFICIAL_HOSTS = new Set([
    "eapp.emart.com","company.lottemart.com","front.homeplus.co.kr",
    "www.costco.co.kr","www.nhhanaro.co.kr"
  ]);
  function trustedMartLink(url) {
    if(typeof url!=="string" || !url)return "";
    try {
      const result=new URL(url);
      return result.protocol==="https:" && MART_OFFICIAL_HOSTS.has(result.hostname)
        ? result.href : "";
    } catch(_){return "";}
  }
  async function loadMartProviders() {
    try {
      const data=await fetchJson("./data/card-radar-mart-providers.json",{cache:"no-store"},8000);
      if(!data || data.schemaVersion!==1 || !Array.isArray(data.providers))return;
      state.martProviders=Object.fromEntries(data.providers
        .filter((p)=>["emart","traders","lottemart","homeplus","costco","hanaro"].includes(p.id))
        .map((p)=>[p.id,{
          label:String(p.label||"").slice(0,50),
          lookupLabel:String(p.lookupLabel||"공식 상품 확인").slice(0,65),
          lookupUrl:trustedMartLink(p.lookupUrl),
          // Client-side metadata describes supported coverage; never assert stock from it.
          inventoryApiConnected:false,
          note:String(p.note||"재고 연동 미지원").slice(0,160)
        }]));
      render();
    } catch(_){state.martProviders={};}
  }
  function martLookup(store) {
    if(store.kind!=="mart")return null;
    const id=martBrand(store.chain||store.name);
    return state.martProviders[id] || null;
  }
  function parseApprovedMartFeed(data,now=Date.now()) {
    const source=data && data.source;
    if(!data || data.schemaVersion!==1 || !source ||
      source.status!=="connected" || source.authorized!==true ||
      !["emart","traders","lottemart","homeplus","costco","hanaro"].includes(source.providerId) ||
      typeof source.licenseRef!=="string" || source.licenseRef.trim().length<8 ||
      !Number.isFinite(Date.parse(source.generatedAt)) ||
      !Number.isFinite(Date.parse(source.expiresAt)) ||
      Date.parse(source.generatedAt)>now+60000 ||
      Date.parse(source.expiresAt)<=now || !Array.isArray(data.stores))return [];
    return data.stores.slice(0,500).flatMap((record)=>{
      if(!record || !record.id || !record.name || martBrand(record.chain||record.name)!==source.providerId ||
        !validCoord(Number(record.lat),Number(record.lng)))return [];
      const products=(Array.isArray(record.items)?record.items:[]).slice(0,80).flatMap((item)=>{
        if(!item || typeof item.name!=="string" || !isCardProduct(item.name) ||
          !Number.isSafeInteger(item.quantity) || item.quantity<0 ||
          !Number.isFinite(Date.parse(item.checkedAt)))return [];
        const checked=Date.parse(item.checkedAt);
        if(checked>now+60000 || now-checked>=15*60000)return [];
        return [{code:String(item.code||"").slice(0,25),
          name:item.name.slice(0,90),quantity:item.quantity,
          checkedAt:item.checkedAt,provider:source.providerId}];
      });
      if(!products.length)return [];
      return [{id:"licensed-mart:"+String(record.id).slice(0,90),
        name:String(record.name).slice(0,90),kind:"mart",
        chain:String(record.chain||"").slice(0,40),lat:Number(record.lat),
        lng:Number(record.lng),address:String(record.address||"").slice(0,120),
        items:products}];
    });
  }
  async function loadMartInventory() {
    try {
      const feed=await fetchJson("./data/card-radar-mart-inventory.json",{cache:"no-store"},8000);
      state.martInventory=parseApprovedMartFeed(feed);
    } catch(_) {state.martInventory=[];}
    render();
  }
  // A coincidentally similar shop name/location cannot transfer stock
  // between competing chains. Retailer store codes are stronger evidence.
  function sameRetailerForStock(candidate,source){
    if(candidate.kind!==source.kind)return false;
    if(candidate.retailerId && source.retailerId)
      return candidate.retailerId===source.retailerId;
    if(source.kind==="convenience"){
      const sourceChain=convenienceChain(source);
      return sourceChain!=="other" && convenienceChain(candidate)===sourceChain;
    }
    if(source.kind==="mart"){
      const sourceChain=martBrand(source.chain||source.name);
      return sourceChain!=="other" &&
        martBrand(candidate.chain||candidate.name)===sourceChain;
    }
    return false;
  }
  function mergeInventory(shops) {
    // Only records supplied by this site's separately maintained authorized feed are stock records.
    // OpenStreetMap entries are location candidates, never evidence of inventory or card sales.
    const known = [...state.inventory,...state.martInventory].filter((s) => {
      return selectedKind(s) && validCoord(s.lat,s.lng) && distanceKm(state.center,s) <= state.radiusKm + .03;
    });
    const merged = storeCandidates(shops);
    for (const source of known) {
      let target = merged.find((candidate) =>
        sameRetailerForStock(candidate,source) &&
        ((candidate.storeId && source.id && candidate.storeId===source.id &&
          distanceKm(candidate,source)<.5) ||
          (normalizeShopName(candidate.name)===normalizeShopName(source.name) &&
          distanceKm(candidate,source)<.13)));
      if (!target) {
        target = {id:"feed:"+source.id,name:source.name,lat:source.lat,lng:source.lng,
          distance:distanceKm(state.center,source),kind:source.kind,
          retailerId:source.retailerId||"",chain:source.chain||"",
          addr:source.address || "",
          origin:source.inventorySource==="public-aggregator"?"public-aggregator":"authorized-feed",
          verifiedInventory:[]};
        merged.push(target);
      }
      if(source.retailerId && !target.retailerId)target.retailerId=source.retailerId;
      if(source.chain)target.chain=source.chain;
      if(source.kind==="mart")target.chain=source.chain||target.chain||"";
      // Never mutate the originating map/directory stock array: the same
      // candidate can be rendered again with another brand or search response.
      const existing = (target.verifiedInventory || []).slice();
      for (const item of source.items || []) {
        const index = existing.findIndex((p) => p.provider===item.provider &&
          stockProductIdentity(p)===stockProductIdentity(item));
        if (index >= 0) existing[index] = item;
        else existing.push(item);
      }
      target.verifiedInventory = existing;
      if(source.inventorySource==="public-aggregator"){
        if(target.origin!=="authorized-feed")target.origin="public-aggregator";
      }else target.origin="authorized-feed";
    }
    return merged.sort((a,b) => a.distance-b.distance);
  }
  async function loadInventory() {
    try {
      const data = await fetchJson("./data/card-radar-inventory.json", {cache:"no-store"}, 8000);
      if (!data || !Array.isArray(data.stores)) return;
      state.inventory = data.stores.map((item) => ({
        id:String(item.id || "").slice(0,90),
        name:String(item.name || "").slice(0,90),
        lat:Number(item.lat), lng:Number(item.lng),
        kind:["convenience","mart"].includes(item.kind) ? item.kind : null,
        address:String(item.address || "").slice(0,120),
        items:Array.isArray(item.items) ? item.items.filter((p) => Number.isInteger(p.quantity) && p.quantity >= 0 &&
          typeof p.name === "string" && typeof p.checkedAt === "string" && Number.isFinite(Date.parse(p.checkedAt)))
          .slice(0,80).map((p) => ({code:String(p.code || "").slice(0,25),
            name:p.name.slice(0,90),quantity:p.quantity,checkedAt:p.checkedAt})) : []
      })).filter((item) => item.kind && item.id && item.name && validCoord(item.lat,item.lng));
    } catch (_) { state.inventory = []; }
  }
  // Product name is untrusted retailer data: allow confirmed TCG/pack names, reject food and merchandise.
  const NON_CARD_ITEMS = /빵|띠부씰|스티커|샘플|젤리|캔디|껌|초콜릿|과자|스낵|쿠키|케이크|음료|사이다|콜라|우유|아이스크림|도넛|피규어|인형|키링|열쇠고리|봉제|장난감|문구|팬시|슬리브|카드홀더|바인더|카드앨범|필통|파우치|틴케이스|랜덤씰|증정|이즐|EZL|티머니|T-?money|캐시비|교통카드|교통.?결제|선불카드|충전카드|금액권|상품권|기프트카드|멤버십카드|카드지갑|체크카드|신용카드/i;
  const KNOWN_PACK_NAMES = [
    ...PRODUCTS.map((p) => p[1]), "30주년", "나이트원더러", "배틀파트너즈",
    "테라스탈페스ex", "샤이니트레저ex", "로켓단의 영광",
    "블랙볼트", "화이트플레어", "포켓몬카드151", "포켓몬 카드 151"
  ];
  function isCardProduct(name) {
    if (typeof name !== "string") return false;
    const text = name.trim();
    if (!text || NON_CARD_ITEMS.test(text)) return false;
    const compact = text.replace(/[\s·_/-]+/g, "").toLowerCase();
    const namedPack = KNOWN_PACK_NAMES.some((pack) =>
      compact.includes(pack.replace(/[\s·_/-]+/g, "").toLowerCase()));
    const strongTCG = /TCG|트레이딩.?카드.?게임|카드.?게임|확장팩|하이클래스팩|부스터(?:팩|박스)?|스타터(?:덱|세트)?|구축덱|카드팩|카드박스/i.test(text);
    const hasPokemon = /(포켓몬|pokemon|pokémon)/i.test(text);
    const namedOnly = KNOWN_PACK_NAMES.some((pack) =>
      compact === pack.replace(/[\s·_/-]+/g, "").toLowerCase());
    return (hasPokemon && strongTCG) ||
      (namedPack && (namedOnly || /팩|박스|덱|세트|카드|TCG/i.test(text)));
  }
  function inventoryLabel(store) {
    const cardItems = (store.verifiedInventory || []).filter((p) =>
      isCardProduct(p.name) && (!state.pack || String(p.code || "").toLowerCase() === state.pack.toLowerCase()));
    const fresh = cardItems.filter((p) => {
      const age = Date.now() - Date.parse(p.checkedAt);
      return Number.isFinite(age) && age >= -60000 && age < 15 * 60000;
    });
    const available = fresh.filter((p) => Number.isSafeInteger(p.quantity) && p.quantity > 0)
      .sort((a,b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt) || b.quantity - a.quantity);
    if (available.length) {
      const item = available[0];
      const when = new Date(item.checkedAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});
      const publicResponse=item.inventorySource==="public-aggregator";
      return { message: item.name + " · 조회 수량 " + item.quantity + "개", known: true,
        checked: true, detail: (item.provider ? item.provider + " · " : "") +
          (publicResponse?"공개 재고 조회 응답 수신 ":"재고 확인 시각 ") + when +
          (publicResponse?" · 판매처 원본 갱신시각 미확인 · 실제 점포 재고와 다를 수 있음":
            " · 방문 전 재확인 권장") };
    }
    if (fresh.length) return { message: "", known: false, checked: true,
      detail: state.pack ? "선택한 카드팩 조회 수량 0개" :
        "조회된 카드 상품은 수량 0개 · 다른 카드팩은 미확인" };
    if (cardItems.length) return { message: "", known: false, checked: false,
      detail: "이전 조회 이력만 있음 · 현재 재고 미확인" };
    return { message: "", known: false, checked: false, detail: "카드 재고 미확인" };
  }
  function filterStoresForDisplay(stores) {
    return state.onlyInStock ? stores.filter((store) => inventoryLabel(store).known) : stores;
  }
  function setStockOnly(checked) {
    state.onlyInStock = Boolean(checked);
    const input = byId("radar-only-in-stock");
    input.checked = state.onlyInStock;
    const label = input.closest(".radar-stock-filter");
    if (label) label.classList.toggle("is-active", state.onlyInStock);
    document.querySelectorAll("[data-map-mode]").forEach((button)=>{
      const active=button.dataset.mapMode === (state.onlyInStock?"stock":"all");
      button.classList.toggle("selected",active);
      button.setAttribute("aria-pressed",String(active));
    });
    byId("radar-map-panel").classList.toggle("is-stock-map",state.onlyInStock);
    try {
      localStorage.setItem("digitalCardBinderRadarOnlyInStockV1", state.onlyInStock ? "1" : "0");
    } catch (_) {
      // The toggle still works in browsers that block persistent storage.
    }
    render();
  }
  // Official apps provide store/product lookup, not an authorized API feed
  // for our site. These are verified Google Play listings, not store/SKU deep links.
  const OFFICIAL_STOCK_APPS=Object.freeze({
    cu:"https://play.google.com/store/apps/details?id=com.bgfcu.membership",
    gs25:"https://play.google.com/store/apps/details?id=com.gsr.gs25",
    seveneleven:"https://play.google.com/store/apps/details?id=kr.co.kork7app",
    emart24:"https://play.google.com/store/apps/details?id=kr.co.emart24.everse"
  });
  function officialStockApp(store){
    return store?.kind==="convenience" ?
      OFFICIAL_STOCK_APPS[convenienceChain(store)]||"" : "";
  }
  function addStoreCard(target,store) {
    const card=make("article","radar-store");
    const top=make("div","radar-store-top"),title=make("h3","radar-store-title",store.name);
    const km=make("span","radar-store-distance",store.distance.toFixed(1)+"km");
    const typeName=store.kind==="convenience"?CONVENIENCE_CHAIN_LABELS[convenienceChain(store)]:
      martBrandLabel(martBrand(store.chain||store.name));
    const badge=make("span","radar-store-kind radar-store-kind--"+store.kind,typeName);
    const header=make("div","radar-store-name");
    header.append(title,badge);
    top.append(header,km);card.append(top);
    card.append(make("p","radar-store-sub",(store.addr ? store.addr+" · ":"")+
      (store.origin==="public-aggregator"?"외부 재고 조회 응답 · 방문 전 확인":
        store.origin==="self-db"?"등록 매장 · 재고 별도 확인":
        store.origin==="government-business-registry"?"매장 위치 후보 · 재고 미확인":
        store.origin==="official-directory"?"매장 위치 확인 · 재고 별도 확인":
        store.origin==="authorized-feed"?"재고 데이터 제공 매장":"지도에 등록된 매장 후보")));
    const summary=inventoryLabel(store);
    if (summary.known) card.append(make("div","radar-stock in-stock",summary.message));
    card.append(make("p","radar-stock-note",summary.detail));
    const mart=martLookup(store);
    if(mart && !summary.checked){
      const info=make("p","radar-mart-lookup-note",
        "대형마트 자동 재고 연동 미지원 · "+mart.note);
      card.append(info);
    }
    const buttons=make("div","radar-store-actions");
    const google=make("a","", "지도 길찾기");
    google.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(store.lat+","+store.lng);
    google.target="_blank";google.rel="noopener noreferrer";
    buttons.append(google);
    const officialApp=officialStockApp(store);
    if(officialApp){
      const verify=make("a","radar-official-stock-link","공식 앱에서 확인");
      verify.href=officialApp;
      verify.target="_blank";verify.rel="noopener noreferrer";
      verify.title="공식 판매처 앱에서 이 상품과 매장을 직접 검색해 확인하세요. 재고가 있다는 뜻은 아닙니다.";
      buttons.append(verify);
    }
    if(mart && mart.lookupUrl) {
      const lookup=make("a","radar-mart-lookup-link",mart.lookupLabel+" ↗");
      lookup.href=mart.lookupUrl;
      lookup.target="_blank";lookup.rel="noopener noreferrer";
      lookup.title="공식 웹사이트로 이동합니다. 점포 및 상품을 직접 선택해야 하며, 카드 재고가 있다는 뜻은 아닙니다.";
      buttons.append(lookup);
    }
    if (store.origin==="official-directory" && store.sourceUrl) {
      const official=make("a","", "공식 매장 정보");
      official.href=store.sourceUrl;
      official.target="_blank";official.rel="noopener noreferrer";
      buttons.append(official);
    }
    if (state.map) {
      const show=make("button","","지도에서 보기");
      show.type="button";
      show.addEventListener("click",() => {
        setView("map");
        state.map.setView([store.lat,store.lng],Math.max(state.map.getZoom(),15));
        if(store.marker)store.marker.openPopup();
      });
      buttons.append(show);
    }
    card.append(buttons);target.append(card);
  }
  function stockProductCount(store) {
    const seen=new Set();
    for(const item of store.verifiedInventory||[]) {
      const age=Date.now()-Date.parse(item.checkedAt);
      if(!isCardProduct(item.name) ||
        (state.pack && String(item.code||"").toLowerCase()!==state.pack.toLowerCase()) ||
        !Number.isSafeInteger(item.quantity) || item.quantity<=0 ||
        !Number.isFinite(age) || age < -60000 || age >= 15*60000)continue;
      seen.add(stockProductIdentity(item));
    }
    return seen.size;
  }
  function renderMapMarkers(shops) {
    if (!state.map || !state.pinLayer) return;
    state.pinLayer.clearLayers();
    for (const store of shops) {
      const mapColors={convenience:"#4168dc",mart:"#ed9b2a"};
      const hasStock=inventoryLabel(store).known;
      const color=mapColors[store.kind]||mapColors.mart;
      const count=stockProductCount(store);
      const marker=(state.onlyInStock && hasStock && window.L.divIcon
        ? window.L.marker([store.lat,store.lng],{
          icon:window.L.divIcon({className:"radar-stock-marker",html:
            '<span class="radar-stock-marker-bubble" aria-hidden="true">'+count+
            '<small>종</small></span>',iconSize:[48,38],iconAnchor:[24,36]})
        })
        : window.L.circleMarker([store.lat,store.lng],{
          color:hasStock?"#bd263f":color,
          fillColor:color,fillOpacity:.92,weight:hasStock?4:2,radius:hasStock?9:7
        })).addTo(state.pinLayer);
      const popup=make("div","");
      const stock = inventoryLabel(store);
      popup.append(make("strong","",store.name),
        make("p","",(store.kind==="mart"?martBrandLabel(martBrand(store.chain||store.name)):
            CONVENIENCE_CHAIN_LABELS[convenienceChain(store)])+
          " · "+(stock.known?stock.message:stock.detail)));
      if(state.onlyInStock && hasStock)popup.append(make("small","",
        "확인된 카드 상품 "+count+"종 · 마지막 재고 응답 기준"));
      marker.bindPopup(popup);
      store.marker=marker;
    }
  }
  function render() {
    // Capture the complete nearby population first. The stock-only preference changes
    // only the visible list and map markers, not the population or API request totals.
    const nearbyStores = mergeInventory(state.shops).filter(selectedKind)
      .filter((store) => store.distance <= state.radiusKm + .03);
    const inStockStores = nearbyStores.filter((store) => inventoryLabel(store).known);
    const displayedStores = filterStoresForDisplay(nearbyStores);
    const hasResults = state.mapChecked || state.inventory.length > 0 || state.shops.length > 0 || state.retailerShops.length > 0 || state.masterShops.length > 0 || state.publicShops.length > 0;
    const list = byId("radar-stores");
    list.replaceChildren();
    currentSummary(nearbyStores.length, displayedStores.length);
    byId("radar-stock-filter-count").textContent = hasResults
      ? "재고 있음 " + inStockStores.length + "곳" : "재고 있음 —곳";
    byId("radar-map-mode-count").textContent = !hasResults ? "매장 탐색 전" :
      state.onlyInStock ? "재고 확인 "+inStockStores.length+"곳" :
        "매장 "+nearbyStores.length+"곳 · 재고 확인 "+inStockStores.length+"곳";
    byId("radar-map-mode-note").textContent = state.onlyInStock
      ? (inStockStores.length===0
          ? "현재 검색 반경에서 연결된 재고 API가 확인한 카드 보유 매장이 없습니다. 조회 불가 매장은 품절로 간주하지 않습니다."
          : "재고가 확인된 매장만 지도에 표시합니다. 지도 이동 후 다시 검색하면 새 지역으로 갱신됩니다.")
      : "전체 매장 위치를 표시합니다. 재고 보기에서는 확인된 포켓몬 카드 재고 보유 매장만 강조합니다.";
    byId("radar-stock-checked").textContent = hasResults
      ? String(nearbyStores.filter((store) => inventoryLabel(store).checked).length) : "—";
    renderMapMarkers(displayedStores);
    if (!displayedStores.length) {
      const box = make("div","radar-empty");
      const heading = state.onlyInStock
        ? (state.searching ? "재고 있는 매장을 찾는 중입니다" : "현재 재고 있는 매장이 확인되지 않았습니다")
        : "표시할 매장 정보가 없습니다";
      const description = state.onlyInStock
        ? (state.searching
          ? "판매처 조회가 진행 중입니다. 카드 재고 1개 이상이 확인되면 목록과 지도에 표시됩니다."
          : "조회할 수 없었던 매장은 품절로 확정된 것이 아닙니다. ‘재고 있는 매장만 보기’를 해제하면 전체 매장을 볼 수 있습니다.")
        : (state.locationChosen
          ? "검색 버튼을 눌러 주변 매장 후보를 찾거나 검색 범위를 바꿔 보세요."
          : "내 위치 또는 지역명을 설정하고 매장 탐색을 시작하세요.");
      box.append(make("span","",state.onlyInStock ? "📡" : "📍"),
        make("h3","",heading),make("p","",description));
      list.append(box);
      return;
    }
    for (const store of displayedStores) addStoreCard(list,store);
  }
  async function search() {
    if (state.searching) return;
    state.searching = true;
    state.hasSearched = true;
    const button = byId("radar-search");
    button.disabled = true;
    state.shops = [];
    state.retailerShops = [];
    state.masterShops = [];
    state.publicShops = [];
    byId("radar-public-status").textContent="주변 매장 정보를 찾는 중…";
    byId("radar-db-status").textContent="매장 정보를 확인하는 중…";
    state.inventory = [];
    state.mapChecked = false;
    state.providerNotes = [];
    state.providerOutcomes = {};
    renderProviderDiagnostics();
    const jobs = inventoryJobs();
    const includeCuStores = state.kind==="all" ||
      (state.kind==="convenience" && ["all","cu"].includes(state.convenienceBrand));
    state.progress = {completed:0,total:jobs.length+3+(includeCuStores?1:0),successes:0,failures:0,active:true};
    updateProgress("매장 및 카드 재고 탐색 중");
    render();
    setStatus("카드 상품만 확인하고 있습니다. 매장 후보와 API 응답이 들어오는 순서대로 결과가 갱신됩니다.");
    const query = categoryQuery(state.radiusKm*1000,state.center.lat,state.center.lng);
    const mapTask = fetchJson("https://overpass.kumi.systems/api/interpreter", {
      method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body:"data="+encodeURIComponent(query)
    },30000).then((result)=>{
      if(!result || !Array.isArray(result.elements))throw new Error("INVALID_RESPONSE");
      state.shops = parseShops(result.elements);
      return true;
    }).catch(()=>false).then((ok)=>{
      state.mapChecked = true;
      completeProgressStep(ok, "재고 조회 중", false);
      render();
      return ok;
    });
    const cuStoreTask = !includeCuStores ? Promise.resolve(null) :
      fetchJson(API_BASE+"/api/cu/stores?"+new URLSearchParams({
        lat:state.center.lat.toFixed(5),lng:state.center.lng.toFixed(5),limit:"150"
      }).toString(),{cache:"no-store"},25000)
        .then((payload)=>{
          state.retailerShops = parseCuStoreDirectory(payload);
          return true;
        }).catch(()=>false).then((ok)=>{
          completeProgressStep(ok,"매장 위치 조회 중",false);
          render();
          return ok;
        });
    const dbTask=loadSelfDbStores()
      .then((records)=>{
        state.masterShops=records;
        byId("radar-db-status").textContent="등록된 매장 "+records.length+"곳 확인";
        return true;
      })
      .catch(()=>{
        byId("radar-db-status").textContent="일부 매장 정보를 가져오지 못했습니다.";
        return false;
      }).then((ok)=>{
        completeProgressStep(ok,"자체 DB 매장 조회 중",false);
        render();
        return ok;
      });
    const govTask=loadPublicShopLocations().then(result=>{
      state.publicShops=result.stores;
      byId("radar-public-status").textContent=result.configured
        ? "주변 매장 후보 "+result.stores.length+"곳 추가 확인"+
          (result.coverageLimited?" · 일부 구역은 빠져 있을 수 있습니다.":"")
        : "일부 매장 정보를 확인할 수 없습니다.";
      return result.configured;
    }).catch(()=>{
      byId("radar-public-status").textContent=
        "일부 매장 정보를 가져오지 못했습니다.";
      return false;
    }).then(ok=>{
      completeProgressStep(ok,"정부 상가 위치 조회",false);
      render();
      return ok;
    });
    const areaTask=jobs.some(task=>["seveneleven","emart24"].includes(task.provider))
      ? resolveRetailerArea() : Promise.resolve("");
    const stockTask = fetchLiveInventory(jobs,areaTask);
    const martFeedTask = loadMartInventory();
    const [mapOK,cuOK,dbOK,govOK] = await Promise.all([mapTask,cuStoreTask,dbTask,govTask,stockTask,martFeedTask]);
    state.progress.active = false;
    updateProgress("검색 종료");
    render();
    const candidates = mergeInventory(state.shops).filter(selectedKind)
      .filter((store)=>store.distance <= state.radiusKm + .03);
    const withNumbers = candidates.filter((store)=>inventoryLabel(store).checked).length;
    const positive = candidates.filter((store)=>inventoryLabel(store).known).length;
    const partial = !mapOK || !dbOK || !govOK || state.progress.failures>0;
    setStatus("재고 확인 "+positive+"곳 · 주변 매장 "+candidates.length+"곳. "+
      (partial?"일부 매장은 조회하지 못했습니다. ":"")+
      "재고 미확인 매장은 품절이 아닐 수 있습니다.",partial);
    button.disabled=false;
    state.searching=false;
    // A pack changed while this search was running. Never treat an old broad
    // query as proof that the newly selected pack is unavailable.
    if(state.packRefreshPending){
      state.packRefreshPending=false;
      void search();
    }
  }

  // An independent, public REST aggregator, documented by the Daiso MCP project.
  // API responses are never converted into "0 stock" unless the retailer returned a number 0.
  const API_BASE = "https://mcp.aka.page";
  const PACK_TITLES = new Map(PRODUCTS);
  const packFromTitle = (name) => {
    const found = PRODUCTS.find((p) => name.toLowerCase().includes(p[1].toLowerCase()) ||
      (p[0] === "m6a" && /30주년/.test(name)));
    return found ? found[0] : "";
  };
  function validQuantity(q) {
    return typeof q === "number" && Number.isSafeInteger(q) && q >= 0;
  }
  // Retailer keyword endpoints can return approximate search matches.
  // A named pack query may only confirm that named pack; a general pack
  // query can admit any recognized Pokémon TCG product.
  function matchesRequestedCardProduct(name,keyword){
    if(!isCardProduct(name))return false;
    if(!keyword || keyword==="포켓몬카드 부스터팩")return true;
    const norm=(value)=>String(value).normalize("NFKC").toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g,"");
    const actual=norm(name),requested=norm(keyword);
    if(!actual || !requested)return false;
    if(/30thcelebration|30주년/.test(requested))
      return /30thcelebration|30주년/.test(actual);
    return actual.includes(requested);
  }
  function stockProductIdentity(item){
    const sku=String(item.retailerSku||"").trim();
    if(/^[A-Za-z0-9_-]{1,72}$/.test(sku))return "sku:"+sku.toLowerCase();
    return "name:"+String(item.name||"").normalize("NFKC").toLowerCase()
      .replace(/\s+/g,"").slice(0,110);
  }
  function storeFromResult(raw, kind, source, product, quantity, observedAt, retailerSku="") {
    if (!raw || !validQuantity(quantity) || !isCardProduct(product)) return null;
    const lat = Number(raw.latitude ?? raw.lat);
    const lng = Number(raw.longitude ?? raw.lng);
    if (!validCoord(lat, lng)) return null;
    const record = {
      id: String(raw.storeCode || raw.bizNo || raw.storeName || "").slice(0,90),
      retailerId: {"CU":"cu","GS25":"gs25","세븐일레븐":"seveneleven","이마트24":"emart24"}[source]||"",
      chain: source,
      name: String(raw.storeName || raw.name || "").slice(0,90),
      address: String(raw.address || "").slice(0,120),
      kind, lat, lng,
      inventorySource:"public-aggregator",
      items:[{code:packFromTitle(product),name:product.slice(0,90),quantity,
        retailerSku:/^[A-Za-z0-9_-]{1,72}$/.test(String(retailerSku))?String(retailerSku):"",
        checkedAt:observedAt,provider:source,inventorySource:"public-aggregator"}]
    };
    return record.id && record.name ? record : null;
  }
  // Seven-Eleven's upstream store search is text-based; without a local
  // keyword, it can return the first stores elsewhere in Korea. Reverse-geocode
  // just once per search (not once per product/retailer request), and cache it.
  const retailerAreaCache=new Map();
  let retailerDistrictFallback="";
  function normalizeRetailerDistrict(reverse){
    const addr=reverse && reverse.address || {};
    const district=[addr.city_district,addr.borough,addr.county,addr.city]
      .find(value=>typeof value==="string" && /[가-힣]{2,}/.test(value));
    return district ? district.replace(/(특별자치시|특별시|광역시|시|군|구)$/,"").trim().slice(0,24) : "";
  }
  function emart24FallbackArea(provider,error,narrowArea,wideArea){
    // Live check: Emart24 returned HTTP 500 for 금곡동 and HTTP 200
    // for 분당. Only retry server errors, never auth failures or throttling.
    if(provider!=="emart24" || !/^HTTP 5\d\d$/.test(String(error?.message||"")))return "";
    if(!wideArea || wideArea===narrowArea)return "";
    return wideArea;
  }
  function normalizeRetailerArea(reverse){
    const addr=reverse && reverse.address || {};
    // A district name (e.g. 분당구) can cover hundreds of shops; selecting
    // its first 60 results misses nearby branches. Prefer 동/리 granularity.
    const candidate=[addr.neighbourhood,addr.quarter,addr.suburb,
      addr.village,addr.town,addr.city_district,addr.borough,
      addr.municipality,addr.city,addr.county,addr.state_district]
      .find(value=>typeof value==="string" && /[가-힣]{2,}/.test(value));
    return candidate ? candidate.replace(/(특별자치시|특별시|광역시|자치구|구)$/,"").trim().slice(0,24) : "";
  }
  async function resolveRetailerArea(){
    retailerDistrictFallback="";
    const input=byId("radar-place").value.trim();
    // A typed place also needs its parent district for server-error fallback.
    const key=state.center.lat.toFixed(3)+","+state.center.lng.toFixed(3);
    const cached=retailerAreaCache.get(key);
    if(cached && Date.now()<cached.until){
      retailerDistrictFallback=cached.district||"";
      return input.length>1?input:cached.keyword;
    }
    const q=new URLSearchParams({format:"jsonv2",addressdetails:"1",
      zoom:"14","accept-language":"ko",lat:state.center.lat.toFixed(5),
      lon:state.center.lng.toFixed(5)});
    try {
      const data=await fetchJson("https://nominatim.openstreetmap.org/reverse?"+q,
        {headers:{"Accept":"application/json"}},7000);
      const keyword=input.length>1?input:normalizeRetailerArea(data);
      const district=normalizeRetailerDistrict(data);
      retailerDistrictFallback=district!==keyword?district:"";
      if(retailerAreaCache.size>=16)retailerAreaCache.clear();
      retailerAreaCache.set(key,{keyword,district:retailerDistrictFallback,
        until:Date.now()+10*60000});
      return keyword;
    }catch(_){return input.length>1?input:"";}
  }
  function endpoint(provider, keyword,storeArea="") {
    const p=new URLSearchParams();
    p.set("keyword", keyword);
    if(provider !== "seveneleven") {
      p.set("lat", state.center.lat.toFixed(5));
      p.set("lng", state.center.lng.toFixed(5));
    }
    if(provider === "cu") {
      p.set("size","10");p.set("storeLimit","55");
    } else if(provider === "seveneleven") {
      if(storeArea) p.set("storeKeyword",storeArea);
      p.set("storeLimit","60");
    } else if(provider === "gs25") {
      p.set("storeLimit","60");
    } else if(provider === "emart24") {
      if(storeArea) p.set("storeKeyword",storeArea);
      p.set("pageSize","12");p.set("storeLimit","60");
    }
    return API_BASE+"/api/"+provider+"/inventory?"+p.toString();
  }
  function parseRetail(provider, payload, responseAt,requestedKeyword="") {
    if(!payload || payload.success !== true || !payload.data) throw new Error("PROVIDER_ERROR");
    const data=payload.data, results=[];
    if(provider === "cu") {
      if(data.inventory?.available===false) return results;
      const name=String(data.nearbyStores?.stockItemName || "");
      for(const store of data.nearbyStores?.stores || []) {
        const parsed=storeFromResult(store,"convenience","CU",name,store.stock,responseAt);
        if(parsed)results.push(parsed);
      }
    } else if(provider === "gs25") {
      // Source chooses a verified SKU when available, but can fall back
      // to a broad keyword-only stock search. A displayed positive count must
      // not be inferred from the keyword in that fallback response.
      if(data.itemCodeUsed===false || (data.itemCodeUsed===true &&
        !/^[A-Za-z0-9_-]{2,72}$/.test(String(data.itemCode||""))))return results;
      const name=String(data.product?.name || "");
      if(name && !matchesRequestedCardProduct(name,requestedKeyword))return results;
      for(const store of data.inventory?.stores || []) {
        const displayedName=String(store.searchItemName || name);
        // A per-store label disagreeing with the selected SKU's pack set
        // is an identity conflict, not independent proof of inventory.
        const sourceSet=packFromTitle(name),storeSet=packFromTitle(displayedName);
        if(sourceSet && storeSet && sourceSet!==storeSet)continue;
        const parsed=storeFromResult(store,"convenience","GS25",
          name||displayedName,store.realStockQuantity,responseAt,
          data.itemCode || "");
        if(parsed)results.push(parsed);
      }
    } else if(provider === "seveneleven") {
      if(data.stockAvailable!==true)return results;
      const name=String(data.product?.itemName || "");
      for(const store of data.inventory?.stores || []) {
        const parsed=storeFromResult(store,"convenience","세븐일레븐",
          name,store.stockQuantity,responseAt,data.product?.itemCode||"");
        if(parsed)results.push(parsed);
      }
    } else if(provider === "emart24") {
      const nearby=Array.isArray(data.nearbyStores)?data.nearbyStores:(data.nearbyStores?.stores||[]);
      const selectedPlu=String(data.pluCd||"").trim();
      const stockPlu=String(data.goodsInfo?.pluCd||"").trim();
      // Retailer stock must be for the product identified by the selected PLU.
      if(stockPlu && selectedPlu && stockPlu!==selectedPlu)return results;
      // The API may choose a non-first candidate. Never substitute candidate[0].
      const selectedCandidate=(data.productCandidates||[]).find(
        item=>selectedPlu && String(item.pluCd||"").trim()===selectedPlu);
      const selectedName=String(selectedCandidate?.goodsName||
        selectedCandidate?.goodsNm||"");
      const authoritativeName=String(data.goodsInfo?.goodsName||
        data.goodsInfo?.goodsNm||"");
      const selectedSet=packFromTitle(selectedName),
        goodsSet=packFromTitle(authoritativeName);
      if(selectedSet && goodsSet && selectedSet!==goodsSet)return results;
      const name=String(authoritativeName||selectedName);
      for(const store of data.stores || []) {
        const companion=nearby.find((row)=>String(row.storeCode)===String(store.bizNo));
        // Some responses contain the coordinate directly on the stock row.
        // A missing companion must not erase it.
        const parsed=storeFromResult({...store,
          latitude:companion?.latitude??store.latitude??store.lat,
          longitude:companion?.longitude??store.longitude??store.lng,
          storeName:store.storeName || companion?.storeName,
          address:store.address || companion?.address,
          storeCode:store.bizNo},"convenience","이마트24",name,store.bizQty,responseAt,
          selectedPlu || stockPlu);
        if(parsed)results.push(parsed);
      }
    }
    return results.filter((row)=>
      matchesRequestedCardProduct(row.items[0].name,requestedKeyword) &&
      distanceKm(state.center,row) <= state.radiusKm+.03);
  }
  function liveQueries() {
    if(state.pack) return [PACK_TITLES.get(state.pack)].filter(Boolean);
    // Cover all nine *named* packs in the site's supported selection list.
    // Do not rely on a generic search that can return an unrelated product.
    // This still cannot enumerate every product sold by each retailer.
    return PRODUCTS.map(([,title])=>title);
  }
  function inventoryJobs() {
    const providers = state.kind === "mart" ? [] :
      (state.kind === "convenience" && state.convenienceBrand !== "all"
        ? (state.convenienceBrand === "other" ? [] : [state.convenienceBrand])
        : ["cu","seveneleven","gs25","emart24"]);
    // Distribute the requests among chains instead of nine calls to one chain
    // before checking another. The circuit breaker below limits wasted calls.
    return liveQueries().flatMap((keyword)=>
      providers.map((provider)=>({provider,keyword})));
  }
  // A 429 or an explicit stock-unavailable response tells us this provider
  // cannot satisfy the remaining pack requests right now. Two consecutive 5xx
  // errors indicate upstream instability; stop instead of hammering it.
  function updateProviderCircuit(broken,failures,provider,error){
    const reason=String(error?.message||"");
    const failureCount=(failures.get(provider)||0)+1;
    if(reason==="STOCK_UNAVAILABLE" || /^HTTP 429\b/.test(reason)){
      broken.add(provider);
      return true;
    }
    if(/^HTTP 5\d\d\b/.test(reason) && failureCount>=2){
      broken.add(provider);
      return true;
    }
    failures.set(provider,/^HTTP 5\d\d\b/.test(reason)?failureCount:0);
    return false;
  }
  function groupInventoryRows(records) {
    const grouped = new Map();
    for (const record of records) {
      const id = record.items[0].provider+"|"+record.id;
      if (!grouped.has(id)) grouped.set(id,record);
      else {
        const existing=grouped.get(id);
        const item=record.items[0];
        const index=existing.items.findIndex((entry)=>
          stockProductIdentity(entry)===stockProductIdentity(item));
        if(index<0)existing.items.push(item);
        else if(Date.parse(existing.items[index].checkedAt)<Date.parse(item.checkedAt))
          existing.items[index]=item;
      }
    }
    return [...grouped.values()];
  }
  async function fetchLiveInventory(jobs,areaTask=Promise.resolve("")) {
    const all=[];
    const notes=[];
    let index=0,emart24PreferDistrict=false;
    const brokenProviders=new Set();
    const upstreamFailures=new Map();
    async function worker() {
      while(index<jobs.length) {
        const task=jobs[index++];
        if(brokenProviders.has(task.provider)){
          // Skipped work is not an actual failed HTTP request.
          notes.push(task.provider+":skipped");
          recordProviderOutcome(task.provider,"skipped");
          state.providerNotes=notes.slice();
          state.progress.skipped=(state.progress.skipped||0)+1;
          completeProgressStep(false,"재고 조회 중",false);
          renderProviderDiagnostics();
          continue;
        }
        let success=false;
        try {
          const needsArea=task.provider==="seveneleven"||task.provider==="emart24";
          const storeArea=needsArea?await areaTask:"";
          // Never query arbitrary first 60 Seven-Eleven stores nationwide and
          // report zero near the selected GPS point.
          if(task.provider==="seveneleven" && !storeArea)
            throw new Error("SEVENELEVEN_LOCALITY_UNAVAILABLE");
          const selectedArea=task.provider==="emart24" &&
            emart24PreferDistrict && retailerDistrictFallback ?
            retailerDistrictFallback : storeArea;
          let payload;
          try {
            payload=await fetchJson(endpoint(task.provider,task.keyword,selectedArea),
              {cache:"no-store"},28000);
          }catch(error){
            const wider=emart24FallbackArea(task.provider,error,
              selectedArea,retailerDistrictFallback);
            if(!wider)throw error;
            emart24PreferDistrict=true;
            payload=await fetchJson(endpoint(task.provider,task.keyword,wider),
              {cache:"no-store"},28000);
          }
          if(payload?.success !== true || !payload.data)throw new Error("PROVIDER_ERROR");
          if(task.provider==="cu" && payload.data.inventory?.available===false)
            throw new Error("STOCK_UNAVAILABLE");
          if(task.provider==="seveneleven" && payload.data.stockAvailable===false)
            throw new Error("STOCK_UNAVAILABLE");
          if(task.provider==="gs25" && payload.data.itemCodeUsed===false)
            throw new Error("PRODUCT_SKU_UNVERIFIED");
          if(task.provider==="emart24"){
            const data=payload.data;
            const plu=String(data.pluCd||"").trim();
            const chosen=(data.productCandidates||[]).find(
              item=>plu && String(item.pluCd||"").trim()===plu);
            const candidateSet=packFromTitle(String(chosen?.goodsName||chosen?.goodsNm||""));
            const goodsSet=packFromTitle(String(data.goodsInfo?.goodsName||
              data.goodsInfo?.goodsNm||""));
            if(candidateSet && goodsSet && candidateSet!==goodsSet)
              throw new Error("PRODUCT_SKU_CONFLICT");
          }
          const rows=parseRetail(task.provider,payload,new Date().toISOString(),task.keyword);
          all.push(...rows);
          recordProviderOutcome(task.provider,"success",rows);
          success=true;
          upstreamFailures.set(task.provider,0);
          notes.push(task.provider+":ok");
        } catch (error) {
          updateProviderCircuit(brokenProviders,upstreamFailures,task.provider,error);
          recordProviderOutcome(task.provider,"failure",[],error);
          notes.push(task.provider+":error");
        } finally {
          state.providerNotes=notes.slice();
          renderProviderDiagnostics();
          state.inventory=groupInventoryRows(all);
          completeProgressStep(success,"재고 조회 중");
          render();
        }
      }
    }
    await Promise.all([worker(),worker()]);
    return state.inventory;
  }
  // Only the first search is user-initiated. Changing the selected pack after
  // a search must issue new pack-specific requests, not merely filter the
  // previous five broad keyword responses.
  function schedulePackRefresh(runSearch=search){
    if(!state.hasSearched)return false;
    if(state.searching){
      state.packRefreshPending=true;
      return false;
    }
    void runSearch();
    return true;
  }
  function initialize() {
    const product=byId("radar-pack");
    for(const [code,title] of PRODUCTS) {
      const option=make("option","",title);
      option.value=code;
      product.append(option);
    }
    const requested=new URLSearchParams(location.search).get("pack");
    if(requested && PRODUCTS.some((p)=>p[0].toLowerCase()===requested.toLowerCase()))product.value=requested;
    state.pack=product.value;
    product.addEventListener("change",()=>{
      state.pack=product.value;
      render();
      const started=schedulePackRefresh();
      if(state.hasSearched){
        setStatus(started?"선택한 카드팩을 자동으로 새로 조회합니다. 이전 검색 결과만 필터링하지 않습니다.":
          "기존 검색이 끝나면 선택한 카드팩을 다시 조회합니다.");
      }else{
        setStatus("카드팩을 선택했습니다. ‘이 지역 매장 탐색’을 눌러 재고를 확인하세요.");
      }
    });
    const type=byId("radar-store-kind");
    const martField=byId("radar-mart-brand-field");
    const martSelect=byId("radar-mart-brand");
    const convenienceField=byId("radar-convenience-brand-field");
    const convenienceSelect=byId("radar-convenience-brand");
    type.addEventListener("change",()=>{
      state.kind=type.value;
      martField.hidden=type.value!=="mart";
      convenienceField.hidden=type.value!=="convenience";
      if(type.value!=="mart"){state.martBrand="all";martSelect.value="all";}
      if(type.value!=="convenience"){state.convenienceBrand="all";convenienceSelect.value="all";}
      render();
      if(!state.searching)setStatus("매장 유형을 변경했습니다. 새 유형의 조회 범위를 정확하게 확인하려면 다시 탐색해 주세요.");
    });
    martSelect.addEventListener("change",()=>{
      state.martBrand=martSelect.value;
      render();
    });
    convenienceSelect.addEventListener("change",()=>{
      state.convenienceBrand=convenienceSelect.value;
      render();
      if(!state.searching)setStatus("편의점 브랜드를 변경했습니다. 선택한 판매처의 재고는 ‘이 지역 매장 탐색’을 다시 눌러 최신 조회를 시작하세요.");
    });
    document.querySelectorAll("[data-radius]").forEach((button) =>
      button.addEventListener("click",()=>setRadius(Number(button.dataset.radius))));
    document.querySelectorAll("[data-view]").forEach((button) =>
      button.addEventListener("click",()=>setView(button.dataset.view)));
    byId("radar-geolocate").addEventListener("click",()=>showGeolocate());
    byId("radar-find-place").addEventListener("click",findPlace);
    byId("radar-place").addEventListener("keydown",(event) => {
      if(event.key==="Enter"){event.preventDefault();void findPlace();}
    });
    byId("radar-search").addEventListener("click",()=>void search());
    byId("radar-search-map-area").addEventListener("click",searchCurrentMapArea);
    byId("radar-coverage").addEventListener("toggle",()=>{
      if(byId("radar-coverage").open)void loadCoverage();
    });
    byId("radar-coverage-refresh").addEventListener("click",()=>void loadCoverage());
    const stockFilter = byId("radar-only-in-stock");
    stockFilter.addEventListener("change",()=>setStockOnly(stockFilter.checked));
    document.querySelectorAll("[data-map-mode]").forEach((button)=>
      button.addEventListener("click",()=>setStockOnly(button.dataset.mapMode==="stock")));
    initMap();
    let saved=3;
    try {saved=Number(localStorage.getItem("digitalCardBinderRadarRadiusV1"))||3;}catch(_){}
    setRadius(saved);
    setView("list");
    let savedStockOnly = false;
    try { savedStockOnly = localStorage.getItem("digitalCardBinderRadarOnlyInStockV1") === "1"; }
    catch (_) {}
    setStockOnly(savedStockOnly);
    void Promise.all([loadInventory(),loadStoreCatalog(),loadMartProviders(),loadMartInventory()]).then(render);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();