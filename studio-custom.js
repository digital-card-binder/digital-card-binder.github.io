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

  const state = {
    objectUrl: "",
    sourceFile: null,
    sourceWidth: 0,
    sourceHeight: 0,
    catalog: null,
    catalogPromise: null,
    placements: [],
    selectedId: "",
    nextZ: 1,
    searchTimer: 0,
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
      history.replaceState(null, "", selected === "custom" ? "#studio-custom" : "#studio-print");
    }
  }

  function selectedGrid() {
    const value = gridInputs.find((input) => input.checked)?.value || "3x4";
    const [cols, rows] = value.split("x").map(Number);
    return { cols, rows, value };
  }

  function renderGrid() {
    const { cols, rows } = selectedGrid();
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
    renderSearchResults(searchInput.value);
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
    const rect = previewStage.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      if (state.sourceWidth && state.sourceHeight) return state.sourceWidth / state.sourceHeight;
      return 1;
    }
    return rect.width / rect.height;
  }

  function heightPercentForWidth(widthPercent) {
    return widthPercent * (88 / 63) * stageAspectFactor();
  }

  function slotGeometry(index) {
    const { cols, rows } = selectedGrid();
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    const stageFactor = stageAspectFactor();
    const widthFromCell = cellW * 0.9;
    const widthFromHeight = (cellH * 0.9) / ((88 / 63) * stageFactor);
    const width = Math.max(5, Math.min(widthFromCell, widthFromHeight));
    const height = heightPercentForWidth(width);
    const slot = ((index % (cols * rows)) + (cols * rows)) % (cols * rows);
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    return {
      x: col * cellW + (cellW - width) / 2,
      y: row * cellH + (cellH - height) / 2,
      width,
    };
  }

  function clampPlacement(entry) {
    const height = heightPercentForWidth(entry.width);
    entry.width = Math.max(5, Math.min(80, entry.width));
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

  function resizeSelected(multiplier) {
    const entry = selectedPlacement();
    if (!entry) return;
    const oldHeight = heightPercentForWidth(entry.width);
    const centerX = entry.x + entry.width / 2;
    const centerY = entry.y + oldHeight / 2;
    entry.width = Math.max(5, Math.min(80, entry.width * multiplier));
    const newHeight = heightPercentForWidth(entry.width);
    entry.x = centerX - entry.width / 2;
    entry.y = centerY - newHeight / 2;
    clampPlacement(entry);
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
    if (action === "smaller") resizeSelected(0.9);
    if (action === "larger") resizeSelected(1.1);
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
        rotation: Number(entry.rotation.toFixed(2)),
        z: entry.z,
      })),
    };
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

  resetButton.addEventListener("click", () => {
    const defaultGrid = gridInputs.find((input) => input.value === "3x4");
    if (defaultGrid) defaultGrid.checked = true;
    searchInput.value = "";
    renderGrid();
    clearImage();
    renderSearchResults("");
  });

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
})();
