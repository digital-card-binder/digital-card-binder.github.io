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
    radiusKm: 3, kind: "all", pack: "", view: "list",
    shops: [], inventory: [], providerNotes: [], map: null, radiusCircle: null, pinLayer: null,
    searching: false, locationChosen: false, mapChecked: false,
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
    return String(tags.name || tags.brand || "").trim().slice(0, 90);
  }
  function category(tags) {
    const name = safeStoreName(tags);
    const shop = tags.shop || "";
    if (shop === "convenience" || /^(CU|GS25|GS 25|세븐일레븐|7.?Eleven|이마트24|emart24)/i.test(name)) return "convenience";
    if (shop === "supermarket" || /이마트|롯데마트|홈플러스/i.test(name)) return "mart";
    return "cardshop";
  }
  function selectedKind(store) {
    return state.kind === "all" || store.kind === state.kind;
  }
  function currentSummary(count) {
    byId("radar-summary").textContent = state.locationLabel + " · 반경 " + state.radiusKm + "km";
    byId("radar-map-caption").textContent = "반경 " + state.radiusKm + "km";
    byId("radar-location-label").textContent = "검색 중심: " + state.locationLabel +
      " · " + state.center.lat.toFixed(4) + ", " + state.center.lng.toFixed(4);
    const visible = state.mapChecked || state.inventory.length > 0 || state.shops.length > 0;
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
    byId("radar-progress-detail").textContent = total > 0
      ? "완료한 요청 " + completed + " / 전체 " + total + "건 · 실패 포함"
      : "검색을 시작하면 실제 완료한 요청 수만큼 진행됩니다.";
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
    } catch (_) {
      byId("radar-map").hidden = true;
      byId("radar-map-fallback").hidden = false;
    }
  }
  function setRadius(value) {
    if (![1,3,5,10].includes(value) || state.searching) return;
    const changed = value !== state.radiusKm;
    if (changed) {
      state.shops=[];state.inventory=[];state.mapChecked=false;
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
    if (state.shops.length) setStatus("검색 반경을 변경했습니다. 새 범위의 매장을 보려면 ‘이 지역 매장 탐색’을 눌러 주세요.");
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
  function showGeolocate() {
    if(state.searching) return setStatus("검색 종료 후 새 위치를 선택해 주세요.");
    if (!navigator.geolocation) {
      setStatus("이 브라우저에서는 위치 확인을 지원하지 않습니다. 지역명을 입력해 주세요.", true);
      return;
    }
    setStatus("현재 위치 권한을 확인하는 중입니다.");
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude, lng = position.coords.longitude;
      if (!validCoord(lat,lng)) return setStatus("위치 좌표를 확인하지 못했습니다.", true);
      state.center = {lat,lng};
      state.locationLabel = "내 위치";
      state.locationChosen = true;
      state.shops = [];
      state.inventory = [];
      state.mapChecked = false;
      state.progress={completed:0,total:0,successes:0,failures:0,active:false};
      updateProgress("검색 대기");
      centerMap();
      render();
      setStatus("내 위치가 설정되었습니다. ‘이 지역 매장 탐색’을 눌러 주세요.");
    }, () => setStatus("위치 권한이 없거나 위치를 확인할 수 없습니다. 지역명 검색을 이용해 주세요.", true), {
      enableHighAccuracy:false, maximumAge:60000, timeout:12000
    });
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
      'nwr["shop"="convenience"]["name"~"CU|GS25|GS 25|세븐일레븐|7-Eleven|이마트24|emart24",i]' + around + ";" +
      'nwr["shop"="supermarket"]["name"~"이마트|롯데마트|홈플러스",i]' + around + ";" +
      'nwr["shop"="games"]["name"~"카드|TCG|포켓몬|Pokemon",i]' + around + ";" +
      ");out center " + MAX_SHOPS + ";";
  }
  function parseShops(elements) {
    const seen = new Set(), shops = [];
    for (const element of elements || []) {
      const tags = element.tags || {};
      const coords = recordCoords(element);
      const name = safeStoreName(tags);
      if (!coords || !name) continue;
      const distance = distanceKm(state.center, coords);
      if (distance > state.radiusKm + 0.03) continue;
      const key = element.type + ":" + element.id;
      if (seen.has(key)) continue;
      seen.add(key);
      shops.push({
        id:key, name, lat:coords.lat, lng:coords.lng,
        kind:category(tags), distance, origin:"osm",
        addr: String(tags["addr:full"] || tags["addr:street"] || tags["addr:city"] || "").slice(0,120),
        verifiedInventory:[]
      });
    }
    return shops.sort((a,b) => a.distance - b.distance);
  }
  function mergeInventory(shops) {
    // Only records supplied by this site's separately maintained authorized feed are stock records.
    // OpenStreetMap entries are location candidates, never evidence of inventory or card sales.
    const known = state.inventory.filter((s) => {
      return validCoord(s.lat,s.lng) && distanceKm(state.center,s) <= state.radiusKm + .03;
    });
    const merged = shops.slice();
    for (const source of known) {
      let target = merged.find((candidate) =>
        candidate.name.trim().toLowerCase() === source.name.trim().toLowerCase()
        && distanceKm(candidate,source) < .13);
      if (!target) {
        target = {id:"feed:"+source.id,name:source.name,lat:source.lat,lng:source.lng,
          distance:distanceKm(state.center,source),kind:source.kind,
          addr:source.address || "",origin:"authorized-feed",verifiedInventory:[]};
        merged.push(target);
      }
      const existing = target.verifiedInventory || [];
      for (const item of source.items || []) {
        const index = existing.findIndex((p) => p.provider === item.provider && p.name === item.name);
        if (index >= 0) existing[index] = item;
        else existing.push(item);
      }
      target.verifiedInventory = existing;
      target.origin = "authorized-feed";
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
        kind:["convenience","mart","cardshop"].includes(item.kind) ? item.kind : "cardshop",
        address:String(item.address || "").slice(0,120),
        items:Array.isArray(item.items) ? item.items.filter((p) => Number.isInteger(p.quantity) && p.quantity >= 0 &&
          typeof p.name === "string" && typeof p.checkedAt === "string" && Number.isFinite(Date.parse(p.checkedAt)))
          .slice(0,80).map((p) => ({code:String(p.code || "").slice(0,25),
            name:p.name.slice(0,90),quantity:p.quantity,checkedAt:p.checkedAt})) : []
      })).filter((item) => item.id && item.name && validCoord(item.lat,item.lng));
    } catch (_) { state.inventory = []; }
  }
  // Product name is untrusted retailer data: allow confirmed TCG/pack names, reject food and merchandise.
  const NON_CARD_ITEMS = /빵|띠부씰|스티커|샘플|젤리|캔디|껌|초콜릿|과자|스낵|쿠키|케이크|음료|사이다|콜라|우유|아이스크림|도넛|피규어|인형|키링|열쇠고리|봉제|장난감|문구|팬시|슬리브|카드홀더|바인더|카드앨범|필통|파우치|틴케이스|랜덤씰|증정/i;
  const KNOWN_PACK_NAMES = [
    ...PRODUCTS.map((p) => p[1]), "나이트원더러", "배틀파트너즈",
    "테라스탈페스ex", "샤이니트레저ex", "로켓단의 영광",
    "블랙볼트", "화이트플레어", "포켓몬카드151", "포켓몬 카드 151"
  ];
  function isCardProduct(name) {
    if (typeof name !== "string") return false;
    const text = name.trim();
    if (!text || NON_CARD_ITEMS.test(text)) return false;
    const compact = text.replace(/[\\s·_/-]+/g, "").toLowerCase();
    const namedPack = KNOWN_PACK_NAMES.some((pack) =>
      compact.includes(pack.replace(/[\\s·_/-]+/g, "").toLowerCase()));
    return /(포켓몬|pokemon|pokémon).{0,25}(tcg|카드|확장팩|부스터|스타터덱)/i.test(text) ||
      /(tcg|카드게임|트레이딩카드).{0,25}(포켓몬|pokemon|pokémon)/i.test(text) ||
      (namedPack && (/(팩|카드|덱|부스터|확장팩)/i.test(text) || KNOWN_PACK_NAMES.some((pack) =>
        compact === pack.replace(/[\\s·_/-]+/g, "").toLowerCase())));
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
      return { message: item.name + " · 재고 " + item.quantity + "개", known: true,
        checked: true, detail: (item.provider ? item.provider + " · " : "") + "API 응답 " + when + " (시차 가능)" };
    }
    if (fresh.length) return { message: "", known: false, checked: true,
      detail: "조회한 카드 상품 재고 없음 (0개) · 강조 표시 제외" };
    if (cardItems.length) return { message: "", known: false, checked: false,
      detail: "이전 조회 이력만 있음 · 현재 재고 미확인" };
    return { message: "", known: false, checked: false, detail: "카드 재고 미확인" };
  }
  function addStoreCard(target,store) {
    const card=make("article","radar-store");
    const top=make("div","radar-store-top"),title=make("h3","radar-store-title",store.name);
    const km=make("span","radar-store-distance",store.distance.toFixed(1)+"km");
    top.append(title,km);card.append(top);
    const typeName=store.kind==="convenience"?"편의점":store.kind==="mart"?"마트":"카드샵 후보";
    card.append(make("p","radar-store-sub",typeName + (store.addr ? " · "+store.addr:"") + " · 위치 정보 참고용"));
    const summary=inventoryLabel(store);
    if (summary.known) card.append(make("div","radar-stock in-stock",summary.message));
    card.append(make("p","radar-stock-note",summary.detail));
    const buttons=make("div","radar-store-actions");
    const google=make("a","", "지도 길찾기");
    google.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(store.lat+","+store.lng);
    google.target="_blank";google.rel="noopener noreferrer";
    buttons.append(google);
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
  function renderMapMarkers(shops) {
    if (!state.map || !state.pinLayer) return;
    state.pinLayer.clearLayers();
    for (const store of shops) {
      const marker=window.L.circleMarker([store.lat,store.lng],{
        color:store.origin==="authorized-feed"?"#15835c":"#3758c6",
        fillColor:store.origin==="authorized-feed"?"#22b485":"#647ff1",
        fillOpacity:.9,weight:2,radius:7
      }).addTo(state.pinLayer);
      const popup=make("div","");
      const stock = inventoryLabel(store);
      popup.append(make("strong","",store.name),make("p","",stock.known ? stock.message : stock.detail));
      marker.bindPopup(popup);
      store.marker=marker;
    }
  }
  function render() {
    const filtered = mergeInventory(state.shops).filter(selectedKind)
      .filter((s) => s.distance <= state.radiusKm + .03);
    const list = byId("radar-stores");
    list.replaceChildren();
    currentSummary(filtered.length);
    byId("radar-stock-checked").textContent =
      state.mapChecked || state.inventory.length ? String(filtered.filter((s) => inventoryLabel(s).checked).length) : "—";
    renderMapMarkers(filtered);
    if (!filtered.length) {
      const box = make("div","radar-empty");
      box.append(make("span","","📍"),make("h3","","표시할 매장 정보가 없습니다"),
        make("p","",state.locationChosen
          ? "검색 버튼을 눌러 주변 매장 후보를 찾거나 검색 범위를 바꿔 보세요."
          : "내 위치 또는 지역명을 설정하고 매장 탐색을 시작하세요."));
      list.append(box);
      return;
    }
    for (const store of filtered) addStoreCard(list,store);
  }
  async function search() {
    if (state.searching) return;
    state.searching = true;
    const button = byId("radar-search");
    button.disabled = true;
    state.shops = [];
    state.inventory = [];
    state.mapChecked = false;
    state.providerNotes = [];
    const jobs = inventoryJobs();
    state.progress = {completed:0,total:jobs.length+1,successes:0,failures:0,active:true};
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
    const stockTask = fetchLiveInventory(jobs);
    const [mapOK] = await Promise.all([mapTask,stockTask]);
    state.progress.active = false;
    updateProgress("검색 종료");
    render();
    const candidates = mergeInventory(state.shops).filter(selectedKind)
      .filter((store)=>store.distance <= state.radiusKm + .03);
    const withNumbers = candidates.filter((store)=>inventoryLabel(store).checked).length;
    const positive = candidates.filter((store)=>inventoryLabel(store).known).length;
    setStatus("카드 재고 있음 "+positive+"곳 · 재고 응답 매장 "+withNumbers+"곳 · "+
      (mapOK?"지도 후보 검색 완료":"지도 후보 일부 조회 실패")+" · "+
      (jobs.length ? "판매처 API "+state.progress.successes+"건 성공 / "+state.progress.failures+"건 실패." :
        "선택한 매장 유형은 자동 재고조회 미지원.")+
      " 조회되지 않은 매장은 재고 0개로 간주하지 않습니다.",
      !mapOK || state.progress.failures > 0);
    button.disabled=false;
    state.searching=false;
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
  function storeFromResult(raw, kind, source, product, quantity, observedAt) {
    if (!raw || !validQuantity(quantity) || !isCardProduct(product)) return null;
    const lat = Number(raw.latitude ?? raw.lat);
    const lng = Number(raw.longitude ?? raw.lng);
    if (!validCoord(lat, lng)) return null;
    const record = {
      id: String(raw.storeCode || raw.bizNo || raw.storeName || "").slice(0,90),
      name: String(raw.storeName || raw.name || "").slice(0,90),
      address: String(raw.address || "").slice(0,120),
      kind, lat, lng,
      items:[{code:packFromTitle(product),name:product.slice(0,90),quantity,
        checkedAt:observedAt,provider:source}]
    };
    return record.id && record.name ? record : null;
  }
  function endpoint(provider, keyword) {
    const p=new URLSearchParams();
    p.set("keyword", keyword);
    if(provider !== "seveneleven") {
      p.set("lat", state.center.lat.toFixed(5));
      p.set("lng", state.center.lng.toFixed(5));
    }
    if(provider === "cu") {
      p.set("size","10");p.set("storeLimit","55");
    } else if(provider === "seveneleven") {
      const place=byId("radar-place").value.trim();
      if(place.length>1) p.set("storeKeyword", place);
      p.set("storeLimit","60");
    } else if(provider === "gs25") {
      p.set("storeLimit","60");
    } else if(provider === "emart24") {
      p.set("pageSize","12");p.set("storeLimit","60");
    }
    return API_BASE+"/api/"+provider+"/inventory?"+p.toString();
  }
  function parseRetail(provider, payload, responseAt) {
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
      const name=String(data.product?.name || "");
      for(const store of data.inventory?.stores || []) {
        const parsed=storeFromResult(store,"convenience","GS25",
          String(store.searchItemName || name),store.realStockQuantity,responseAt);
        if(parsed)results.push(parsed);
      }
    } else if(provider === "seveneleven") {
      if(data.stockAvailable!==true)return results;
      const name=String(data.product?.itemName || "");
      for(const store of data.inventory?.stores || []) {
        const parsed=storeFromResult(store,"convenience","세븐일레븐",name,store.stockQuantity,responseAt);
        if(parsed)results.push(parsed);
      }
    } else if(provider === "emart24") {
      const nearby=Array.isArray(data.nearbyStores)?data.nearbyStores:(data.nearbyStores?.stores||[]);
      const name=String(data.goodsInfo?.goodsName || data.goodsInfo?.goodsNm ||
        (data.productCandidates || [])[0]?.goodsName || "");
      for(const store of data.stores || []) {
        const companion=nearby.find((row)=>String(row.storeCode)===String(store.bizNo));
        const parsed=storeFromResult({...store,latitude:companion?.latitude,longitude:companion?.longitude,
          storeName:store.storeName || companion?.storeName,
          address:store.address || companion?.address,
          storeCode:store.bizNo},"convenience","이마트24",name,store.bizQty,responseAt);
        if(parsed)results.push(parsed);
      }
    }
    return results.filter((row)=>distanceKm(state.center,row) <= state.radiusKm+.03);
  }
  function liveQueries() {
    if(state.pack) return [PACK_TITLES.get(state.pack)].filter(Boolean);
    // These broad queries cover multiple supported card products, without imposing a pack selection.
    // This is not the entire retailer product universe: supported product coverage is best-effort.
    return ["포켓몬카드","포켓몬스터30주년","스톰에메랄다"];
  }
  function inventoryJobs() {
    const providers = state.kind === "mart" || state.kind === "cardshop" ? [] :
      ["cu","seveneleven","gs25","emart24"];
    return providers.flatMap((provider)=>liveQueries().map((keyword)=>({provider,keyword})));
  }
  function groupInventoryRows(records) {
    const grouped = new Map();
    for (const record of records) {
      const id = record.items[0].provider+"|"+record.id;
      if (!grouped.has(id)) grouped.set(id,record);
      else {
        const existing=grouped.get(id);
        const item=record.items[0];
        const index=existing.items.findIndex((entry)=>entry.name===item.name);
        if(index<0)existing.items.push(item);
        else if(Date.parse(existing.items[index].checkedAt)<Date.parse(item.checkedAt))
          existing.items[index]=item;
      }
    }
    return [...grouped.values()];
  }
  async function fetchLiveInventory(jobs) {
    const all=[];
    const notes=[];
    let index=0;
    async function worker() {
      while(index<jobs.length) {
        const task=jobs[index++];
        let success=false;
        try {
          const payload=await fetchJson(endpoint(task.provider,task.keyword),{cache:"no-store"},28000);
          if(payload?.success !== true || !payload.data)throw new Error("PROVIDER_ERROR");
          if(task.provider==="cu" && payload.data.inventory?.available===false)
            throw new Error("STOCK_UNAVAILABLE");
          if(task.provider==="seveneleven" && payload.data.stockAvailable===false)
            throw new Error("STOCK_UNAVAILABLE");
          const rows=parseRetail(task.provider,payload,new Date().toISOString());
          all.push(...rows);
          success=true;
          notes.push(task.provider+":ok");
        } catch (_) {
          notes.push(task.provider+":error");
        } finally {
          state.providerNotes=notes.slice();
          state.inventory=groupInventoryRows(all);
          completeProgressStep(success,"재고 조회 중");
          render();
        }
      }
    }
    await Promise.all([worker(),worker()]);
    return state.inventory;
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
    product.addEventListener("change",()=>{state.pack=product.value;render();});
    const type=byId("radar-store-kind");
    type.addEventListener("change",()=>{state.kind=type.value;render();});
    document.querySelectorAll("[data-radius]").forEach((button) =>
      button.addEventListener("click",()=>setRadius(Number(button.dataset.radius))));
    document.querySelectorAll("[data-view]").forEach((button) =>
      button.addEventListener("click",()=>setView(button.dataset.view)));
    byId("radar-geolocate").addEventListener("click",showGeolocate);
    byId("radar-find-place").addEventListener("click",findPlace);
    byId("radar-place").addEventListener("keydown",(event) => {
      if(event.key==="Enter"){event.preventDefault();void findPlace();}
    });
    byId("radar-search").addEventListener("click",()=>void search());
    initMap();
    let saved=3;
    try {saved=Number(localStorage.getItem("digitalCardBinderRadarRadiusV1"))||3;}catch(_){}
    setRadius(saved);
    setView("list");
    void loadInventory().then(render);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();