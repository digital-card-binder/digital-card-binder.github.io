"use strict";

(function () {
  const panel = document.querySelector("#studio-custom");
  if (!panel) return;

  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});
  const catalogService = root.catalog;
  const identityService = root.cardIdentity;

  const tabs = [...document.querySelectorAll("[data-studio-tab]")];
  const panels = {
    print: document.querySelector("#studio-print"),
    custom: panel,
  };

  const fileInput = panel.querySelector("#studio-custom-file");
  const dropzone = panel.querySelector("#studio-custom-dropzone");
  const resetButton = panel.querySelector("#studio-custom-reset");
  const gridInputs = [...panel.querySelectorAll('input[name="studio-custom-grid"]')];
  const previewEmpty = panel.querySelector("#studio-custom-preview-empty");
  const previewWrap = panel.querySelector("#studio-custom-preview-wrap");
  const previewStage = panel.querySelector("#studio-custom-preview-stage");
  const previewImage = panel.querySelector("#studio-custom-preview-image");
  const overlay = panel.querySelector("#studio-custom-grid-overlay");
  const cardLayer = panel.querySelector("#studio-custom-card-layer");
  const gridLabel = panel.querySelector("#studio-custom-grid-label");
  const slotLabel = panel.querySelector("#studio-custom-slot-label");
  const placedCount = panel.querySelector("#studio-custom-placed-count");
  const fileLabel = panel.querySelector("#studio-custom-file-label");
  const imageMeta = panel.querySelector("#studio-custom-image-meta");
  const ratioNote = panel.querySelector("#studio-custom-ratio-note");
  const searchInput = panel.querySelector("#studio-custom-card-search");
  const searchStatus = panel.querySelector("#studio-custom-card-search-status");
  const searchResults = panel.querySelector("#studio-custom-card-results");
  const editorTools = panel.querySelector("#studio-custom-editor-tools");
  const selectedName = panel.querySelector("#studio-custom-selected-name");
  const titleInput = panel.querySelector("#studio-custom-title-input");
  const saveStatus = panel.querySelector("#studio-custom-save-status");
  const saveButton = panel.querySelector("#studio-custom-save-button");
  const newButton = panel.querySelector("#studio-custom-new-button");
  const deleteButton = panel.querySelector("#studio-custom-delete-button");
  const library = panel.querySelector("#studio-custom-library");
  const libraryEmpty = panel.querySelector("#studio-custom-library-empty");

  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const CHUNK_BYTES = 600 * 1024;
  const MAX_SAVED_WORKS = 30;
  const CARD_WIDTH_MM = 63;
  const CARD_HEIGHT_MM = 88;
  const PREVIEW_PX_PER_MM = 1.5;

  const state = {
    objectUrl: "",
    sourceFile: null,
    sourceBlob: null,
    backgroundDirty: false,
    sourceWidth: 0,
    sourceHeight: 0,
    catalog: null,
    catalogPromise: null,
    placements: [],
    selectedId: "",
    nextZ: 1,
    searchTimer: 0,
    firebase: null,
    user: null,
    currentBinderId: "",
    currentCreatedAt: null,
    currentChunkCount: 0,
    currentChunkSet: "",
    saving: false,
    savedWorkCount: 0,
  };

  function clean(value) {
    return String(value ?? "").trim();
  }

  function normalize(value) {
    return clean(value).toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
  }

  function makeId(prefix) {
    const random = globalThis.crypto?.getRandomValues
      ? [...crypto.getRandomValues(new Uint32Array(2))]
          .map((value) => value.toString(36))
          .join("")
      : Math.random().toString(36).slice(2, 14);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  function activateTab(name, updateHash = true) {
    const selected = name === "custom" ? "custom" : "print";
    Object.entries(panels).forEach(([key, section]) => {
      if (!section) return;
      section.hidden = key !== selected;
    });
  
  tabs.forEach((tab) => {
      const active = tab.dataset.studioTab === selected;
      tab.classList.toggle("is-active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (updateHash) {
      const url = new URL(window.location.href);
      url.hash = selected === "custom" ? "studio-custom" : "studio-print";
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }

  function selectedGrid() {
    const value = gridInputs.find((input) => input.checked)?.value || "3x4";
    const [cols, rows] = value.split("x").map(Number);
    return { cols, rows, value };
  }

  function applyStageGeometry() {
    const { cols, rows } = selectedGrid();
    previewStage.style.width = `${cols * CARD_WIDTH_MM * PREVIEW_PX_PER_MM}px`;
    previewStage.style.height = `${rows * CARD_HEIGHT_MM * PREVIEW_PX_PER_MM}px`;
  }

  function renderGrid() {
    const { cols, rows } = selectedGrid();
    applyStageGeometry();
    overlay.replaceChildren();
    overlay.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    overlay.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let index = 0; index < cols * rows; index += 1) {
      const cell = document.createElement("span");
      cell.setAttribute("aria-hidden", "true");
      overlay.append(cell);
    }

    gridLabel.textContent = `${cols} × ${rows}`;
    slotLabel.textContent = `${cols * rows}칸`;

    if (previewImage.naturalWidth && previewImage.naturalHeight) {
      updateRatioNote(previewImage.naturalWidth, previewImage.naturalHeight);
    }

    const fixedWidth = 100 / cols;
    state.placements.forEach((entry) => {
      entry.width = fixedWidth;
      clampPlacement(entry);
    });
    if (state.placements.length) renderPlacements();
    else renderSearchResults(searchInput.value);
  }

  function updateRatioNote(width, height) {
    const { cols, rows } = selectedGrid();
    const expected = (cols * 63) / (rows * 88);
    const actual = width / height;
    const gap = Math.abs(actual - expected) / expected;

    if (gap <= 0.04) {
      ratioNote.textContent = "선택한 그리드 비율과 잘 맞습니다.";
      ratioNote.className = "studio-custom-ratio-note is-good";
    } else {
      ratioNote.textContent = "이미지 비율과 선택한 그리드 비율이 다릅니다. 카드 배치 위치를 확인해 주세요.";
      ratioNote.className = "studio-custom-ratio-note is-warning";
    }
  }

  function selectedPlacement() {
    return state.placements.find((entry) => entry.id === state.selectedId) || null;
  }

  function updateEditorUi() {
    placedCount.textContent = `${state.placements.length}장`;
    const selected = selectedPlacement();
    editorTools.hidden = !selected;
    if (selected) {
      selectedName.textContent = [
        selected.card.name,
        selected.card.setCode,
        selected.card.cardNumber,
      ].filter(Boolean).join(" · ");
    } else {
      selectedName.textContent = "카드를 눌러 선택하세요.";
    }
    for (const node of cardLayer.querySelectorAll(".studio-custom-card-placement")) {
      node.classList.toggle("is-selected", node.dataset.placementId === state.selectedId);
    }
  }

  function clearPlacements() {
    state.placements = [];
    state.selectedId = "";
    state.nextZ = 1;
    cardLayer.replaceChildren();
    updateEditorUi();
  }

  function clearImage() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = "";
    state.sourceFile = null;
    state.sourceBlob = null;
    state.backgroundDirty = false;
    state.sourceWidth = 0;
    state.sourceHeight = 0;
    fileInput.value = "";
    previewImage.removeAttribute("src");
    previewImage.removeAttribute("alt");
    previewWrap.hidden = true;
    previewEmpty.hidden = false;
    fileLabel.textContent = "이미지를 선택하거나 여기에 놓으세요";
    imageMeta.textContent = "PNG · JPG · WEBP · 최대 10MB";
    ratioNote.textContent = "이미지를 올리면 선택한 그리드와 비율을 확인합니다.";
    ratioNote.className = "studio-custom-ratio-note";
    clearPlacements();
  }

  function loadFile(file) {
    if (!file) return;

    const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowed.has(file.type)) {
      window.alert("PNG, JPG, WEBP 이미지만 사용할 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      window.alert("이미지는 최대 10MB까지 사용할 수 있습니다.");
      return;
    }

    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    clearPlacements();
    state.sourceFile = file;
    state.sourceBlob = file;
    state.backgroundDirty = true;
    state.objectUrl = URL.createObjectURL(file);
    previewImage.src = state.objectUrl;
    previewImage.alt = file.name;
    fileLabel.textContent = file.name;
    imageMeta.textContent = `${(file.size / 1024 / 1024).toFixed(2)}MB · 기기 안에서 편집 중`;

    previewImage.onload = () => {
      state.sourceWidth = previewImage.naturalWidth;
      state.sourceHeight = previewImage.naturalHeight;
      previewEmpty.hidden = true;
      previewWrap.hidden = false;
      imageMeta.textContent =
        `${state.sourceWidth.toLocaleString("ko-KR")} × ${state.sourceHeight.toLocaleString("ko-KR")}px · ${(file.size / 1024 / 1024).toFixed(2)}MB`;
      updateRatioNote(state.sourceWidth, state.sourceHeight);
      renderSearchResults(searchInput.value);
      updateSaveUi();
    };
  }

  function cardImage(card) {
    return clean(card?.originalImage || card?.image || card?.imageUrl);
  }

  function cardNumber(card) {
    return clean(card?.cardNumber || card?.number || card?.meta || card?.code);
  }

  async function ensureCatalog() {
    if (state.catalog) return state.catalog;
    if (state.catalogPromise) return state.catalogPromise;

    state.catalogPromise = (async () => {
      if (!catalogService?.series) {
        throw new Error("시리즈 도감 서비스를 찾지 못했습니다.");
      }
      searchStatus.textContent = "전체 시리즈 도감을 불러오는 중…";
      const groups = await catalogService.series();
      const cards = [];

      groups.forEach((group, groupIndex) => {
        (group.cards || []).forEach((card, cardIndex) => {
          const image = cardImage(card);
          if (!image) return;
          const key = identityService?.cardIdentity
            ? identityService.cardIdentity("series", group, card, groupIndex, cardIndex)
            : `${clean(group.code || group.title || groupIndex)}::${clean(card.code || card.meta || cardIndex)}::${cardIndex}`;
          const name = clean(card.name || card.pokemonName || card.code || card.meta || "카드");
          const setCode = clean(group.code || group.name);
          const setTitle = clean(group.title || group.name);
          const number = cardNumber(card);
          const rarity = clean(card.rarity);
          cards.push({
            key,
            name,
            setCode,
            setTitle,
            cardNumber: number,
            rarity,
            image,
            search: normalize([
              name,
              card.pokemonName,
              setCode,
              setTitle,
              number,
              card.code,
              card.meta,
              rarity,
            ].join(" ")),
          });
        });
      });

      state.catalog = cards;
      searchStatus.textContent =
        `시리즈 도감 ${cards.length.toLocaleString("ko-KR")}장 검색 준비 완료`;
      return cards;
    })().catch((error) => {
      state.catalogPromise = null;
      searchStatus.textContent = "카드 목록을 불러오지 못했습니다. 다시 검색해 주세요.";
      throw error;
    });

    return state.catalogPromise;
  }

  function catalogMatches(query) {
    if (!state.catalog) return [];
    const normalized = normalize(query);
    if (!normalized) return [];
    const tokens = normalized.split(" ").filter(Boolean);
    const matches = [];
    for (const card of state.catalog) {
      if (!tokens.every((token) => card.search.includes(token))) continue;
      matches.push(card);
      if (matches.length >= 36) break;
    }
    return matches;
  }

  function resultCard(card) {
    const row = document.createElement("article");
    row.className = "studio-custom-card-result";

    const image = document.createElement("img");
    image.src = card.image;
    image.alt = "";
    image.loading = "lazy";

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = card.name;
    const meta = document.createElement("span");
    meta.textContent = [card.setCode, card.cardNumber, card.rarity].filter(Boolean).join(" · ");
    const set = document.createElement("small");
    set.textContent = card.setTitle || card.setCode;
    copy.append(title, meta, set);

    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "추가";
    add.disabled = !state.objectUrl || state.placements.length >= selectedGrid().cols * selectedGrid().rows;
    add.addEventListener("click", () => addCard(card));

    row.append(image, copy, add);
    return row;
  }

  function renderSearchResults(query) {
    if (!searchResults) return;
    const normalized = normalize(query);
    if (!normalized) {
      searchResults.hidden = true;
      searchResults.replaceChildren();
      if (state.catalog) {
        searchStatus.textContent =
          `시리즈 도감 ${state.catalog.length.toLocaleString("ko-KR")}장 검색 준비 완료`;
      } else {
        searchStatus.textContent = "검색어를 입력하면 전체 시리즈 도감에서 찾습니다.";
      }
      return;
    }
    if (!state.catalog) return;

    const matches = catalogMatches(normalized);
    searchResults.replaceChildren(...matches.map(resultCard));
    searchResults.hidden = false;
    if (!state.objectUrl) {
      searchStatus.textContent = `${matches.length}장 찾음 · 먼저 배경 일러스트를 올려 주세요.`;
    } else if (state.placements.length >= selectedGrid().cols * selectedGrid().rows) {
      searchStatus.textContent = `${matches.length}장 찾음 · 현재 그리드의 모든 칸이 사용 중입니다.`;
    } else {
      searchStatus.textContent = `${matches.length}장 찾음 · 원하는 카드를 추가하세요.`;
    }
  }

  async function runSearch() {
    const query = searchInput.value;
    if (!normalize(query)) {
      renderSearchResults("");
      return;
    }
    try {
      await ensureCatalog();
      renderSearchResults(query);
    } catch (error) {
      console.error("커스텀 바인더 카드 검색 실패", error);
    }
  }

  function stageAspectFactor() {
    const { cols, rows } = selectedGrid();
    return (cols * CARD_WIDTH_MM) / (rows * CARD_HEIGHT_MM);
  }

  function heightPercentForWidth(widthPercent) {
    return widthPercent * (88 / 63) * stageAspectFactor();
  }

  function slotGeometry(index) {
    const { cols, rows } = selectedGrid();
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    const width = cellW;
    const height = cellH;
    const slot = ((index % (cols * rows)) + (cols * rows)) % (cols * rows);
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    return {
      x: col * cellW,
      y: row * cellH,
      width,
    };
  }

  function clampPlacement(entry) {
    const { cols } = selectedGrid();
    entry.width = 100 / cols;
    const height = heightPercentForWidth(entry.width);
    entry.x = Math.max(0, Math.min(100 - entry.width, entry.x));
    entry.y = Math.max(0, Math.min(Math.max(0, 100 - height), entry.y));
  }

  function placementNode(entry) {
    const node = document.createElement("div");
    node.className = "studio-custom-card-placement";
    node.dataset.placementId = entry.id;
    node.style.left = `${entry.x}%`;
    node.style.top = `${entry.y}%`;
    node.style.width = `${entry.width}%`;
    node.style.zIndex = String(entry.z);
    node.style.transform = `rotate(${entry.rotation}deg)`;
    node.title = entry.card.name;

    const image = document.createElement("img");
    image.src = entry.card.image;
    image.alt = `${entry.card.name} 카드`;
    image.draggable = false;
    node.append(image);

    node.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedId = entry.id;
      updateEditorUi();
    });

    node.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      state.selectedId = entry.id;
      updateEditorUi();

      const stageRect = previewStage.getBoundingClientRect();
      if (!stageRect.width || !stageRect.height) return;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startX = entry.x;
      const startY = entry.y;
      node.setPointerCapture?.(event.pointerId);
      node.classList.add("is-dragging");

      const move = (moveEvent) => {
        const dx = ((moveEvent.clientX - startClientX) / stageRect.width) * 100;
        const dy = ((moveEvent.clientY - startClientY) / stageRect.height) * 100;
        entry.x = startX + dx;
        entry.y = startY + dy;
        clampPlacement(entry);
        node.style.left = `${entry.x}%`;
        node.style.top = `${entry.y}%`;
      };

      const finish = () => {
        node.classList.remove("is-dragging");
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerup", finish);
        node.removeEventListener("pointercancel", finish);
      };

      node.addEventListener("pointermove", move);
      node.addEventListener("pointerup", finish);
      node.addEventListener("pointercancel", finish);
    });

    return node;
  }

  function renderPlacements() {
    cardLayer.replaceChildren(...state.placements
      .slice()
      .sort((a, b) => a.z - b.z)
      .map(placementNode));
    updateEditorUi();
    renderSearchResults(searchInput.value);
  }

  function addCard(card) {
    if (!state.objectUrl) {
      window.alert("먼저 배경 일러스트를 올려 주세요.");
      return;
    }

    const { cols, rows } = selectedGrid();
    if (state.placements.length >= cols * rows) {
      window.alert("현재 그리드의 모든 카드 칸이 사용 중입니다.");
      return;
    }

    const geometry = slotGeometry(state.placements.length);
    const entry = {
      id: makeId("card"),
      card: {
        key: card.key,
        name: card.name,
        setCode: card.setCode,
        setTitle: card.setTitle,
        cardNumber: card.cardNumber,
        rarity: card.rarity,
        image: card.image,
      },
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      rotation: 0,
      z: state.nextZ++,
    };
    state.placements.push(entry);
    state.selectedId = entry.id;
    renderPlacements();
  }

  function rotateSelected(delta) {
    const entry = selectedPlacement();
    if (!entry) return;
    entry.rotation = ((entry.rotation + delta + 180) % 360) - 180;
    renderPlacements();
  }

  function snapSelected() {
    const entry = selectedPlacement();
    if (!entry) return;
    const { cols, rows } = selectedGrid();
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    const height = heightPercentForWidth(entry.width);
    const centerX = entry.x + entry.width / 2;
    const centerY = entry.y + height / 2;
    const col = Math.max(0, Math.min(cols - 1, Math.floor(centerX / cellW)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor(centerY / cellH)));
    const geometry = slotGeometry(row * cols + col);
    entry.x = geometry.x;
    entry.y = geometry.y;
    entry.width = geometry.width;
    entry.rotation = 0;
    renderPlacements();
  }

  function frontSelected() {
    const entry = selectedPlacement();
    if (!entry) return;
    entry.z = state.nextZ++;
    renderPlacements();
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    state.placements = state.placements.filter((entry) => entry.id !== state.selectedId);
    state.selectedId = "";
    renderPlacements();
  }

  function handleToolAction(action) {
    if (action === "rotate-left") rotateSelected(-5);
    if (action === "rotate-right") rotateSelected(5);
    if (action === "snap") snapSelected();
    if (action === "front") frontSelected();
    if (action === "delete") deleteSelected();
  }

  function draftSnapshot() {
    const grid = selectedGrid();
    return {
      schemaVersion: 1,
      kind: "custom-binder-layout",
      grid: {
        cols: grid.cols,
        rows: grid.rows,
        slotCount: grid.cols * grid.rows,
        cardWidthMm: CARD_WIDTH_MM,
        cardHeightMm: CARD_HEIGHT_MM,
        canvasWidthMm: grid.cols * CARD_WIDTH_MM,
        canvasHeightMm: grid.rows * CARD_HEIGHT_MM,
      },
      background: {
        name: clean(state.sourceFile?.name),
        type: clean(state.sourceFile?.type),
        width: state.sourceWidth,
        height: state.sourceHeight,
      },
      cards: state.placements.map((entry) => ({
        placementId: entry.id,
        sourceKey: entry.card.key,
        name: entry.card.name,
        setCode: entry.card.setCode,
        setTitle: entry.card.setTitle,
        cardNumber: entry.card.cardNumber,
        rarity: entry.card.rarity,
        imageUrl: entry.card.image,
        x: Number(entry.x.toFixed(4)),
        y: Number(entry.y.toFixed(4)),
        width: Number(entry.width.toFixed(4)),
        widthMm: CARD_WIDTH_MM,
        heightMm: CARD_HEIGHT_MM,
        rotation: Number(entry.rotation.toFixed(2)),
        z: entry.z,
      })),
    };
  }

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId
    );
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

  function binderRef(binderId) {
    if (!state.firebase || !state.user || !binderId) return null;
    return state.firebase.firestoreModule.doc(
      state.firebase.db,
      "users",
      state.user.uid,
      "customBinders",
      binderId,
    );
  }

  function updateSaveUi(message = "") {
    if (!saveButton || !saveStatus) return;

    if (!configured()) {
      saveButton.disabled = true;
      saveStatus.textContent = "저장 설정을 확인하지 못했습니다.";
      return;
    }
    if (!state.firebase) {
      saveButton.disabled = true;
      saveStatus.textContent = "로그인 상태를 확인하고 있습니다.";
      return;
    }
    if (!state.user) {
      saveButton.disabled = true;
      saveStatus.textContent = "Google 로그인 후 커스텀 바인더를 나만의도감에 저장할 수 있습니다.";
      return;
    }
    if (message) {
      saveStatus.textContent = message;
    } else if (!state.sourceBlob) {
      saveStatus.textContent = "배경 일러스트를 올리면 저장할 수 있습니다.";
    } else if (state.currentBinderId) {
      saveStatus.textContent = "현재 저장 작업을 수정 중입니다.";
    } else {
      saveStatus.textContent = "기존 도감과 분리된 개인 커스텀 바인더 영역에 저장됩니다.";
    }

    saveButton.disabled = state.saving || !state.sourceBlob;
    saveButton.textContent = state.saving
      ? "저장 중…"
      : state.currentBinderId
        ? "변경 내용 저장"
        : "나만의도감에 저장";
    deleteButton.hidden = !state.currentBinderId;
  }

  function setBinderUrl(binderId = "") {
    const url = new URL(window.location.href);
    if (binderId) url.searchParams.set("binder", binderId);
    else url.searchParams.delete("binder");
    url.hash = "studio-custom";
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function formatSavedTime(value) {
    try {
      const date = typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value || Date.now());
      return new Intl.DateTimeFormat("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return "";
    }
  }

  async function refreshLibrary() {
    if (!library || !libraryEmpty) return;
    library.replaceChildren();
    if (!state.user || !state.firebase) {
      state.savedWorkCount = 0;
      libraryEmpty.hidden = false;
      libraryEmpty.textContent = "Google 로그인 후 저장한 커스텀 바인더가 여기에 표시됩니다.";
      return;
    }

    const { firestoreModule, db } = state.firebase;
    try {
      const collectionRef = firestoreModule.collection(
        db,
        "users",
        state.user.uid,
        "customBinders",
      );
      const snapshot = await firestoreModule.getDocs(
        firestoreModule.query(
          collectionRef,
          firestoreModule.orderBy("updatedAt", "desc"),
          firestoreModule.limit(MAX_SAVED_WORKS),
        ),
      );
      state.savedWorkCount = snapshot.size;
      const fragment = document.createDocumentFragment();

      snapshot.forEach((documentSnapshot) => {
        const data = documentSnapshot.data() || {};
        const grid = data.grid || {};
        const item = document.createElement("article");
        item.className = "studio-custom-library-item";

        const copy = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = clean(data.title) || "커스텀 바인더";
        const meta = document.createElement("span");
        meta.textContent = [
          grid.cols && grid.rows ? `${grid.cols}×${grid.rows}` : "",
          Array.isArray(data.cards) ? `${data.cards.length}장 배치` : "",
          formatSavedTime(data.updatedAt),
        ].filter(Boolean).join(" · ");
        copy.append(title, meta);

        const open = document.createElement("button");
        open.type = "button";
        open.textContent = documentSnapshot.id === state.currentBinderId ? "편집 중" : "열기";
        open.disabled = documentSnapshot.id === state.currentBinderId;
        open.addEventListener("click", () => void loadSavedBinder(documentSnapshot.id));

        item.append(copy, open);
        fragment.append(item);
      });

      library.append(fragment);
      libraryEmpty.hidden = snapshot.size > 0;
      if (!snapshot.size) libraryEmpty.textContent = "저장한 작업이 없습니다.";
    } catch (error) {
      console.error("커스텀 바인더 목록 불러오기 실패", error);
      libraryEmpty.hidden = false;
      libraryEmpty.textContent = "저장한 작업 목록을 불러오지 못했습니다.";
    }
  }

  async function writeBackgroundChunks(reference, blob, chunkSet) {
    const { firestoreModule, db } = state.firebase;
    const raw = new Uint8Array(await blob.arrayBuffer());
    const chunkCount = Math.ceil(raw.length / CHUNK_BYTES);
    if (!chunkCount || chunkCount > 24) {
      throw new Error("배경 이미지 용량이 저장 한도를 초과했습니다.");
    }

    for (let start = 0; start < chunkCount; start += 4) {
      const batch = firestoreModule.writeBatch(db);
      const end = Math.min(chunkCount, start + 4);
      for (let index = start; index < end; index += 1) {
        const from = index * CHUNK_BYTES;
        const to = Math.min(raw.length, from + CHUNK_BYTES);
        const bytes = raw.slice(from, to);
        const chunkReference = firestoreModule.doc(
          reference,
          "chunks",
          `${chunkSet}_${String(index).padStart(3, "0")}`,
        );
        batch.set(chunkReference, {
          ownerUid: state.user.uid,
          chunkSet,
          index,
          data: firestoreModule.Bytes.fromUint8Array(bytes),
          size: bytes.length,
          updatedAt: firestoreModule.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    return chunkCount;
  }

  async function deleteChunkSet(reference, chunkSet) {
    if (!chunkSet) return;
    const { firestoreModule, db } = state.firebase;
    const snapshot = await firestoreModule.getDocs(
      firestoreModule.collection(reference, "chunks"),
    );
    const matches = snapshot.docs.filter(
      (item) => item.data()?.chunkSet === chunkSet,
    );
    for (let start = 0; start < matches.length; start += 100) {
      const batch = firestoreModule.writeBatch(db);
      matches.slice(start, start + 100).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  }

  async function readBackgroundBlob(reference, background) {
    const { firestoreModule } = state.firebase;
    const chunkCollection = firestoreModule.collection(reference, "chunks");
    const snapshot = await firestoreModule.getDocs(chunkCollection);

    const chunkRows = snapshot.docs
      .map((chunkSnapshot) => chunkSnapshot.data() || {})
      .filter((data) => data.chunkSet === background?.chunkSet)
      .sort((a, b) => Number(a.index) - Number(b.index));

    const chunks = [];
    let total = 0;
    chunkRows.forEach((data) => {
      const bytes = data.data?.toUint8Array?.();
      if (!bytes) return;
      chunks.push(bytes);
      total += bytes.length;
    });

    if (!chunks.length || chunks.length !== Number(background?.chunkCount || 0)) {
      throw new Error("저장된 배경 이미지 조각을 모두 찾지 못했습니다.");
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const bytes of chunks) {
      merged.set(bytes, offset);
      offset += bytes.length;
    }

    if (background?.size && merged.length !== background.size) {
      throw new Error("저장된 배경 이미지 크기가 올바르지 않습니다.");
    }

    return new Blob([merged], { type: clean(background?.type) || "image/webp" });
  }

  function restorePlacement(entry, index) {
    return {
      id: clean(entry?.placementId) || makeId("card"),
      card: {
        key: clean(entry?.sourceKey),
        name: clean(entry?.name) || "카드",
        setCode: clean(entry?.setCode),
        setTitle: clean(entry?.setTitle),
        cardNumber: clean(entry?.cardNumber),
        rarity: clean(entry?.rarity),
        image: clean(entry?.imageUrl),
      },
      x: Number.isFinite(Number(entry?.x)) ? Number(entry.x) : 0,
      y: Number.isFinite(Number(entry?.y)) ? Number(entry.y) : 0,
      width: Number.isFinite(Number(entry?.width)) ? Number(entry.width) : 20,
      rotation: Number.isFinite(Number(entry?.rotation)) ? Number(entry.rotation) : 0,
      z: Number.isFinite(Number(entry?.z)) ? Number(entry.z) : index + 1,
    };
  }

  async function loadSavedBinder(binderId) {
    if (!state.user || !state.firebase || !binderId) return;
    const reference = binderRef(binderId);
    if (!reference) return;

    saveStatus.textContent = "저장한 작업을 불러오는 중…";
    saveButton.disabled = true;

    try {
      const snapshot = await state.firebase.firestoreModule.getDoc(reference);
      if (!snapshot.exists()) throw new Error("저장한 작업을 찾을 수 없습니다.");
      const data = snapshot.data() || {};
      if (data.ownerUid !== state.user.uid) throw new Error("이 작업을 열 권한이 없습니다.");

      const blob = await readBackgroundBlob(reference, data.background || {});
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);

      const gridValue = `${data.grid?.cols || 3}x${data.grid?.rows || 4}`;
      const gridInput = gridInputs.find((input) => input.value === gridValue);
      if (gridInput) gridInput.checked = true;

      state.objectUrl = URL.createObjectURL(blob);
      state.sourceBlob = blob;
      state.sourceFile = {
        name: clean(data.background?.name) || "saved-background.webp",
        type: clean(data.background?.type) || blob.type,
        size: blob.size,
      };
      state.backgroundDirty = false;
      state.sourceWidth = Number(data.background?.width) || 0;
      state.sourceHeight = Number(data.background?.height) || 0;
      state.currentBinderId = binderId;
      state.currentCreatedAt = data.createdAt || null;
      state.currentChunkCount = Number(data.background?.chunkCount) || 0;
      state.currentChunkSet = clean(data.background?.chunkSet);
      state.placements = (Array.isArray(data.cards) ? data.cards : [])
        .slice(0, 16)
        .map(restorePlacement);
      state.nextZ = Math.max(0, ...state.placements.map((entry) => entry.z)) + 1;
      state.selectedId = "";
      titleInput.value = clean(data.title);

      previewImage.src = state.objectUrl;
      previewImage.alt = state.sourceFile.name;
      fileLabel.textContent = state.sourceFile.name;
      imageMeta.textContent = "저장된 배경 이미지를 불러오는 중…";
      previewImage.onload = () => {
        state.sourceWidth = state.sourceWidth || previewImage.naturalWidth;
        state.sourceHeight = state.sourceHeight || previewImage.naturalHeight;
        previewEmpty.hidden = true;
        previewWrap.hidden = false;
        imageMeta.textContent =
          `${state.sourceWidth.toLocaleString("ko-KR")} × ${state.sourceHeight.toLocaleString("ko-KR")}px · 저장된 작업`;
        renderGrid();
        renderPlacements();
        updateRatioNote(state.sourceWidth, state.sourceHeight);
      };

      setBinderUrl(binderId);
      deleteButton.hidden = false;
      updateSaveUi("저장한 작업을 불러왔습니다. 수정 후 다시 저장할 수 있습니다.");
      await refreshLibrary();
    } catch (error) {
      console.error("커스텀 바인더 불러오기 실패", error);
      updateSaveUi(clean(error?.message) || "저장한 작업을 불러오지 못했습니다.");
    }
  }

  async function saveCurrentBinder() {
    if (!state.user || !state.firebase) {
      updateSaveUi("Google 로그인 후 저장할 수 있습니다.");
      return;
    }
    if (!state.sourceBlob) {
      window.alert("먼저 배경 일러스트를 올려 주세요.");
      return;
    }

    const title = clean(titleInput.value).slice(0, 60);
    if (!title) {
      titleInput.focus();
      saveStatus.textContent = "작업 이름을 입력해 주세요.";
      return;
    }

    if (!state.currentBinderId && state.savedWorkCount >= MAX_SAVED_WORKS) {
      window.alert(`커스텀 바인더는 최대 ${MAX_SAVED_WORKS}개까지 저장할 수 있습니다.`);
      return;
    }

    state.saving = true;
    updateSaveUi("배경 이미지와 카드 배치를 저장하고 있습니다…");

    const binderId = state.currentBinderId || makeId("binder");
    const reference = binderRef(binderId);
    const draft = draftSnapshot();

    try {
      let chunkCount = state.currentChunkCount;
      let chunkSet = state.currentChunkSet;
      const previousChunkSet = state.currentChunkSet;
      if (!state.currentBinderId || state.backgroundDirty || !chunkCount || !chunkSet) {
        chunkSet = makeId("blob");
        chunkCount = await writeBackgroundChunks(
          reference,
          state.sourceBlob,
          chunkSet,
        );
      }

      const firestoreModule = state.firebase.firestoreModule;
      const metadata = {
        schemaVersion: 1,
        ownerUid: state.user.uid,
        title,
        grid: draft.grid,
        background: {
          name: clean(state.sourceFile?.name) || "background.webp",
          type: clean(state.sourceBlob.type || state.sourceFile?.type) || "image/webp",
          size: state.sourceBlob.size,
          chunkCount,
          chunkSet,
          width: state.sourceWidth,
          height: state.sourceHeight,
        },
        cards: draft.cards,
        createdAt: state.currentCreatedAt || firestoreModule.serverTimestamp(),
        updatedAt: firestoreModule.serverTimestamp(),
      };

      await firestoreModule.setDoc(reference, metadata);
      const saved = await firestoreModule.getDoc(reference);
      const savedData = saved.data() || {};

      state.currentBinderId = binderId;
      state.currentCreatedAt = savedData.createdAt || state.currentCreatedAt;
      state.currentChunkCount = chunkCount;
      state.currentChunkSet = chunkSet;
      state.backgroundDirty = false;
      if (previousChunkSet && previousChunkSet !== chunkSet) {
        await deleteChunkSet(reference, previousChunkSet);
      }
      setBinderUrl(binderId);
      updateSaveUi("나만의도감에 저장했습니다.");
      await refreshLibrary();
    } catch (error) {
      console.error("커스텀 바인더 저장 실패", error);
      updateSaveUi(clean(error?.message) || "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      state.saving = false;
      updateSaveUi(saveStatus.textContent);
    }
  }

  async function deleteCurrentBinder() {
    if (!state.user || !state.firebase || !state.currentBinderId) return;
    const title = clean(titleInput.value) || "이 작업";
    if (!window.confirm(`‘${title}’ 저장 작업을 삭제할까요?`)) return;

    const reference = binderRef(state.currentBinderId);
    const { firestoreModule, db } = state.firebase;

    try {
      const chunks = await firestoreModule.getDocs(
        firestoreModule.collection(reference, "chunks"),
      );
      const batch = firestoreModule.writeBatch(db);
      chunks.forEach((chunk) => batch.delete(chunk.ref));
      batch.delete(reference);
      await batch.commit();
      resetEditor(true);
      await refreshLibrary();
      updateSaveUi("저장 작업을 삭제했습니다.");
    } catch (error) {
      console.error("커스텀 바인더 삭제 실패", error);
      updateSaveUi(clean(error?.message) || "저장 작업을 삭제하지 못했습니다.");
    }
  }

  function resetEditor(clearUrl = true) {
    state.currentBinderId = "";
    state.currentCreatedAt = null;
    state.currentChunkCount = 0;
    state.currentChunkSet = "";
    state.backgroundDirty = false;
    titleInput.value = "";
    searchInput.value = "";
    const defaultGrid = gridInputs.find((input) => input.value === "3x4");
    if (defaultGrid) defaultGrid.checked = true;
    renderGrid();
    clearImage();
    renderSearchResults("");
    if (clearUrl) setBinderUrl("");
    deleteButton.hidden = true;
    updateSaveUi();
    void refreshLibrary();
  }

  async function initializePersistence() {
    if (!configured()) {
      updateSaveUi();
      void refreshLibrary();
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
        console.warn("커스텀 바인더 로그인 유지 설정 실패", error);
      }
      state.firebase = {
        auth,
        authModule,
        firestoreModule,
        db: firestoreModule.getFirestore(app),
      };
      state.user = await firstAuthUser(auth, authModule);
      updateSaveUi();
      await refreshLibrary();

      const requestedBinder = clean(new URLSearchParams(window.location.search).get("binder"));
      if (requestedBinder && state.user) {
        activateTab("custom", false);
        await loadSavedBinder(requestedBinder);
      }
    } catch (error) {
      console.error("커스텀 바인더 저장 초기화 실패", error);
      state.firebase = null;
      state.user = null;
      updateSaveUi("저장 기능을 초기화하지 못했습니다.");
      await refreshLibrary();
    }
  }


  tabs.forEach((tab) => {
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      activateTab(tab.dataset.studioTab);
    });
  });

  gridInputs.forEach((input) => input.addEventListener("change", renderGrid));
  fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));

  ["dragenter", "dragover"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  });
  dropzone.addEventListener("drop", (event) => loadFile(event.dataTransfer?.files?.[0]));

  searchInput.addEventListener("focus", () => {
    if (!state.catalogPromise && !state.catalog) {
      void ensureCatalog().catch((error) => console.error(error));
    }
  });
  searchInput.addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => void runSearch(), 120);
  });

  editorTools.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-custom-action]");
    if (!button) return;
    handleToolAction(button.dataset.customAction);
  });

  previewStage.addEventListener("click", (event) => {
    if (event.target.closest(".studio-custom-card-placement")) return;
    state.selectedId = "";
    updateEditorUi();
  });

  resetButton.addEventListener("click", () => resetEditor(true));
  saveButton.addEventListener("click", () => void saveCurrentBinder());
  newButton.addEventListener("click", () => resetEditor(true));
  deleteButton.addEventListener("click", () => void deleteCurrentBinder());
  titleInput.addEventListener("input", () => updateSaveUi());

  window.addEventListener("resize", () => {
    state.placements.forEach(clampPlacement);
    renderPlacements();
  });

  window.addEventListener("beforeunload", () => {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  });

  root.customBinderEditor = Object.freeze({
    getDraft: draftSnapshot,
    hasBackground: () => Boolean(state.objectUrl),
    getPlacedCount: () => state.placements.length,
  });

  renderGrid();
  clearImage();
  renderSearchResults("");
  activateTab(window.location.hash === "#studio-custom" ? "custom" : "print", false);
  updateSaveUi();
  void initializePersistence();
})();
