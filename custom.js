"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const SERIES_URL = "./data/series.json";
  const STORAGE_DOCUMENT = "pokemonCollectionsDex";
  const MAX_DEXES = 30;
  const MAX_CARDS_PER_DEX = 1500;

  const state = {
    firebase: null,
    user: null,
    documentRef: null,
    dexes: {},
    catalog: [],
    catalogMap: new Map(),
    selectedDexId: "",
    filter: "all",
    query: "",
    editingDexId: "",
    draggedKey: "",
    saveQueue: Promise.resolve(),
    pickedCatalogKeys: new Set(),
    bulkOrderMode: false,
    bulkOrderKeys: new Set(),
    bulkSaving: false,
    photoQueue: [],
    photoSaving: false,
    photoCache: new Map(),
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
          ].join(" ")),
        });
      }
    }
    state.catalog = catalog;
    state.catalogMap = new Map(catalog.map((card) => [card.key, card]));
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
      return normalize([
        card.name,
        card.setCode,
        card.setTitle,
        card.cardNumber,
      ].join(" ")).includes(query);
    });
  }

  function makeCustomCard(entry, index, dex) {
    const card = displayCard(entry);
    const article = document.createElement("article");
    article.className = `pokemon-card custom-card${entry.owned ? " is-owned" : " is-missing"}`;
    article.draggable = true;
    article.dataset.cardKey = entry.key;
    if (state.bulkOrderMode) {
      article.classList.toggle("is-bulk-selected", state.bulkOrderKeys.has(entry.key));
      article.draggable = false;
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
    own.addEventListener("click", async () => {
      entry.owned = !entry.owned;
      dex.updatedAt = new Date().toISOString();
      renderAll();
      try {
        await saveDexes();
      } catch (error) {
        entry.owned = !entry.owned;
        renderAll();
        alert(error.message || "보유 상태를 저장하지 못했습니다.");
      }
    });

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

    article.append(imageWrap, body, actions);
    article.addEventListener("dragstart", (event) => {
      if (state.bulkOrderMode) { event.preventDefault(); return; }
      state.draggedKey = entry.key;
      article.classList.add("is-dragging");
    });
    article.addEventListener("dragend", () => {
      state.draggedKey = "";
      article.classList.remove("is-dragging");
    });
    article.addEventListener("dragover", (event) => event.preventDefault());
    article.addEventListener("drop", (event) => {
      event.preventDefault();
      if (state.bulkOrderMode) return;
      if (!state.draggedKey || state.draggedKey === entry.key) return;
      void moveCardBefore(dex, state.draggedKey, entry.key);
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
    }
    renderAll();
  }

  function renderWorkspace() {
    const workspace = $("custom-workspace");
    const dex = currentDex();
    renderBulkToolbar(dex);
    if (!dex) {
      workspace.hidden = true;
      $("custom-no-selection").hidden = false;
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
    const grid = $("custom-card-grid");
    grid.replaceChildren();
    visibleEntries.forEach((entry) => {
      const originalIndex = dex.cards.findIndex((item) => item.key === entry.key);
      grid.append(makeCustomCard(entry, originalIndex, dex));
    });
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
    if (!normalizedQuery) return state.catalog.slice(0, 30);
    return state.catalog.filter((card) => card.search.includes(normalizedQuery)).slice(0, 60);
  }

  function renderPicker() {
    const dex = currentDex();
    const results = $("card-picker-results");
    results.replaceChildren();
    const cards = pickerMatches($("card-picker-search").value);
    $("card-picker-count").textContent = String(cards.length);
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
    $("card-picker-empty").hidden = cards.length > 0;
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
    $("custom-photo-status").textContent = uploaded.length - (failed.length > candidates.length - uploaded.length ? uploaded.length : 0) +
      "장 등록 완료 · " + failed.length + "장 실패";
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
    $("card-picker-search").addEventListener("input", renderPicker);
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
    $("custom-edit-order-button").addEventListener("click", toggleBulkOrderMode);
    $("custom-bulk-toolbar").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-bulk-action]");
      if (button) void moveSelectedCards(button.dataset.bulkAction);
    });
    $("manual-card-form").addEventListener("submit", addManualCard);
    $("custom-search").addEventListener("input", (event) => {
      state.query = event.currentTarget.value;
      renderWorkspace();
    });
    $("custom-status").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-status]");
      if (!button) return;
      setStatusFilter(button.dataset.status);
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
