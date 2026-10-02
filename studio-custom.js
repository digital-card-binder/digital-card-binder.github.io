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
  const pagePrevButton = panel.querySelector("#studio-custom-page-prev");
  const pageNextButton = panel.querySelector("#studio-custom-page-next");
  const pageAddButton = panel.querySelector("#studio-custom-page-add");
  const pageDuplicateButton = panel.querySelector("#studio-custom-page-duplicate");
  const pageLeftButton = panel.querySelector("#studio-custom-page-left");
  const pageRightButton = panel.querySelector("#studio-custom-page-right");
  const pageDeleteButton = panel.querySelector("#studio-custom-page-delete");
  const pagePosition = panel.querySelector("#studio-custom-page-position");
  const pageList = panel.querySelector("#studio-custom-page-list");
  const pagePreviewLabel = panel.querySelector("#studio-custom-page-preview-label");
  const artFileInput = panel.querySelector("#studio-custom-art-file");
  const artFileLabel = panel.querySelector("#studio-custom-art-file-label");
  const artMeta = panel.querySelector("#studio-custom-art-meta");
  const artStatus = panel.querySelector("#studio-custom-art-status");
  const slotSelectToggle = panel.querySelector("#studio-custom-slot-select-toggle");
  const slotSelectAllButton = panel.querySelector("#studio-custom-slot-select-all");
  const slotSelectionClearButton = panel.querySelector("#studio-custom-slot-selection-clear");
  const artApplyButton = panel.querySelector("#studio-custom-art-apply");
  const slotClearButton = panel.querySelector("#studio-custom-slot-clear");
  const previewEmpty = panel.querySelector("#studio-custom-preview-empty");
  const previewWrap = panel.querySelector("#studio-custom-preview-wrap");
  const previewStage = panel.querySelector("#studio-custom-preview-stage");
  const previewImage = panel.querySelector("#studio-custom-preview-image");
  const overlay = panel.querySelector("#studio-custom-grid-overlay");
  const slotLayer = panel.querySelector("#studio-custom-slot-layer");
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
  const customPrintButton = panel.querySelector("#studio-custom-print-button");
  const customPrintSummary = panel.querySelector("#studio-custom-print-summary");
  const customPrintNote = panel.querySelector("#studio-custom-print-note");
  const customPrintSizeInputs = [...panel.querySelectorAll('input[name="studio-custom-print-size"]')];
  const printRoot = document.querySelector("#studio-print-root");

  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const CHUNK_BYTES = 600 * 1024;
  const MAX_SAVED_WORKS = 30;
  const MAX_BINDER_PAGES = 60;
  const BINDER_SCHEMA_VERSION = 2;
  const DEFAULT_PAGE_ID = "page_1";
  const CARD_WIDTH_MM = 63;
  const CARD_HEIGHT_MM = 88;
  const SLEEVE_WIDTH_MM = 65;
  const SLEEVE_HEIGHT_MM = 90;
  const PRINT_MARGIN_MM = 7;
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
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
    currentSchemaVersion: BINDER_SCHEMA_VERSION,
    currentPageId: DEFAULT_PAGE_ID,
    currentPageCreatedAt: null,
    currentChunkCount: 0,
    currentChunkSet: "",
    slots: [],
    images: [],
    selectedSlots: new Set(),
    slotSelectMode: false,
    artFile: null,
    artBlob: null,
    artObjectUrl: "",
    artWidth: 0,
    artHeight: 0,
    pages: [],
    deletedPageIds: new Set(),
    orphanChunkSets: new Set(),
    linkedDexId: "",
    saving: false,
    switchingPage: false,
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

  function gridSpec(value = "3x4") {
    const [cols, rows] = String(value).split("x").map(Number);
    return {
      cols: Number.isInteger(cols) ? cols : 3,
      rows: Number.isInteger(rows) ? rows : 4,
    };
  }

  function emptySlots(count) {
    return Array.from({ length: Math.max(0, count) }, (_, index) => ({
      index,
      type: "empty",
    }));
  }

  function normalizeSlot(value, index) {
    const type = ["card", "image"].includes(value?.type) ? value.type : "empty";
    const slot = { index, type };
    if (type === "card") {
      slot.placementId = clean(value?.placementId);
      slot.sourceKey = clean(value?.sourceKey);
    }
    if (type === "image") {
      slot.imageId = clean(value?.imageId);
      const crop = value?.crop || {};
      slot.crop = {
        x: Math.max(0, Math.min(1, Number(crop.x) || 0)),
        y: Math.max(0, Math.min(1, Number(crop.y) || 0)),
        width: Math.max(0.0001, Math.min(1, Number(crop.width) || 1)),
        height: Math.max(0.0001, Math.min(1, Number(crop.height) || 1)),
      };
    }
    return slot;
  }

  function normalizeSlots(values, count) {
    const source = Array.isArray(values) ? values : [];
    return Array.from({ length: count }, (_, index) =>
      normalizeSlot(source[index], index)
    );
  }

  function clonePlacement(entry) {
    return {
      id: entry.id,
      card: { ...entry.card },
      x: Number(entry.x) || 0,
      y: Number(entry.y) || 0,
      width: Number(entry.width) || 0,
      rotation: Number(entry.rotation) || 0,
      z: Number(entry.z) || 1,
      slotIndex: Number.isInteger(entry.slotIndex) ? entry.slotIndex : null,
    };
  }

  function restoreImageSource(value) {
    return {
      id: clean(value?.id) || makeId("image"),
      name: clean(value?.name) || "slot-image.webp",
      type: clean(value?.type) || "image/webp",
      size: Number(value?.size) || 0,
      width: Number(value?.width) || 0,
      height: Number(value?.height) || 0,
      chunkCount: Number(value?.chunkCount) || 0,
      chunkSet: clean(value?.chunkSet),
      blob: null,
      objectUrl: "",
      dirty: false,
    };
  }

  function cloneImageSource(value, fresh = false) {
    return {
      id: fresh ? makeId("image") : clean(value?.id) || makeId("image"),
      name: clean(value?.name) || "slot-image.webp",
      type: clean(value?.type) || "image/webp",
      size: Number(value?.size) || Number(value?.blob?.size) || 0,
      width: Number(value?.width) || 0,
      height: Number(value?.height) || 0,
      chunkCount: fresh ? 0 : Number(value?.chunkCount) || 0,
      chunkSet: fresh ? "" : clean(value?.chunkSet),
      blob: value?.blob || null,
      objectUrl: fresh && value?.blob
        ? URL.createObjectURL(value.blob)
        : clean(value?.objectUrl),
      dirty: fresh ? Boolean(value?.blob) : Boolean(value?.dirty),
    };
  }

  function persistedImageSource(value) {
    return {
      id: clean(value?.id),
      name: (clean(value?.name) || "slot-image.webp").slice(0, 180),
      type: clean(value?.type) || "image/webp",
      size: Number(value?.size) || Number(value?.blob?.size) || 0,
      chunkCount: Number(value?.chunkCount) || 0,
      chunkSet: clean(value?.chunkSet),
      width: Number(value?.width) || 0,
      height: Number(value?.height) || 0,
    };
  }

  function imageSourceById(imageId) {
    return state.images.find((image) => image.id === imageId) || null;
  }

  function activePageIndex() {
    return Math.max(0, state.pages.findIndex((page) => page.id === state.currentPageId));
  }

  function activePage() {
    return state.pages.find((page) => page.id === state.currentPageId) || null;
  }

  function pageTitle(index) {
    return `${index + 1}페이지`;
  }

  function blankPage(pageId = makeId("page"), gridValue = "3x4") {
    const grid = gridSpec(gridValue);
    return {
      id: pageId,
      title: "",
      grid,
      background: null,
      sourceBlob: null,
      sourceFile: null,
      objectUrl: "",
      sourceWidth: 0,
      sourceHeight: 0,
      backgroundDirty: false,
      chunkCount: 0,
      chunkSet: "",
      createdAt: null,
      placements: [],
      slots: emptySlots(grid.cols * grid.rows),
      images: [],
      nextZ: 1,
      loaded: true,
      isNew: true,
    };
  }

  function slotIndexFromPlacement(entry) {
    const { cols, rows } = selectedGrid();
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    const height = heightPercentForWidth(entry.width || 100 / cols);
    const centerX = (Number(entry.x) || 0) + (Number(entry.width) || 100 / cols) / 2;
    const centerY = (Number(entry.y) || 0) + height / 2;
    const col = Math.max(0, Math.min(cols - 1, Math.floor(centerX / cellW)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor(centerY / cellH)));
    return row * cols + col;
  }

  function syncSlotsFromPlacements() {
    const { cols, rows } = selectedGrid();
    const count = cols * rows;
    const next = normalizeSlots(state.slots, count).map((slot) =>
      slot.type === "card" ? { index: slot.index, type: "empty" } : slot
    );
    state.placements.forEach((entry) => {
      if (!Number.isInteger(entry.slotIndex) || entry.slotIndex < 0 || entry.slotIndex >= count) return;
      if (next[entry.slotIndex]?.type !== "empty") {
        entry.slotIndex = null;
        return;
      }
      next[entry.slotIndex] = {
        index: entry.slotIndex,
        type: "card",
        placementId: entry.id,
        sourceKey: clean(entry.card?.key),
      };
    });
    state.slots = next;
  }

  function inferPlacementSlots() {
    const { cols, rows } = selectedGrid();
    const count = cols * rows;
    state.slots = normalizeSlots(state.slots, count);
    const occupied = new Set(
      state.slots
        .filter((slot) => slot.type !== "empty")
        .map((slot) => slot.index)
    );
    for (const entry of state.placements) {
      if (Number.isInteger(entry.slotIndex) && entry.slotIndex >= 0 && entry.slotIndex < count) {
        occupied.add(entry.slotIndex);
        continue;
      }
      const index = slotIndexFromPlacement(entry);
      if (!occupied.has(index)) {
        entry.slotIndex = index;
        occupied.add(index);
      } else {
        entry.slotIndex = null;
      }
    }
    syncSlotsFromPlacements();
  }

  function captureCurrentPage() {
    const page = activePage();
    if (!page) return null;
    syncSlotsFromPlacements();
    const grid = selectedGrid();
    page.grid = { cols: grid.cols, rows: grid.rows };
    page.sourceBlob = state.sourceBlob;
    page.sourceFile = state.sourceFile;
    page.objectUrl = state.objectUrl;
    page.sourceWidth = state.sourceWidth;
    page.sourceHeight = state.sourceHeight;
    page.backgroundDirty = state.backgroundDirty;
    page.chunkCount = state.currentChunkCount;
    page.chunkSet = state.currentChunkSet;
    page.createdAt = state.currentPageCreatedAt;
    page.placements = state.placements.map(clonePlacement);
    page.slots = normalizeSlots(state.slots, grid.cols * grid.rows);
    page.images = state.images.map((image) => ({ ...image }));
    page.nextZ = state.nextZ;
    page.loaded = true;
    if (page.sourceBlob) {
      page.background = {
        name: (clean(page.sourceFile?.name) || clean(page.background?.name) || "background.webp").slice(0, 180),
        type: clean(page.sourceBlob.type || page.sourceFile?.type || page.background?.type) || "image/webp",
        size: page.sourceBlob.size,
        chunkCount: page.chunkCount,
        chunkSet: page.chunkSet,
        width: page.sourceWidth,
        height: page.sourceHeight,
      };
    } else if (!page.background?.chunkSet) {
      page.background = null;
    }
    return page;
  }

  function releasePageObjectUrls() {
    const urls = new Set(state.pages.map((page) => page.objectUrl).filter(Boolean));
    state.pages.forEach((page) => {
      (page.images || []).forEach((image) => {
        if (image.objectUrl) urls.add(image.objectUrl);
      });
    });
    state.images.forEach((image) => {
      if (image.objectUrl) urls.add(image.objectUrl);
    });
    if (state.objectUrl) urls.add(state.objectUrl);
    if (state.artObjectUrl) urls.add(state.artObjectUrl);
    urls.forEach((url) => URL.revokeObjectURL(url));
    state.artObjectUrl = "";
  }

  function selectedSlotIndexes() {
    const count = selectedGrid().cols * selectedGrid().rows;
    return [...state.selectedSlots]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < count)
      .sort((a, b) => a - b);
  }

  function updateArtUi(message = "") {
    const selected = selectedSlotIndexes();
    const hasSelection = selected.length > 0;
    if (slotSelectToggle) {
      slotSelectToggle.textContent = state.slotSelectMode
        ? "슬롯 선택 완료"
        : "슬롯 선택 시작";
      slotSelectToggle.classList.toggle("is-active", state.slotSelectMode);
    }
    if (artApplyButton) artApplyButton.disabled = !state.artBlob || !hasSelection;
    if (slotClearButton) slotClearButton.disabled = !hasSelection;
    if (slotSelectionClearButton) slotSelectionClearButton.disabled = !hasSelection;
    if (artStatus) {
      artStatus.textContent = message || (
        hasSelection
          ? `${selected.length}칸 선택됨 · 이미지 채우기 또는 비우기를 선택하세요.`
          : state.artBlob
            ? "미리보기에서 원하는 슬롯을 눌러 선택하세요."
            : "이미지를 고른 뒤 미리보기의 원하는 슬롯을 눌러 선택하세요."
      );
    }
    previewStage.classList.toggle("is-slot-selecting", state.slotSelectMode);
  }

  function setSlotSelectMode(enabled) {
    state.slotSelectMode = Boolean(enabled);
    if (!state.slotSelectMode) state.selectedSlots = new Set(selectedSlotIndexes());
    updateArtUi();
    renderSlotLayer();
  }

  function toggleSlotSelection(index) {
    if (!state.slotSelectMode) return;
    if (state.selectedSlots.has(index)) state.selectedSlots.delete(index);
    else state.selectedSlots.add(index);
    renderSlotLayer();
    updateArtUi();
  }

  function selectAllSlots() {
    const count = selectedGrid().cols * selectedGrid().rows;
    state.selectedSlots = new Set(Array.from({ length: count }, (_, index) => index));
    state.slotSelectMode = true;
    renderSlotLayer();
    updateArtUi();
  }

  function clearSlotSelection() {
    state.selectedSlots.clear();
    renderSlotLayer();
    updateArtUi();
  }

  function applyCropStyle(node, source, crop) {
    if (!source?.objectUrl) return;
    const safe = crop || { x: 0, y: 0, width: 1, height: 1 };
    const width = Math.max(0.0001, Math.min(1, Number(safe.width) || 1));
    const height = Math.max(0.0001, Math.min(1, Number(safe.height) || 1));
    const x = Math.max(0, Math.min(1 - width, Number(safe.x) || 0));
    const y = Math.max(0, Math.min(1 - height, Number(safe.y) || 0));
    const posX = width >= 0.9999 ? 0 : (x / (1 - width)) * 100;
    const posY = height >= 0.9999 ? 0 : (y / (1 - height)) * 100;
    node.style.backgroundImage = `url("${source.objectUrl.replaceAll('"', "%22")}")`;
    node.style.backgroundSize = `${100 / width}% ${100 / height}%`;
    node.style.backgroundPosition = `${posX}% ${posY}%`;
    node.style.backgroundRepeat = "no-repeat";
  }

  function pruneUnusedImages() {
    const used = new Set(
      state.slots
        .filter((slot) => slot.type === "image")
        .map((slot) => clean(slot.imageId))
        .filter(Boolean),
    );
    const keep = [];
    state.images.forEach((image) => {
      if (used.has(image.id)) {
        keep.push(image);
        return;
      }
      if (image.chunkSet) state.orphanChunkSets.add(image.chunkSet);
      if (image.objectUrl) URL.revokeObjectURL(image.objectUrl);
    });
    state.images = keep;
  }

  function removeCardAtSlot(index) {
    const slot = state.slots[index];
    if (slot?.type !== "card") return;
    state.placements = state.placements.filter(
      (entry) => entry.id !== slot.placementId && entry.slotIndex !== index,
    );
  }

  function clearSelectedSlots() {
    const selected = selectedSlotIndexes();
    if (!selected.length) return;
    selected.forEach((index) => {
      removeCardAtSlot(index);
      state.slots[index] = { index, type: "empty" };
    });
    pruneUnusedImages();
    state.selectedId = "";
    state.selectedSlots.clear();
    renderSlotLayer();
    renderPlacements();
    captureCurrentPage();
    updateArtUi("선택한 슬롯을 비웠습니다.");
  }

  function renderSlotLayer() {
    if (!slotLayer) return;
    const { cols, rows } = selectedGrid();
    const count = cols * rows;
    state.slots = normalizeSlots(state.slots, count);
    slotLayer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    slotLayer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    const nodes = state.slots.map((slot) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = `studio-custom-slot is-${slot.type}`;
      node.classList.toggle("is-selected", state.selectedSlots.has(slot.index));
      node.dataset.slotIndex = String(slot.index);
      node.dataset.slotType = slot.type;
      node.setAttribute("aria-label", `${slot.index + 1}번 슬롯 · ${slot.type}`);
      if (slot.type === "image") {
        applyCropStyle(node, imageSourceById(slot.imageId), slot.crop);
      }
      node.addEventListener("click", (event) => {
        if (!state.slotSelectMode) return;
        event.preventDefault();
        event.stopPropagation();
        toggleSlotSelection(slot.index);
      });
      return node;
    });
    slotLayer.replaceChildren(...nodes);
    updateArtUi();
  }

  function renderPageControls() {
    const index = activePageIndex();
    const total = Math.max(1, state.pages.length);
    if (pagePosition) pagePosition.textContent = `${index + 1} / ${total}`;
    if (pagePreviewLabel) pagePreviewLabel.textContent = pageTitle(index);
    if (pagePrevButton) pagePrevButton.disabled = index <= 0 || state.switchingPage;
    if (pageNextButton) pageNextButton.disabled = index >= total - 1 || state.switchingPage;
    if (pageLeftButton) pageLeftButton.disabled = index <= 0 || state.switchingPage;
    if (pageRightButton) pageRightButton.disabled = index >= total - 1 || state.switchingPage;
    if (pageDeleteButton) pageDeleteButton.disabled = total <= 1 || state.switchingPage;
    if (pageDuplicateButton) pageDuplicateButton.disabled = total >= MAX_BINDER_PAGES || state.switchingPage;
    if (pageAddButton) pageAddButton.disabled = total >= MAX_BINDER_PAGES || state.switchingPage;
    if (!pageList) return;
    pageList.replaceChildren(...state.pages.map((page, pageIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "studio-custom-page-chip";
      button.classList.toggle("is-active", page.id === state.currentPageId);
      button.dataset.pageId = page.id;
      button.textContent = String(pageIndex + 1);
      button.title = pageTitle(pageIndex);
      button.addEventListener("click", () => void switchPage(page.id));
      return button;
    }));
  }

  async function hydratePageBackground(page) {
    if (!page || page.sourceBlob || !page.background?.chunkSet || !state.currentBinderId) return;
    const reference = binderRef(state.currentBinderId);
    const blob = await readBackgroundBlob(reference, page.background);
    page.sourceBlob = blob;
    page.sourceFile = {
      name: clean(page.background.name) || "saved-background.webp",
      type: clean(page.background.type) || blob.type,
      size: blob.size,
    };
    page.sourceWidth = Number(page.background.width) || 0;
    page.sourceHeight = Number(page.background.height) || 0;
    page.chunkCount = Number(page.background.chunkCount) || 0;
    page.chunkSet = clean(page.background.chunkSet);
    page.objectUrl = URL.createObjectURL(blob);
  }

  async function hydrateImageSource(image) {
    if (!image || image.blob || !image.chunkSet || !state.currentBinderId) return image;
    const reference = binderRef(state.currentBinderId);
    const blob = await readBackgroundBlob(reference, image);
    image.blob = blob;
    image.size = image.size || blob.size;
    image.type = clean(image.type) || blob.type || "image/webp";
    image.objectUrl = URL.createObjectURL(blob);
    image.dirty = false;
    return image;
  }

  async function hydratePageImages(page) {
    if (!page) return;
    const images = Array.isArray(page.images) ? page.images : [];
    for (const image of images) {
      await hydrateImageSource(image);
    }
  }

  async function applyPage(page) {
    if (!page) return;
    await hydratePageBackground(page);
    await hydratePageImages(page);
    const value = `${page.grid?.cols || 3}x${page.grid?.rows || 4}`;
    const input = gridInputs.find((item) => item.value === value)
      || gridInputs.find((item) => item.value === "3x4");
    if (input) input.checked = true;

    state.currentPageId = page.id;
    state.currentPageCreatedAt = page.createdAt || null;
    state.currentChunkCount = Number(page.chunkCount) || 0;
    state.currentChunkSet = clean(page.chunkSet);
    state.sourceBlob = page.sourceBlob || null;
    state.sourceFile = page.sourceFile || null;
    state.objectUrl = page.objectUrl || "";
    state.sourceWidth = Number(page.sourceWidth) || 0;
    state.sourceHeight = Number(page.sourceHeight) || 0;
    state.backgroundDirty = Boolean(page.backgroundDirty);
    state.placements = (page.placements || []).map(clonePlacement);
    state.slots = normalizeSlots(page.slots, selectedGrid().cols * selectedGrid().rows);
    state.images = (page.images || []).map((image) => ({ ...image }));
    state.selectedSlots.clear();
    state.slotSelectMode = false;
    state.nextZ = Math.max(
      Number(page.nextZ) || 1,
      Math.max(0, ...state.placements.map((entry) => Number(entry.z) || 0)) + 1,
    );
    state.selectedId = "";

    if (state.objectUrl) {
      previewImage.src = state.objectUrl;
      previewImage.alt = clean(state.sourceFile?.name) || pageTitle(activePageIndex());
      fileLabel.textContent = clean(state.sourceFile?.name) || "배경 이미지";
      imageMeta.textContent = state.sourceWidth && state.sourceHeight
        ? `${state.sourceWidth.toLocaleString("ko-KR")} × ${state.sourceHeight.toLocaleString("ko-KR")}px · 현재 페이지`
        : "저장된 배경 이미지";
    } else {
      previewImage.removeAttribute("src");
      previewImage.removeAttribute("alt");
      fileLabel.textContent = "이미지를 선택하거나 여기에 놓으세요";
      imageMeta.textContent = "선택 사항 · PNG · JPG · WEBP · 최대 10MB";
    }

    previewEmpty.hidden = true;
    previewWrap.hidden = false;
    renderGrid();
    inferPlacementSlots();
    renderPlacements();
    renderSlotLayer();
    if (state.sourceWidth && state.sourceHeight) {
      updateRatioNote(state.sourceWidth, state.sourceHeight);
    } else {
      ratioNote.textContent = "배경 없이 카드만 배치할 수도 있습니다.";
      ratioNote.className = "studio-custom-ratio-note";
    }
    renderPageControls();
    updateArtUi();
    updateSaveUi();
    updateCustomPrintUi();
  }

  async function switchPage(pageId) {
    if (state.switchingPage || pageId === state.currentPageId) return;
    const target = state.pages.find((page) => page.id === pageId);
    if (!target) return;
    captureCurrentPage();
    state.switchingPage = true;
    renderPageControls();
    try {
      await applyPage(target);
    } catch (error) {
      console.error("바인더 페이지 전환 실패", error);
      window.alert(clean(error?.message) || "페이지를 불러오지 못했습니다.");
    } finally {
      state.switchingPage = false;
      renderPageControls();
    }
  }

  async function addPage() {
    if (state.pages.length >= MAX_BINDER_PAGES) {
      window.alert(`바인더는 최대 ${MAX_BINDER_PAGES}페이지까지 만들 수 있습니다.`);
      return;
    }
    captureCurrentPage();
    const currentGrid = selectedGrid().value;
    const page = blankPage(makeId("page"), currentGrid);
    state.pages.push(page);
    await applyPage(page);
  }

  async function duplicatePage() {
    if (state.pages.length >= MAX_BINDER_PAGES) {
      window.alert(`바인더는 최대 ${MAX_BINDER_PAGES}페이지까지 만들 수 있습니다.`);
      return;
    }
    const sourcePage = captureCurrentPage();
    if (!sourcePage) return;
    await hydratePageBackground(sourcePage);
    await hydratePageImages(sourcePage);
    const copy = blankPage(makeId("page"), `${sourcePage.grid.cols}x${sourcePage.grid.rows}`);
    copy.sourceBlob = sourcePage.sourceBlob;
    copy.sourceFile = sourcePage.sourceFile
      ? { ...sourcePage.sourceFile, name: `복제_${clean(sourcePage.sourceFile.name) || "background.webp"}` }
      : null;
    copy.sourceWidth = sourcePage.sourceWidth;
    copy.sourceHeight = sourcePage.sourceHeight;
    copy.objectUrl = sourcePage.sourceBlob ? URL.createObjectURL(sourcePage.sourceBlob) : "";
    copy.backgroundDirty = Boolean(sourcePage.sourceBlob);
    copy.placements = sourcePage.placements.map((entry) => ({
      ...clonePlacement(entry),
      id: makeId("card"),
    }));
    const placementIdMap = new Map(
      sourcePage.placements.map((entry, index) => [entry.id, copy.placements[index]?.id || ""])
    );
    copy.images = (sourcePage.images || []).map((image) => cloneImageSource(image, true));
    const imageIdMap = new Map(
      (sourcePage.images || []).map((image, index) => [image.id, copy.images[index]?.id || ""])
    );
    copy.slots = sourcePage.slots.map((slot, index) => {
      const normalized = normalizeSlot(slot, index);
      if (normalized.type === "card") {
        normalized.placementId = placementIdMap.get(normalized.placementId) || "";
      }
      if (normalized.type === "image") {
        normalized.imageId = imageIdMap.get(normalized.imageId) || "";
      }
      return normalized;
    });
    copy.nextZ = Math.max(1, ...copy.placements.map((entry) => entry.z + 1));
    const index = activePageIndex();
    state.pages.splice(index + 1, 0, copy);
    await applyPage(copy);
  }

  async function deletePage() {
    if (state.pages.length <= 1) {
      window.alert("바인더에는 최소 한 페이지가 필요합니다.");
      return;
    }
    const index = activePageIndex();
    const page = captureCurrentPage();
    if (!page) return;
    if (!window.confirm(`${pageTitle(index)}를 삭제할까요?`)) return;
    if (!page.isNew) state.deletedPageIds.add(page.id);
    if (page.chunkSet) state.orphanChunkSets.add(page.chunkSet);
    (page.images || []).forEach((image) => {
      if (image.chunkSet) state.orphanChunkSets.add(image.chunkSet);
      if (image.objectUrl) URL.revokeObjectURL(image.objectUrl);
    });
    if (page.objectUrl) URL.revokeObjectURL(page.objectUrl);
    state.pages.splice(index, 1);
    const target = state.pages[Math.min(index, state.pages.length - 1)];
    await applyPage(target);
  }

  function movePage(delta) {
    captureCurrentPage();
    const index = activePageIndex();
    const next = index + delta;
    if (next < 0 || next >= state.pages.length) return;
    const [page] = state.pages.splice(index, 1);
    state.pages.splice(next, 0, page);
    renderPageControls();
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

  function selectedCustomPrintMode() {
    return customPrintSizeInputs.find((input) => input.checked)?.value || "card";
  }

  function customPrintPlan() {
    const grid = selectedGrid();
    const slotCount = grid.cols * grid.rows;
    const mode = selectedCustomPrintMode();

    if (mode === "fit") {
      const logicalWidth = grid.cols * CARD_WIDTH_MM;
      const logicalHeight = grid.rows * CARD_HEIGHT_MM;
      const availableWidth = A4_WIDTH_MM - PRINT_MARGIN_MM * 2;
      const availableHeight = A4_HEIGHT_MM - PRINT_MARGIN_MM * 2;
      const scale = Math.min(
        availableWidth / logicalWidth,
        availableHeight / logicalHeight,
      );
      return {
        ...grid,
        mode,
        label: "A4 한 장 맞춤",
        slotCount,
        perPage: slotCount,
        pageCount: 1,
        orientation: "portrait",
        cellWidth: CARD_WIDTH_MM * scale,
        cellHeight: CARD_HEIGHT_MM * scale,
      };
    }

    const isSleeve = mode === "sleeve";
    const cellWidth = isSleeve ? SLEEVE_WIDTH_MM : CARD_WIDTH_MM;
    const cellHeight = isSleeve ? SLEEVE_HEIGHT_MM : CARD_HEIGHT_MM;
    const availableWidth = A4_WIDTH_MM - PRINT_MARGIN_MM * 2;
    const availableHeight = A4_HEIGHT_MM - PRINT_MARGIN_MM * 2;
    const pageCols = Math.max(1, Math.floor(availableWidth / cellWidth));
    const pageRows = Math.max(1, Math.floor(availableHeight / cellHeight));
    const perPage = pageCols * pageRows;

    return {
      ...grid,
      mode,
      label: isSleeve ? "실제 슬리브" : "실제 카드",
      slotCount,
      pageCols,
      pageRows,
      perPage,
      pageCount: Math.ceil(slotCount / perPage),
      orientation: "portrait",
      cellWidth,
      cellHeight,
    };
  }

  function isAndroidAppShell() {
    return window.POKEMON_DEX_ANDROID_APP === true ||
      (
        typeof window.DigitalCardBinderApp !== "undefined" &&
        typeof window.DigitalCardBinderApp.getVersionCode === "function"
      );
  }

  function supportsNativePrint() {
    return typeof window.DigitalCardBinderApp !== "undefined" &&
      typeof window.DigitalCardBinderApp.startPrint === "function";
  }

  function updateCustomPrintUi() {
    if (!customPrintButton || !customPrintSummary) return;
    const plan = customPrintPlan();
    customPrintSummary.textContent =
      `${plan.cols} × ${plan.rows} · ${plan.slotCount}칸 · ${plan.label} · A4 ${plan.pageCount}페이지`;

    if (customPrintNote) {
      customPrintNote.textContent = plan.mode === "fit"
        ? "전체 바인더를 A4 한 장에 맞추며 각 칸 구분선이 함께 출력됩니다."
        : `각 칸은 ${plan.cellWidth} × ${plan.cellHeight} mm 고정 · A4 한 장당 최대 ${plan.pageCols} × ${plan.pageRows}칸 · 남는 칸은 잘리지 않고 다음 장으로 넘어갑니다.`;
    }

    customPrintButton.disabled = !state.pages.length;
    customPrintButton.textContent = supportsNativePrint()
      ? "인쇄 · PDF로 저장"
      : isAndroidAppShell()
        ? "인쇄 · 앱 업데이트 필요"
        : "인쇄 · PDF 저장";
  }

  function applyStageGeometry() {
    const { cols, rows } = selectedGrid();
    previewStage.style.width = `${cols * CARD_WIDTH_MM * PREVIEW_PX_PER_MM}px`;
    previewStage.style.height = `${rows * CARD_HEIGHT_MM * PREVIEW_PX_PER_MM}px`;
  }

  function renderGrid() {
    const { cols, rows } = selectedGrid();
    const count = cols * rows;
    applyStageGeometry();
    overlay.replaceChildren();
    overlay.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    overlay.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let index = 0; index < count; index += 1) {
      const cell = document.createElement("span");
      cell.setAttribute("aria-hidden", "true");
      overlay.append(cell);
    }

    gridLabel.textContent = `${cols} × ${rows}`;
    slotLabel.textContent = `${count}칸`;
    state.slots = normalizeSlots(state.slots, count);

    if (state.sourceWidth && state.sourceHeight) {
      updateRatioNote(state.sourceWidth, state.sourceHeight);
    }

    const fixedWidth = 100 / cols;
    state.placements.forEach((entry) => {
      entry.width = fixedWidth;
      if (Number.isInteger(entry.slotIndex) && entry.slotIndex >= count) {
        entry.slotIndex = null;
      }
      clampPlacement(entry);
    });
    syncSlotsFromPlacements();
    renderSlotLayer();
    if (state.placements.length) renderPlacements();
    else renderSearchResults(searchInput.value);
    updateCustomPrintUi();
  }

  function handleGridChange() {
    const { cols, rows } = selectedGrid();
    const count = cols * rows;
    state.slots = normalizeSlots(state.slots, count);
    state.selectedSlots = new Set(
      [...state.selectedSlots].filter((index) => index >= 0 && index < count),
    );
    state.placements.forEach((entry) => {
      if (Number.isInteger(entry.slotIndex) && entry.slotIndex >= count) {
        entry.slotIndex = null;
      }
    });
    renderGrid();
    captureCurrentPage();
    renderPageControls();
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

  function clearImage(clearCards = false) {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = "";
    state.sourceFile = null;
    state.sourceBlob = null;
    state.backgroundDirty = false;
    state.sourceWidth = 0;
    state.sourceHeight = 0;
    state.currentChunkCount = 0;
    state.currentChunkSet = "";
    fileInput.value = "";
    previewImage.removeAttribute("src");
    previewImage.removeAttribute("alt");
    previewWrap.hidden = false;
    previewEmpty.hidden = true;
    fileLabel.textContent = "이미지를 선택하거나 여기에 놓으세요";
    imageMeta.textContent = "선택 사항 · PNG · JPG · WEBP · 최대 10MB";
    ratioNote.textContent = "배경 없이 카드만 배치할 수도 있습니다.";
    ratioNote.className = "studio-custom-ratio-note";
    if (clearCards) {
      clearPlacements();
      state.slots = normalizeSlots([], selectedGrid().cols * selectedGrid().rows);
    }
    renderSlotLayer();
    updateCustomPrintUi();
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

    const page = activePage();
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    if (state.currentChunkSet) state.orphanChunkSets.add(state.currentChunkSet);
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
      if (page) {
        page.sourceFile = state.sourceFile;
        page.sourceBlob = state.sourceBlob;
        page.objectUrl = state.objectUrl;
        page.sourceWidth = state.sourceWidth;
        page.sourceHeight = state.sourceHeight;
        page.backgroundDirty = true;
      }
      renderSearchResults(searchInput.value);
      updateSaveUi();
      updateCustomPrintUi();
    };
  }

  async function loadArtFile(file) {
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

    if (state.artObjectUrl) URL.revokeObjectURL(state.artObjectUrl);
    state.artFile = file;
    state.artBlob = file;
    state.artObjectUrl = URL.createObjectURL(file);
    state.artWidth = 0;
    state.artHeight = 0;
    if (artFileLabel) artFileLabel.textContent = file.name;
    if (artMeta) artMeta.textContent = `${(file.size / 1024 / 1024).toFixed(2)}MB · 이미지 확인 중…`;

    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
        image.src = state.artObjectUrl;
      });
      state.artWidth = image.naturalWidth;
      state.artHeight = image.naturalHeight;
      if (artMeta) {
        artMeta.textContent =
          `${state.artWidth.toLocaleString("ko-KR")} × ${state.artHeight.toLocaleString("ko-KR")}px · ${(file.size / 1024 / 1024).toFixed(2)}MB`;
      }
      state.slotSelectMode = true;
      updateArtUi("확장 이미지를 준비했습니다. 미리보기에서 넣을 슬롯을 선택하세요.");
      renderSlotLayer();
    } catch (error) {
      console.error("슬롯 이미지 읽기 실패", error);
      state.artFile = null;
      state.artBlob = null;
      state.artWidth = 0;
      state.artHeight = 0;
      if (artMeta) artMeta.textContent = "이미지를 읽지 못했습니다.";
      updateArtUi("이미지를 읽지 못했습니다. 다른 이미지를 선택해 주세요.");
    }
  }

  function applyArtToSelectedSlots() {
    const selected = selectedSlotIndexes();
    if (!state.artBlob || !selected.length) return;
    const { cols } = selectedGrid();
    const coordinates = selected.map((index) => ({
      index,
      col: index % cols,
      row: Math.floor(index / cols),
    }));
    const minCol = Math.min(...coordinates.map((item) => item.col));
    const maxCol = Math.max(...coordinates.map((item) => item.col));
    const minRow = Math.min(...coordinates.map((item) => item.row));
    const maxRow = Math.max(...coordinates.map((item) => item.row));
    const spanCols = maxCol - minCol + 1;
    const spanRows = maxRow - minRow + 1;

    const source = {
      id: makeId("image"),
      name: (clean(state.artFile?.name) || "slot-image.webp").slice(0, 180),
      type: clean(state.artBlob.type || state.artFile?.type) || "image/webp",
      size: state.artBlob.size,
      width: state.artWidth,
      height: state.artHeight,
      chunkCount: 0,
      chunkSet: "",
      blob: state.artBlob,
      objectUrl: URL.createObjectURL(state.artBlob),
      dirty: true,
    };
    state.images.push(source);

    coordinates.forEach(({ index, col, row }) => {
      removeCardAtSlot(index);
      state.slots[index] = {
        index,
        type: "image",
        imageId: source.id,
        crop: {
          x: Number(((col - minCol) / spanCols).toFixed(6)),
          y: Number(((row - minRow) / spanRows).toFixed(6)),
          width: Number((1 / spanCols).toFixed(6)),
          height: Number((1 / spanRows).toFixed(6)),
        },
      };
    });

    pruneUnusedImages();
    state.selectedId = "";
    state.selectedSlots.clear();
    state.slotSelectMode = false;
    renderSlotLayer();
    renderPlacements();
    captureCurrentPage();
    updateArtUi(`${selected.length}칸에 이미지를 자동분할했습니다.`);
  }

  function availableCardTargetIndex() {
    const selected = selectedSlotIndexes();
    if (selected.length === 1) return selected[0];
    return state.slots.findIndex((slot) => slot.type === "empty");
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
    add.disabled = availableCardTargetIndex() < 0;
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
    const selected = selectedSlotIndexes();
    if (selected.length === 1) {
      searchStatus.textContent = `${matches.length}장 찾음 · 선택한 ${selected[0] + 1}번 슬롯의 내용을 카드로 교체할 수 있습니다.`;
    } else if (!state.slots.some((slot) => slot.type === "empty")) {
      searchStatus.textContent = `${matches.length}장 찾음 · 빈 슬롯이 없습니다. 교체할 슬롯 하나를 먼저 선택하세요.`;
    } else {
      searchStatus.textContent = `${matches.length}장 찾음 · 빈 슬롯부터 자동으로 배치됩니다.`;
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

  function snapEntryToSlot(entry, slotIndex) {
    const geometry = slotGeometry(slotIndex);
    entry.slotIndex = slotIndex;
    entry.x = geometry.x;
    entry.y = geometry.y;
    entry.width = geometry.width;
    entry.rotation = 0;
  }

  function movePlacementToSlot(entry, targetIndex, originIndex = null) {
    const count = selectedGrid().cols * selectedGrid().rows;
    if (!entry || targetIndex < 0 || targetIndex >= count) return;
    const target = state.slots[targetIndex];

    if (target?.type === "card" && target.placementId !== entry.id) {
      const other = state.placements.find((item) => item.id === target.placementId);
      if (other) {
        if (Number.isInteger(originIndex) && originIndex >= 0 && originIndex < count) {
          snapEntryToSlot(other, originIndex);
        } else {
          other.slotIndex = null;
        }
      }
    }

    if (target?.type === "image") {
      state.slots[targetIndex] = { index: targetIndex, type: "empty" };
    }

    snapEntryToSlot(entry, targetIndex);
    syncSlotsFromPlacements();
    pruneUnusedImages();
    renderSlotLayer();
    renderPlacements();
    captureCurrentPage();
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
      const originSlotIndex = Number.isInteger(entry.slotIndex) ? entry.slotIndex : null;
      let moved = false;
      node.setPointerCapture?.(event.pointerId);
      node.classList.add("is-dragging");

      const move = (moveEvent) => {
        const dxPx = moveEvent.clientX - startClientX;
        const dyPx = moveEvent.clientY - startClientY;
        if (Math.hypot(dxPx, dyPx) > 4) moved = true;
        const dx = (dxPx / stageRect.width) * 100;
        const dy = (dyPx / stageRect.height) * 100;
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
        if (moved && Number.isInteger(originSlotIndex)) {
          movePlacementToSlot(entry, slotIndexFromPlacement(entry), originSlotIndex);
        } else {
          captureCurrentPage();
        }
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
    const slotIndex = availableCardTargetIndex();
    if (slotIndex < 0) {
      window.alert("빈 슬롯이 없습니다. 교체할 슬롯 하나를 먼저 선택해 주세요.");
      return;
    }

    removeCardAtSlot(slotIndex);
    const geometry = slotGeometry(slotIndex);
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
      slotIndex,
    };
    state.placements.push(entry);
    state.slots[slotIndex] = {
      index: slotIndex,
      type: "card",
      placementId: entry.id,
      sourceKey: clean(card.key),
    };
    state.selectedId = entry.id;
    state.selectedSlots.clear();
    state.slotSelectMode = false;
    pruneUnusedImages();
    renderSlotLayer();
    renderPlacements();
    captureCurrentPage();
    updateArtUi("선택한 슬롯을 실제 카드로 교체했습니다.");
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
    const slotIndex = row * cols + col;
    const originIndex = Number.isInteger(entry.slotIndex) ? entry.slotIndex : null;
    movePlacementToSlot(entry, slotIndex, originIndex);
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
    syncSlotsFromPlacements();
    renderSlotLayer();
    renderPlacements();
    captureCurrentPage();
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
      schemaVersion: BINDER_SCHEMA_VERSION,
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
      background: state.sourceBlob
        ? {
            name: clean(state.sourceFile?.name),
            type: clean(state.sourceFile?.type),
            width: state.sourceWidth,
            height: state.sourceHeight,
          }
        : null,
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
        slotIndex: Number.isInteger(entry.slotIndex) ? entry.slotIndex : null,
      })),
      slots: normalizeSlots(state.slots, grid.cols * grid.rows).map((slot) => ({ ...slot })),
    };
  }

  function installCustomPrintPageStyle() {
    document.querySelector("#studio-dynamic-page-style")?.remove();
    const style = document.createElement("style");
    style.id = "studio-dynamic-page-style";
    style.textContent = "@media print { @page { size: A4 portrait; margin: 0; } }";
    document.head.append(style);
  }

  function createCustomPrintComposition(plan) {
    const grid = selectedGrid();
    const canvasWidth = grid.cols * plan.cellWidth;
    const canvasHeight = grid.rows * plan.cellHeight;
    const composition = document.createElement("div");
    composition.className = "studio-custom-print-composition";
    composition.style.width = `${canvasWidth}mm`;
    composition.style.height = `${canvasHeight}mm`;

    if (state.objectUrl) {
      const background = document.createElement("img");
      background.className = "studio-custom-print-background";
      background.src = state.objectUrl;
      background.alt = "";
      composition.append(background);
    }

    state.slots
      .filter((slot) => slot.type === "image")
      .forEach((slot) => {
        const source = imageSourceById(slot.imageId);
        if (!source?.objectUrl) return;
        const col = slot.index % grid.cols;
        const row = Math.floor(slot.index / grid.cols);
        const tile = document.createElement("div");
        tile.className = "studio-custom-print-image-tile";
        tile.style.position = "absolute";
        tile.style.left = `${col * plan.cellWidth}mm`;
        tile.style.top = `${row * plan.cellHeight}mm`;
        tile.style.width = `${plan.cellWidth}mm`;
        tile.style.height = `${plan.cellHeight}mm`;
        applyCropStyle(tile, source, slot.crop);
        composition.append(tile);
      });

    state.placements
      .slice()
      .sort((a, b) => a.z - b.z)
      .forEach((entry) => {
        const image = document.createElement("img");
        image.className = "studio-custom-print-card-image";
        image.src = entry.card.image;
        image.alt = "";
        image.style.left = `${(entry.x / 100) * canvasWidth}mm`;
        image.style.top = `${(entry.y / 100) * canvasHeight}mm`;
        image.style.width = `${plan.cellWidth}mm`;
        image.style.height = `${plan.cellHeight}mm`;
        image.style.zIndex = String(entry.z);
        image.style.transform = `rotate(${entry.rotation}deg)`;
        composition.append(image);
      });

    return composition;
  }

  function createCustomPrintCell(index, plan) {
    const grid = selectedGrid();
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    const cell = document.createElement("article");
    cell.className = "studio-custom-print-cell";
    cell.dataset.customPrintSlot = String(index + 1);
    cell.style.width = `${plan.cellWidth}mm`;
    cell.style.height = `${plan.cellHeight}mm`;
    cell.style.pageBreakInside = "avoid";
    cell.style.breakInside = "avoid";

    const composition = createCustomPrintComposition(plan);
    composition.style.left = `-${col * plan.cellWidth}mm`;
    composition.style.top = `-${row * plan.cellHeight}mm`;
    cell.append(composition);
    return cell;
  }

  function addCustomPrintCalibration(sheet) {
    const calibration = document.createElement("div");
    calibration.className = "studio-calibration";
    calibration.textContent = "10 mm";
    sheet.append(calibration);
  }

  function buildCustomPrintSheets() {
    if (!printRoot) return null;
    const plan = customPrintPlan();
    installCustomPrintPageStyle();
    printRoot.replaceChildren();

    if (plan.mode === "fit") {
      const sheet = document.createElement("section");
      sheet.className = "studio-print-sheet studio-custom-print-sheet studio-custom-print-sheet--fit";
      sheet.style.gridTemplateColumns = `repeat(${plan.cols}, ${plan.cellWidth}mm)`;
      sheet.style.gridTemplateRows = `repeat(${plan.rows}, ${plan.cellHeight}mm)`;
      for (let index = 0; index < plan.slotCount; index += 1) {
        sheet.append(createCustomPrintCell(index, plan));
      }
      printRoot.append(sheet);
      return plan;
    }

    for (let start = 0; start < plan.slotCount; start += plan.perPage) {
      const sheet = document.createElement("section");
      sheet.className = "studio-print-sheet studio-print-sheet--exact studio-custom-print-sheet";
      sheet.dataset.customPrintPage = String(Math.floor(start / plan.perPage) + 1);
      sheet.style.gridTemplateColumns = `repeat(${plan.pageCols}, ${plan.cellWidth}mm)`;
      sheet.style.gridTemplateRows = `repeat(${plan.pageRows}, ${plan.cellHeight}mm)`;
      sheet.style.pageBreakInside = "avoid";
      sheet.style.breakInside = "avoid-page";
      const end = Math.min(plan.slotCount, start + plan.perPage);
      for (let index = start; index < end; index += 1) {
        sheet.append(createCustomPrintCell(index, plan));
      }
      addCustomPrintCalibration(sheet);
      printRoot.append(sheet);
    }
    return plan;
  }

  async function waitForCustomPrintImages() {
    const images = [...printRoot.querySelectorAll("img")];
    let timer;
    const tasks = images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        const finish = () => {
          image.removeEventListener("load", finish);
          image.removeEventListener("error", finish);
          resolve();
        };
        image.addEventListener("load", finish);
        image.addEventListener("error", finish);
      });
    });
    try {
      await Promise.race([
        Promise.all(tasks),
        new Promise((resolve) => { timer = window.setTimeout(resolve, 60000); }),
      ]);
    } finally { window.clearTimeout(timer); }
    if (images.some((image) => !image.complete || image.naturalWidth === 0)) {
      throw new Error("일부 카드 이미지를 준비하지 못했습니다. 잠시 후 다시 인쇄해 주세요.");
    }
  }

  async function startCustomPrint() {
    if (!printRoot) return;

    if (isAndroidAppShell() && !supportsNativePrint()) {
      window.alert(
        "현재 설치된 Android 앱은 시스템 인쇄를 지원하지 않습니다.\n" +
        "디지털 카드 바인더 앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.",
      );
      return;
    }

    const plan = buildCustomPrintSheets();
    if (!plan) return;

    const originalTitle = document.title;
    const title = clean(titleInput.value) || "커스텀바인더";
    const printTitle = `바인더스튜디오_${title}_${plan.cols}x${plan.rows}_${plan.mode}`;
    document.title = printTitle;
    customPrintButton.disabled = true;
    customPrintButton.textContent = "인쇄 준비 중…";

    try {
      await waitForCustomPrintImages();
      if (supportsNativePrint()) {
        window.DigitalCardBinderApp.startPrint(printTitle, false);
      } else {
        window.print();
      }
    } catch (error) {
      window.alert(error.message || "카드 이미지를 준비하지 못했습니다. 다시 인쇄해 주세요.");
    } finally {
      updateCustomPrintUi();
      window.setTimeout(() => {
        document.title = originalTitle;
      }, 500);
    }
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

  function binderPageRef(binderId, pageId = DEFAULT_PAGE_ID) {
    const reference = binderRef(binderId);
    if (!reference || !pageId) return null;
    return state.firebase.firestoreModule.doc(reference, "pages", pageId);
  }

  function primaryPageId(data) {
    const order = Array.isArray(data?.pageOrder) ? data.pageOrder : [];
    const first = clean(order[0]);
    return first || DEFAULT_PAGE_ID;
  }

  async function savedPagesData(binderId, binderData) {
    if (Number(binderData?.schemaVersion) !== BINDER_SCHEMA_VERSION) {
      return [{
        pageId: DEFAULT_PAGE_ID,
        page: binderData || {},
        pageCreatedAt: null,
        legacy: true,
      }];
    }

    const reference = binderRef(binderId);
    const snapshot = await state.firebase.firestoreModule.getDocs(
      state.firebase.firestoreModule.collection(reference, "pages"),
    );
    const pageMap = new Map(
      snapshot.docs.map((documentSnapshot) => [
        documentSnapshot.id,
        documentSnapshot.data() || {},
      ]),
    );
    const order = (Array.isArray(binderData.pageOrder) ? binderData.pageOrder : [])
      .map(clean)
      .filter(Boolean);
    if (!order.length) throw new Error("저장된 바인더의 페이지 순서를 찾지 못했습니다.");

    return order.map((pageId) => {
      const page = pageMap.get(pageId);
      if (!page) throw new Error(`저장된 페이지를 찾지 못했습니다: ${pageId}`);
      if (page.ownerUid !== state.user.uid) {
        throw new Error("이 페이지를 열 권한이 없습니다.");
      }
      return {
        pageId,
        page,
        pageCreatedAt: page.createdAt || null,
        legacy: false,
      };
    });
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
    } else if (state.currentBinderId) {
      saveStatus.textContent = `현재 ${state.pages.length}페이지 바인더를 수정 중입니다.`;
    } else {
      saveStatus.textContent = "배경 이미지 없이도 페이지와 카드 슬롯을 저장할 수 있습니다.";
    }

    saveButton.disabled = state.saving || !state.pages.length;
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
        const isV2 = Number(data.schemaVersion) === BINDER_SCHEMA_VERSION;
        const grid = isV2 ? (data.summary?.firstGrid || {}) : (data.grid || {});
        const item = document.createElement("article");
        item.className = "studio-custom-library-item";

        const copy = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = clean(data.title) || "커스텀 바인더";
        const meta = document.createElement("span");
        meta.textContent = [
          grid.cols && grid.rows ? `${grid.cols}×${grid.rows}` : "",
          isV2
            ? `${Number(data.summary?.pageCount) || 1}페이지 · ${Number(data.summary?.cardCount) || 0}장 배치`
            : Array.isArray(data.cards) ? `${data.cards.length}장 배치` : "",
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
      slotIndex:
        entry?.slotIndex !== null &&
        entry?.slotIndex !== undefined &&
        entry?.slotIndex !== "" &&
        Number.isInteger(Number(entry.slotIndex))
          ? Number(entry.slotIndex)
          : null,
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

      const savedPages = await savedPagesData(binderId, data);
      releasePageObjectUrls();
      state.pages = savedPages.map((saved, index) => {
        const page = saved.page || {};
        const cols = Number(page.grid?.cols) || 3;
        const rows = Number(page.grid?.rows) || 4;
        const background = page.background || null;
        const placements = (Array.isArray(page.cards) ? page.cards : [])
          .slice(0, 20)
          .map(restorePlacement);
        const slots = normalizeSlots(page.slots, cols * rows);
        return {
          id: saved.pageId,
          title: clean(page.title) || pageTitle(index),
          grid: { cols, rows },
          background,
          sourceBlob: null,
          sourceFile: null,
          objectUrl: "",
          sourceWidth: Number(background?.width) || 0,
          sourceHeight: Number(background?.height) || 0,
          backgroundDirty: false,
          chunkCount: Number(background?.chunkCount) || 0,
          chunkSet: clean(background?.chunkSet),
          createdAt: saved.pageCreatedAt || null,
          placements,
          slots,
          images: (Array.isArray(page.images) ? page.images : [])
            .slice(0, 20)
            .map(restoreImageSource),
          nextZ: Math.max(0, ...placements.map((entry) => Number(entry.z) || 0)) + 1,
          loaded: true,
          isNew: saved.legacy,
        };
      });

      state.currentBinderId = binderId;
      state.currentCreatedAt = data.createdAt || null;
      state.currentSchemaVersion = Number(data.schemaVersion) || 1;
      state.linkedDexId = clean(data.linkedDexId);
      state.deletedPageIds = new Set();
      state.orphanChunkSets = new Set();
      titleInput.value = clean(data.title);

      const firstPage = state.pages[0];
      if (!firstPage) throw new Error("저장된 페이지가 없습니다.");
      await applyPage(firstPage);

      setBinderUrl(binderId);
      deleteButton.hidden = false;
      updateSaveUi(
        state.currentSchemaVersion === 1
          ? "기존 저장 작업을 불러왔습니다. 다음 저장 시 여러 페이지 구조(v2)로 안전하게 전환됩니다."
          : `${state.pages.length}페이지 바인더를 불러왔습니다.`,
      );
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

    const title = clean(titleInput.value).slice(0, 60);
    if (!title) {
      titleInput.focus();
      saveStatus.textContent = "작업 이름을 입력해 주세요.";
      return;
    }
    if (!state.pages.length) {
      window.alert("저장할 페이지가 없습니다.");
      return;
    }
    if (!state.currentBinderId && state.savedWorkCount >= MAX_SAVED_WORKS) {
      window.alert(`커스텀 바인더는 최대 ${MAX_SAVED_WORKS}개까지 저장할 수 있습니다.`);
      return;
    }

    captureCurrentPage();
    state.saving = true;
    updateSaveUi(`${state.pages.length}페이지를 저장하고 있습니다…`);

    const binderId = state.currentBinderId || makeId("binder");
    const reference = binderRef(binderId);
    const firestoreModule = state.firebase.firestoreModule;

    try {
      for (const page of state.pages) {
        const usedImageIds = new Set(
          (page.slots || [])
            .filter((slot) => slot?.type === "image")
            .map((slot) => clean(slot.imageId))
            .filter(Boolean),
        );
        page.images = (page.images || []).filter((image) => {
          if (usedImageIds.has(image.id)) return true;
          if (image.chunkSet) state.orphanChunkSets.add(image.chunkSet);
          if (image.objectUrl) URL.revokeObjectURL(image.objectUrl);
          return false;
        });

        if (page.sourceBlob) {
          if (
            !page.sourceWidth ||
            !page.sourceHeight ||
            page.sourceWidth > 20000 ||
            page.sourceHeight > 20000
          ) {
            throw new Error(`${page.title || "페이지"} 배경 이미지의 가로·세로는 1~20,000px이어야 합니다.`);
          }
          if (
            !state.currentBinderId ||
            page.backgroundDirty ||
            !page.chunkCount ||
            !page.chunkSet
          ) {
            if (page.chunkSet) state.orphanChunkSets.add(page.chunkSet);
            const chunkSet = makeId("blob");
            const chunkCount = await writeBackgroundChunks(
              reference,
              page.sourceBlob,
              chunkSet,
            );
            page.chunkSet = chunkSet;
            page.chunkCount = chunkCount;
            page.background = {
              name: (clean(page.sourceFile?.name) || clean(page.background?.name) || "background.webp").slice(0, 180),
              type: clean(page.sourceBlob.type || page.sourceFile?.type || page.background?.type) || "image/webp",
              size: page.sourceBlob.size,
              chunkCount,
              chunkSet,
              width: page.sourceWidth,
              height: page.sourceHeight,
            };
          }
        } else if (!page.background?.chunkSet) {
          page.background = null;
          page.chunkCount = 0;
          page.chunkSet = "";
        }

        for (const image of page.images || []) {
          if (
            image.blob &&
            (!image.width || !image.height || image.width > 20000 || image.height > 20000)
          ) {
            throw new Error(`${page.title || "페이지"} 슬롯 이미지의 가로·세로는 1~20,000px이어야 합니다.`);
          }
          if (
            image.blob &&
            (!state.currentBinderId || image.dirty || !image.chunkCount || !image.chunkSet)
          ) {
            if (image.chunkSet) state.orphanChunkSets.add(image.chunkSet);
            const chunkSet = makeId("tile");
            const chunkCount = await writeBackgroundChunks(reference, image.blob, chunkSet);
            image.chunkSet = chunkSet;
            image.chunkCount = chunkCount;
            image.size = image.blob.size;
            image.type = clean(image.blob.type || image.type) || "image/webp";
          }
          if (!image.chunkSet || !image.chunkCount) {
            throw new Error(`${page.title || "페이지"}의 슬롯 이미지 저장 정보가 올바르지 않습니다.`);
          }
        }
      }

      const now = firestoreModule.serverTimestamp();
      const batch = firestoreModule.writeBatch(state.firebase.db);

      state.pages.forEach((page, index) => {
        const cols = Number(page.grid?.cols) || 3;
        const rows = Number(page.grid?.rows) || 4;
        const slotCount = cols * rows;
        const grid = {
          cols,
          rows,
          slotCount,
          cardWidthMm: CARD_WIDTH_MM,
          cardHeightMm: CARD_HEIGHT_MM,
          canvasWidthMm: cols * CARD_WIDTH_MM,
          canvasHeightMm: rows * CARD_HEIGHT_MM,
        };
        const cards = page.placements.map((entry) => ({
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
          slotIndex: Number.isInteger(entry.slotIndex) ? entry.slotIndex : null,
        }));
        const pageReference = binderPageRef(binderId, page.id);
        batch.set(pageReference, {
          schemaVersion: BINDER_SCHEMA_VERSION,
          ownerUid: state.user.uid,
          pageId: page.id,
          title: clean(page.title) || pageTitle(index),
          grid,
          background: page.background || null,
          cards,
          slots: normalizeSlots(page.slots, slotCount).map((slot) => ({ ...slot })),
          images: (page.images || []).map(persistedImageSource),
          createdAt: page.createdAt || now,
          updatedAt: now,
        });
      });

      state.deletedPageIds.forEach((pageId) => {
        batch.delete(binderPageRef(binderId, pageId));
      });

      const first = state.pages[0];
      const cardCount = state.pages.reduce(
        (sum, page) => sum + page.placements.length,
        0,
      );
      const metadata = {
        schemaVersion: BINDER_SCHEMA_VERSION,
        ownerUid: state.user.uid,
        title,
        linkedDexId: state.linkedDexId || "",
        pageOrder: state.pages.map((page) => page.id),
        summary: {
          pageCount: state.pages.length,
          cardCount,
          firstGrid: {
            cols: Number(first.grid?.cols) || 3,
            rows: Number(first.grid?.rows) || 4,
          },
        },
        settings: {
          defaultPrintMode: selectedCustomPrintMode(),
          missingCardDisplay: "color",
        },
        createdAt: state.currentCreatedAt || now,
        updatedAt: now,
      };
      batch.set(reference, metadata);
      await batch.commit();

      const [savedRoot, savedPagesSnapshot] = await Promise.all([
        firestoreModule.getDoc(reference),
        firestoreModule.getDocs(firestoreModule.collection(reference, "pages")),
      ]);
      const savedData = savedRoot.data() || {};
      const createdMap = new Map(
        savedPagesSnapshot.docs.map((item) => [item.id, item.data()?.createdAt || null]),
      );

      state.currentBinderId = binderId;
      state.currentCreatedAt = savedData.createdAt || state.currentCreatedAt;
      state.currentSchemaVersion = BINDER_SCHEMA_VERSION;
      state.deletedPageIds = new Set();
      state.pages.forEach((page) => {
        page.createdAt = createdMap.get(page.id) || page.createdAt;
        page.backgroundDirty = false;
        (page.images || []).forEach((image) => {
          image.dirty = false;
        });
        page.isNew = false;
      });

      const activeSets = new Set();
      state.pages.forEach((page) => {
        if (page.chunkSet) activeSets.add(clean(page.chunkSet));
        (page.images || []).forEach((image) => {
          if (image.chunkSet) activeSets.add(clean(image.chunkSet));
        });
      });
      for (const chunkSet of state.orphanChunkSets) {
        if (!activeSets.has(chunkSet)) {
          await deleteChunkSet(reference, chunkSet);
        }
      }
      state.orphanChunkSets = new Set();

      const current = activePage();
      if (current) {
        state.currentPageCreatedAt = current.createdAt || null;
        state.currentChunkCount = Number(current.chunkCount) || 0;
        state.currentChunkSet = clean(current.chunkSet);
        state.backgroundDirty = false;
      }

      setBinderUrl(binderId);
      renderPageControls();
      updateSaveUi(`${state.pages.length}페이지를 나만의도감에 저장했습니다.`);
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
      const [chunks, pages] = await Promise.all([
        firestoreModule.getDocs(firestoreModule.collection(reference, "chunks")),
        firestoreModule.getDocs(firestoreModule.collection(reference, "pages")),
      ]);
      const subdocuments = [...chunks.docs, ...pages.docs];
      for (let start = 0; start < subdocuments.length; start += 400) {
        const batch = firestoreModule.writeBatch(db);
        subdocuments.slice(start, start + 400).forEach((item) => batch.delete(item.ref));
        await batch.commit();
      }
      await firestoreModule.deleteDoc(reference);
      resetEditor(true);
      await refreshLibrary();
      updateSaveUi("저장 작업을 삭제했습니다.");
    } catch (error) {
      console.error("커스텀 바인더 삭제 실패", error);
      updateSaveUi(clean(error?.message) || "저장 작업을 삭제하지 못했습니다.");
    }
  }

  function resetEditor(clearUrl = true) {
    releasePageObjectUrls();
    state.currentBinderId = "";
    state.currentCreatedAt = null;
    state.currentSchemaVersion = BINDER_SCHEMA_VERSION;
    state.currentPageId = DEFAULT_PAGE_ID;
    state.currentPageCreatedAt = null;
    state.currentChunkCount = 0;
    state.currentChunkSet = "";
    state.backgroundDirty = false;
    state.slots = [];
    state.images = [];
    state.selectedSlots = new Set();
    state.slotSelectMode = false;
    state.artFile = null;
    state.artBlob = null;
    if (state.artObjectUrl) URL.revokeObjectURL(state.artObjectUrl);
    state.artObjectUrl = "";
    state.artWidth = 0;
    state.artHeight = 0;
    if (artFileInput) artFileInput.value = "";
    if (artFileLabel) artFileLabel.textContent = "확장 이미지를 선택하세요";
    if (artMeta) artMeta.textContent = "PNG · JPG · WEBP · 최대 10MB";
    state.pages = [blankPage(DEFAULT_PAGE_ID, "3x4")];
    state.deletedPageIds = new Set();
    state.orphanChunkSets = new Set();
    state.linkedDexId = "";
    state.placements = [];
    state.selectedId = "";
    state.nextZ = 1;
    titleInput.value = "";
    searchInput.value = "";
    const defaultGrid = gridInputs.find((input) => input.value === "3x4");
    if (defaultGrid) defaultGrid.checked = true;
    state.slots = emptySlots(12);
    clearImage(true);
    previewWrap.hidden = false;
    previewEmpty.hidden = true;
    renderGrid();
    renderSlotLayer();
    renderPageControls();
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

  gridInputs.forEach((input) => input.addEventListener("change", handleGridChange));
  customPrintSizeInputs.forEach((input) =>
    input.addEventListener("change", updateCustomPrintUi),
  );
  fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));
  artFileInput?.addEventListener("change", () => void loadArtFile(artFileInput.files?.[0]));
  slotSelectToggle?.addEventListener("click", () => {
    setSlotSelectMode(!state.slotSelectMode);
  });
  slotSelectAllButton?.addEventListener("click", () => selectAllSlots());
  slotSelectionClearButton?.addEventListener("click", () => clearSlotSelection());
  artApplyButton?.addEventListener("click", () => applyArtToSelectedSlots());
  slotClearButton?.addEventListener("click", () => clearSelectedSlots());

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
  pagePrevButton?.addEventListener("click", () => {
    const index = activePageIndex();
    if (index > 0) void switchPage(state.pages[index - 1].id);
  });
  pageNextButton?.addEventListener("click", () => {
    const index = activePageIndex();
    if (index < state.pages.length - 1) void switchPage(state.pages[index + 1].id);
  });
  pageAddButton?.addEventListener("click", () => void addPage());
  pageDuplicateButton?.addEventListener("click", () => void duplicatePage());
  pageLeftButton?.addEventListener("click", () => movePage(-1));
  pageRightButton?.addEventListener("click", () => movePage(1));
  pageDeleteButton?.addEventListener("click", () => void deletePage());
  saveButton.addEventListener("click", () => void saveCurrentBinder());
  newButton.addEventListener("click", () => resetEditor(true));
  deleteButton.addEventListener("click", () => void deleteCurrentBinder());
  titleInput.addEventListener("input", () => updateSaveUi());
  customPrintButton.addEventListener("click", () => void startCustomPrint());
  updateArtUi();

  window.addEventListener("resize", () => {
    state.placements.forEach(clampPlacement);
    renderPlacements();
  });

  window.addEventListener("beforeunload", () => {
    releasePageObjectUrls();
  });

  root.customBinderEditor = Object.freeze({
    getDraft: draftSnapshot,
    hasBackground: () => Boolean(state.objectUrl),
    getPlacedCount: () => state.placements.length,
    getPageCount: () => state.pages.length,
  });

  resetEditor(false);
  activateTab(window.location.hash === "#studio-custom" ? "custom" : "print", false);
  updateSaveUi();
  updateCustomPrintUi();
  void initializePersistence();
})();
