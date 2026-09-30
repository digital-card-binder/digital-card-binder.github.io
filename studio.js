"use strict";

(function () {
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const registry = window.CollectorCollectionRegistry;
  const catalogService = window.DigitalCardBinder?.catalog;
  if (!registry || !catalogService) {
    console.error("바인더 스튜디오에 필요한 도감 코어를 불러오지 못했습니다.");
    return;
  }

  const SDK_VERSION = "12.16.0";
  const PRINT_MARGIN_MM = 7;
  const A4 = {
    portrait: { width: 210, height: 297, label: "A4 세로" },
    landscape: { width: 297, height: 210, label: "A4 가로" },
  };
  const SIZE_MODES = {
    card: { width: 63, height: 88, label: "실제 카드 63 × 88 mm" },
    sleeve: { width: 65, height: 90, label: "슬리브 65 × 90 mm" },
  };
  const PREVIEW_PAGE_LIMIT = 6;

  const elements = {
    collection: document.querySelector("#studio-collection"),
    scope: document.querySelector("#studio-scope"),
    ownedInputs: [...document.querySelectorAll('input[name="studio-owned"]')],
    sizeInputs: [...document.querySelectorAll('input[name="studio-size"]')],
    reset: document.querySelector("#studio-reset"),
    print: document.querySelector("#studio-print-button"),
    selectionCount: document.querySelector("#studio-selection-count"),
    pageNote: document.querySelector("#studio-page-note"),
    orientation: document.querySelector("#studio-orientation-badge"),
    authStatus: document.querySelector("#studio-auth-status"),
    loading: document.querySelector("#studio-loading"),
    empty: document.querySelector("#studio-empty-preview"),
    preview: document.querySelector("#studio-card-preview"),
    printRoot: document.querySelector("#studio-print-root"),
  };

  if (!elements.collection || !elements.scope || !elements.preview || !elements.printRoot) return;

  const state = {
    firebase: null,
    currentUser: null,
    collectionId: elements.collection.value || "series",
    catalog: null,
    items: [],
    ownedKeys: new Set(),
    selectedItems: [],
    loadToken: 0,
    authReady: false,
    ownershipReady: false,
  };

  const sourceDocumentCache = new Map();
  const visualCatalogCache = new Map();

  function clean(value) {
    return String(value ?? "").trim();
  }

  function selectedOwnedMode() {
    return elements.ownedInputs.find((input) => input.checked)?.value || "all";
  }

  function selectedSizeMode() {
    return elements.sizeInputs.find((input) => input.checked)?.value || "card";
  }

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(CONFIG.enabled && config.apiKey && config.authDomain && config.projectId);
  }

  async function firstAuthUser(auth, authModule) {
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
      return auth.currentUser || null;
    }
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

  function updateAuthControls() {
    const signedIn = Boolean(state.currentUser);
    elements.ownedInputs.forEach((input) => {
      if (input.value === "all") return;
      input.disabled = !signedIn || !state.ownershipReady;
    });

    if (!signedIn && selectedOwnedMode() !== "all") {
      const all = elements.ownedInputs.find((input) => input.value === "all");
      if (all) all.checked = true;
    }

    if (!state.authReady) {
      elements.authStatus.textContent = "로그인 상태를 확인하고 있습니다.";
    } else if (!configured()) {
      elements.authStatus.textContent = "로그인 설정을 확인하지 못해 전체 카드만 인쇄할 수 있습니다.";
    } else if (!signedIn) {
      elements.authStatus.textContent = "전체 카드는 바로 인쇄할 수 있습니다. 보유만·미보유만은 Google 로그인 후 사용할 수 있습니다.";
    } else {
      elements.authStatus.textContent = "로그인된 계정의 선택 도감 보유 기록을 사용합니다.";
    }
  }

  async function initializeFirebase() {
    if (!configured()) {
      state.authReady = true;
      updateAuthControls();
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
      try {
        await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      } catch (error) {
        console.warn("바인더 스튜디오 로그인 유지 설정 실패", error);
      }
      state.firebase = {
        auth,
        db: firestoreModule.getFirestore(app),
        authModule,
        firestoreModule,
      };
      state.currentUser = await firstAuthUser(auth, authModule);
    } catch (error) {
      console.warn("바인더 스튜디오 Firebase 초기화 실패", error);
    } finally {
      state.authReady = true;
      updateAuthControls();
    }
  }

  async function sourceDocumentFor(collectionId) {
    if (!state.currentUser || !state.firebase) return {};
    const documentId = registry.COLLECTIONS[collectionId]?.documentId;
    if (!documentId) return {};

    if (!sourceDocumentCache.has(documentId)) {
      const { db, firestoreModule } = state.firebase;
      const reference = firestoreModule.doc(
        db,
        "users",
        state.currentUser.uid,
        CONFIG.userCollection || "collections",
        documentId,
      );
      sourceDocumentCache.set(
        documentId,
        firestoreModule.getDoc(reference)
          .then((snapshot) => (snapshot.exists() ? snapshot.data() || {} : {}))
          .catch((error) => {
            sourceDocumentCache.delete(documentId);
            throw error;
          }),
      );
    }
    return sourceDocumentCache.get(documentId);
  }

  function cardImage(card) {
    return clean(
      card?.imageLarge ||
      card?.image ||
      card?.imageUrl ||
      card?.originalImage ||
      card?.card?.image ||
      card?.card?.imageLarge,
    );
  }

  function cardMeta(card, item) {
    const values = [
      clean(card?.code),
      clean(card?.meta),
      clean(card?.cardNumber || card?.number),
      clean(card?.rarity),
      clean(card?.set || card?.setName),
    ].filter(Boolean);
    return values.length ? values.slice(0, 3).join(" · ") : clean(item?.groupName);
  }

  function mergeVisual(catalog, visualMap) {
    return catalog.items.map((item) => ({
      ...item,
      image: visualMap.get(item.key)?.image || "",
      meta: visualMap.get(item.key)?.meta || item.groupName || "",
    }));
  }

  async function buildVisualCatalog(collectionId, catalog) {
    const visualMap = new Map();

    if (collectionId === "national") {
      const payload = await catalogService.json("./data/pokedex.json");
      for (const record of payload.records || []) {
        const key = String(record.number);
        visualMap.set(key, {
          image: clean(record.imageUrl),
          meta: `${record.numberLabel || `#${String(record.number).padStart(4, "0")}`} · ${record.generation}세대`,
        });
      }
      return mergeVisual(catalog, visualMap);
    }

    if (collectionId === "people") {
      const payload = await catalogService.json("./data/people.json");
      for (const person of payload.people || []) {
        visualMap.set(String(person.id), {
          image: clean(person.imageLarge || person.image),
          meta: [person.category, person.region].filter(Boolean).join(" · "),
        });
      }
      return mergeVisual(catalog, visualMap);
    }

    if (collectionId === "world") {
      const payload = await catalogService.json("./data/world-exploration.json");
      (payload.generations || []).forEach((generation, groupIndex) => {
        const group = {
          code: `generation-${generation.generation}`,
          name: `${generation.generation}세대 ${generation.region || ""}`.trim(),
          cards: (generation.slots || []).map((slot) => ({
            code: slot.id,
            name: slot.title,
            owned: false,
            slotId: slot.id,
          })),
        };
        group.cards.forEach((card, cardIndex) => {
          const slot = generation.slots?.[cardIndex] || {};
          const key = registry.cardIdentity(collectionId, group, card, groupIndex, cardIndex);
          visualMap.set(key, {
            image: clean(slot.card?.image || slot.image),
            meta: clean(slot.subtitle || generation.region || group.name),
          });
        });
      });
      return mergeVisual(catalog, visualMap);
    }

    let groups = [];
    if (collectionId === "series") {
      groups = await catalogService.series();
    } else if (collectionId === "pokemon") {
      groups = await catalogService.pokemonCollections();
    } else if (collectionId === "ar") {
      groups = await catalogService.ar();
    } else if (collectionId === "artist") {
      const payload = await catalogService.json("./data/artists.json");
      groups = payload.artists || [];
    } else if (collectionId === "trainerPokemon") {
      const payload = await catalogService.json("./data/trainer-pokemon.json");
      groups = payload.groups || [];
    } else if (collectionId === "fossil") {
      const payload = await catalogService.json("./data/fossil.json");
      groups = payload.groups || [];
    }

    groups.forEach((group, groupIndex) => {
      (group.cards || []).forEach((card, cardIndex) => {
        const key = registry.cardIdentity(collectionId, group, card, groupIndex, cardIndex);
        visualMap.set(key, {
          image: cardImage(card),
          meta: cardMeta(card, catalog.itemMap.get(key)),
        });
      });
    });

    return mergeVisual(catalog, visualMap);
  }

  async function visualCatalogFor(collectionId, catalog) {
    if (!visualCatalogCache.has(collectionId)) {
      visualCatalogCache.set(
        collectionId,
        buildVisualCatalog(collectionId, catalog).catch((error) => {
          visualCatalogCache.delete(collectionId);
          throw error;
        }),
      );
    }
    return visualCatalogCache.get(collectionId);
  }

  function scopeLabel(collectionId) {
    const labels = {
      national: "전체 세대",
      series: "전체 시리즈",
      ar: "전체 AR",
      pokemon: "전체 포켓몬 컬렉션",
      artist: "전체 작가",
      people: "전체 인물",
      trainerPokemon: "전체 트레이너 × 포켓몬",
      fossil: "전체 화석 도감",
      world: "전체 월드탐험",
    };
    return labels[collectionId] || "전체";
  }

  function populateScopes(catalog, collectionId) {
    const options = [];
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = scopeLabel(collectionId);
    options.push(all);

    for (const group of catalog.groups || []) {
      const option = document.createElement("option");
      option.value = group.key;
      option.textContent = `${group.name} · ${group.itemKeys.length.toLocaleString("ko-KR")}장`;
      options.push(option);
    }

    elements.scope.replaceChildren(...options);
    elements.scope.disabled = false;
    elements.scope.value = "all";
  }

  function filteredItems() {
    if (!state.catalog) return [];

    const scope = elements.scope.value || "all";
    const ownedMode = selectedOwnedMode();
    let allowedKeys = null;

    if (scope !== "all") {
      const group = state.catalog.groups.find((entry) => entry.key === scope);
      allowedKeys = new Set(group?.itemKeys || []);
    }

    return state.items.filter((item) => {
      if (allowedKeys && !allowedKeys.has(item.key)) return false;
      if (ownedMode === "owned") return state.ownedKeys.has(item.key);
      if (ownedMode === "missing") return !state.ownedKeys.has(item.key);
      return true;
    });
  }

  function fitLayout(count) {
    if (!count) {
      return {
        orientation: "portrait",
        page: A4.portrait,
        cols: 1,
        rows: 1,
        cardWidth: 63,
        cardHeight: 88,
      };
    }

    let best = null;
    for (const orientation of ["portrait", "landscape"]) {
      const page = A4[orientation];
      const areaWidth = page.width - PRINT_MARGIN_MM * 2;
      const areaHeight = page.height - PRINT_MARGIN_MM * 2;
      for (let cols = 1; cols <= count; cols += 1) {
        const rows = Math.ceil(count / cols);
        const maxWidth = areaWidth / cols;
        const maxHeight = areaHeight / rows;
        const cardWidth = Math.min(maxWidth, maxHeight * (63 / 88));
        const cardHeight = cardWidth * (88 / 63);
        const score = cardWidth * cardHeight;
        if (!best || score > best.score) {
          best = { orientation, page, cols, rows, cardWidth, cardHeight, score };
        }
      }
    }
    return best;
  }

  function printPlan(count) {
    const mode = selectedSizeMode();
    if (mode === "fit") {
      const layout = fitLayout(count);
      return {
        mode,
        orientation: layout.orientation,
        pageCount: count ? 1 : 0,
        perPage: count,
        ...layout,
      };
    }

    const size = SIZE_MODES[mode];
    return {
      mode,
      orientation: "portrait",
      page: A4.portrait,
      pageCount: Math.ceil(count / 9),
      perPage: 9,
      cols: 3,
      rows: 3,
      cardWidth: size.width,
      cardHeight: size.height,
    };
  }

  function createPreviewCard(item) {
    const card = document.createElement("article");
    card.className = "studio-preview-card";
    if (state.currentUser && state.ownershipReady && !state.ownedKeys.has(item.key)) {
      card.classList.add("is-missing");
    }

    const imageWrap = document.createElement("div");
    imageWrap.className = "studio-preview-card-image";
    if (item.image) {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.name || "";
      image.loading = "lazy";
      image.decoding = "async";
      imageWrap.append(image);
    } else {
      const missing = document.createElement("span");
      missing.className = "studio-preview-placeholder";
      missing.textContent = "이미지 없음";
      imageWrap.append(missing);
    }

    const copy = document.createElement("div");
    copy.className = "studio-preview-card-copy";
    const title = document.createElement("strong");
    title.textContent = item.name || "카드";
    const meta = document.createElement("small");
    meta.textContent = item.meta || item.groupName || "";
    copy.append(title, meta);
    card.append(imageWrap, copy);
    return card;
  }

  function createPreviewPage(items, pageIndex, pageCount, plan) {
    const page = document.createElement("section");
    page.className = "studio-preview-page";

    const heading = document.createElement("div");
    heading.className = "studio-preview-page-heading";
    const title = document.createElement("strong");
    title.textContent = pageCount === 1
      ? "A4 1페이지"
      : `A4 ${pageIndex + 1} / ${pageCount}페이지`;
    const meta = document.createElement("span");
    meta.textContent = plan.mode === "fit"
      ? `자동 ${plan.cols} × ${plan.rows}`
      : `3 × 3 · 최대 ${plan.perPage}장`;
    heading.append(title, meta);

    const grid = document.createElement("div");
    grid.className = "studio-preview-page-grid";
    if (plan.mode === "fit") grid.classList.add("studio-preview-page-grid--fit");
    items.forEach((item) => grid.append(createPreviewCard(item)));

    page.append(heading, grid);
    return page;
  }

  function renderSelection() {
    state.selectedItems = filteredItems();
    const count = state.selectedItems.length;
    const plan = printPlan(count);
    const meta = registry.COLLECTIONS[state.collectionId];
    const ownedMode = selectedOwnedMode();
    const modeLabels = {
      all: "전체",
      owned: "보유",
      missing: "미보유",
    };

    elements.loading.hidden = true;
    elements.empty.hidden = count > 0;
    elements.preview.hidden = count === 0;
    elements.print.disabled = count === 0;

    elements.selectionCount.textContent =
      `${meta?.title || "도감"} · ${modeLabels[ownedMode]} ${count.toLocaleString("ko-KR")}장`;
    elements.orientation.textContent = A4[plan.orientation]?.label || "A4 세로";

    if (!count) {
      elements.pageNote.textContent = "선택 조건에 맞는 카드가 없습니다.";
      elements.preview.replaceChildren();
      return;
    }

    if (plan.mode === "fit") {
      elements.pageNote.textContent = count > 30
        ? `A4 1장 · 자동 ${plan.cols} × ${plan.rows} 배열 · 카드 수가 많아 실제 출력은 작게 보일 수 있습니다.`
        : `A4 1장 · 자동 ${plan.cols} × ${plan.rows} 배열 · 모든 선택 카드를 한 페이지에 맞춤`;
    } else {
      const size = SIZE_MODES[plan.mode];
      elements.pageNote.textContent =
        `A4 ${plan.pageCount.toLocaleString("ko-KR")}장 · 3 × 3 · 페이지당 최대 9장 · ${size.label}`;
    }

    const pageNodes = [];
    if (plan.mode === "fit") {
      pageNodes.push(createPreviewPage(state.selectedItems.slice(0, 54), 0, 1, plan));
      if (count > 54) {
        const more = document.createElement("div");
        more.className = "studio-preview-more";
        more.textContent =
          `A4 맞춤 미리보기는 앞 54장만 표시합니다. 실제 인쇄에는 선택한 ${count.toLocaleString("ko-KR")}장이 모두 포함됩니다.`;
        pageNodes.push(more);
      }
    } else {
      const previewPageCount = Math.min(plan.pageCount, PREVIEW_PAGE_LIMIT);
      for (let pageIndex = 0; pageIndex < previewPageCount; pageIndex += 1) {
        const start = pageIndex * plan.perPage;
        pageNodes.push(
          createPreviewPage(
            state.selectedItems.slice(start, start + plan.perPage),
            pageIndex,
            plan.pageCount,
            plan,
          ),
        );
      }
      if (plan.pageCount > PREVIEW_PAGE_LIMIT) {
        const more = document.createElement("div");
        more.className = "studio-preview-more";
        more.textContent =
          `미리보기는 앞 ${PREVIEW_PAGE_LIMIT}페이지만 표시합니다. 실제 인쇄는 총 ${plan.pageCount.toLocaleString("ko-KR")}페이지입니다.`;
        pageNodes.push(more);
      }
    }
    elements.preview.replaceChildren(...pageNodes);
  }

  function setLoading(message = "도감 데이터를 불러오고 있습니다.") {
    elements.loading.hidden = false;
    elements.loading.querySelector("strong").textContent = message;
    elements.empty.hidden = true;
    elements.preview.hidden = true;
    elements.preview.replaceChildren();
    elements.scope.disabled = true;
    elements.print.disabled = true;
    elements.selectionCount.textContent = "도감을 불러오는 중…";
    elements.pageNote.textContent = "카드 목록과 선택 도감의 보유 기록을 확인합니다.";
  }

  function setLoadError(error) {
    elements.loading.hidden = false;
    elements.loading.querySelector("strong").textContent = "도감 데이터를 불러오지 못했습니다.";
    elements.loading.querySelector("p").textContent =
      "페이지를 새로고침한 뒤 다시 시도해 주세요. 기존 도감 데이터에는 영향을 주지 않습니다.";
    elements.selectionCount.textContent = "불러오기 실패";
    elements.pageNote.textContent = clean(error?.message) || "알 수 없는 오류";
    elements.print.disabled = true;
  }

  async function loadCollection(collectionId) {
    const token = ++state.loadToken;
    state.collectionId = collectionId;
    state.catalog = null;
    state.items = [];
    state.ownedKeys = new Set();
    state.ownershipReady = false;
    setLoading();
    updateAuthControls();

    try {
      const catalog = await registry.loadCatalog(collectionId);
      const itemsPromise = visualCatalogFor(collectionId, catalog);

      let ownedKeys = new Set();
      if (state.currentUser && state.firebase) {
        try {
          const source = await sourceDocumentFor(collectionId);
          const ownership = await registry.ownershipFor(collectionId, source);
          ownedKeys = new Set(ownership.ownedKeys || []);
          state.ownershipReady = true;
        } catch (error) {
          console.warn(`${collectionId} 보유 기록을 읽지 못했습니다.`, error);
          state.ownershipReady = false;
        }
      } else {
        state.ownershipReady = false;
      }

      const items = await itemsPromise;
      if (token !== state.loadToken) return;

      state.catalog = catalog;
      state.items = items;
      state.ownedKeys = ownedKeys;
      populateScopes(catalog, collectionId);
      updateAuthControls();
      renderSelection();
    } catch (error) {
      if (token !== state.loadToken) return;
      console.error("바인더 스튜디오 도감 불러오기 실패", error);
      setLoadError(error);
    }
  }

  function createPrintCard(item, width, height) {
    const card = document.createElement("article");
    card.className = "studio-print-card";
    if (state.currentUser && state.ownershipReady && !state.ownedKeys.has(item.key)) {
      card.classList.add("is-missing");
    }
    card.style.width = `${width}mm`;
    card.style.height = `${height}mm`;

    if (item.image) {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = "";
      image.loading = "eager";
      image.decoding = "sync";
      card.append(image);
    } else {
      card.classList.add("studio-print-card--missing");
      card.textContent = item.name || "이미지 없음";
    }
    return card;
  }

  function addCalibration(sheet) {
    const calibration = document.createElement("div");
    calibration.className = "studio-calibration";
    calibration.textContent = "10 mm";
    sheet.append(calibration);
  }

  function installPageStyle(orientation) {
    document.querySelector("#studio-dynamic-page-style")?.remove();
    const style = document.createElement("style");
    style.id = "studio-dynamic-page-style";
    style.textContent =
      `@media print { @page { size: A4 ${orientation}; margin: 0; } }`;
    document.head.append(style);
  }

  function buildPrintSheets() {
    const items = state.selectedItems;
    if (!items.length) return null;

    const plan = printPlan(items.length);
    installPageStyle(plan.orientation);
    elements.printRoot.replaceChildren();

    if (plan.mode === "fit") {
      const sheet = document.createElement("section");
      sheet.className = "studio-print-sheet studio-print-sheet--fit";
      sheet.style.width = `${plan.page.width}mm`;
      sheet.style.height = `${plan.page.height}mm`;
      sheet.style.gridTemplateColumns = `repeat(${plan.cols}, ${plan.cardWidth}mm)`;
      sheet.style.gridTemplateRows = `repeat(${plan.rows}, ${plan.cardHeight}mm)`;
      items.forEach((item) => {
        sheet.append(createPrintCard(item, plan.cardWidth, plan.cardHeight));
      });
      elements.printRoot.append(sheet);
    } else {
      const size = SIZE_MODES[plan.mode];
      for (let index = 0; index < items.length; index += plan.perPage) {
        const sheet = document.createElement("section");
        sheet.className = "studio-print-sheet studio-print-sheet--exact";
        items.slice(index, index + plan.perPage).forEach((item) => {
          sheet.append(createPrintCard(item, size.width, size.height));
        });
        addCalibration(sheet);
        elements.printRoot.append(sheet);
      }
    }

    return plan;
  }

  async function waitForPrintImages() {
    const images = [...elements.printRoot.querySelectorAll("img")];
    const tasks = images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    });
    await Promise.race([
      Promise.all(tasks),
      new Promise((resolve) => window.setTimeout(resolve, 5000)),
    ]);
  }

  async function startPrint() {
    if (!state.selectedItems.length) return;
    if (state.selectedItems.length > 500) {
      const proceed = window.confirm(
        `선택한 카드가 ${state.selectedItems.length.toLocaleString("ko-KR")}장입니다. 인쇄 준비에 시간이 걸릴 수 있습니다. 계속할까요?`,
      );
      if (!proceed) return;
    }

    const plan = buildPrintSheets();
    if (!plan) return;

    const originalLabel = elements.print.textContent;
    elements.print.disabled = true;
    elements.print.textContent = "인쇄 준비 중…";

    const meta = registry.COLLECTIONS[state.collectionId];
    const scopeText = elements.scope.selectedOptions?.[0]?.textContent || "전체";
    const originalTitle = document.title;
    document.title = `바인더스튜디오_${meta?.title || "도감"}_${scopeText}`;

    try {
      await waitForPrintImages();
      window.print();
    } finally {
      elements.print.disabled = false;
      elements.print.textContent = originalLabel;
      window.setTimeout(() => {
        document.title = originalTitle;
      }, 250);
    }
  }

  async function resetStudio() {
    elements.collection.value = "series";
    elements.ownedInputs.forEach((input) => {
      input.checked = input.value === "all";
    });
    elements.sizeInputs.forEach((input) => {
      input.checked = input.value === "card";
    });
    await loadCollection("series");
  }

  elements.collection.addEventListener("change", () => {
    void loadCollection(elements.collection.value);
  });
  elements.scope.addEventListener("change", renderSelection);
  elements.ownedInputs.forEach((input) => input.addEventListener("change", renderSelection));
  elements.sizeInputs.forEach((input) => input.addEventListener("change", renderSelection));
  elements.reset.addEventListener("click", () => {
    void resetStudio();
  });
  elements.print.addEventListener("click", () => {
    void startPrint();
  });

  async function initialize() {
    setLoading("도감과 로그인 정보를 준비하고 있습니다.");
    await initializeFirebase();
    await loadCollection(elements.collection.value || "series");
  }

  void initialize();
})();
