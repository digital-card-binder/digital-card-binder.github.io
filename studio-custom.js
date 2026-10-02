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
  const photoCameraInput = panel.querySelector("#studio-custom-photo-camera");
  const photoAlbumInput = panel.querySelector("#studio-custom-photo-album");
  const photoGridLabel = panel.querySelector("#studio-custom-photo-grid");
  const photoStatus = panel.querySelector("#studio-custom-photo-status");
  const photoRecognizeButton = panel.querySelector("#studio-custom-photo-recognize");
  const photoRecognitionResults = panel.querySelector("#studio-custom-photo-recognition-results");
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
  const linkedDexSelect = panel.querySelector("#studio-custom-linked-dex");
  const linkedDexStatus = panel.querySelector("#studio-custom-linked-dex-status");
  const missingDisplayInputs = [...panel.querySelectorAll('input[name="studio-custom-missing-display"]')];
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
  const shareStatus = panel.querySelector("#studio-custom-share-status");
  const publishButton = panel.querySelector("#studio-custom-publish-button");
  const unpublishButton = panel.querySelector("#studio-custom-unpublish-button");
  const shareLinkWrap = panel.querySelector("#studio-custom-share-link-wrap");
  const shareUrlInput = panel.querySelector("#studio-custom-share-url");
  const copyLinkButton = panel.querySelector("#studio-custom-copy-link");
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
  const PUBLIC_PREVIEW_PX_PER_MM = 4;

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
    customDexes: new Map(),
    missingCardDisplay: "color",
    publicProfile: null,
    isPublished: false,
    publishing: false,
    photoRecognizing: false,
    photoReview: new Map(),
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

  function normalizeCustomDexes(source) {
    const result = new Map();
    if (!source || typeof source !== "object" || Array.isArray(source)) return result;
    Object.entries(source).slice(0, 30).forEach(([fallbackId, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      const id = clean(value.id || fallbackId);
      const title = clean(value.title);
      if (!id || !title) return;
      const cards = Array.isArray(value.cards) ? value.cards : [];
      const cardMap = new Map();
      cards.forEach((entry) => {
        const key = clean(entry?.key);
        if (!key || cardMap.has(key)) return;
        cardMap.set(key, Boolean(entry?.owned));
      });
      result.set(id, { id, title, cardMap, cardCount: cardMap.size });
    });
    return result;
  }

  function linkedDex() {
    return state.customDexes.get(state.linkedDexId) || null;
  }

  function customDexKeyCandidates(card) {
    const candidates = new Set();
    const direct = clean(card?.customDexKey);
    const sourceKey = clean(card?.key || card?.sourceKey);
    if (direct) candidates.add(direct);
    if (sourceKey) {
      candidates.add(sourceKey);
      const parts = sourceKey.split("::");
      if (parts.length >= 3 && /^\d+$/.test(parts.at(-1))) {
        candidates.add(parts.slice(0, -1).join("::"));
      }
    }
    return [...candidates];
  }

  function ownershipForCard(card) {
    const dex = linkedDex();
    if (!dex) return null;
    for (const key of customDexKeyCandidates(card)) {
      if (dex.cardMap.has(key)) return dex.cardMap.get(key);
    }
    return null;
  }

  function binderOwnershipStats() {
    const dex = linkedDex();
    if (!dex) return { linked: false, matched: 0, owned: 0, missing: 0 };
    let matched = 0;
    let owned = 0;
    let missing = 0;
    state.pages.forEach((page) => {
      const placements = page.id === state.currentPageId
        ? state.placements
        : (page.placements || []);
      placements.forEach((entry) => {
        const status = ownershipForCard(entry.card);
        if (status === null) return;
        matched += 1;
        if (status) owned += 1;
        else missing += 1;
      });
    });
    return { linked: true, matched, owned, missing };
  }

  function renderLinkedDexUi(message = "") {
    if (linkedDexSelect) {
      linkedDexSelect.disabled = !state.user || !state.customDexes.size;
      const previous = state.linkedDexId;
      linkedDexSelect.replaceChildren();
      const none = document.createElement("option");
      none.value = "";
      none.textContent = state.customDexes.size ? "연결하지 않음" : "연결할 나만의 도감 없음";
      linkedDexSelect.append(none);
      state.customDexes.forEach((dex) => {
        const option = document.createElement("option");
        option.value = dex.id;
        option.textContent = `${dex.title} · ${dex.cardCount}장`;
        linkedDexSelect.append(option);
      });
      if (previous && !state.customDexes.has(previous)) {
        const unavailable = document.createElement("option");
        unavailable.value = previous;
        unavailable.textContent = "연결된 도감을 찾을 수 없음";
        linkedDexSelect.append(unavailable);
      }
      linkedDexSelect.value = previous;
    }
    if (!linkedDexStatus) return;
    if (message) {
      linkedDexStatus.textContent = message;
      return;
    }
    if (!state.user) {
      linkedDexStatus.textContent = "로그인 후 나만의 도감과 연결할 수 있습니다.";
      return;
    }
    if (!state.linkedDexId) {
      linkedDexStatus.textContent = state.customDexes.size
        ? "도감을 연결하면 배치 카드의 보유·미보유 상태를 읽어서 표시합니다."
        : "나만의 도감을 먼저 만든 뒤 연결할 수 있습니다.";
      return;
    }
    const dex = linkedDex();
    if (!dex) {
      linkedDexStatus.textContent = "연결된 도감을 찾지 못했습니다. 연결 설정을 다시 선택해 주세요.";
      return;
    }
    const stats = binderOwnershipStats();
    linkedDexStatus.textContent =
      `${dex.title} 연결 · 일치 ${stats.matched}장 · 보유 ${stats.owned}장 · 미보유 ${stats.missing}장`;
  }

  async function loadCustomDexes() {
    state.customDexes = new Map();
    if (!state.user || !state.firebase) {
      renderLinkedDexUi();
      return;
    }
    try {
      const { firestoreModule, db } = state.firebase;
      const reference = firestoreModule.doc(
        db,
        "users",
        state.user.uid,
        CONFIG.userCollection || "collections",
        "pokemonCollectionsDex",
      );
      const snapshot = await firestoreModule.getDoc(reference);
      state.customDexes = normalizeCustomDexes(snapshot.exists() ? snapshot.data()?.customDexes : {});
      renderLinkedDexUi();
    } catch (error) {
      console.error("나만의 도감 연결 정보 불러오기 실패", error);
      state.customDexes = new Map();
      renderLinkedDexUi("나만의 도감 목록을 불러오지 못했습니다.");
    }
  }

  function selectedMissingDisplay() {
    const value = missingDisplayInputs.find((input) => input.checked)?.value;
    return ["color", "grayscale", "dim", "empty"].includes(value)
      ? value
      : "color";
  }

  function applyMissingDisplaySelection(value) {
    const normalized = value === "dim"
      ? "grayscale"
      : ["color", "grayscale", "empty"].includes(value)
        ? value
        : "color";
    state.missingCardDisplay = normalized;
    const input = missingDisplayInputs.find((item) => item.value === normalized)
      || missingDisplayInputs.find((item) => item.value === "color");
    if (input) input.checked = true;
  }

  function publicBinderUrl() {
    const publicId = clean(state.publicProfile?.publicId);
    if (!publicId || !state.currentBinderId) return "";
    const url = new URL("./binder.html", window.location.href);
    url.searchParams.set("collector", publicId);
    url.searchParams.set("binder", state.currentBinderId);
    return url.href;
  }

  function renderShareUi(message = "") {
    if (!shareStatus || !publishButton || !unpublishButton || !shareLinkWrap) return;
    const profileReady = Boolean(
      state.publicProfile?.profileCompleted &&
      /^[a-z0-9]{12}$/.test(clean(state.publicProfile?.publicId)),
    );
    const canPublish = Boolean(
      state.user &&
      profileReady &&
      state.pages.length &&
      !state.publishing &&
      !state.saving,
    );

    publishButton.disabled = !canPublish || state.isPublished;
    publishButton.textContent = state.currentBinderId ? "공개하기" : "저장 후 공개하기";
    publishButton.hidden = state.isPublished;
    unpublishButton.disabled = !canPublish;
    unpublishButton.hidden = !state.isPublished;
    shareLinkWrap.hidden = !state.isPublished;
    if (shareUrlInput) shareUrlInput.value = state.isPublished ? publicBinderUrl() : "";

    if (message) {
      shareStatus.textContent = message;
      return;
    }
    if (!state.user) {
      shareStatus.textContent = "Google 로그인 후 바인더를 공개할 수 있습니다.";
    } else if (!profileReady) {
      shareStatus.innerHTML = "";
      const text = document.createTextNode("컬렉터 프로필을 먼저 완성해 주세요. ");
      const link = document.createElement("a");
      link.href = "./collector-settings.html";
      link.textContent = "프로필 설정";
      shareStatus.append(text, link);
    } else if (!state.currentBinderId) {
      shareStatus.textContent = "공개하기를 누르면 먼저 저장한 뒤 공개 링크를 만듭니다.";
    } else if (state.publishing) {
      shareStatus.textContent = "공개본을 만들고 있습니다…";
    } else if (state.isPublished) {
      shareStatus.textContent = "공개 중 · 저장할 때마다 공개본도 최신 상태로 갱신됩니다.";
    } else {
      shareStatus.textContent = "현재 비공개 · 공개하면 컬렉터 프로필과 공유 링크에서 읽기 전용으로 볼 수 있습니다.";
    }
  }

  async function loadPublicProfile() {
    state.publicProfile = null;
    if (!state.user || !state.firebase) {
      renderShareUi();
      return;
    }
    try {
      const { firestoreModule, db } = state.firebase;
      const snapshot = await firestoreModule.getDoc(
        firestoreModule.doc(db, "users", state.user.uid, "profile", "main"),
      );
      const data = snapshot.exists() ? snapshot.data() || {} : {};
      if (
        data.profileCompleted === true &&
        /^[a-z0-9]{12}$/.test(clean(data.publicId))
      ) {
        state.publicProfile = {
          publicId: clean(data.publicId),
          nickname: clean(data.nickname) || "컬렉터",
          profileCompleted: true,
        };
      }
      renderShareUi();
    } catch (error) {
      console.error("바인더 공개 프로필 확인 실패", error);
      renderShareUi("컬렉터 프로필을 확인하지 못했습니다.");
    }
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
    if (normalize(searchInput.value) && state.catalog) renderSearchResults(searchInput.value);
  }

  function selectAllSlots() {
    const count = selectedGrid().cols * selectedGrid().rows;
    state.selectedSlots = new Set(Array.from({ length: count }, (_, index) => index));
    state.slotSelectMode = true;
    renderSlotLayer();
    updateArtUi();
    if (normalize(searchInput.value) && state.catalog) renderSearchResults(searchInput.value);
  }

  function clearSlotSelection() {
    state.selectedSlots.clear();
    renderSlotLayer();
    updateArtUi();
    if (normalize(searchInput.value) && state.catalog) renderSearchResults(searchInput.value);
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

  function customPrintPlanForGrid(gridValue, mode = selectedCustomPrintMode()) {
    const cols = Math.max(1, Number(gridValue?.cols) || 3);
    const rows = Math.max(1, Number(gridValue?.rows) || 4);
    const slotCount = cols * rows;

    if (mode === "fit") {
      const logicalWidth = cols * CARD_WIDTH_MM;
      const logicalHeight = rows * CARD_HEIGHT_MM;
      const availableWidth = A4_WIDTH_MM - PRINT_MARGIN_MM * 2;
      const availableHeight = A4_HEIGHT_MM - PRINT_MARGIN_MM * 2;
      const scale = Math.min(
        availableWidth / logicalWidth,
        availableHeight / logicalHeight,
      );
      return {
        cols,
        rows,
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
      cols,
      rows,
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

  function customPrintPlan() {
    return customPrintPlanForGrid(selectedGrid(), selectedCustomPrintMode());
  }

  function allCustomPrintPlans() {
    const mode = selectedCustomPrintMode();
    return state.pages.map((page) => ({
      page,
      plan: customPrintPlanForGrid(page.grid, mode),
    }));
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
    const plans = allCustomPrintPlans();
    const current = customPrintPlan();
    const totalSheets = plans.reduce((sum, item) => sum + item.plan.pageCount, 0);
    customPrintSummary.textContent =
      `바인더 ${state.pages.length}페이지 · ${current.label} · A4 총 ${totalSheets}페이지`;

    if (customPrintNote) {
      customPrintNote.textContent = current.mode === "fit"
        ? "각 바인더 페이지를 A4 한 장에 맞춰 순서대로 출력합니다. 페이지별 그리드는 그대로 유지됩니다."
        : `각 칸은 ${current.cellWidth} × ${current.cellHeight} mm 고정 · 페이지별로 자동 분할하며 칸이 잘리지 않습니다.`;
    }

    customPrintButton.disabled = !state.pages.length;
    customPrintButton.textContent = supportsNativePrint()
      ? "전체 바인더 인쇄 · PDF로 저장"
      : isAndroidAppShell()
        ? "인쇄 · 앱 업데이트 필요"
        : "전체 바인더 인쇄 · PDF 저장";
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
    updatePhotoImportUi();
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

  function importedPhotoSource() {
    const imageSlots = state.slots.filter((slot) => slot.type === "image");
    if (!imageSlots.length) return null;
    const imageId = clean(imageSlots[0]?.imageId);
    if (!imageId || !imageId.startsWith("photo_")) return null;
    if (!imageSlots.every((slot) => clean(slot.imageId) === imageId)) return null;
    return imageSourceById(imageId);
  }

  function updatePhotoImportUi(message = "") {
    if (photoGridLabel) {
      const { cols, rows } = selectedGrid();
      photoGridLabel.textContent = `${cols} × ${rows}`;
    }
    const source = importedPhotoSource();
    if (photoRecognizeButton) {
      photoRecognizeButton.disabled = !source || state.photoRecognizing;
      photoRecognizeButton.textContent = state.photoRecognizing
        ? "카드 인식 중…"
        : "카드 자동인식";
    }
    if (!photoStatus) return;
    if (message) {
      photoStatus.textContent = message;
      return;
    }
    const { cols, rows } = selectedGrid();
    photoStatus.textContent = source
      ? `현재 사진을 ${cols} × ${rows} 슬롯로 가져왔습니다. 카드 자동인식을 실행하거나 그대로 저장할 수 있습니다.`
      : `현재 ${cols} × ${rows} 그리드로 사진을 나눠 가져옵니다. 현재 페이지의 슬롯 내용은 사진으로 교체됩니다.`;
  }

  function clearPhotoRecognitionResults() {
    state.photoReview = new Map();
    if (!photoRecognitionResults) return;
    photoRecognitionResults.replaceChildren();
    photoRecognitionResults.hidden = true;
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("이미지 변환에 실패했습니다.")),
        type,
        quality,
      );
    });
  }

  async function normalizeBinderPhoto(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      throw new Error("이미지 파일을 선택해 주세요.");
    }

    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("사진을 읽지 못했습니다. 기기에서 열 수 있는 JPG, PNG 또는 WEBP 사진으로 다시 시도해 주세요."));
        image.src = sourceUrl;
      });

      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      if (!sourceWidth || !sourceHeight) {
        throw new Error("사진 크기를 확인하지 못했습니다.");
      }

      // Camera originals may be very large. Accept the original as-is, then
      // downscale/encode locally before it is ever stored in Firestore.
      const maxDimension = 4200;
      const initialScale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
      let width = Math.max(1, Math.round(sourceWidth * initialScale));
      let height = Math.max(1, Math.round(sourceHeight * initialScale));
      let canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      let context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("사진 변환 기능을 사용할 수 없습니다.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);

      const targetBytes = 8.5 * 1024 * 1024;
      let quality = 0.9;
      let blob = null;
      let outputType = "image/webp";

      for (let attempt = 0; attempt < 7; attempt += 1) {
        try {
          blob = await canvasBlob(canvas, outputType, quality);
        } catch {
          outputType = "image/jpeg";
          blob = await canvasBlob(canvas, outputType, quality);
        }

        if (blob.size <= targetBytes) break;

        const scale = blob.size > targetBytes * 1.8 ? 0.76 : 0.84;
        width = Math.max(1, Math.round(canvas.width * scale));
        height = Math.max(1, Math.round(canvas.height * scale));

        const reduced = document.createElement("canvas");
        reduced.width = width;
        reduced.height = height;
        const reducedContext = reduced.getContext("2d", { alpha: false });
        if (!reducedContext) throw new Error("사진 용량을 자동으로 줄이지 못했습니다.");
        reducedContext.fillStyle = "#ffffff";
        reducedContext.fillRect(0, 0, width, height);
        reducedContext.imageSmoothingEnabled = true;
        reducedContext.imageSmoothingQuality = "high";
        reducedContext.drawImage(canvas, 0, 0, width, height);
        canvas = reduced;
        context = reducedContext;
        quality = Math.max(0.72, quality - 0.04);
      }

      if (!blob) throw new Error("사진을 저장용 이미지로 변환하지 못했습니다.");

      // Extremely unusual originals are allowed too; keep shrinking until the
      // saved copy is safe to chunk, instead of rejecting based on source MB.
      while (blob.size > targetBytes && Math.max(canvas.width, canvas.height) > 1600) {
        width = Math.max(1, Math.round(canvas.width * 0.82));
        height = Math.max(1, Math.round(canvas.height * 0.82));
        const reduced = document.createElement("canvas");
        reduced.width = width;
        reduced.height = height;
        const reducedContext = reduced.getContext("2d", { alpha: false });
        if (!reducedContext) throw new Error("사진 용량을 자동으로 줄이지 못했습니다.");
        reducedContext.fillStyle = "#ffffff";
        reducedContext.fillRect(0, 0, width, height);
        reducedContext.imageSmoothingEnabled = true;
        reducedContext.imageSmoothingQuality = "high";
        reducedContext.drawImage(canvas, 0, 0, width, height);
        canvas = reduced;
        try {
          blob = await canvasBlob(canvas, outputType, 0.72);
        } catch {
          outputType = "image/jpeg";
          blob = await canvasBlob(canvas, outputType, 0.72);
        }
      }

      return {
        blob,
        width: canvas.width,
        height: canvas.height,
        name: `${clean(file.name).replace(/\.[^.]+$/, "") || "binder-photo"}.${outputType === "image/webp" ? "webp" : "jpg"}`,
        originalSize: Number(file.size) || 0,
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  function currentPageHasSlotContent() {
    return Boolean(
      state.placements.length ||
      state.slots.some((slot) => slot.type !== "empty"),
    );
  }

  async function importBinderPhoto(file) {
    if (!file) return;
    const { cols, rows } = selectedGrid();
    if (
      currentPageHasSlotContent() &&
      !window.confirm("현재 페이지의 카드·슬롯 이미지를 사진으로 교체할까요? 저장 전이라면 기존 배치는 사라집니다.")
    ) {
      if (photoCameraInput) photoCameraInput.value = "";
      if (photoAlbumInput) photoAlbumInput.value = "";
      return;
    }

    updatePhotoImportUi("사진을 가져오는 중입니다…");
    try {
      const prepared = await normalizeBinderPhoto(file);
      state.images.forEach((image) => {
        if (image.chunkSet) state.orphanChunkSets.add(image.chunkSet);
        if (image.objectUrl) URL.revokeObjectURL(image.objectUrl);
      });

      state.placements = [];
      state.selectedId = "";
      state.nextZ = 1;
      clearPhotoRecognitionResults();
      state.selectedSlots.clear();
      state.slotSelectMode = false;

      const source = {
        id: makeId("photo"),
        name: prepared.name.slice(0, 180),
        type: prepared.blob.type || "image/webp",
        size: prepared.blob.size,
        width: prepared.width,
        height: prepared.height,
        chunkCount: 0,
        chunkSet: "",
        blob: prepared.blob,
        objectUrl: URL.createObjectURL(prepared.blob),
        dirty: true,
      };
      state.images = [source];

      const count = cols * rows;
      state.slots = Array.from({ length: count }, (_, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
          index,
          type: "image",
          imageId: source.id,
          crop: {
            x: Number((col / cols).toFixed(6)),
            y: Number((row / rows).toFixed(6)),
            width: Number((1 / cols).toFixed(6)),
            height: Number((1 / rows).toFixed(6)),
          },
        };
      });

      previewEmpty.hidden = true;
      previewWrap.hidden = false;
      renderSlotLayer();
      renderPlacements();
      captureCurrentPage();
      renderPageControls();
      updateSaveUi();
      updateCustomPrintUi();

      const expected = (cols * CARD_WIDTH_MM) / (rows * CARD_HEIGHT_MM);
      const actual = prepared.width / prepared.height;
      const gap = Math.abs(actual - expected) / expected;
      const originalMb = prepared.originalSize
        ? ` · 원본 ${(prepared.originalSize / 1024 / 1024).toFixed(1)}MB 자동 최적화`
        : "";
      const sizeText =
        `${prepared.width.toLocaleString("ko-KR")} × ${prepared.height.toLocaleString("ko-KR")}px${originalMb}`;
      if (gap > 0.16) {
        updatePhotoImportUi(
          `${cols} × ${rows}로 가져왔습니다 · ${sizeText}. 사진 비율이 그리드와 다르므로 2번 그리드가 실제 바인더와 같은지 확인해 주세요.`,
        );
      } else {
        updatePhotoImportUi(
          `${cols} × ${rows} · ${count}칸으로 가져왔습니다 · ${sizeText}. 필요한 칸만 카드로 교체하거나 그대로 저장할 수 있습니다.`,
        );
      }
    } catch (error) {
      console.error("바인더 사진 가져오기 실패", error);
      updatePhotoImportUi(clean(error?.message) || "사진을 가져오지 못했습니다. 다른 사진으로 다시 시도해 주세요.");
    } finally {
      if (photoCameraInput) photoCameraInput.value = "";
      if (photoAlbumInput) photoAlbumInput.value = "";
    }
  }

  function replaceSlotWithCard(card, slotIndex, { render = true, select = true } = {}) {
    if (!card || slotIndex < 0 || slotIndex >= state.slots.length) return null;
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
        customDexKey: clean(card.customDexKey),
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
    if (select) state.selectedId = entry.id;
    if (render) {
      state.selectedSlots.clear();
      state.slotSelectMode = false;
      pruneUnusedImages();
      renderSlotLayer();
      renderPlacements();
      captureCurrentPage();
      updateArtUi("선택한 슬롯을 실제 카드로 교체했습니다.");
      updatePhotoImportUi();
    }
    return entry;
  }

  function recognitionCandidateButton(slotIndex, match) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "studio-photo-candidate";
    const image = document.createElement("img");
    image.src = match.card.image;
    image.alt = "";
    image.loading = "lazy";
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = match.card.name;
    const meta = document.createElement("small");
    meta.textContent = [
      match.card.setCode,
      match.card.cardNumber,
      `차이 ${match.distance.toFixed(1)}`,
    ].filter(Boolean).join(" · ");
    copy.append(name, meta);
    button.append(image, copy);
    button.addEventListener("click", () => {
      replaceSlotWithCard(match.card, slotIndex);
      state.photoReview.delete(slotIndex);
      renderPhotoRecognitionReview();
      updatePhotoImportUi(`${slotIndex + 1}번 슬롯을 ${match.card.name} 카드로 교체했습니다.`);
    });
    return button;
  }

  function renderPhotoRecognitionReview(summary = "") {
    if (!photoRecognitionResults) return;
    const rows = [...state.photoReview.entries()].map(([slotIndex, matches]) => {
      const row = document.createElement("article");
      row.className = "studio-photo-review-row";
      const heading = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `${slotIndex + 1}번 슬롯 · 후보 확인`;
      const keep = document.createElement("small");
      keep.textContent = "맞는 카드가 없으면 사진을 그대로 두세요.";
      heading.append(title, keep);
      const candidates = document.createElement("div");
      candidates.className = "studio-photo-candidates";
      matches.slice(0, 3).forEach((match) => {
        candidates.append(recognitionCandidateButton(slotIndex, match));
      });
      row.append(heading, candidates);
      return row;
    });
    photoRecognitionResults.replaceChildren();
    if (summary) {
      const summaryNode = document.createElement("p");
      summaryNode.className = "studio-photo-recognition-summary";
      summaryNode.textContent = summary;
      photoRecognitionResults.append(summaryNode);
    }
    photoRecognitionResults.append(...rows);
    photoRecognitionResults.hidden = !summary && !rows.length;
  }

  async function imageFromObjectUrl(url) {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("가져온 바인더 사진을 다시 읽지 못했습니다."));
      image.src = url;
    });
    return image;
  }

  async function recognizeImportedPhotoCards() {
    if (state.photoRecognizing) return;
    const source = importedPhotoSource();
    if (!source?.objectUrl) {
      updatePhotoImportUi("먼저 바인더 사진을 촬영하거나 앨범에서 선택해 주세요.");
      return;
    }
    const matcher = root.visualMatcher;
    if (!matcher?.rankImageCrop || !matcher?.confident) {
      updatePhotoImportUi("카드 자동인식 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      return;
    }

    state.photoRecognizing = true;
    clearPhotoRecognitionResults();
    updatePhotoImportUi("우리 도감과 비교할 카드 목록을 준비하는 중입니다…");

    try {
      await ensureCatalog();
      const image = await imageFromObjectUrl(source.objectUrl);
      const targets = state.slots
        .filter((slot) => slot.type === "image" && clean(slot.imageId) === source.id)
        .map((slot) => ({ index: slot.index, crop: { ...slot.crop } }));
      let automatic = 0;
      let noMatch = 0;
      const review = new Map();

      for (let position = 0; position < targets.length; position += 1) {
        const target = targets[position];
        updatePhotoImportUi(
          `카드 자동인식 중 · ${position + 1} / ${targets.length}칸`,
        );
        const matches = await matcher.rankImageCrop(
          image,
          target.crop,
          state.catalog,
          3,
        );
        const accepted = matcher.confident(matches);
        if (accepted) {
          replaceSlotWithCard(accepted.card, target.index, { render: false, select: false });
          automatic += 1;
        } else if (matches.length && matches[0].distance <= 19) {
          review.set(target.index, matches);
        } else {
          noMatch += 1;
        }
        if (position % 2 === 1) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }

      state.photoReview = review;
      state.selectedId = "";
      pruneUnusedImages();
      renderSlotLayer();
      renderPlacements();
      captureCurrentPage();
      updateCustomPrintUi();

      const summary =
        `자동 인식 ${automatic}칸 · 후보 확인 ${review.size}칸 · 사진 유지 ${noMatch}칸`;
      renderPhotoRecognitionReview(summary);
      updatePhotoImportUi(
        review.size
          ? `${summary}. 아래 후보에서 맞는 카드만 선택하세요.`
          : `${summary}. 확실한 카드만 자동으로 교체했습니다.`,
      );
    } catch (error) {
      console.error("바인더 사진 카드 자동인식 실패", error);
      updatePhotoImportUi(
        clean(error?.message) || "카드 자동인식에 실패했습니다. 사진 상태로 그대로 저장할 수 있습니다.",
      );
    } finally {
      state.photoRecognizing = false;
      updatePhotoImportUi(photoStatus?.textContent || "");
    }
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
    if (selected.length > 1) return -1;
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
          const rawCustomCode = clean(card.code || card.meta || cardIndex);
          const customDexKey = `${clean(group.code || group.title || groupIndex)}::${rawCustomCode}`;
          cards.push({
            key,
            rawCode: rawCustomCode,
            customDexKey,
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
    const ownership = ownershipForCard(card);
    if (ownership !== null) {
      row.classList.add(ownership ? "is-owned" : "is-missing");
    }

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
    if (ownership !== null) {
      const ownershipLabel = document.createElement("small");
      ownershipLabel.className = `studio-custom-result-ownership ${ownership ? "is-owned" : "is-missing"}`;
      ownershipLabel.textContent = ownership ? "연결 도감 · 보유" : "연결 도감 · 미보유";
      copy.append(ownershipLabel);
    }

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
    } else if (selected.length > 1) {
      searchStatus.textContent = `${matches.length}장 찾음 · 카드 교체는 슬롯 한 칸만 선택해 주세요.`;
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

    const ownership = ownershipForCard(entry.card);
    node.dataset.ownership = ownership === null ? "unlinked" : ownership ? "owned" : "missing";
    node.classList.toggle("is-owned", ownership === true);
    node.classList.toggle("is-missing", ownership === false);
    if (ownership === false) {
      node.classList.add(`is-missing-${state.missingCardDisplay}`);
    }

    const image = document.createElement("img");
    image.src = entry.card.image;
    image.alt = `${entry.card.name} 카드`;
    image.draggable = false;
    node.append(image);

    if (ownership !== null) {
      const badge = document.createElement("span");
      badge.className = `studio-custom-ownership-badge ${ownership ? "is-owned" : "is-missing"}`;
      badge.textContent = ownership ? "보유" : "미보유";
      node.append(badge);
    }

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
    renderLinkedDexUi();
    renderSearchResults(searchInput.value);
  }

  function addCard(card) {
    const slotIndex = availableCardTargetIndex();
    if (slotIndex < 0) {
      window.alert("빈 슬롯이 없습니다. 교체할 슬롯 하나를 먼저 선택해 주세요.");
      return;
    }
    replaceSlotWithCard(card, slotIndex);
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
        customDexKey: clean(entry.card.customDexKey),
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

  function pageImageSourceById(page, imageId) {
    return (page.images || []).find((image) => image.id === imageId) || null;
  }

  function applyMissingPrintStyle(image, ownership) {
    if (ownership !== false) return true;
    if (state.missingCardDisplay === "empty") return false;
    if (state.missingCardDisplay === "grayscale") {
      image.style.filter = "grayscale(1)";
    } else if (state.missingCardDisplay === "dim") {
      image.style.opacity = "0.35";
    }
    return true;
  }

  function createCustomPrintComposition(page, plan) {
    const grid = {
      cols: Math.max(1, Number(page.grid?.cols) || 3),
      rows: Math.max(1, Number(page.grid?.rows) || 4),
    };
    const canvasWidth = grid.cols * plan.cellWidth;
    const canvasHeight = grid.rows * plan.cellHeight;
    const composition = document.createElement("div");
    composition.className = "studio-custom-print-composition";
    composition.style.width = `${canvasWidth}mm`;
    composition.style.height = `${canvasHeight}mm`;

    if (page.objectUrl) {
      const background = document.createElement("img");
      background.className = "studio-custom-print-background";
      background.src = page.objectUrl;
      background.alt = "";
      composition.append(background);
    }

    (page.slots || [])
      .filter((slot) => slot.type === "image")
      .forEach((slot) => {
        const source = pageImageSourceById(page, slot.imageId);
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
        tile.dataset.imageUrl = source.objectUrl;
        applyCropStyle(tile, source, slot.crop);
        composition.append(tile);
      });

    (page.placements || [])
      .slice()
      .sort((a, b) => a.z - b.z)
      .forEach((entry) => {
        const ownership = ownershipForCard(entry.card);
        const image = document.createElement("img");
        image.className = "studio-custom-print-card-image";
        image.dataset.ownership = ownership === null ? "unlinked" : ownership ? "owned" : "missing";
        if (!applyMissingPrintStyle(image, ownership)) return;
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

  function createCustomPrintCell(page, index, plan) {
    const cols = Math.max(1, Number(page.grid?.cols) || 3);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cell = document.createElement("article");
    cell.className = "studio-custom-print-cell";
    cell.dataset.customPrintSlot = String(index + 1);
    cell.style.width = `${plan.cellWidth}mm`;
    cell.style.height = `${plan.cellHeight}mm`;
    cell.style.pageBreakInside = "avoid";
    cell.style.breakInside = "avoid";

    const composition = createCustomPrintComposition(page, plan);
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

  async function prepareAllPagesForPrint() {
    captureCurrentPage();
    for (const page of state.pages) {
      await hydratePageBackground(page);
      await hydratePageImages(page);
    }
  }

  function buildCustomPrintSheets() {
    if (!printRoot) return null;
    const plans = allCustomPrintPlans();
    installCustomPrintPageStyle();
    printRoot.replaceChildren();
    let sheetCount = 0;

    plans.forEach(({ page, plan }, binderPageIndex) => {
      if (plan.mode === "fit") {
        const sheet = document.createElement("section");
        sheet.className = "studio-print-sheet studio-custom-print-sheet studio-custom-print-sheet--fit";
        sheet.dataset.binderPage = String(binderPageIndex + 1);
        sheet.dataset.customPrintPage = String(++sheetCount);
        sheet.style.gridTemplateColumns = `repeat(${plan.cols}, ${plan.cellWidth}mm)`;
        sheet.style.gridTemplateRows = `repeat(${plan.rows}, ${plan.cellHeight}mm)`;
        for (let index = 0; index < plan.slotCount; index += 1) {
          sheet.append(createCustomPrintCell(page, index, plan));
        }
        printRoot.append(sheet);
        return;
      }

      for (let start = 0; start < plan.slotCount; start += plan.perPage) {
        const sheet = document.createElement("section");
        sheet.className = "studio-print-sheet studio-print-sheet--exact studio-custom-print-sheet";
        sheet.dataset.binderPage = String(binderPageIndex + 1);
        sheet.dataset.binderPagePart = String(Math.floor(start / plan.perPage) + 1);
        sheet.dataset.customPrintPage = String(++sheetCount);
        sheet.style.gridTemplateColumns = `repeat(${plan.pageCols}, ${plan.cellWidth}mm)`;
        sheet.style.gridTemplateRows = `repeat(${plan.pageRows}, ${plan.cellHeight}mm)`;
        sheet.style.pageBreakInside = "avoid";
        sheet.style.breakInside = "avoid-page";
        const end = Math.min(plan.slotCount, start + plan.perPage);
        for (let index = start; index < end; index += 1) {
          sheet.append(createCustomPrintCell(page, index, plan));
        }
        addCustomPrintCalibration(sheet);
        printRoot.append(sheet);
      }
    });

    return {
      mode: selectedCustomPrintMode(),
      label: plans[0]?.plan.label || "출력",
      pageCount: sheetCount,
      binderPageCount: state.pages.length,
    };
  }

  async function waitForCustomPrintImages() {
    const images = [...printRoot.querySelectorAll("img")];
    const tileUrls = [...new Set(
      [...printRoot.querySelectorAll(".studio-custom-print-image-tile[data-image-url]")]
        .map((tile) => tile.dataset?.imageUrl)
        .filter(Boolean),
    )];
    const tilePreloads = tileUrls.map((url) => {
      const image = new Image();
      return new Promise((resolve) => {
        image.onload = () => resolve({ ok: true, image });
        image.onerror = () => resolve({ ok: false, image });
        image.src = url;
      });
    });
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
    let tileResults = [];
    try {
      const result = await Promise.race([
        Promise.all([
          Promise.all(tasks),
          Promise.all(tilePreloads),
        ]),
        new Promise((resolve) => {
          timer = window.setTimeout(() => resolve([null, []]), 60000);
        }),
      ]);
      tileResults = Array.isArray(result?.[1]) ? result[1] : [];
    } finally { window.clearTimeout(timer); }
    if (
      images.some((image) => !image.complete || image.naturalWidth === 0) ||
      tileResults.length !== tileUrls.length ||
      tileResults.some((result) => !result.ok || result.image.naturalWidth === 0)
    ) {
      throw new Error("일부 카드 이미지를 준비하지 못했습니다. 카드 또는 확장 이미지를 확인한 뒤 다시 인쇄해 주세요.");
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

    const originalTitle = document.title;
    const title = clean(titleInput.value) || "커스텀바인더";
    customPrintButton.disabled = true;
    customPrintButton.textContent = "전체 페이지 준비 중…";

    try {
      await prepareAllPagesForPrint();
      const plan = buildCustomPrintSheets();
      if (!plan) return;
      const printTitle = `바인더스튜디오_${title}_${plan.binderPageCount}pages_${plan.mode}`;
      document.title = printTitle;
      customPrintButton.textContent = "인쇄 준비 중…";
      await waitForCustomPrintImages();
      if (supportsNativePrint()) {
        window.DigitalCardBinderApp.startPrint(printTitle, false);
      } else {
        window.print();
      }
    } catch (error) {
      window.alert(error.message || "바인더 이미지를 준비하지 못했습니다. 다시 인쇄해 주세요.");
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

  function publicBinderRef(publicId = state.publicProfile?.publicId, binderId = state.currentBinderId) {
    if (!state.firebase || !publicId || !binderId) return null;
    return state.firebase.firestoreModule.doc(
      state.firebase.db,
      "publicProfiles",
      clean(publicId),
      "binders",
      clean(binderId),
    );
  }

  function publicBinderPageRef(publicId, binderId, pageId) {
    const reference = publicBinderRef(publicId, binderId);
    if (!reference || !pageId) return null;
    return state.firebase.firestoreModule.doc(reference, "pages", pageId);
  }

  function publicBinderChunkRef(publicId, binderId, chunkId) {
    const reference = publicBinderRef(publicId, binderId);
    if (!reference || !chunkId) return null;
    return state.firebase.firestoreModule.doc(reference, "chunks", chunkId);
  }

  async function refreshPublishState() {
    state.isPublished = false;
    if (
      !state.user ||
      !state.firebase ||
      !state.currentBinderId ||
      !state.publicProfile?.publicId
    ) {
      renderShareUi();
      return;
    }
    try {
      const snapshot = await state.firebase.firestoreModule.getDoc(publicBinderRef());
      state.isPublished = snapshot.exists();
      renderShareUi();
    } catch (error) {
      console.error("바인더 공개 상태 확인 실패", error);
      renderShareUi("공개 상태를 확인하지 못했습니다.");
    }
  }

  function imageForCanvas(url, cache) {
    const key = clean(url);
    if (!key) return Promise.reject(new Error("이미지 주소가 비어 있습니다."));
    if (cache.has(key)) return cache.get(key);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      try {
        const parsed = new URL(key, window.location.href);
        if (parsed.protocol.startsWith("http") && parsed.origin !== window.location.origin) {
          image.crossOrigin = "anonymous";
        }
      } catch {
        // blob/data URLs need no cross-origin mode.
      }
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("공개본에 필요한 이미지를 불러오지 못했습니다."));
      image.src = key;
    });
    cache.set(key, promise);
    return promise;
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("공개 바인더 이미지를 만들지 못했습니다."));
              return;
            }
            resolve(blob);
          },
          "image/webp",
          0.88,
        );
      } catch (error) {
        reject(
          new Error(
            error?.name === "SecurityError"
              ? "공개본을 만들 수 없는 외부 이미지가 포함되어 있습니다."
              : "공개 바인더 이미지를 만들지 못했습니다.",
          ),
        );
      }
    });
  }

  async function renderPublicPageSnapshot(page) {
    await hydratePageBackground(page);
    await hydratePageImages(page);

    const cols = Math.max(1, Number(page.grid?.cols) || 3);
    const rows = Math.max(1, Number(page.grid?.rows) || 4);
    const width = Math.round(cols * CARD_WIDTH_MM * PUBLIC_PREVIEW_PX_PER_MM);
    const height = Math.round(rows * CARD_HEIGHT_MM * PUBLIC_PREVIEW_PX_PER_MM);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("공개 바인더 렌더링을 시작하지 못했습니다.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    const imageCache = new Map();
    if (page.objectUrl) {
      const background = await imageForCanvas(page.objectUrl, imageCache);
      context.drawImage(background, 0, 0, width, height);
    }

    for (const slot of page.slots || []) {
      if (slot.type !== "image") continue;
      const source = (page.images || []).find((image) => image.id === slot.imageId);
      if (!source?.objectUrl) continue;
      const image = await imageForCanvas(source.objectUrl, imageCache);
      const crop = slot.crop || {};
      const cropX = Math.max(0, Math.min(1, Number(crop.x) || 0));
      const cropY = Math.max(0, Math.min(1, Number(crop.y) || 0));
      const cropWidth = Math.max(0.0001, Math.min(1 - cropX, Number(crop.width) || 1));
      const cropHeight = Math.max(0.0001, Math.min(1 - cropY, Number(crop.height) || 1));
      const col = Number(slot.index) % cols;
      const row = Math.floor(Number(slot.index) / cols);
      context.drawImage(
        image,
        cropX * image.naturalWidth,
        cropY * image.naturalHeight,
        cropWidth * image.naturalWidth,
        cropHeight * image.naturalHeight,
        (col / cols) * width,
        (row / rows) * height,
        width / cols,
        height / rows,
      );
    }

    const placements = (page.placements || []).slice().sort((a, b) => a.z - b.z);
    for (const entry of placements) {
      const ownership = ownershipForCard(entry.card);
      if (ownership === false && state.missingCardDisplay === "empty") continue;
      const image = await imageForCanvas(entry.card.image, imageCache);
      const drawWidth = (Number(entry.width) / 100) * width;
      const drawHeight = drawWidth * (CARD_HEIGHT_MM / CARD_WIDTH_MM);
      const left = (Number(entry.x) / 100) * width;
      const top = (Number(entry.y) / 100) * height;
      const rotation = (Number(entry.rotation) || 0) * Math.PI / 180;

      context.save();
      context.translate(left + drawWidth / 2, top + drawHeight / 2);
      context.rotate(rotation);
      context.filter =
        ownership === false && state.missingCardDisplay === "grayscale"
          ? "grayscale(1)"
          : "none";
      context.drawImage(
        image,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight,
      );
      context.filter = "none";

      if (ownership !== null) {
        const label = ownership ? "보유" : "미보유";
        const fontSize = Math.max(11, Math.round(drawWidth * 0.075));
        context.font = `700 ${fontSize}px sans-serif`;
        const paddingX = Math.max(5, Math.round(fontSize * 0.5));
        const paddingY = Math.max(3, Math.round(fontSize * 0.32));
        const metrics = context.measureText(label);
        const badgeWidth = metrics.width + paddingX * 2;
        const badgeHeight = fontSize + paddingY * 2;
        const badgeX = drawWidth / 2 - badgeWidth - 5;
        const badgeY = -drawHeight / 2 + 5;
        context.fillStyle = ownership
          ? "rgba(21,111,103,.88)"
          : "rgba(82,91,103,.86)";
        context.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
        context.fillStyle = "#ffffff";
        context.textBaseline = "top";
        context.fillText(label, badgeX + paddingX, badgeY + paddingY);
      }
      context.restore();
    }

    const blob = await canvasBlob(canvas);
    if (blob.size > CHUNK_BYTES * 24) {
      throw new Error(
        `${page.title || "페이지"} 공개 이미지 용량이 너무 큽니다. 배경 이미지를 줄인 뒤 다시 시도해 주세요.`,
      );
    }
    return {
      blob,
      width,
      height,
    };
  }

  async function writePublicBlobChunks(reference, blob, chunkSet, publicId, binderId) {
    const { firestoreModule, db } = state.firebase;
    const raw = new Uint8Array(await blob.arrayBuffer());
    const chunkCount = Math.ceil(raw.length / CHUNK_BYTES);
    if (!chunkCount || chunkCount > 24) {
      throw new Error("공개 페이지 이미지 용량이 저장 한도를 초과했습니다.");
    }

    for (let start = 0; start < chunkCount; start += 4) {
      const batch = firestoreModule.writeBatch(db);
      const end = Math.min(chunkCount, start + 4);
      for (let index = start; index < end; index += 1) {
        const from = index * CHUNK_BYTES;
        const to = Math.min(raw.length, from + CHUNK_BYTES);
        const bytes = raw.slice(from, to);
        const chunkId = `${chunkSet}_${String(index).padStart(3, "0")}`;
        batch.set(publicBinderChunkRef(publicId, binderId, chunkId), {
          schemaVersion: 1,
          publicId,
          binderId,
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

  function publicDirectoryRef(publicId = state.publicProfile?.publicId) {
    if (!state.firebase || !publicId) return null;
    return state.firebase.firestoreModule.doc(
      state.firebase.db,
      "publicCollectorDirectory",
      clean(publicId),
    );
  }

  async function reconcilePublicDirectory() {
    if (!state.firebase || !state.publicProfile?.publicId) return;
    const { firestoreModule } = state.firebase;
    const publicId = state.publicProfile.publicId;
    const profileReference = firestoreModule.doc(
      state.firebase.db,
      "publicProfiles",
      publicId,
    );
    const [collections, binders] = await Promise.all([
      firestoreModule.getDocs(firestoreModule.collection(profileReference, "collections")),
      firestoreModule.getDocs(firestoreModule.collection(profileReference, "binders")),
    ]);
    const directoryReference = publicDirectoryRef(publicId);
    if (!directoryReference) return;
    if (collections.empty && binders.empty) {
      await firestoreModule.deleteDoc(directoryReference).catch((error) => {
        if (String(error?.code || "").includes("not-found")) return;
        throw error;
      });
      return;
    }
    await firestoreModule.setDoc(directoryReference, {
      publicId,
      updatedAt: firestoreModule.serverTimestamp(),
    });
  }

  async function removePublicBinderProjection({ confirmUser = false } = {}) {
    if (
      !state.firebase ||
      !state.publicProfile?.publicId ||
      !state.currentBinderId
    ) return false;
    if (
      confirmUser &&
      !window.confirm("이 바인더의 공개를 중단할까요? 공유 링크와 컬렉터 프로필에서도 사라집니다.")
    ) return false;

    const { firestoreModule, db } = state.firebase;
    const reference = publicBinderRef();
    const [pages, chunks] = await Promise.all([
      firestoreModule.getDocs(firestoreModule.collection(reference, "pages")),
      firestoreModule.getDocs(firestoreModule.collection(reference, "chunks")),
    ]);
    const documents = [...pages.docs, ...chunks.docs];
    for (let start = 0; start < documents.length; start += 300) {
      const batch = firestoreModule.writeBatch(db);
      documents.slice(start, start + 300).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
    await firestoreModule.deleteDoc(reference);
    await reconcilePublicDirectory();
    state.isPublished = false;
    renderShareUi("공개를 중단했습니다. 기존 공유 링크에서는 더 이상 열 수 없습니다.");
    return true;
  }

  async function publishCurrentBinder(options = {}) {
    if (state.publishing) return false;
    if (!state.user || !state.firebase) {
      renderShareUi("Google 로그인 후 공개할 수 있습니다.");
      return false;
    }
    if (!state.publicProfile?.profileCompleted || !state.publicProfile?.publicId) {
      renderShareUi("컬렉터 프로필을 먼저 완성해 주세요.");
      return false;
    }

    if (!options.skipSave) {
      await saveCurrentBinder({ skipPublicSync: true });
    }
    if (!state.currentBinderId) {
      renderShareUi("바인더를 먼저 저장해 주세요.");
      return false;
    }

    state.publishing = true;
    renderShareUi();
    const { firestoreModule, db } = state.firebase;
    const publicId = state.publicProfile.publicId;
    const binderId = state.currentBinderId;
    const reference = publicBinderRef(publicId, binderId);

    try {
      captureCurrentPage();
      await prepareAllPagesForPrint();

      const existing = await firestoreModule.getDoc(reference);
      const [oldPages, oldChunks] = await Promise.all([
        firestoreModule.getDocs(firestoreModule.collection(reference, "pages")),
        firestoreModule.getDocs(firestoreModule.collection(reference, "chunks")),
      ]);
      const oldPageIds = new Set(oldPages.docs.map((item) => item.id));
      const newChunkSets = new Set();
      const publicPages = [];

      for (let index = 0; index < state.pages.length; index += 1) {
        const page = state.pages[index];
        renderShareUi(`공개본 생성 중 · ${index + 1} / ${state.pages.length}페이지`);
        const snapshot = await renderPublicPageSnapshot(page);
        const chunkSet = makeId("publicpage");
        const chunkCount = await writePublicBlobChunks(
          reference,
          snapshot.blob,
          chunkSet,
          publicId,
          binderId,
        );
        newChunkSets.add(chunkSet);
        publicPages.push({
          page,
          preview: {
            type: snapshot.blob.type || "image/webp",
            size: snapshot.blob.size,
            width: snapshot.width,
            height: snapshot.height,
            chunkSet,
            chunkCount,
          },
        });
      }

      const batch = firestoreModule.writeBatch(db);
      const now = firestoreModule.serverTimestamp();
      publicPages.forEach(({ page, preview }, index) => {
        oldPageIds.delete(page.id);
        batch.set(publicBinderPageRef(publicId, binderId, page.id), {
          schemaVersion: 1,
          publicId,
          binderId,
          pageId: page.id,
          title: clean(page.title) || pageTitle(index),
          grid: {
            cols: Math.max(1, Number(page.grid?.cols) || 3),
            rows: Math.max(1, Number(page.grid?.rows) || 4),
          },
          preview,
          updatedAt: now,
        });
      });
      oldPageIds.forEach((pageId) => {
        batch.delete(publicBinderPageRef(publicId, binderId, pageId));
      });

      const stats = binderOwnershipStats();
      const cardCount = state.pages.reduce(
        (sum, page) => sum + (page.placements || []).length,
        0,
      );
      batch.set(reference, {
        schemaVersion: 1,
        publicId,
        binderId,
        title: clean(titleInput.value) || "커스텀 바인더",
        pageOrder: state.pages.map((page) => page.id),
        summary: {
          pageCount: state.pages.length,
          cardCount,
          matchedCount: stats.matched,
          ownedCount: stats.owned,
          missingCount: stats.missing,
        },
        settings: {
          missingCardDisplay: state.missingCardDisplay,
        },
        publishedAt: existing.exists()
          ? existing.data().publishedAt
          : now,
        updatedAt: now,
      });
      batch.set(publicDirectoryRef(publicId), {
        publicId,
        updatedAt: now,
      });
      await batch.commit();

      const staleChunks = oldChunks.docs.filter(
        (item) => !newChunkSets.has(clean(item.data()?.chunkSet)),
      );
      for (let start = 0; start < staleChunks.length; start += 300) {
        const cleanup = firestoreModule.writeBatch(db);
        staleChunks.slice(start, start + 300).forEach((item) => cleanup.delete(item.ref));
        await cleanup.commit();
      }

      state.isPublished = true;
      renderShareUi(
        options.silent
          ? "공개본도 최신 상태로 갱신했습니다."
          : "공개 완료 · 컬렉터 프로필과 아래 링크에서 읽기 전용으로 볼 수 있습니다.",
      );
      return true;
    } catch (error) {
      console.error("커스텀 바인더 공개 실패", error);
      renderShareUi(clean(error?.message) || "바인더를 공개하지 못했습니다.");
      return false;
    } finally {
      state.publishing = false;
      renderShareUi(shareStatus?.textContent || "");
    }
  }

  async function copyPublicBinderLink() {
    const url = publicBinderUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      renderShareUi("공개 링크를 복사했습니다.");
    } catch {
      shareUrlInput?.focus();
      shareUrlInput?.select();
      document.execCommand?.("copy");
      renderShareUi("공개 링크를 복사했습니다.");
    }
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
        customDexKey: clean(entry?.customDexKey),
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
      applyMissingDisplaySelection(data.settings?.missingCardDisplay);
      renderLinkedDexUi();
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
      await refreshPublishState();
    } catch (error) {
      console.error("커스텀 바인더 불러오기 실패", error);
      updateSaveUi(clean(error?.message) || "저장한 작업을 불러오지 못했습니다.");
    }
  }

  async function saveCurrentBinder(options = {}) {
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
          customDexKey: clean(entry.card.customDexKey),
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
          missingCardDisplay: state.missingCardDisplay,
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
        state.images = (current.images || []).map((image) => ({ ...image }));
      }

      setBinderUrl(binderId);
      renderPageControls();
      updateSaveUi(`${state.pages.length}페이지를 나만의도감에 저장했습니다.`);
      await refreshLibrary();
      renderShareUi();
      if (state.isPublished && !options.skipPublicSync) {
        await publishCurrentBinder({ silent: true, skipSave: true });
      }
    } catch (error) {
      console.error("커스텀 바인더 저장 실패", error);
      updateSaveUi(clean(error?.message) || "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      state.saving = false;
      updateSaveUi(saveStatus.textContent);
      renderShareUi();
    }
  }

  async function deleteCurrentBinder() {
    if (!state.user || !state.firebase || !state.currentBinderId) return;
    const title = clean(titleInput.value) || "이 작업";
    if (!window.confirm(`‘${title}’ 저장 작업을 삭제할까요?`)) return;

    const reference = binderRef(state.currentBinderId);
    const { firestoreModule, db } = state.firebase;

    try {
      if (state.isPublished) {
        await removePublicBinderProjection({ confirmUser: false });
      }
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
    state.isPublished = false;
    state.publishing = false;
    applyMissingDisplaySelection("color");
    renderLinkedDexUi();
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
    renderShareUi();
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
      await Promise.all([refreshLibrary(), loadCustomDexes(), loadPublicProfile()]);

      const requestedBinder = clean(new URLSearchParams(window.location.search).get("binder"));
      if (requestedBinder && state.user) {
        activateTab("custom", false);
        await loadSavedBinder(requestedBinder);
        const params = new URLSearchParams(window.location.search);
        if (params.get("publish") === "1") {
          const published = await publishCurrentBinder({ skipSave: true });
          if (published && params.get("return") === "settings") {
            window.location.replace(`./collector-settings.html?binder=${encodeURIComponent(requestedBinder)}#binder-settings`);
            return;
          }
        }
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
  missingDisplayInputs.forEach((input) =>
    input.addEventListener("change", () => {
      state.missingCardDisplay = selectedMissingDisplay();
      renderPlacements();
      updateCustomPrintUi();
    }),
  );
  linkedDexSelect?.addEventListener("change", () => {
    state.linkedDexId = clean(linkedDexSelect.value);
    renderPlacements();
    renderLinkedDexUi();
    updateSaveUi();
  });
  fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));
  photoCameraInput?.addEventListener("change", () => void importBinderPhoto(photoCameraInput.files?.[0]));
  photoAlbumInput?.addEventListener("change", () => void importBinderPhoto(photoAlbumInput.files?.[0]));
  photoRecognizeButton?.addEventListener("click", () => void recognizeImportedPhotoCards());
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
  publishButton?.addEventListener("click", () => void publishCurrentBinder());
  unpublishButton?.addEventListener("click", () =>
    void removePublicBinderProjection({ confirmUser: true }),
  );
  copyLinkButton?.addEventListener("click", () => void copyPublicBinderLink());
  titleInput.addEventListener("input", () => {
    updateSaveUi();
    renderShareUi();
  });
  customPrintButton.addEventListener("click", () => void startCustomPrint());
  updateArtUi();
  updatePhotoImportUi();

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
  renderShareUi();
  void initializePersistence();
})();
