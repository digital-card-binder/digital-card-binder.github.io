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
    shops: [], inventory: [], map: null, radiusCircle: null, pinLayer: null,
    searching: false, locationChosen: false
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
  function currentSummary(count, extra) {
    byId("radar-summary").textContent = state.locationLabel + " · 반경 " + state.radiusKm +
      "km · 지도 등록 매장 후보 " + count + "곳" + (extra || "");
    byId("radar-map-caption").textContent = "반경 " + state.radiusKm + "km";
    byId("radar-location-label").textContent = "검색 중심: " + state.locationLabel +
      " · " + state.center.lat.toFixed(4) + ", " + state.center.lng.toFixed(4);
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
    if (![1,3,5,10].includes(value)) return;
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
      target.verifiedInventory = source.items;
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
  function inventoryLabel(store) {
    const items = (store.verifiedInventory || []).filter((p) =>
      !state.pack || p.code.toLowerCase() === state.pack.toLowerCase());
    if (!items.length) return {message:"재고 조회 불가 · 판매 여부 미확인",known:false};
    const date = new Date(Math.max(...items.map((p) => Date.parse(p.checkedAt))));
    const when = Number.isFinite(date.getTime()) ? date.toLocaleString("ko-KR") : "시각 미확인";
    const line = items.slice(0,4).map((p) => p.name + " " + p.quantity + "개").join(" · ");
    return {message:line + " · 확인 " + when + (items.length>4 ? " 외 " + (items.length-4) + "종" : ""), known:true};
  }
  function addStoreCard(target,store) {
    const card=make("article","radar-store");
    const top=make("div","radar-store-top"),title=make("h3","radar-store-title",store.name);
    const km=make("span","radar-store-distance",store.distance.toFixed(1)+"km");
    top.append(title,km);card.append(top);
    const typeName=store.kind==="convenience"?"편의점":store.kind==="mart"?"마트":"카드샵 후보";
    card.append(make("p","radar-store-sub",typeName + (store.addr ? " · "+store.addr:"") + " · 위치 정보 참고용"));
    const summary=inventoryLabel(store);
    card.append(make("div","radar-stock"+(summary.known?" known":""),summary.message));
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
      popup.append(make("strong","",store.name),make("p","",inventoryLabel(store).message));
      marker.bindPopup(popup);
      store.marker=marker;
    }
  }
  function render() {
    const filtered=mergeInventory(state.shops).filter(selectedKind).filter((s) => s.distance<=state.radiusKm+.03);
    const list=byId("radar-stores");
    list.replaceChildren();
    currentSummary(filtered.length, state.kind!=="all"?" · 매장 유형 필터 적용":"");
    renderMapMarkers(filtered);
    if(!filtered.length) {
      const box=make("div","radar-empty");
      box.append(make("span","","📍"),make("h3","","표시할 매장 정보가 없습니다"),
        make("p","",state.locationChosen?"검색 버튼을 눌러 주변 매장 후보를 찾거나 검색 범위를 바꿔 보세요.":"내 위치 또는 지역명을 설정하고 매장 탐색을 시작하세요."));
      list.append(box);
      return;
    }
    for(const store of filtered) addStoreCard(list,store);
  }
  async function search() {
    if(state.searching)return;
    state.searching=true;
    const button=byId("radar-search");
    button.disabled=true;
    setStatus("공개 지도에서 매장 후보를 찾고 있습니다. 공개 지도에는 실제 재고 수량이 포함되지 않습니다.");
    try {
      const query=categoryQuery(state.radiusKm*1000,state.center.lat,state.center.lng);
      const result=await fetchJson("https://overpass.kumi.systems/api/interpreter",{
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
        body:"data="+encodeURIComponent(query)
      },30000);
      if(!result || !Array.isArray(result.elements))throw new Error("INVALID_RESPONSE");
      state.shops=parseShops(result.elements);
      render();
      const count=mergeInventory(state.shops).filter(selectedKind).length;
      setStatus("공개 지도 기반 매장 후보 "+count+"곳 표시 · 카드 판매 여부 및 재고는 확인되지 않았습니다. 재고 연동 매장의 수량만 별도로 표시합니다.");
    } catch(error) {
      state.shops=[];
      render();
      setStatus(errorMessage(error,"공개 매장 지도 데이터에 연결하지 못했습니다. 잠시 후 다시 검색하거나 검색 범위를 줄여 주세요."),true);
    } finally {
      button.disabled=false;state.searching=false;
    }
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