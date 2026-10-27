"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const SERIES_URL = "./data/series.json";
  const STORAGE_DOCUMENT = "pokemonCollectionsDex";
  const MAX_DEXES = 30;
  const MAX_CARDS_PER_DEX = 1500;
  const PICKER_PAGE_SIZE = 50;
  const CUSTOM_CARD_PAGE_SIZE = 50;
  // Korean collector names that do not appear in the series DB's English set title.
  const SET_SEARCH_ALIASES = {
    m6a: ["30주년", "포켓몬 30주년", "30th anniversary", "30thcelebration"],
  };

  const state = {
    firebase: null,
    user: null,
    documentRef: null,
    dexes: {},
    catalog: [],
    catalogMap: new Map(),
    catalogSetCodes: new Set(),
    pickerVisibleCount: PICKER_PAGE_SIZE,
    customCardVisibleCount: CUSTOM_CARD_PAGE_SIZE,
    customCardPageStart: 0,
    selectedDexId: "",
    filter: "all",
    query: "",
    editingDexId: "",
    draggedKey: "",
    dragKeys: [],
    dragDestination: null,
    touchDrag: null,
    dragGhost: null,
    dragScrollFrame: 0,
    saveQueue: Promise.resolve(),
    pickedCatalogKeys: new Set(),
    bulkOrderMode: false,
    bulkOrderKeys: new Set(),
    bulkSaving: false,
    ownershipSaving: false,
    photoQueue: [],
    photoSaving: false,
    photoCache: new Map(),
    publicSyncTimer: null,
  };

  const $ = (id) => document.getElementById(id);

  function clean(value) {
    return String(value || "").trim();
  }

  function normalize(value) {
    return clean(value).toLocaleLowerCase("ko-KR");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function searchMatches(card, query) {
    const terms = normalize(query).normalize("NFKC").split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const setCode = normalize(card.setCode);
    const haystack = card.search || normalize([
      card.name, card.setCode, card.setTitle, card.cardNumber,
      ...(SET_SEARCH_ALIASES[setCode] || []),
    ].join(" "));
    // An exact set code must not match a substring of another set (M6a != SM6a).
    return terms.every((term) => state.catalogSetCodes.has(term)
      ? setCode === term
      : haystack.includes(term));
  }

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId &&
        clean(CONFIG.ownerEmail),
    );
  }

  function isOwnerAccount(user) {
    return Boolean(
      user &&
        normalize(user.email) &&
        normalize(user.email) === normalize(CONFIG.ownerEmail),
    );
  }

  function makeId(prefix) {
    const random = globalThis.crypto?.getRandomValues
      ? [...crypto.getRandomValues(new Uint32Array(2))]
          .map((value) => value.toString(36))
          .join("")
      : Math.random().toString(36).slice(2, 14);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  function normalizeCardEntry(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const key = clean(value.key);
    if (!key) return null;
    const manual = value.manual && typeof value.manual === "object" && !Array.isArray(value.manual)
      ? {
          name: clean(value.manual.name).slice(0, 80),
          setCode: clean(value.manual.setCode).slice(0, 30),
          cardNumber: clean(value.manual.cardNumber).slice(0, 40),
          imageUrl: clean(value.manual.imageUrl).slice(0, 600),
        }
      : null;
    return {
      key,
      owned: Boolean(value.owned),
      manual: manual && manual.name && manual.imageUrl ? manual : null,
    };
  }

  function normalizeDex(value, fallbackId) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const id = clean(value.id || fallbackId);
    const title = clean(value.title).slice(0, 60);
    if (!id || !title) return null;
    const cards = Array.isArray(value.cards)
      ? value.cards.map(normalizeCardEntry).filter(Boolean).slice(0, MAX_CARDS_PER_DEX)
      : [];
    const seen = new Set();
    const uniqueCards = cards.filter((card) => {
      if (seen.has(card.key)) return false;
      seen.add(card.key);
      return true;
    });
    return {
      id,
      title,
      description: clean(value.description).slice(0, 180),
      cards: uniqueCards,
      createdAt: clean(value.createdAt) || new Date().toISOString(),
      updatedAt: clean(value.updatedAt) || new Date().toISOString(),
    };
  }

  function normalizeDexes(source) {
    const result = {};
    if (!source || typeof source !== "object" || Array.isArray(source)) return result;
    Object.entries(source)
      .slice(0, MAX_DEXES)
      .forEach(([id, value]) => {
        const dex = normalizeDex(value, id);
        if (dex) result[dex.id] = dex;
      });
    return result;
  }

  function displayCard(entry) {
    if (entry.manual) {
      return {
        key: entry.key,
        name: entry.manual.name,
        setCode: entry.manual.setCode || "직접 추가",
        setTitle: "",
        cardNumber: entry.manual.cardNumber || "",
        imageUrl: entry.manual.imageUrl,
        owned: entry.owned,
        manual: true,
      };
    }
    const source = state.catalogMap.get(entry.key);
    if (!source) {
      return {
        key: entry.key,
        name: "카드 정보를 찾을 수 없음",
        setCode: "—",
        setTitle: "",
        cardNumber: entry.key,
        imageUrl: "",
        owned: entry.owned,
        missingSource: true,
      };
    }
    return { ...source, owned: entry.owned };
  }

  function currentDex() {
    return state.dexes[state.selectedDexId] || null;
  }

  function orderedDexes() {
    return Object.values(state.dexes).sort((a, b) =>
      String(b.updatedAt).localeCompare(String(a.updatedAt)),
    );
  }

  function totalStats() {
    const dexes = Object.values(state.dexes);
    let cards = 0;
    let owned = 0;
    for (const dex of dexes) {
      cards += dex.cards.length;
      owned += dex.cards.filter((card) => card.owned).length;
    }
    return { dexes: dexes.length, cards, owned };
  }

  function updateAuthUi(error = null) {
    const status = $("custom-auth-status");
    const login = $("custom-login");
    const logout = $("custom-logout");
    const create = $("new-dex-button");
    if (!status) return;

    if (!configured()) {
      status.textContent = "Firebase 설정 필요";
      login.hidden = true;
      logout.hidden = true;
      create.disabled = true;
      return;
    }
    if (error) {
      status.textContent = "Firebase 연결 오류";
      login.hidden = false;
      logout.hidden = true;
      create.disabled = true;
      return;
    }
    if (!state.user) {
      status.textContent = "Google 로그인 후 나만의 도감을 만들 수 있습니다.";
      login.hidden = false;
      logout.hidden = true;
      create.disabled = true;
      return;
    }
    status.textContent = `${state.user.displayName || state.user.email || "내 계정"} · 개인 도감`;
    login.hidden = true;
    logout.hidden = false;
    create.disabled = false;
  }

  async function signIn() {
    if (!state.firebase) return;
    const { auth, authModule } = state.firebase;
    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await authModule.signInWithPopup(auth, provider);
      window.location.reload();
    } catch (error) {
      if (error.code === "auth/popup-closed-by-user") return;
      console.error(error);
      alert(error.message || "Google 로그인에 실패했습니다.");
    }
  }

  async function signOut() {
    if (!state.firebase) return;
    await state.firebase.authModule.signOut(state.firebase.auth);
    window.location.reload();
  }

  async function firstAuthUser(auth, authModule) {
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user || null);
        },
        reject,
      );
    });
  }

  async function loadAccountDocument() {
    if (!state.user || !state.firebase) return;
    const { db, firestoreModule } = state.firebase;
    state.documentRef = firestoreModule.doc(
      db,
      "users",
      state.user.uid,
      CONFIG.userCollection || "collections",
      STORAGE_DOCUMENT,
    );
    const snapshot = await firestoreModule.getDoc(state.documentRef);
    if (snapshot.exists()) {
      state.dexes = normalizeDexes(snapshot.data()?.customDexes || {});
      return;
    }
    const baseMode = isOwnerAccount(state.user) ? "legacy" : "empty";
    await firestoreModule.setDoc(state.documentRef, {
      baseMode,
      email: state.user.email || "",
      displayName: state.user.displayName || "",
      overrides: {},
      customDexes: {},
      createdAt: firestoreModule.serverTimestamp(),
      updatedAt: firestoreModule.serverTimestamp(),
    });
    state.dexes = {};
  }

  async function saveDexes() {
    if (!state.user || !state.documentRef || !state.firebase) {
      throw new Error("Google 로그인 후 저장할 수 있습니다.");
    }
    const operation = async () => {
      await state.firebase.firestoreModule.setDoc(
        state.documentRef,
        {
          customDexes: state.dexes,
          updatedAt: state.firebase.firestoreModule.serverTimestamp(),
        },
        { merge: true },
      );
    };
    const queued = state.saveQueue.then(operation, operation);
    void queued.then(() => {
      if (!window.CollectorPublicSync || !state.firebase || !state.user) return;
      window.clearTimeout(state.publicSyncTimer);
      state.publicSyncTimer = window.setTimeout(() => {
        const { db, firestoreModule } = state.firebase;
        void window.CollectorPublicSync.syncCollectionWithRetry({
          db, firestoreModule, user: state.user, collectionId: "custom", preferServer: true,
        }).catch((error) => console.warn("나만의 도감 공개 동기화 실패", error));
      }, 900);
    }).catch(() => undefined);
    state.saveQueue = queued.catch(() => undefined);
    return queued;
  }

  async function loadCatalog() {
    const response = await fetch(SERIES_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`series.json ${response.status}`);
    const groups = await response.json();
    const catalog = [];
    for (const group of groups || []) {
      for (const card of group.cards || []) {
        const rawCode = clean(card.code || card.meta || `${group.code}_${card.order || catalog.length}`);
        const key = `${clean(group.code)}::${rawCode}`;
        const codePart = rawCode.includes("_") ? rawCode.slice(rawCode.indexOf("_") + 1) : rawCode;
        catalog.push({
          key,
          name: clean(card.name || card.pokemonName || rawCode) || rawCode,
          setCode: clean(group.code),
          setTitle: clean(group.title),
          cardNumber: codePart,
          imageUrl: clean(card.originalImage || card.image),
          search: normalize([
            card.name,
            card.pokemonName,
            rawCode,
            codePart,
            group.code,
            group.title,
            group.displayName,
            ...(SET_SEARCH_ALIASES[normalize(group.code)] || []),
          ].join(" ")),
        });
      }
    }
    state.catalog = catalog;
    state.catalogMap = new Map(catalog.map((card) => [card.key, card]));
    state.catalogSetCodes = new Set(catalog.map((card) => normalize(card.setCode)));
  }

  function renderSummary() {
    const stats = totalStats();
    $("custom-dex-count").textContent = String(stats.dexes);
    $("custom-card-count").textContent = String(stats.cards);
    $("custom-owned-count").textContent = String(stats.owned);
  }

  function renderDexList() {
    const container = $("custom-dex-list");
    const dexes = orderedDexes();
    if (!state.selectedDexId && dexes[0]) state.selectedDexId = dexes[0].id;
    if (state.selectedDexId && !state.dexes[state.selectedDexId]) {
      state.selectedDexId = dexes[0]?.id || "";
    }
    container.replaceChildren();

    if (!state.user) {
      container.innerHTML = `<div class="custom-empty-card"><strong>로그인이 필요합니다.</strong><span>Google 로그인 후 나만의 도감을 만들고 관리할 수 있습니다.</span></div>`;
      return;
    }
    if (!dexes.length) {
      container.innerHTML = `<div class="custom-empty-card"><strong>아직 만든 도감이 없습니다.</strong><span>‘새 도감 만들기’로 첫 번째 테마 도감을 만들어보세요.</span></div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    dexes.forEach((dex) => {
      const owned = dex.cards.filter((card) => card.owned).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `custom-dex-tile${dex.id === state.selectedDexId ? " is-active" : ""}`;
      button.dataset.dexId = dex.id;
      button.innerHTML = `
        <span class="custom-dex-tile-icon ui-icon ui-icon--binder" aria-hidden="true"></span>
        <span class="custom-dex-tile-copy">
          <strong>${escapeHtml(dex.title)}</strong>
          <small>${owned} / ${dex.cards.length}장 보유</small>
        </span>
        <span class="custom-dex-tile-arrow">›</span>
      `;
      button.addEventListener("click", () => {
        state.selectedDexId = dex.id;
        state.customCardVisibleCount = CUSTOM_CARD_PAGE_SIZE;
        state.customCardPageStart = 0;
        state.bulkOrderMode = false;
        state.bulkOrderKeys.clear();
        state.pickedCatalogKeys.clear();
        state.filter = "all";
        state.query = "";
        $("custom-search").value = "";
        setStatusFilter("all");
        renderAll();
      });
      fragment.append(button);
    });
    container.append(fragment);
  }

  function setStatusFilter(filter) {
    state.filter = filter;
    document.querySelectorAll("#custom-status button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.status === filter);
    });
  }

  function filteredEntries(dex) {
    const query = normalize(state.query);
    return dex.cards.filter((entry) => {
      if (state.filter === "owned" && !entry.owned) return false;
      if (state.filter === "missing" && entry.owned) return false;
      if (!query) return true;
      const card = displayCard(entry);
      return searchMatches(card, query);
    });
  }


  function selectedDragKeys(dex, key) {
    const selection = state.bulkOrderMode && state.bulkOrderKeys.has(key)
      ? dex.cards.filter((item) => state.bulkOrderKeys.has(item.key)).map((item) => item.key)
      : [key];
    return selection;
  }

  function clearDropMarker() {
    document.querySelectorAll("#custom-card-grid .custom-drop-before, #custom-card-grid .custom-drop-after")
      .forEach((node) => node.classList.remove("custom-drop-before", "custom-drop-after", "custom-drop-vertical"));
    state.dragDestination = null;
  }

  function previewDropOn(card, event) {
    clearDropMarker();
    if (!card || !state.dragKeys.length || state.dragKeys.includes(card.dataset.cardKey)) return;
    const grid = $("custom-card-grid");
    if (!grid.contains(card)) return;
    const rect = card.getBoundingClientRect();
    const isMultiColumn = [...grid.children].some((other) => {
      if (other === card) return false;
      const bounds = other.getBoundingClientRect();
      return Math.abs(bounds.top - rect.top) < Math.min(bounds.height, rect.height) / 2;
    });
    const after = isMultiColumn
      ? event.clientX >= rect.left + rect.width / 2
      : event.clientY >= rect.top + rect.height / 2;
    card.classList.add(after ? "custom-drop-after" : "custom-drop-before");
    if (!isMultiColumn) card.classList.add("custom-drop-vertical");
    state.dragDestination = { key: card.dataset.cardKey, after };
  }

  // Retain the stored order of the selected group, including nonadjacent cards.
  async function dropDragKeys(dex, movingKeys, destination) {
    if (!dex || !destination || !movingKeys.length || state.bulkSaving) return;
    const before = [...dex.cards];
    const set = new Set(movingKeys);
    if (set.has(destination.key)) return;
    const picked = before.filter((item) => set.has(item.key));
    const rest = before.filter((item) => !set.has(item.key));
    const targetIndex = rest.findIndex((item) => item.key === destination.key);
    if (!picked.length || targetIndex < 0) return;
    const insertAt = targetIndex + (destination.after ? 1 : 0);
    const next = [...rest.slice(0, insertAt), ...picked, ...rest.slice(insertAt)];
    if (next.every((item, index) => item.key === before[index].key)) return;
    const previousTime = dex.updatedAt;
    state.bulkSaving = true;
    dex.cards = next;
    dex.updatedAt = new Date().toISOString();
    renderAll();
    try {
      await saveDexes();
    } catch (error) {
      dex.cards = before;
      dex.updatedAt = previousTime;
      alert(error.message || "드래그한 카드 순서를 저장하지 못했습니다.");
    } finally {
      state.bulkSaving = false;
      renderAll();
    }
  }

  function finishSortingDrag() {
    if (state.dragScrollFrame) cancelAnimationFrame(state.dragScrollFrame);
    state.dragScrollFrame = 0;
    clearDropMarker();
    document.querySelectorAll("#custom-card-grid .is-dragging")
      .forEach((node) => node.classList.remove("is-dragging"));
    state.dragGhost?.remove();
    state.dragGhost = null;
    state.draggedKey = "";
    state.dragKeys = [];
    state.touchDrag = null;
    document.body.classList.remove("custom-touch-sorting");
  }

  function updateTouchDestination() {
    const active = state.touchDrag;
    if (!active?.started) return;
    const target = document.elementFromPoint(active.x, active.y)?.closest?.(".custom-card");
    previewDropOn(target, active);
    if (state.dragGhost) {
      state.dragGhost.style.left = Math.min(window.innerWidth - 110, Math.max(8, active.x + 15)) + "px";
      state.dragGhost.style.top = Math.max(10, active.y - 52) + "px";
    }
  }

  function autoScrollTouchDrag() {
    state.dragScrollFrame = 0;
    const active = state.touchDrag;
    if (!active?.started) return;
    const edge = 85;
    const y = active.y;
    const speed = y < edge ? -Math.min(24, Math.round((edge - y) / 3))
      : y > window.innerHeight - edge ? Math.min(24, Math.round((y - window.innerHeight + edge) / 3))
      : 0;
    if (speed) {
      window.scrollBy(0, speed);
      updateTouchDestination();
    }
    state.dragScrollFrame = requestAnimationFrame(autoScrollTouchDrag);
  }

  function startTouchDrag(event, handle, dex, key) {
    if (event.pointerType === "mouse" || state.bulkSaving || state.touchDrag) return;
    event.preventDefault();
    event.stopPropagation();
    state.dragKeys = selectedDragKeys(dex, key);
    state.touchDrag = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY, started: false,
      dexId: dex.id,
    };
    try { handle.setPointerCapture(event.pointerId); } catch { /* Ignore capture limitations */ }
  }

  function moveTouchDrag(event) {
    const active = state.touchDrag;
    if (!active || active.pointerId !== event.pointerId) return;
    active.x = event.clientX;
    active.y = event.clientY;
    if (!active.started && Math.hypot(active.x - active.startX, active.y - active.startY) >= 7) {
      active.started = true;
      document.body.classList.add("custom-touch-sorting");
      const ghost = document.createElement("div");
      ghost.className = "custom-drag-ghost";
      ghost.textContent = "↕ " + state.dragKeys.length + "장 이동 중";
      document.body.append(ghost);
      state.dragGhost = ghost;
      document.querySelectorAll("#custom-card-grid .custom-card").forEach((card) => {
        if (state.dragKeys.includes(card.dataset.cardKey)) card.classList.add("is-dragging");
      });
      state.dragScrollFrame = requestAnimationFrame(autoScrollTouchDrag);
    }
    if (active.started) {
      event.preventDefault();
      updateTouchDestination();
    }
  }

  function finishTouchDrag(event, dex, cancelled = false) {
    const active = state.touchDrag;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!cancelled && active.started) {
      active.x = event.clientX;
      active.y = event.clientY;
      updateTouchDestination();
    }
    const destination = !cancelled && active.started ? state.dragDestination : null;
    const movingKeys = [...state.dragKeys];
    const sameDex = active.dexId === dex.id;
    finishSortingDrag();
    if (sameDex && destination) void dropDragKeys(dex, movingKeys, destination);
  }

  // Update only the changed card and ownership counters, preserving all image
  // elements, the current 50-card page, mobile controls and scroll position.
  function setCustomOwnershipSaving(busy) {
    state.ownershipSaving = busy;
    document.querySelectorAll("#custom-card-grid .custom-owned-toggle").forEach((button) => {
      button.disabled = busy;
      button.setAttribute("aria-busy", String(busy));
    });
  }

  function refreshCustomOwnershipUi(entry, dex) {
    renderSummary();
    const owned = dex.cards.filter((item) => item.owned).length;
    document.querySelectorAll("#custom-dex-list .custom-dex-tile").forEach((tile) => {
      if (tile.dataset.dexId !== dex.id) return;
      const counter = tile.querySelector(".custom-dex-tile-copy small");
      if (counter) counter.textContent = owned + " / " + dex.cards.length + "장 보유";
    });
    if (currentDex()?.id !== dex.id) return;
    $("selected-dex-progress").textContent = owned + " / " + dex.cards.length + "장 보유";

    // A status-filtered card can enter/leave the results; only the workspace
    // must re-render. The dex switcher and all other collections remain intact.
    if (state.filter !== "all") {
      renderWorkspace();
      return;
    }
    document.querySelectorAll("#custom-card-grid .custom-card").forEach((article) => {
      if (article.dataset.cardKey !== entry.key) return;
      article.classList.toggle("is-owned", entry.owned);
      article.classList.toggle("is-missing", !entry.owned);
      const button = article.querySelector(".custom-owned-toggle");
      if (button) button.textContent = entry.owned ? "✓ 보유" : "○ 미보유";
      const badge = article.querySelector(".status-badge");
      if (badge) {
        badge.classList.toggle("is-owned", entry.owned);
        badge.classList.toggle("is-missing", !entry.owned);
        badge.textContent = entry.owned ? "보유" : "미보유";
      }
      const image = article.querySelector(".custom-card-image");
      if (!image) return;
      const overlay = image.querySelector(".missing-overlay");
      if (entry.owned) {
        overlay?.remove();
      } else if (!overlay) {
        const missing = document.createElement("span");
        missing.className = "missing-overlay";
        missing.textContent = "미보유";
        image.append(missing);
      }
    });
  }

  async function toggleCustomCardOwned(entry, dex) {
    // Serialize this collection's owned-status edits to avoid losing a quick
    // second click while Firestore is persisting the previous snapshot.
    if (state.ownershipSaving || !dex.cards.includes(entry)) return;
    const previousOwned = entry.owned;
    const previousUpdatedAt = dex.updatedAt;
    setCustomOwnershipSaving(true);
    entry.owned = !previousOwned;
    dex.updatedAt = new Date().toISOString();
    refreshCustomOwnershipUi(entry, dex);
    try {
      await saveDexes();
    } catch (error) {
      entry.owned = previousOwned;
      dex.updatedAt = previousUpdatedAt;
      refreshCustomOwnershipUi(entry, dex);
      alert(error.message || "보유 상태를 저장하지 못했습니다.");
    } finally {
      setCustomOwnershipSaving(false);
    }
  }

  function makeCustomCard(entry, index, dex) {
    const card = displayCard(entry);
    const article = document.createElement("article");
    article.className = `pokemon-card custom-card${entry.owned ? " is-owned" : " is-missing"}`;
    article.draggable = true;
    article.dataset.cardKey = entry.key;
    if (state.bulkOrderMode) {
      article.classList.toggle("is-bulk-selected", state.bulkOrderKeys.has(entry.key));
      const choose = document.createElement("label");
      choose.className = "custom-bulk-select";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = state.bulkOrderKeys.has(entry.key);
      check.setAttribute("aria-label", card.name + " 순서 이동 대상으로 선택");
      check.addEventListener("change", () => {
        if (check.checked) state.bulkOrderKeys.add(entry.key);
        else state.bulkOrderKeys.delete(entry.key);
        renderWorkspace();
      });
      choose.append(check, document.createTextNode(" 선택"));
      article.append(choose);
      article.addEventListener("click", (event) => {
        if (!state.bulkOrderMode || event.target.closest("button, input, label, a")) return;
        if (state.bulkOrderKeys.has(entry.key)) state.bulkOrderKeys.delete(entry.key);
        else state.bulkOrderKeys.add(entry.key);
        renderWorkspace();
      });
    }

    const imageWrap = document.createElement("div");
    imageWrap.className = "card-image-wrap custom-card-image";
    if (card.imageUrl) {
      const image = document.createElement("img");
      image.className = "card-image";
      image.loading = "lazy";
      if (card.imageUrl.startsWith("dcb-photo:")) {
        schedulePhotoImage(image, card.imageUrl.slice("dcb-photo:".length));
      } else {
        image.src = card.imageUrl;
      }
      image.alt = `${card.name} 카드`;
      image.onerror = () => article.classList.add("has-image-error");
      imageWrap.append(image);
    }
    const fallback = document.createElement("span");
    fallback.className = "image-fallback";
    fallback.textContent = "이미지를 불러오지 못했습니다";
    imageWrap.append(fallback);
    if (!entry.owned) {
      const overlay = document.createElement("span");
      overlay.className = "missing-overlay";
      overlay.textContent = "미보유";
      imageWrap.append(overlay);
    }

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <span class="card-topline"><span class="number-badge">${escapeHtml(card.setCode || "MY")}</span><span class="status-badge ${entry.owned ? "is-owned" : "is-missing"}">${entry.owned ? "보유" : "미보유"}</span></span>
      <strong class="card-name-ko">${escapeHtml(card.name)}</strong>
      <span class="custom-card-set">${escapeHtml(card.setTitle || card.setCode)}</span>
      <span class="card-meta">${escapeHtml(card.cardNumber || "직접 추가 카드")}</span>
    `;

    const actions = document.createElement("div");
    actions.className = "custom-card-actions";
    const own = document.createElement("button");
    own.type = "button";
    own.className = "custom-owned-toggle";
    own.textContent = entry.owned ? "✓ 보유" : "○ 미보유";
    own.disabled = state.ownershipSaving;
    own.setAttribute("aria-busy", String(state.ownershipSaving));
    own.addEventListener("click", () => void toggleCustomCardOwned(entry, dex));

    const up = document.createElement("button");
    up.type = "button";
    up.title = "앞으로 이동";
    up.setAttribute("aria-label", `${card.name} 앞으로 이동`);
    up.textContent = "↑";
    up.disabled = index === 0;
    up.addEventListener("click", () => moveCard(dex, entry.key, -1));

    const down = document.createElement("button");
    down.type = "button";
    down.title = "뒤로 이동";
    down.setAttribute("aria-label", `${card.name} 뒤로 이동`);
    down.textContent = "↓";
    down.disabled = index === dex.cards.length - 1;
    down.addEventListener("click", () => moveCard(dex, entry.key, 1));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "custom-remove-card";
    remove.title = "도감에서 제거";
    remove.setAttribute("aria-label", `${card.name} 도감에서 제거`);
    remove.textContent = "×";
    remove.addEventListener("click", async () => {
      if (!confirm(`${card.name} 카드를 이 도감에서 제거할까요?`)) return;
      const original = [...dex.cards];
      dex.cards = dex.cards.filter((item) => item.key !== entry.key);
      dex.updatedAt = new Date().toISOString();
      renderAll();
      try {
        await saveDexes();
      } catch (error) {
        dex.cards = original;
        renderAll();
        alert(error.message || "카드를 제거하지 못했습니다.");
      }
    });
    actions.append(own, up, down, remove);

    const grip = document.createElement("button");
    grip.type = "button";
    grip.className = "custom-drag-handle";
    grip.textContent = "⠿";
    grip.title = "잡고 드래그해 카드 순서 변경";
    grip.setAttribute("aria-label", card.name + " 드래그로 순서 변경");
    grip.draggable = false;
    grip.addEventListener("pointerdown", (event) => startTouchDrag(event, grip, dex, entry.key));
    grip.addEventListener("pointermove", moveTouchDrag);
    grip.addEventListener("pointerup", (event) => finishTouchDrag(event, dex));
    grip.addEventListener("pointercancel", (event) => finishTouchDrag(event, dex, true));
    grip.addEventListener("lostpointercapture", (event) => finishTouchDrag(event, dex, true));

    article.append(imageWrap, body, actions, grip);
    article.addEventListener("dragstart", (event) => {
      if (state.bulkSaving) { event.preventDefault(); return; }
      state.draggedKey = entry.key;
      state.dragKeys = selectedDragKeys(dex, entry.key);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", entry.key);
      }
      document.querySelectorAll("#custom-card-grid .custom-card").forEach((node) => {
        if (state.dragKeys.includes(node.dataset.cardKey)) node.classList.add("is-dragging");
      });
    });
    article.addEventListener("dragend", finishSortingDrag);
    article.addEventListener("dragover", (event) => {
      if (!state.dragKeys.length || state.bulkSaving) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      previewDropOn(article, event);
    });
    article.addEventListener("drop", (event) => {
      event.preventDefault();
      const destination = state.dragDestination;
      const keys = [...state.dragKeys];
      finishSortingDrag();
      if (destination) void dropDragKeys(dex, keys, destination);
    });
    return article;
  }

  async function moveCard(dex, key, delta) {
    const index = dex.cards.findIndex((entry) => entry.key === key);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= dex.cards.length) return;
    [dex.cards[index], dex.cards[nextIndex]] = [dex.cards[nextIndex], dex.cards[index]];
    dex.updatedAt = new Date().toISOString();
    renderAll();
    try {
      await saveDexes();
    } catch (error) {
      [dex.cards[index], dex.cards[nextIndex]] = [dex.cards[nextIndex], dex.cards[index]];
      renderAll();
      alert(error.message || "순서를 저장하지 못했습니다.");
    }
  }

  async function moveCardBefore(dex, fromKey, toKey) {
    const original = [...dex.cards];
    const fromIndex = dex.cards.findIndex((entry) => entry.key === fromKey);
    let toIndex = dex.cards.findIndex((entry) => entry.key === toKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = dex.cards.splice(fromIndex, 1);
    if (fromIndex < toIndex) toIndex -= 1;
    dex.cards.splice(toIndex, 0, moved);
    dex.updatedAt = new Date().toISOString();
    renderAll();
    try {
      await saveDexes();
    } catch (error) {
      dex.cards = original;
      renderAll();
      alert(error.message || "순서를 저장하지 못했습니다.");
    }
  }

  function renderBulkToolbar(dex) {
    const toolbar = $("custom-bulk-toolbar");
    toolbar.hidden = !state.bulkOrderMode;
    $("custom-edit-order-button").textContent = state.bulkOrderMode ? "편집 완료" : "순서 편집";
    document.body.classList.toggle("custom-bulk-mode", state.bulkOrderMode);
    if (!state.bulkOrderMode || !dex) return;
    const valid = new Set(dex.cards.map((card) => card.key));
    for (const key of state.bulkOrderKeys) if (!valid.has(key)) state.bulkOrderKeys.delete(key);
    $("custom-bulk-count").textContent = String(state.bulkOrderKeys.size);
    const position = $("custom-bulk-position");
    const previous = Number(position.value) || 1;
    position.replaceChildren();
    for (let i = 1; i <= dex.cards.length; i += 1) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = i + "번째";
      position.append(option);
    }
    position.value = String(Math.min(previous, Math.max(1, dex.cards.length)));
    toolbar.querySelectorAll("button[data-bulk-action]").forEach((button) => {
      button.disabled = state.bulkSaving || !state.bulkOrderKeys.size;
    });
  }

  async function moveSelectedCards(action) {
    const dex = currentDex();
    if (!dex || state.bulkSaving || !state.bulkOrderKeys.size) return;
    const before = [...dex.cards];
    const selected = state.bulkOrderKeys;
    const picked = before.filter((entry) => selected.has(entry.key));
    const rest = before.filter((entry) => !selected.has(entry.key));
    let reordered;
    if (action === "front") reordered = [...picked, ...rest];
    else if (action === "back") reordered = [...rest, ...picked];
    else if (action === "position") {
      const insertAt = Math.min(rest.length, Math.max(0, Number($("custom-bulk-position").value) - 1 || 0));
      reordered = [...rest.slice(0, insertAt), ...picked, ...rest.slice(insertAt)];
    } else {
      reordered = [...before];
      if (action === "up") {
        for (let i = 1; i < reordered.length; i += 1) {
          if (selected.has(reordered[i].key) && !selected.has(reordered[i - 1].key)) {
            [reordered[i - 1], reordered[i]] = [reordered[i], reordered[i - 1]];
          }
        }
      } else if (action === "down") {
        for (let i = reordered.length - 2; i >= 0; i -= 1) {
          if (selected.has(reordered[i].key) && !selected.has(reordered[i + 1].key)) {
            [reordered[i], reordered[i + 1]] = [reordered[i + 1], reordered[i]];
          }
        }
      } else return;
    }
    if (reordered.every((entry, index) => entry.key === before[index].key)) return;
    state.bulkSaving = true;
    dex.cards = reordered;
    dex.updatedAt = new Date().toISOString();
    renderAll();
    try {
      await saveDexes();
      state.bulkOrderKeys.clear();
    } catch (error) {
      dex.cards = before;
      alert(error.message || "선택한 카드의 순서를 저장하지 못했습니다.");
    } finally {
      state.bulkSaving = false;
      renderAll();
    }
  }

  function toggleBulkOrderMode() {
    if (state.bulkSaving) return;
    state.bulkOrderMode = !state.bulkOrderMode;
    state.bulkOrderKeys.clear();
    if (state.bulkOrderMode) {
      state.query = "";
      $("custom-search").value = "";
      setStatusFilter("all");
      state.customCardPageStart = 0;
      state.customCardVisibleCount = CUSTOM_CARD_PAGE_SIZE;
    }
    renderAll();
  }

  // Paginate large personal collections without changing stored card order or ownership.
  // Sorting deliberately exposes all cards, preserving cross-page drag targets.
  function updateCustomCardsPagination(visible, total) {
    const panel = $("custom-cards-pagination");
    if (!panel) return;
    const start = state.bulkOrderMode ? 0 : state.customCardPageStart;
    const end = Math.min(start + visible, total);
    panel.hidden = state.bulkOrderMode || total <= CUSTOM_CARD_PAGE_SIZE;
    const label = $("custom-cards-visible-counter");
    if (label) label.textContent = start
      ? String(start + 1) + "–" + String(end) + " / " + String(total) + "장 표시"
      : String(end) + " / " + String(total) + "장 표시";
    const button = $("custom-cards-load-more");
    if (button) {
      button.hidden = state.bulkOrderMode || end >= total;
      button.textContent = String(Math.min(CUSTOM_CARD_PAGE_SIZE, total - end)) + "장 더보기";
    }
    const select = $("custom-cards-page-jump");
    if (select) {
      const count = Math.ceil(total / CUSTOM_CARD_PAGE_SIZE);
      if (select.options.length !== count) {
        select.replaceChildren();
        for (let page = 0; page < count; page += 1) {
          const offset = page * CUSTOM_CARD_PAGE_SIZE;
          const option = document.createElement("option");
          option.value = String(offset);
          option.textContent = String(offset + 1) + "–" +
            String(Math.min(offset + CUSTOM_CARD_PAGE_SIZE, total)) + "장";
          select.append(option);
        }
      }
      select.value = String(start);
    }
  }

  function loadMoreCustomCards() {
    const dex = currentDex();
    if (!dex || state.bulkOrderMode) return;
    const entries = filteredEntries(dex);
    const start = state.customCardPageStart;
    const current = Math.min(start + state.customCardVisibleCount, entries.length);
    const next = Math.min(current + CUSTOM_CARD_PAGE_SIZE, entries.length);
    if (next <= current) return;
    const positions = new Map(dex.cards.map((card, index) => [card.key, index]));
    const fragment = document.createDocumentFragment();
    for (const entry of entries.slice(current, next)) {
      fragment.append(makeCustomCard(entry, positions.get(entry.key), dex));
    }
    $("custom-card-grid").append(fragment);
    state.customCardVisibleCount = next - start;
    updateCustomCardsPagination(state.customCardVisibleCount, entries.length);
  }

  function jumpToCustomCardPage(value) {
    const dex = currentDex();
    if (!dex || state.bulkOrderMode) return;
    const total = filteredEntries(dex).length;
    const offset = Number(value);
    if (!Number.isSafeInteger(offset) || offset < 0 ||
        offset % CUSTOM_CARD_PAGE_SIZE !== 0 || offset >= total) return;
    state.customCardPageStart = offset;
    state.customCardVisibleCount = CUSTOM_CARD_PAGE_SIZE;
    renderWorkspace();
    $("custom-card-grid")?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }

  function renderWorkspace() {
    const workspace = $("custom-workspace");
    const dex = currentDex();
    renderBulkToolbar(dex);
    if (!dex) {
      workspace.hidden = true;
      $("custom-no-selection").hidden = false;
      const pager = $("custom-cards-pagination");
      if (pager) pager.hidden = true;
      return;
    }
    workspace.hidden = false;
    $("custom-no-selection").hidden = true;
    $("selected-dex-title").textContent = dex.title;
    $("selected-dex-description").textContent = dex.description || "설명 없음";
    const owned = dex.cards.filter((card) => card.owned).length;
    $("selected-dex-progress").textContent = `${owned} / ${dex.cards.length}장 보유`;

    const visibleEntries = filteredEntries(dex);
    $("custom-result-count").textContent = String(visibleEntries.length);
    if (!state.bulkOrderMode && state.customCardPageStart >= visibleEntries.length) {
      state.customCardPageStart = 0;
      state.customCardVisibleCount = CUSTOM_CARD_PAGE_SIZE;
    }
    const start = state.bulkOrderMode ? 0 : state.customCardPageStart;
    const limit = state.bulkOrderMode
      ? visibleEntries.length
      : Math.min(state.customCardVisibleCount, visibleEntries.length - start);
    const grid = $("custom-card-grid");
    grid.replaceChildren();
    const positions = new Map(dex.cards.map((card, index) => [card.key, index]));
    const fragment = document.createDocumentFragment();
    for (const entry of visibleEntries.slice(start, start + limit)) {
      fragment.append(makeCustomCard(entry, positions.get(entry.key), dex));
    }
    grid.append(fragment);
    updateCustomCardsPagination(limit, visibleEntries.length);
    $("custom-card-empty").hidden = visibleEntries.length > 0;
  }

  function renderAll() {
    renderSummary();
    renderDexList();
    renderWorkspace();
  }

  function openDexDialog(dex = null) {
    state.editingDexId = dex?.id || "";
    $("dex-dialog-title").textContent = dex ? "도감 수정" : "새 도감 만들기";
    $("dex-title-input").value = dex?.title || "";
    $("dex-description-input").value = dex?.description || "";
    $("dex-save-button").textContent = dex ? "수정 저장" : "도감 만들기";
    $("dex-dialog").showModal();
    requestAnimationFrame(() => $("dex-title-input").focus());
  }

  async function saveDexFromDialog(event) {
    event.preventDefault();
    if (!state.user) return;
    const title = clean($("dex-title-input").value).slice(0, 60);
    const description = clean($("dex-description-input").value).slice(0, 180);
    if (!title) {
      $("dex-title-input").focus();
      return;
    }
    if (!state.editingDexId && Object.keys(state.dexes).length >= MAX_DEXES) {
      alert(`나만의 도감은 최대 ${MAX_DEXES}개까지 만들 수 있습니다.`);
      return;
    }
    const before = JSON.stringify(state.dexes);
    const now = new Date().toISOString();
    let dex;
    if (state.editingDexId && state.dexes[state.editingDexId]) {
      dex = state.dexes[state.editingDexId];
      dex.title = title;
      dex.description = description;
      dex.updatedAt = now;
    } else {
      const id = makeId("dex");
      dex = { id, title, description, cards: [], createdAt: now, updatedAt: now };
      state.dexes[id] = dex;
      state.selectedDexId = id;
    }
    $("dex-dialog").close();
    renderAll();
    try {
      await saveDexes();
    } catch (error) {
      state.dexes = normalizeDexes(JSON.parse(before));
      renderAll();
      alert(error.message || "도감을 저장하지 못했습니다.");
    }
  }

  async function deleteCurrentDex() {
    const dex = currentDex();
    if (!dex) return;
    if (!confirm(`‘${dex.title}’ 도감을 삭제할까요?\n이 도감에 넣은 카드 목록도 함께 삭제됩니다.`)) return;
    const original = state.dexes[dex.id];
    delete state.dexes[dex.id];
    state.selectedDexId = orderedDexes()[0]?.id || "";
    renderAll();
    try {
      await saveDexes();
    } catch (error) {
      state.dexes[dex.id] = original;
      state.selectedDexId = dex.id;
      renderAll();
      alert(error.message || "도감을 삭제하지 못했습니다.");
    }
  }

  function pickerMatches(query) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return state.catalog.slice(0, PICKER_PAGE_SIZE);
    return state.catalog.filter((card) => searchMatches(card, normalizedQuery));
  }

  function renderPicker() {
    const dex = currentDex();
    const results = $("card-picker-results");
    const previousScrollTop = results.scrollTop;
    results.replaceChildren();
    const matches = pickerMatches($("card-picker-search").value);
    const cards = matches.slice(0, state.pickerVisibleCount);
    $("card-picker-count").textContent = String(matches.length);
    $("card-picker-shown-count").textContent = String(cards.length);
    const more = $("card-picker-load-more");
    more.hidden = cards.length >= matches.length;
    more.textContent = `카드 더 보기 (${cards.length} / ${matches.length})`;
    const existing = new Set(dex?.cards.map((entry) => entry.key) || []);
    for (const key of state.pickedCatalogKeys) if (existing.has(key)) state.pickedCatalogKeys.delete(key);
    $("card-picker-selected-count").textContent = String(state.pickedCatalogKeys.size);
    $("card-picker-add-selected").disabled = !state.pickedCatalogKeys.size || state.bulkSaving;
    const fragment = document.createDocumentFragment();
    cards.forEach((card) => {
      const row = document.createElement("article");
      row.className = "custom-picker-card";
      const image = document.createElement("img");
      image.src = card.imageUrl;
      image.alt = "";
      image.loading = "lazy";
      const copy = document.createElement("div");
      copy.innerHTML = `<strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(card.setCode)} · ${escapeHtml(card.cardNumber)}</span><small>${escapeHtml(card.setTitle)}</small>`;
      const add = document.createElement("button");
      add.type = "button";
      add.className = "primary-button";
      add.disabled = existing.has(card.key);
      add.textContent = existing.has(card.key) ? "추가됨" : "추가";
      add.addEventListener("click", () => void addCatalogCard(card.key));
      const chooser = document.createElement("input");
      chooser.type = "checkbox";
      chooser.className = "custom-picker-checkbox";
      chooser.disabled = existing.has(card.key);
      chooser.checked = state.pickedCatalogKeys.has(card.key);
      chooser.setAttribute("aria-label", card.name + " 선택");
      chooser.addEventListener("change", () => {
        if (chooser.checked) state.pickedCatalogKeys.add(card.key);
        else state.pickedCatalogKeys.delete(card.key);
        renderPicker();
      });
      row.classList.toggle("is-picked", chooser.checked);
      row.prepend(chooser);
      row.append(image, copy, add);
      fragment.append(row);
    });
    results.append(fragment);
    results.scrollTop = previousScrollTop;
    $("card-picker-empty").hidden = matches.length > 0;
  }

  async function addSelectedCatalogCards() {
    const dex = currentDex();
    if (!dex || state.bulkSaving) return;
    const existing = new Set(dex.cards.map((entry) => entry.key));
    const pending = [...state.pickedCatalogKeys].filter((key) => state.catalogMap.has(key) && !existing.has(key));
    if (!pending.length) return;
    const capacity = MAX_CARDS_PER_DEX - dex.cards.length;
    if (pending.length > capacity) {
      alert("이 도감에는 " + capacity + "장까지 추가할 수 있습니다. 선택 항목을 줄여주세요.");
      return;
    }
    const before = [...dex.cards];
    state.bulkSaving = true;
    dex.cards.push(...pending.map((key) => ({ key, owned: false, manual: null })));
    dex.updatedAt = new Date().toISOString();
    renderAll();
    try {
      await saveDexes();
      state.pickedCatalogKeys.clear();
      $("card-picker-dialog").close();
    } catch (error) {
      dex.cards = before;
      alert(error.message || "카드 일괄 추가에 실패했습니다.");
    } finally {
      state.bulkSaving = false;
      renderPicker();
      renderAll();
    }
  }

  function selectVisiblePickerCards() {
    const dex = currentDex();
    const existing = new Set(dex?.cards.map((entry) => entry.key) || []);
    pickerMatches($("card-picker-search").value).forEach((card) => {
      if (!existing.has(card.key)) state.pickedCatalogKeys.add(card.key);
    });
    renderPicker();
  }

  async function addCatalogCard(key) {
    const dex = currentDex();
    if (!dex || !state.catalogMap.has(key)) return;
    if (dex.cards.length >= MAX_CARDS_PER_DEX) {
      alert(`한 도감에는 최대 ${MAX_CARDS_PER_DEX}장까지 넣을 수 있습니다.`);
      return;
    }
    if (dex.cards.some((entry) => entry.key === key)) return;
    dex.cards.push({ key, owned: false, manual: null });
    dex.updatedAt = new Date().toISOString();
    renderPicker();
    renderAll();
    try {
      await saveDexes();
    } catch (error) {
      dex.cards = dex.cards.filter((entry) => entry.key !== key);
      renderPicker();
      renderAll();
      alert(error.message || "카드를 추가하지 못했습니다.");
    }
  }

  async function addManualCard(event) {
    event.preventDefault();
    const dex = currentDex();
    if (!dex) return;
    const name = clean($("manual-card-name").value).slice(0, 80);
    const setCode = clean($("manual-set-code").value).slice(0, 30);
    const cardNumber = clean($("manual-card-number").value).slice(0, 40);
    const imageUrl = clean($("manual-image-url").value).slice(0, 600);
    if (!name || !imageUrl) return;
    try {
      const parsed = new URL(imageUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      alert("http 또는 https 이미지 URL을 입력해주세요.");
      return;
    }
    if (dex.cards.length >= MAX_CARDS_PER_DEX) {
      alert(`한 도감에는 최대 ${MAX_CARDS_PER_DEX}장까지 넣을 수 있습니다.`);
      return;
    }
    const key = makeId("manual");
    dex.cards.push({
      key,
      owned: false,
      manual: { name, setCode, cardNumber, imageUrl },
    });
    dex.updatedAt = new Date().toISOString();
    renderAll();
    try {
      await saveDexes();
      $("manual-card-form").reset();
      $("manual-card-details").open = false;
    } catch (error) {
      dex.cards = dex.cards.filter((entry) => entry.key !== key);
      renderAll();
      alert(error.message || "카드를 추가하지 못했습니다.");
    }
  }

  const photoObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((records, observer) => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          observer.unobserve(record.target);
          const photoId = record.target.dataset.dexPhoto;
          if (photoId) void loadPhotoImage(record.target, photoId);
        }
      }, { rootMargin: "350px" })
    : null;

  function photoRef(id) {
    if (!state.firebase || !state.user || !/^photo_[a-z0-9_]{8,90}$/i.test(id)) return null;
    return state.firebase.firestoreModule.doc(
      state.firebase.db, "users", state.user.uid, "customDexPhotos", id,
    );
  }

  async function loadPhotoImage(image, photoId) {
    const reference = photoRef(photoId);
    if (!reference) return;
    try {
      let promise = state.photoCache.get(photoId);
      if (!promise) {
        promise = state.firebase.firestoreModule.getDoc(reference)
          .then((snapshot) => snapshot.exists() ? snapshot.data()?.imageData : "");
        state.photoCache.set(photoId, promise);
        if (state.photoCache.size > 80) state.photoCache.delete(state.photoCache.keys().next().value);
      }
      const dataUrl = await promise;
      if (dataUrl && image.isConnected && image.dataset.dexPhoto === photoId) image.src = dataUrl;
    } catch (error) {
      state.photoCache.delete(photoId);
      console.warn("나만의 도감 사진을 불러오지 못했습니다.", error);
    }
  }

  function schedulePhotoImage(image, photoId) {
    image.dataset.dexPhoto = photoId;
    if (photoObserver) photoObserver.observe(image);
    else void loadPhotoImage(image, photoId);
  }

  function clearPhotoQueue() {
    state.photoQueue.forEach((item) => URL.revokeObjectURL(item.preview));
    state.photoQueue = [];
    $("custom-photo-files").value = "";
    renderPhotoQueue();
  }

  function renderPhotoQueue() {
    const panel = $("custom-photo-panel");
    panel.hidden = state.photoQueue.length === 0;
    $("custom-photo-count").textContent = String(state.photoQueue.length);
    const container = $("custom-photo-preview");
    container.replaceChildren();
    state.photoQueue.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "custom-photo-item";
      const img = document.createElement("img");
      img.src = item.preview;
      img.alt = "업로드할 사진 " + (index + 1);
      const name = document.createElement("input");
      name.type = "text";
      name.value = item.name;
      name.maxLength = 80;
      name.setAttribute("aria-label", "카드명");
      name.addEventListener("input", () => { item.name = name.value; });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "제외";
      remove.disabled = state.photoSaving;
      remove.addEventListener("click", () => {
        URL.revokeObjectURL(item.preview);
        state.photoQueue.splice(index, 1);
        renderPhotoQueue();
      });
      card.append(img, name, remove);
      container.append(card);
    });
    $("custom-photo-import").disabled = state.photoSaving || !state.photoQueue.length;
    $("custom-photo-clear").disabled = state.photoSaving;
    $("custom-photo-trigger").disabled = state.photoSaving;
  }

  function preparePhotoBatch(files) {
    if (state.photoSaving) return;
    const accepted = [...files].filter((file) => file.type.startsWith("image/") && file.size <= 15 * 1024 * 1024);
    const slots = Math.max(0, 30 - state.photoQueue.length);
    for (const file of accepted.slice(0, slots)) {
      state.photoQueue.push({
        file,
        preview: URL.createObjectURL(file),
        name: clean(file.name.replace(/\.[^.]+$/, "")).slice(0, 80) || "내 카드",
      });
    }
    renderPhotoQueue();
    if (accepted.length > slots || files.length !== accepted.length) {
      $("custom-photo-status").textContent = "한 번에 30장까지, 사진 한 장당 15MB 이하로 선택할 수 있습니다.";
    } else {
      $("custom-photo-status").textContent = "사진명을 필요하면 수정하고 일괄 등록을 누르세요.";
    }
  }

  async function compressPhoto(file) {
    let bitmap = null;
    let image = null;
    let url = "";
    try {
      if (typeof createImageBitmap === "function") {
        try { bitmap = await createImageBitmap(file); } catch { /* Browser fallback */ }
      }
      if (!bitmap) {
        url = URL.createObjectURL(file);
        image = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error("이 사진 형식을 읽을 수 없습니다."));
          el.src = url;
        });
      }
      const width = bitmap?.width || image.naturalWidth;
      const height = bitmap?.height || image.naturalHeight;
      if (!width || !height) throw new Error("이미지 크기를 확인할 수 없습니다.");
      let scale = Math.min(1, 1050 / Math.max(width, height));
      for (let attempt = 0; attempt < 9; attempt += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        canvas.getContext("2d", { alpha: false }).drawImage(bitmap || image, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL("image/webp", Math.max(0.45, 0.83 - attempt * 0.055));
        if (!data.startsWith("data:image/webp;")) {
          data = canvas.toDataURL("image/jpeg", Math.max(0.45, 0.83 - attempt * 0.055));
        }
        canvas.width = 0;
        canvas.height = 0;
        if (data.length <= 245000) return data;
        scale *= 0.84;
      }
      throw new Error("사진 압축에 실패했습니다. 다른 사진을 선택해주세요.");
    } finally {
      if (bitmap?.close) bitmap.close();
      if (url) URL.revokeObjectURL(url);
    }
  }

  async function importPhotoBatch() {
    const dex = currentDex();
    if (!dex || !state.user || state.photoSaving || !state.photoQueue.length) return;
    const capacity = MAX_CARDS_PER_DEX - dex.cards.length;
    if (state.photoQueue.length > capacity) {
      alert("이 도감에는 " + capacity + "장을 더 넣을 수 있습니다.");
      return;
    }
    state.photoSaving = true;
    renderPhotoQueue();
    const candidates = [...state.photoQueue];
    const uploaded = [];
    const failed = [];
    for (const [index, item] of candidates.entries()) {
      $("custom-photo-status").textContent = "사진 저장 중 " + (index + 1) + " / " + candidates.length;
      const id = makeId("photo");
      try {
        const imageData = await compressPhoto(item.file);
        await state.firebase.firestoreModule.setDoc(photoRef(id), {
          schemaVersion: 1,
          dexId: dex.id,
          imageData,
          createdAt: state.firebase.firestoreModule.serverTimestamp(),
        });
        uploaded.push({ item, id, imageData });
      } catch (error) {
        console.warn("사진 저장 실패", error);
        failed.push(item);
      }
    }
    if (uploaded.length) {
      const before = [...dex.cards];
      dex.cards.push(...uploaded.map(({ item, id }) => ({
        key: id,
        owned: $("custom-photo-owned").checked,
        manual: {
          name: clean(item.name).slice(0, 80) || "내 카드",
          setCode: "내 사진",
          cardNumber: "",
          imageUrl: "dcb-photo:" + id,
        },
      })));
      dex.updatedAt = new Date().toISOString();
      try {
        await saveDexes();
        uploaded.forEach(({ item, id, imageData }) => {
          state.photoCache.set(id, Promise.resolve(imageData));
          URL.revokeObjectURL(item.preview);
        });
      } catch (error) {
        dex.cards = before;
        failed.push(...uploaded.map(({ item }) => item));
        await Promise.allSettled(uploaded.map(({ id }) => state.firebase.firestoreModule.deleteDoc(photoRef(id))));
        alert(error.message || "사진을 도감에 연결하지 못했습니다.");
      }
    }
    state.photoQueue = failed;
    state.photoSaving = false;
    renderPhotoQueue();
    renderAll();
    const savedCount = failed.length > candidates.length - uploaded.length ? 0 : uploaded.length;
    $("custom-photo-status").textContent = savedCount + "장 등록 완료 · " + failed.length + "장 실패";
    if (uploaded.length && failed.length === 0) $("card-picker-dialog").close();
  }

  function bindEvents() {
    $("custom-login").addEventListener("click", signIn);
    $("custom-logout").addEventListener("click", signOut);
    $("new-dex-button").addEventListener("click", () => openDexDialog());
    $("edit-dex-button").addEventListener("click", () => {
      const dex = currentDex();
      if (dex) openDexDialog(dex);
    });
    $("delete-dex-button").addEventListener("click", deleteCurrentDex);
    $("add-card-button").addEventListener("click", () => {
      if (!currentDex()) return;
      state.pickerVisibleCount = PICKER_PAGE_SIZE;
      $("card-picker-search").value = "";
      state.pickedCatalogKeys.clear();
      if (!state.photoSaving) clearPhotoQueue();
      renderPicker();
      $("card-picker-dialog").showModal();
      requestAnimationFrame(() => $("card-picker-search").focus());
    });
    $("dex-form").addEventListener("submit", saveDexFromDialog);
    $("dex-dialog-close").addEventListener("click", () => $("dex-dialog").close());
    $("dex-cancel-button").addEventListener("click", () => $("dex-dialog").close());
    $("card-picker-close").addEventListener("click", () => {
      if (!state.photoSaving) { clearPhotoQueue(); $("card-picker-dialog").close(); }
    });
    $("card-picker-search").addEventListener("input", () => {
      state.pickerVisibleCount = PICKER_PAGE_SIZE;
      $("card-picker-results").scrollTop = 0;
      renderPicker();
    });
    $("card-picker-load-more").addEventListener("click", () => {
      state.pickerVisibleCount += PICKER_PAGE_SIZE;
      renderPicker();
    });
    $("card-picker-select-visible").addEventListener("click", selectVisiblePickerCards);
    $("card-picker-clear-selected").addEventListener("click", () => {
      state.pickedCatalogKeys.clear();
      renderPicker();
    });
    $("card-picker-add-selected").addEventListener("click", addSelectedCatalogCards);
    $("custom-photo-trigger").addEventListener("click", () => $("custom-photo-files").click());
    $("custom-photo-files").addEventListener("change", (event) => {
      preparePhotoBatch(event.currentTarget.files || []);
      event.currentTarget.value = "";
    });
    $("custom-photo-clear").addEventListener("click", clearPhotoQueue);
    $("custom-photo-import").addEventListener("click", () => void importPhotoBatch());
    $("card-picker-dialog").addEventListener("close", () => {
      if (!state.photoSaving) clearPhotoQueue();
      state.pickedCatalogKeys.clear();
    });
    $("custom-edit-order-button").addEventListener("click", toggleBulkOrderMode);
    $("custom-bulk-toolbar").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-bulk-action]");
      if (button) void moveSelectedCards(button.dataset.bulkAction);
    });
    $("manual-card-form").addEventListener("submit", addManualCard);
    $("custom-cards-load-more").addEventListener("click", loadMoreCustomCards);
    $("custom-cards-page-jump").addEventListener("change", (event) => jumpToCustomCardPage(event.currentTarget.value));
    $("custom-search").addEventListener("input", (event) => {
      state.query = event.currentTarget.value;
      state.customCardVisibleCount = CUSTOM_CARD_PAGE_SIZE;
      state.customCardPageStart = 0;
      renderWorkspace();
    });
    $("custom-status").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-status]");
      if (!button) return;
      setStatusFilter(button.dataset.status);
      state.customCardVisibleCount = CUSTOM_CARD_PAGE_SIZE;
      state.customCardPageStart = 0;
      renderWorkspace();
    });
    for (const dialog of document.querySelectorAll("dialog")) {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    }
  }

  async function initializeFirebase() {
    if (!configured()) {
      updateAuthUi();
      return;
    }
    try {
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(CONFIG.config);
      const auth = authModule.getAuth(app);
      const db = firestoreModule.getFirestore(app);
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      state.firebase = { auth, db, authModule, firestoreModule };
      state.user = await firstAuthUser(auth, authModule);
      if (state.user) await loadAccountDocument();
      updateAuthUi();
    } catch (error) {
      console.error(error);
      updateAuthUi(error);
    }
  }

  async function init() {
    bindEvents();
    updateAuthUi();
    try {
      await Promise.all([loadCatalog(), initializeFirebase()]);
      renderAll();
    } catch (error) {
      console.error(error);
      $("custom-error").hidden = false;
    }
  }

  init();
})();
