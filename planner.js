"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const accountCore = window.DigitalCardBinder?.firebaseAccount;
  const identity = window.DigitalCardBinder?.cardIdentity;
  const catalog = window.DigitalCardBinder?.catalog;
  const TRADE_DRAFT_KEY = "digitalCardBinderTradeDraftV2";
  const PAGE_SIZE = 120;
  const DOC_ID = "pokemonCollectionsDex";

  const state = {
    firebase: null,
    user: null,
    groups: [],
    cards: [],
    cardMap: new Map(),
    keyMap: new Map(),
    owned: new Set(),
    ownedSources: new Map(),
    planner: { wishlist: [], trade: [], quantities: {} },
    history: [],
    filter: "wishlist",
    query: "",
    visible: PAGE_SIZE,
    sourceDocument: {},
    saving: false,
  };

  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value || "").trim();
  const compact = (value) => clean(value).toLocaleLowerCase("ko-KR").replace(/[\s·._()#-]+/g, "");
  const formatNumber = (value) => new Intl.NumberFormat("ko-KR").format(Number(value) || 0);

  function normalizeSetCode(value) {
    return clean(value).toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9+]/g, "");
  }

  function normalizedCardNumber(value) {
    const text = clean(value).replace(/\s+/g, "");
    const slash = text.match(/(?:^|[_:-])0*(\d{1,4})\/\d{1,4}/i) || text.match(/^0*(\d{1,4})\/\d{1,4}/);
    if (slash) return String(Number(slash[1]));
    const separated = text.match(/(?:_|-)(0*\d{1,4})(?:\D|$)/i);
    if (separated) return String(Number(separated[1]));
    const leading = text.match(/^0*(\d{1,4})(?:\D|$)/);
    return leading ? String(Number(leading[1])) : "";
  }

  function fingerprint(setCode, value) {
    const set = normalizeSetCode(setCode);
    const number = normalizedCardNumber(value);
    return set && number ? `${set}::${number}` : "";
  }

  function decodeImage(value, base) {
    const source = clean(value);
    return source.startsWith("@/") ? `${base}${source.slice(1)}` : source;
  }

  function decodeIndex(payload) {
    const imageBase = clean(payload?.imageBase);
    return (payload?.groups || []).map(([code, title, displayName, era, cards]) => ({
      code, title, displayName, era,
      cards: (cards || []).map((entry) => {
        const [cardCode, name, pokemonName, image, meta, cardNumber, accountIndex, owned, originalImage, rarity, illustrators, trainers] = entry;
        return {
          code: cardCode,
          name,
          pokemonName,
          image: decodeImage(image, imageBase),
          meta,
          cardNumber,
          accountIndex,
          owned: owned === 1,
          originalImage: decodeImage(originalImage, imageBase),
          rarity: clean(rarity),
          illustrators: clean(illustrators).split("|").map(clean).filter(Boolean),
          trainers: clean(trainers).split("|").map(clean).filter(Boolean),
        };
      }),
    }));
  }

  function buildCards() {
    const output = [];
    state.keyMap.clear();
    state.groups.forEach((group, groupIndex) => {
      (group.cards || []).forEach((card, cardIndex) => {
        const fp = fingerprint(group.code, card.cardNumber || card.code || card.meta);
        if (!fp) return;
        const item = {
          fingerprint: fp,
          setCode: clean(group.code),
          setName: clean(group.displayName || group.title || group.code),
          era: clean(group.era),
          card,
          group,
          groupIndex,
          cardIndex,
        };
        if (!state.cardMap.has(fp)) {
          state.cardMap.set(fp, item);
          output.push(item);
        }
        try {
          const accountKey = identity?.cardIdentity?.("series", group, card, groupIndex, cardIndex);
          if (accountKey) state.keyMap.set(accountKey, item);
        } catch {}
      });
    });
    state.cards = output;
  }

  function overrideOwned(value) {
    if (typeof value === "boolean") return value;
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.owned);
  }

  function addOwned(setCode, number, source) {
    const fp = fingerprint(setCode, number);
    if (!fp || !state.cardMap.has(fp)) return;
    state.owned.add(fp);
    if (!state.ownedSources.has(fp)) state.ownedSources.set(fp, new Set());
    state.ownedSources.get(fp).add(source);
  }

  function setCodeFromCardCode(value) {
    const match = clean(value).match(/^([a-z0-9+]+)[_-]/i);
    return match?.[1] || "";
  }

  function applySeriesOwnership(documentData) {
    const overrides = documentData?.overrides && typeof documentData.overrides === "object" ? documentData.overrides : {};
    const legacy = documentData?.baseMode === "legacy" || accountCore?.isOwner?.(CONFIG, state.user);
    state.groups.forEach((group, groupIndex) => {
      (group.cards || []).forEach((card, cardIndex) => {
        const fp = fingerprint(group.code, card.cardNumber || card.code || card.meta);
        if (!fp) return;
        let owned = legacy && Boolean(card.owned);
        try {
          const key = identity.cardIdentity("series", group, card, groupIndex, cardIndex);
          if (Object.prototype.hasOwnProperty.call(overrides, key)) owned = overrideOwned(overrides[key]);
        } catch {}
        if (owned) addOwned(group.code, card.cardNumber || card.code || card.meta, "시리즈 도감");
      });
    });
  }

  function applyArtistOwnership(documentData) {
    const overrides = documentData?.overrides || {};
    Object.entries(overrides).forEach(([key, value]) => {
      if (!overrideOwned(value)) return;
      const parts = key.split("::");
      if (parts.length >= 4) addOwned(parts[1], parts[2], "작가 도감");
    });
  }

  function applyArOwnership(documentData) {
    const overrides = documentData?.overrides || {};
    Object.entries(overrides).forEach(([key, value]) => {
      if (!overrideOwned(value)) return;
      const parts = key.split("::");
      if (parts.length >= 3) addOwned(parts[0], parts[1], "AR 전종도감");
    });
  }

  function applyPokemonOwnership(documentData) {
    const overrides = documentData?.overrides || {};
    Object.entries(overrides).forEach(([key, value]) => {
      if (!overrideOwned(value)) return;
      const parts = key.split("::");
      if (parts[0] === "trainerPokemon" && parts.length >= 3) {
        addOwned(setCodeFromCardCode(parts[2]), parts[2], "트레이너 × 포켓몬");
        return;
      }
      if (parts[0]?.startsWith("FOSSIL-") && parts.length >= 2) {
        addOwned(setCodeFromCardCode(parts[1]) || parts[0].replace(/^FOSSIL-/i, ""), parts[1], "화석 도감");
        return;
      }
      if (parts.length >= 3) {
        const chunks = parts[1].split("·").map(clean).filter(Boolean);
        const setCode = chunks.length >= 2 ? chunks[chunks.length - 1] : "";
        addOwned(setCode, chunks[0] || parts[1], "포켓몬 컬렉션");
      }
    });

    const customDexes = documentData?.customDexes && typeof documentData.customDexes === "object"
      ? Object.values(documentData.customDexes)
      : [];
    customDexes.forEach((dex) => (dex?.cards || []).forEach((entry) => {
      if (!entry?.owned) return;
      if (entry.manual) addOwned(entry.manual.setCode, entry.manual.cardNumber, "나만의 도감");
      else {
        const parts = clean(entry.key).split("::");
        if (parts.length >= 2) addOwned(parts[0], parts.slice(1).join("::"), "나만의 도감");
      }
    }));
  }

  function applyNationalOwnership(documentData) {
    const overrides = documentData?.overrides || {};
    Object.values(overrides).forEach((value) => {
      if (!overrideOwned(value) || !value?.setCode || !value?.cardNumber) return;
      addOwned(value.setCode, value.cardNumber, "전국도감");
    });
  }

  function quantityFor(item) {
    const stored = Number(state.planner.quantities?.[item.fingerprint]) || 0;
    return Math.max(state.owned.has(item.fingerprint) ? 1 : 0, stored);
  }

  function normalizePlanner(value) {
    const wishlist = Array.isArray(value?.wishlist) ? value.wishlist.filter((key) => state.cardMap.has(key)).slice(0, 1500) : [];
    const trade = Array.isArray(value?.trade) ? value.trade.filter((key) => state.cardMap.has(key)).slice(0, 1500) : [];
    const quantities = {};
    if (value?.quantities && typeof value.quantities === "object") {
      Object.entries(value.quantities).forEach(([key, amount]) => {
        const number = Math.max(0, Math.min(99, Number(amount) || 0));
        if (number > 1 && state.cardMap.has(key)) quantities[key] = number;
      });
    }
    return { wishlist, trade, quantities };
  }

  async function firebaseContext() {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
    ]);
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(CONFIG.config);
    const auth = authModule.getAuth(app);
    const user = await accountCore.firstAuthUser(auth, authModule);
    return { authModule, firestoreModule, auth, db: firestoreModule.getFirestore(app), user };
  }

  async function readCollection(documentId) {
    const ref = accountCore.documentRef(state.firebase.firestoreModule, state.firebase.db, state.user, CONFIG, documentId);
    const snap = await state.firebase.firestoreModule.getDoc(ref);
    return snap.exists() ? snap.data() || {} : {};
  }

  async function loadAccountData() {
    const [series, artist, pokemon, ar, national] = await Promise.all([
      readCollection("seriesDex"),
      readCollection("artistDex"),
      readCollection("pokemonCollectionsDex"),
      readCollection("arDex"),
      readCollection("nationalDex"),
    ]);
    state.sourceDocument = pokemon;
    state.planner = normalizePlanner(pokemon.plannerV1);
    state.history = Array.isArray(pokemon.historyV1) ? pokemon.historyV1.slice(-300) : [];
    state.owned.clear();
    state.ownedSources.clear();
    applySeriesOwnership(series);
    applyArtistOwnership(artist);
    applyPokemonOwnership(pokemon);
    applyArOwnership(ar);
    applyNationalOwnership(national);
  }

  async function savePlanner() {
    if (state.saving || !state.user) return;
    state.saving = true;
    try {
      const ref = accountCore.documentRef(state.firebase.firestoreModule, state.firebase.db, state.user, CONFIG, DOC_ID);
      const baseMode = state.sourceDocument.baseMode || accountCore.baseMode(CONFIG, state.user);
      const payload = {
        baseMode,
        email: state.user.email || "",
        displayName: state.user.displayName || "",
        plannerVersion: 1,
        plannerV1: {
          version: 1,
          wishlist: [...new Set(state.planner.wishlist)].slice(0, 1500),
          trade: [...new Set(state.planner.trade)].slice(0, 1500),
          quantities: state.planner.quantities,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: state.firebase.firestoreModule.serverTimestamp(),
      };
      await state.firebase.firestoreModule.setDoc(ref, payload, { merge: true });
      state.sourceDocument = { ...state.sourceDocument, ...payload };
    } catch (error) {
      console.error("수집 관리 저장 실패", error);
      $("planner-error").hidden = false;
    } finally {
      state.saving = false;
    }
  }

  function historyAction(action) {
    return {
      changed: "도감 변경",
      "wishlist-add": "위시 추가",
      "wishlist-remove": "위시 해제",
      "trade-add": "교환 가능 추가",
      "trade-remove": "교환 가능 해제",
      "quantity-change": "수량 변경",
    }[action] || "수집 변경";
  }

  function categoryLabel(category) {
    return {
      series: "시리즈 도감", ar: "AR 전종도감", national: "전국도감",
      artist: "작가 도감", pokemon: "포켓몬 컬렉션", pack: "팩 전종수집",
      people: "인물도감", trainerPokemon: "트레이너 × 포켓몬", planner: "수집 관리",
    }[category] || category || "도감";
  }

  function eventCardName(entry) {
    if (entry.name) return entry.name;
    const direct = state.cardMap.get(entry.key) || state.keyMap.get(entry.key);
    if (direct) return clean(direct.card.name || direct.card.pokemonName || direct.card.code);
    const parts = clean(entry.key).split("::");
    if (parts.length >= 2) {
      const item = state.cardMap.get(fingerprint(parts[0], parts[1]));
      if (item) return clean(item.card.name || item.card.pokemonName || item.card.code);
    }
    return clean(entry.key) || categoryLabel(entry.category);
  }

  function recordPlanner(item, action) {
    window.dispatchEvent(new CustomEvent("pokemon-dex:collection-changed", {
      detail: {
        category: "planner",
        key: item.fingerprint,
        action,
        name: clean(item.card.name || item.card.pokemonName || item.card.code),
      },
    }));
    state.history.push({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      category: "planner",
      key: item.fingerprint,
      action,
      name: clean(item.card.name || item.card.pokemonName || item.card.code),
    });
    state.history = state.history.slice(-300);
  }

  function listForFilter() {
    const wish = new Set(state.planner.wishlist);
    const trade = new Set(state.planner.trade);
    const needle = compact(state.query);
    return state.cards.filter((item) => {
      const owned = state.owned.has(item.fingerprint);
      const quantity = quantityFor(item);
      if (state.filter === "wishlist" && !wish.has(item.fingerprint)) return false;
      if (state.filter === "missing" && owned) return false;
      if (state.filter === "trade" && !(owned && trade.has(item.fingerprint))) return false;
      if (state.filter === "duplicate" && quantity < 2) return false;
      if (!needle) return true;
      return [item.card.name, item.card.pokemonName, item.setCode, item.setName, item.card.code, item.card.cardNumber]
        .map(compact).some((value) => value.includes(needle));
    });
  }

  function makeCard(item) {
    const owned = state.owned.has(item.fingerprint);
    const wishlist = state.planner.wishlist.includes(item.fingerprint);
    const trade = state.planner.trade.includes(item.fingerprint);
    const quantity = quantityFor(item);
    const article = document.createElement("article");
    article.className = `pokemon-card catalog-card planner-card${owned ? "" : " is-missing"}`;
    const imageUrl = window.DigitalCardBinderImageCdn?.resolve(item.card.image || item.card.originalImage) || item.card.image || item.card.originalImage || "";
    article.innerHTML = `
      <div class="card-image-wrap"><img class="card-image" loading="lazy" alt=""><span class="missing-overlay">미보유</span><span class="image-fallback">이미지를 불러오지 못했습니다</span></div>
      <div class="card-body">
        <div class="card-topline"><span class="number-badge"></span><span class="planner-card-badge"></span></div>
        <strong class="card-name-ko"></strong>
        <span class="card-name-en"></span>
        <span class="card-meta"></span>
        <div class="planner-card-actions">
          <button type="button" data-action="wishlist"></button>
          <button type="button" data-action="trade"></button>
          <span class="planner-qty"><button type="button" data-action="minus" aria-label="수량 줄이기">−</button><strong></strong><button type="button" data-action="plus" aria-label="수량 늘리기">+</button></span>
        </div>
      </div>`;
    const img = article.querySelector("img");
    img.src = imageUrl;
    img.alt = `${clean(item.card.name || item.card.pokemonName || "카드")} 카드`;
    img.addEventListener("error", () => article.classList.add("has-image-error"), { once: true });
    article.querySelector(".number-badge").textContent = clean(item.card.cardNumber || item.card.code);
    const badge = article.querySelector(".planner-card-badge");
    badge.textContent = owned ? "보유" : "미보유";
    badge.classList.add(owned ? "is-owned" : "is-missing");
    article.querySelector(".card-name-ko").textContent = clean(item.card.name || item.card.pokemonName || item.card.code);
    article.querySelector(".card-name-en").textContent = item.setName;
    article.querySelector(".card-meta").textContent = [item.setCode, item.card.rarity].filter(Boolean).join(" · ");
    const wishButton = article.querySelector('[data-action="wishlist"]');
    wishButton.textContent = wishlist ? "★ 위시" : "☆ 위시";
    wishButton.classList.toggle("is-active", wishlist);
    const tradeButton = article.querySelector('[data-action="trade"]');
    tradeButton.textContent = trade ? "✓ 교환 가능" : "교환 가능";
    tradeButton.classList.toggle("is-active", trade);
    tradeButton.disabled = !owned;
    article.querySelector(".planner-qty strong").textContent = String(quantity);

    article.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "wishlist") {
        state.planner.wishlist = wishlist
          ? state.planner.wishlist.filter((key) => key !== item.fingerprint)
          : [...state.planner.wishlist, item.fingerprint];
        recordPlanner(item, wishlist ? "wishlist-remove" : "wishlist-add");
      } else if (action === "trade" && owned) {
        state.planner.trade = trade
          ? state.planner.trade.filter((key) => key !== item.fingerprint)
          : [...state.planner.trade, item.fingerprint];
        recordPlanner(item, trade ? "trade-remove" : "trade-add");
      } else if (action === "plus") {
        state.planner.quantities[item.fingerprint] = Math.min(99, Math.max(1, quantity) + 1);
        recordPlanner(item, "quantity-change");
      } else if (action === "minus") {
        const next = Math.max(owned ? 1 : 0, quantity - 1);
        if (next <= 1) delete state.planner.quantities[item.fingerprint];
        else state.planner.quantities[item.fingerprint] = next;
        recordPlanner(item, "quantity-change");
      }
      await savePlanner();
      renderAll();
    });
    return article;
  }

  function renderList() {
    const all = listForFilter();
    const shown = all.slice(0, state.visible);
    $("planner-grid").replaceChildren(...shown.map(makeCard));
    $("planner-result-count").textContent = formatNumber(shown.length);
    $("planner-result-note").textContent = all.length > shown.length ? `/ 전체 ${formatNumber(all.length)}장` : "";
    $("planner-more").hidden = shown.length >= all.length;
    $("planner-empty").hidden = all.length > 0;
  }

  function renderSummary() {
    const trade = new Set(state.planner.trade);
    const duplicateCount = state.cards.filter((item) => quantityFor(item) >= 2).length;
    $("planner-wishlist-count").textContent = formatNumber(state.planner.wishlist.length);
    $("planner-trade-count").textContent = formatNumber([...trade].filter((key) => state.owned.has(key)).length);
    $("planner-duplicate-count").textContent = formatNumber(duplicateCount);
  }

  function renderHistory() {
    const history = [...state.history].sort((a, b) => clean(b.at).localeCompare(clean(a.at)));
    const cutoff = Date.now() - 30 * 86400000;
    $("planner-history-30").textContent = formatNumber(history.filter((item) => new Date(item.at).getTime() >= cutoff).length);
    $("planner-history-total").textContent = formatNumber(history.length);
    $("planner-history-latest").textContent = history[0]?.at
      ? new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(history[0].at))
      : "—";
    $("planner-history-empty").hidden = history.length > 0;
    $("planner-history-list").replaceChildren(...history.slice(0, 80).map((entry) => {
      const article = document.createElement("article");
      article.className = "planner-history-item";
      const date = entry.at ? new Date(entry.at) : null;
      article.innerHTML = '<span class="planner-history-icon">✓</span><div class="planner-history-copy"><strong></strong><small></small></div><time></time>';
      article.querySelector("strong").textContent = eventCardName(entry);
      article.querySelector("small").textContent = `${categoryLabel(entry.category)} · ${historyAction(entry.action)}`;
      article.querySelector("time").textContent = date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date)
        : "";
      return article;
    }));
  }

  function renderAll() {
    renderSummary();
    renderList();
    renderHistory();
  }

  function tradeCard(item) {
    return {
      name: clean(item.card.name || item.card.pokemonName || item.card.code).slice(0, 100),
      imageUrl: clean(item.card.image || item.card.originalImage).slice(0, 500),
      detail: [item.card.cardNumber || item.card.code, item.setCode, item.card.rarity].filter(Boolean).join(" · ").slice(0, 160),
      sourcePage: "series.html",
    };
  }

  function prepareTradeDraft() {
    const wantedCards = state.planner.wishlist
      .map((key) => state.cardMap.get(key))
      .filter((item) => item && !state.owned.has(item.fingerprint))
      .slice(0, 6)
      .map(tradeCard);
    if (!wantedCards.length) {
      alert("미보유 위시 카드를 먼저 추가해 주세요.");
      return;
    }
    const offeredCards = state.planner.trade
      .map((key) => state.cardMap.get(key))
      .filter((item) => item && state.owned.has(item.fingerprint))
      .slice(0, 6)
      .map(tradeCard);
    sessionStorage.setItem(TRADE_DRAFT_KEY, JSON.stringify({ wantedCards, offeredCards }));
    window.location.href = "./trades.html?register=1";
  }

  async function clearHistory() {
    if (!confirm("수집 히스토리 기록만 정리할까요? 보유·위시·교환 목록은 그대로 유지됩니다.")) return;
    const ref = accountCore.documentRef(state.firebase.firestoreModule, state.firebase.db, state.user, CONFIG, DOC_ID);
    await state.firebase.firestoreModule.setDoc(ref, {
      baseMode: state.sourceDocument.baseMode || accountCore.baseMode(CONFIG, state.user),
      email: state.user.email || "",
      displayName: state.user.displayName || "",
      historyVersion: 1,
      historyV1: [],
      updatedAt: state.firebase.firestoreModule.serverTimestamp(),
    }, { merge: true });
    state.history = [];
    renderHistory();
  }

  function bindEvents() {
    $("planner-query").addEventListener("input", (event) => {
      state.query = event.currentTarget.value;
      state.visible = PAGE_SIZE;
      renderList();
    });
    $("planner-filter").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      state.filter = button.dataset.filter;
      state.visible = PAGE_SIZE;
      event.currentTarget.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
      renderList();
    });
    $("planner-more").addEventListener("click", () => {
      state.visible += PAGE_SIZE;
      renderList();
    });
    $("planner-trade-draft").addEventListener("click", prepareTradeDraft);
    $("planner-history-clear").addEventListener("click", clearHistory);
  }

  async function init() {
    try {
      await accountCore?.installHeaderPanel?.(CONFIG);
      state.firebase = await firebaseContext();
      state.user = state.firebase.user;
      if (!state.user) {
        $("planner-signin").hidden = false;
        $("planner-content").hidden = true;
        $("planner-login").addEventListener("click", () => document.querySelector("#firebase-login")?.click());
        return;
      }
      $("planner-signin").hidden = true;
      $("planner-content").hidden = false;

      const payload = await catalog.pokemonSearchIndex();
      state.groups = decodeIndex(payload);
      buildCards();
      await loadAccountData();
      bindEvents();
      renderAll();
      void window.DigitalCardBinderHistory?.flush?.();
    } catch (error) {
      console.error("수집 관리 초기화 실패", error);
      $("planner-error").hidden = false;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();
