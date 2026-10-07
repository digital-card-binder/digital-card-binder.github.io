"use strict";

(function () {
  const registry = window.CollectorCollectionRegistry;
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const PROFILE_SETTINGS_HREF = "./collector-settings.html";
  const CARD_COLUMNS_STORAGE_KEY = "pokemonDexCardColumnsV1";
  const COMPACT_CARD_COLUMNS_STORAGE_KEY = "pokemonDexCompactCardColumnsV1";
  const MOBILE_CARD_COLUMNS_STORAGE_KEY = "pokemonDexMobileCardColumnsV1";
  const COMPACT_CARD_LAYOUT_QUERY = "(max-width: 920px)";
  const MOBILE_CARD_LAYOUT_QUERY = "(max-width: 690px)";
  const SITE_BUILD_VERSION = "b-c10c3af3aa8f";
  const CARD_SCANNER_JS_VERSION = "03f62e451e5f";
  const CARD_SCANNER_CSS_VERSION = "1f4470ec220e";
  const NAV_ACCORDION_STORAGE_KEY = "digitalCardBinderNavAccordionV1";
  const RECENT_DEX_STORAGE_KEY = "digitalCardBinderRecentDexV1";
  const SITE_BUILD_CHECK_URL = "./site-version.json";
  const BUILD_CHECK_MIN_INTERVAL_MS = 15_000;
  const PUBLIC_PROJECTION_REPAIR_VERSION = "projection-50k-v1";
  const PUBLIC_PROJECTION_REPAIR_STORAGE_KEY = "digitalCardBinderPublicProjectionRepairV1";
  let lastBuildCheckAt = 0;

  function recentDexPageHref() {
    const page = window.location.pathname.split("/").pop() || "index.html";
    if (!page || page === "index.html") return "";
    const search = String(window.location?.search || "");
    const baseScope =
      page === "series.html" &&
      /(?:^|[?&])scope=base(?:&|$)/.test(search);
    return `./${page}${baseScope ? "?scope=base" : ""}`;
  }

  function readRecentDex() {
    try {
      const raw = window.localStorage.getItem(RECENT_DEX_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!parsed.href || !parsed.title || !parsed.collectionId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function rememberRecentDex(details = {}) {
    if (window.CollectorPublicView?.requested) return null;

    const collectionId =
      String(details.collectionId || registry?.collectionIdForPage?.() || document.body?.dataset?.catalog || "").trim();
    if (!collectionId) return null;

    const meta = registry?.COLLECTIONS?.[collectionId] || {};
    const title = String(details.title || meta.title || document.querySelector("h1")?.textContent || "도감").trim();
    const detail = String(details.detail || "").trim();
    const href = String(details.href || recentDexPageHref()).trim();
    if (!title || !href || !href.startsWith("./")) return null;

    const owned = Number(details.owned);
    const total = Number(details.total);
    const record = {
      schemaVersion: 1,
      collectionId,
      title,
      detail,
      href,
      unit: String(details.unit || meta.unit || "장").trim() || "장",
      owned: Number.isFinite(owned) && owned >= 0 ? owned : null,
      total: Number.isFinite(total) && total >= 0 ? total : null,
      updatedAt: Date.now(),
    };

    try {
      window.localStorage.setItem(RECENT_DEX_STORAGE_KEY, JSON.stringify(record));
    } catch {
      return null;
    }
    return record;
  }

  function rememberCurrentDexPage() {
    const collectionId = String(registry?.collectionIdForPage?.() || document.body?.dataset?.catalog || "").trim();
    if (!collectionId) return;
    rememberRecentDex({ collectionId });
  }

  window.DigitalCardBinder = window.DigitalCardBinder || {};
  window.DigitalCardBinder.recentDex = Object.freeze({
    storageKey: RECENT_DEX_STORAGE_KEY,
    read: readRecentDex,
    remember: rememberRecentDex,
  });

  async function refreshStaleShell({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastBuildCheckAt < BUILD_CHECK_MIN_INTERVAL_MS) return;
    lastBuildCheckAt = now;

    try {
      const response = await fetch(
        `${SITE_BUILD_CHECK_URL}?t=${Date.now()}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const payload = await response.json();
      const remoteVersion = String(payload?.version || "").trim();
      if (!remoteVersion || remoteVersion === SITE_BUILD_VERSION) return;

      const url = new URL(window.location.href);
      if (url.searchParams.get("build") === remoteVersion) return;
      url.searchParams.set("build", remoteVersion);
      window.location.replace(url.href);
    } catch {
      // 네트워크가 없어도 현재 페이지는 정상 동작합니다.
    }
  }

  const compactCardLayoutMedia = typeof window.matchMedia === "function"
    ? window.matchMedia(COMPACT_CARD_LAYOUT_QUERY)
    : null;
  const mobileCardLayoutMedia = typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_CARD_LAYOUT_QUERY)
    : null;
  const CARD_LAYOUT_MODES = {
    desktop: {
      defaultColumns: "4",
      alternateColumns: "3",
      storageKey: CARD_COLUMNS_STORAGE_KEY,
    },
    compact: {
      defaultColumns: "2",
      alternateColumns: "4",
      storageKey: COMPACT_CARD_COLUMNS_STORAGE_KEY,
    },
    mobile: {
      defaultColumns: "2",
      alternateColumns: "4",
      storageKey: MOBILE_CARD_COLUMNS_STORAGE_KEY,
    },
  };

  function loadCardScanner() {
    const eligiblePages = new Set([
      "index.html",
      "pokemon-search.html",
      "national.html",
      "series.html",
      "ar.html",
      "packs.html",
      "pokemon-collections.html",
      "artists.html",
      "people.html",
      "trainer-pokemon.html",
      "fossil.html",
      "world.html",
      "art-themes.html",
      "custom.html",
    ]);
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    if (!eligiblePages.has(currentPage)) return;

    if (!document.querySelector('link[data-card-scanner-style]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "./card-scanner.css?v=" + CARD_SCANNER_CSS_VERSION;
      link.dataset.cardScannerStyle = "true";
      document.head?.append(link);
    }

    if (!document.querySelector('script[data-card-scanner-script]')) {
      const script = document.createElement("script");
      script.src = "./card-scanner.js?v=" + CARD_SCANNER_JS_VERSION;
      script.dataset.cardScannerScript = "true";
      script.async = true;
      document.head?.append(script);
    }
  }

  function targetPage(link) {
    try {
      const url = new URL(link.getAttribute("href") || "", window.location.href);
      return url.pathname.split("/").pop() || "index.html";
    } catch {
      return "";
    }
  }

  function normalizeNavigationState(nav) {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const activePage = currentPage === "collector.html" ? "collectors.html" : currentPage;
    nav.querySelectorAll(".collection-link").forEach((link) => {
      const active = targetPage(link) === activePage;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      const icon = link.querySelector(".collection-icon");
      if (icon) icon.classList.toggle("collection-icon--red", active);
    });
  }

  function savedNavigationGroup() {
    try {
      const saved = window.localStorage.getItem(NAV_ACCORDION_STORAGE_KEY);
      return ["main", "theme", "none"].includes(saved) ? saved : "";
    } catch {
      return "";
    }
  }

  function saveNavigationGroup(groupKey) {
    try {
      window.localStorage.setItem(NAV_ACCORDION_STORAGE_KEY, groupKey || "none");
    } catch {
      // 저장소 접근이 제한되어도 현재 메뉴의 접기/펼치기는 정상 동작합니다.
    }
  }

  function buildNavigationAccordion(nav) {
    if (!nav || nav.dataset.accordionReady === "true") return;

    const sectionLabels = [...nav.querySelectorAll(".collection-nav-section")];
    if (!sectionLabels.length) return;

    const groups = [];

    sectionLabels.forEach((label, index) => {
      const title = String(label.textContent || "").trim();
      const key = title.includes("테마") ? "theme" : index === 0 ? "main" : `group-${index + 1}`;
      const links = [];
      let next = label.nextElementSibling;

      while (next && !next.classList.contains("collection-nav-section")) {
        const candidate = next;
        next = next.nextElementSibling;
        if (candidate.dataset.navStandalone === "true") break;
        if (candidate.classList.contains("collection-link")) links.push(candidate);
      }

      if (!links.length) return;

      const group = document.createElement("div");
      group.className = "collection-nav-group";
      group.dataset.navGroup = key;
      group.id = `collection-nav-group-${key}`;
      links.forEach((link) => group.append(link));

      const button = document.createElement("button");
      button.type = "button";
      button.className = "collection-nav-section-toggle";
      button.dataset.navGroupToggle = key;
      button.setAttribute("aria-controls", group.id);
      button.innerHTML = `
        <span class="collection-nav-section-title">${title}</span>
        <span class="collection-nav-section-meta" aria-hidden="true">
          <small>${links.length}</small>
          <i>⌄</i>
        </span>
      `;

      label.replaceWith(button);
      button.after(group);
      groups.push({ key, button, group });
    });

    if (!groups.length) return;

    const activeGroup = groups.find(({ group }) => group.querySelector(".collection-link.is-active"));
    const savedGroup = savedNavigationGroup();
    const standaloneActive = Boolean(
      nav.querySelector(':scope > .collection-link[data-nav-standalone="true"].is-active'),
    );
    const mobileTopLevelActive = Boolean(
      mobileCardLayoutMedia?.matches &&
      nav.querySelector(":scope > .collection-link.is-active"),
    );
    const preferredGroup =
      activeGroup?.key ||
      (standaloneActive ? "none" : savedGroup) ||
      (mobileTopLevelActive ? "none" : "main");

    const applyOpenGroup = (groupKey, { persist = true } = {}) => {
      groups.forEach(({ key, button, group }) => {
        const open = key === groupKey;
        button.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
        group.hidden = !open;
      });
      if (persist) saveNavigationGroup(groupKey);
      window.requestAnimationFrame(centerActiveNavigationOnMobile);
    };

    groups.forEach(({ key, button }) => {
      button.addEventListener("click", () => {
        const alreadyOpen = button.getAttribute("aria-expanded") === "true";
        applyOpenGroup(alreadyOpen ? "none" : key);
      });
    });

    applyOpenGroup(preferredGroup, { persist: false });
    nav.dataset.accordionReady = "true";
  }

  function arrangeCollectorNavigation() {
    const nav = document.querySelector(".collection-nav");
    if (!nav) return;
    normalizeNavigationState(nav);
    buildNavigationAccordion(nav);
  }

  function decorateAccountProfileEntry(panel) {
    if (!panel) return;
    let status = panel.querySelector("#firebase-auth-status");
    if (!status) return;

    if (status.tagName !== "A") {
      const link = document.createElement("a");
      link.id = status.id;
      link.className = status.className;
      link.textContent = status.textContent;
      status.replaceWith(link);
      status = link;
    }

    const publicCollectionView = Boolean(window.CollectorPublicView?.requested);
    const profileEnabled =
      panel.classList.contains("is-account") &&
      !panel.classList.contains("is-shared-readonly") &&
      !publicCollectionView;
    status.classList.toggle("firebase-profile-link", profileEnabled);

    if (!profileEnabled) {
      status.removeAttribute("href");
      status.removeAttribute("title");
      status.removeAttribute("aria-label");
      status.removeAttribute("aria-current");
      return;
    }

    if (status.textContent !== "프로필설정") {
      status.textContent = "프로필설정";
    }
    status.href = PROFILE_SETTINGS_HREF;
    status.title = "내 프로필 관리";
    status.setAttribute("aria-label", "프로필설정 · 내 프로필 관리 열기");
    if (window.location.pathname.endsWith("/collector-settings.html")) {
      status.setAttribute("aria-current", "page");
    } else {
      status.removeAttribute("aria-current");
    }
  }

  function watchAccountProfileEntry() {
    const watchPanel = (panel) => {
      decorateAccountProfileEntry(panel);
      const stateObserver = new MutationObserver(() => {
        decorateAccountProfileEntry(panel);
      });
      stateObserver.observe(panel, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        characterData: true,
        subtree: true,
      });
    };

    const existing = document.querySelector("#firebase-auth-panel");
    if (existing) {
      watchPanel(existing);
      return;
    }

    const panelObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          const panel = node.matches?.("#firebase-auth-panel")
            ? node
            : node.querySelector?.("#firebase-auth-panel");
          if (!panel) continue;
          panelObserver.disconnect();
          watchPanel(panel);
          return;
        }
      }
    });
    panelObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
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

  function replaceHeaderChipWithProfileShortcut() {
    const chip = document.querySelector(".header-chip");
    if (!chip || chip.matches("a[href*='collector-settings.html']")) return;
    const link = document.createElement("a");
    link.className = chip.className;
    link.href = PROFILE_SETTINGS_HREF;
    link.textContent = "프로필설정";
    link.title = "내 프로필 관리";
    link.setAttribute("aria-label", "프로필설정 · 내 프로필 관리 열기");
    chip.replaceWith(link);
  }

  function ensureProfileShortcutWithoutPanel() {
    if (typeof window.setTimeout !== "function") return;
    window.setTimeout(async () => {
      if (document.querySelector("#firebase-auth-panel")) return;
      const config = CONFIG.config || {};
      if (!CONFIG.enabled || !config.apiKey || !config.authDomain || !config.projectId) return;
      try {
        const SDK_VERSION = "12.16.0";
        const [appModule, authModule] = await Promise.all([
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        ]);
        const app = appModule.getApps().length
          ? appModule.getApp()
          : appModule.initializeApp(config);
        const auth = authModule.getAuth(app);
        const user = await firstAuthUser(auth, authModule);
        if (user && !document.querySelector("#firebase-auth-panel")) {
          replaceHeaderChipWithProfileShortcut();
        }
      } catch (error) {
        console.warn("프로필설정 바로가기를 확인하지 못했습니다.", error);
      }
    }, 700);
  }

  async function repairPublicProjectionsOnce() {
    const sync = window.CollectorPublicSync?.syncCollectionWithRetry;
    if (
      typeof sync !== "function" ||
      !registry?.COLLECTION_ORDER?.length
    ) {
      return;
    }

    const config = CONFIG.config || {};
    if (
      !CONFIG.enabled ||
      !config.apiKey ||
      !config.authDomain ||
      !config.projectId
    ) {
      return;
    }

    try {
      const SDK_VERSION = "12.16.0";
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(config);
      const auth = authModule.getAuth(app);
      const user = await firstAuthUser(auth, authModule);
      if (!user?.uid) return;

      const marker = `${PUBLIC_PROJECTION_REPAIR_VERSION}:${user.uid}`;
      try {
        if (window.localStorage.getItem(PUBLIC_PROJECTION_REPAIR_STORAGE_KEY) === marker) {
          return;
        }
      } catch {
        // 저장소 접근이 제한되어도 복구 작업은 계속합니다.
      }

      const db = firestoreModule.getFirestore(app);
      let failed = false;
      for (const collectionId of registry.COLLECTION_ORDER) {
        try {
          await sync({
            db,
            firestoreModule,
            user,
            collectionId,
            preferServer: true,
          });
        } catch (error) {
          failed = true;
          console.warn(`${collectionId} 공개 도감 자동 복구 실패`, error);
        }
      }

      if (!failed) {
        try {
          window.localStorage.setItem(PUBLIC_PROJECTION_REPAIR_STORAGE_KEY, marker);
        } catch {
          // 다음 방문에 다시 확인해도 안전합니다.
        }
      }
    } catch (error) {
      console.warn("공개 도감 자동 복구를 완료하지 못했습니다.", error);
    }
  }

  function schedulePublicProjectionRepair() {
    if (typeof window.setTimeout !== "function") return;
    window.setTimeout(() => {
      void repairPublicProjectionsOnce();
    }, 1200);
  }

  function activeCardLayoutMode() {
    if (mobileCardLayoutMedia?.matches) return CARD_LAYOUT_MODES.mobile;
    return compactCardLayoutMedia?.matches
      ? CARD_LAYOUT_MODES.compact
      : CARD_LAYOUT_MODES.desktop;
  }

  function storedCardColumns(mode) {
    try {
      const stored = window.localStorage.getItem(mode.storageKey);
      return [mode.defaultColumns, mode.alternateColumns].includes(stored)
        ? stored
        : mode.defaultColumns;
    } catch (error) {
      return mode.defaultColumns;
    }
  }

  function saveCardColumns(columns, mode) {
    try {
      window.localStorage.setItem(mode.storageKey, columns);
    } catch (error) {
      // 저장소 접근이 제한되어도 현재 화면의 열 전환은 계속 제공합니다.
    }
  }

  function updateCardLayout(columns, buttons, mode) {
    const normalized = columns === mode.alternateColumns
      ? mode.alternateColumns
      : mode.defaultColumns;
    document.documentElement.dataset.cardColumns = normalized;
    for (const button of buttons) {
      const available = [mode.defaultColumns, mode.alternateColumns]
        .includes(button.dataset.columns);
      button.hidden = !available;
      button.setAttribute(
        "aria-pressed",
        String(available && button.dataset.columns === normalized),
      );
    }
  }

  function activateCollectionUiShell() {
    const collectionId = registry?.collectionIdForPage?.() || "";
    if (!collectionId || collectionId === "custom") return;

    document.body?.classList?.add?.("collector-collection-page");
    if (document.body?.dataset) {
      document.body.dataset.collectionUi = "unified";
      document.body.dataset.collectionId = collectionId;
    }

    document.querySelector(".main-content")?.classList?.add?.("collector-collection-main");
    document.querySelector(".hero")?.classList?.add?.("collector-collection-hero");
    document.querySelector(".stats-grid")?.classList?.add?.("collector-collection-stats");

    document.querySelectorAll?.(
      ".catalog-panel, .world-generation-panel, .world-binder-panel",
    )?.forEach?.((panel) => panel.classList?.add?.("collector-content-panel"));

    document.querySelectorAll?.(
      ".filter-panel, .pack-filter-panel, .artist-filter-panel, .people-filter-panel, .fossil-filter-panel, .tp-filter-panel, .catalog-toolbar",
    )?.forEach?.((panel) => panel.classList?.add?.("collector-filter-surface"));

    document.querySelectorAll?.(
      ".catalog-summary, .artist-selection-summary, .tp-selection-summary, .fossil-selection-summary",
    )?.forEach?.((summary) => summary.classList?.add?.("collector-selection-summary"));
  }

  const RELATED_DEX_ORDER = Object.freeze([
    "series",
    "ar",
    "pokemon",
    "artist",
    "people",
    "trainerPokemon",
    "fossil",
    "world",
    "artThemes",
    "national",
  ]);
  let relatedDexIndexPromise = null;

  function relatedClean(value) {
    return String(value ?? "").trim();
  }

  function relatedNormalizedSet(value) {
    return relatedClean(value)
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9+\-]/g, "");
  }

  function relatedCardNumerator(value) {
    const text = relatedClean(value).replace(/\s+/g, "");
    const slash =
      text.match(/(?:^|[_:\-])0*(\d{1,4})\/\d{1,4}/i) ||
      text.match(/^0*(\d{1,4})\/\d{1,4}/);
    if (slash) return String(Number(slash[1]));
    const separated = text.match(/(?:_|-)0*(\d{1,4})(?:\D|$)/i);
    if (separated) return String(Number(separated[1]));
    const leading = text.match(/^0*(\d{1,4})(?:\D|$)/);
    return leading ? String(Number(leading[1])) : "";
  }

  function relatedSetFromMeta(value) {
    const chunks = relatedClean(value)
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chunks.length < 2) return "";
    const candidate = chunks[chunks.length - 1];
    return /[a-z]/i.test(candidate) && !/\s/.test(candidate)
      ? candidate
      : "";
  }

  function relatedSetFromImage(imageUrl) {
    const value = relatedClean(imageUrl).split(/[?#]/, 1)[0];
    if (!value) return "";
    const pathMatch = value.match(
      /\/wmimages\/(?:SV|SM|S|MEGA|M|XY|BW|DP|ADV)\/([^/]+)\/([^/]+)$/i,
    );
    if (!pathMatch) return "";
    const folder = pathMatch[1] || "";
    const filename = pathMatch[2] || "";
    const fileMatch = filename.match(/^([^_]+)_\d+/i);
    const fileSet = fileMatch?.[1] || "";
    if (
      fileSet &&
      folder &&
      fileSet.toLowerCase().startsWith(folder.toLowerCase())
    ) {
      return fileSet;
    }
    return folder || fileSet;
  }

  function looksLikeSetCode(value) {
    const text = relatedClean(value);
    if (!text || /\s/.test(text) || text.length > 18) return false;
    if (/^BS20\d{5,}$/i.test(text)) return false;
    return /[a-z]/i.test(text) && /\d|[-+]/.test(text);
  }

  function relatedCardReference(card = {}, context = {}) {
    const image =
      context.image ||
      card.image ||
      card.imageUrl ||
      card.imageLarge ||
      card.originalImage ||
      card.actualImage ||
      "";
    const metaSet = relatedSetFromMeta(card.meta || card.code);
    const directSetCandidates = [
      context.setCode,
      card.set,
      metaSet,
      card.setCode,
      card.actualSetCode,
    ];
    let setCode = directSetCandidates.find(looksLikeSetCode) || "";
    if (!setCode) setCode = relatedSetFromImage(image);

    const cardNumber =
      context.cardNumber ||
      card.cardNumber ||
      card.number ||
      card.actualCardNumber ||
      card.code ||
      card.meta ||
      image;

    const normalizedSet = relatedNormalizedSet(setCode);
    const normalizedNumber = relatedCardNumerator(cardNumber);
    return {
      setCode: relatedClean(setCode),
      cardNumber: relatedClean(cardNumber),
      fingerprint:
        normalizedSet && normalizedNumber
          ? `${normalizedSet}::${normalizedNumber}`
          : "",
      name: relatedClean(
        context.name ||
          card.name ||
          card.pokemonName ||
          card.cardName ||
          card.nameKo,
      ),
      image,
    };
  }

  function relatedHref(collectionId, groupKey) {
    const value = relatedClean(groupKey);
    switch (collectionId) {
      case "series":
        return `./series.html?group=${encodeURIComponent(value)}`;
      case "ar":
        return `./ar.html?group=${encodeURIComponent(value)}`;
      case "pokemon":
        return `./pokemon-collections.html?group=${encodeURIComponent(value)}`;
      case "artist":
        return `./artists.html?artist=${encodeURIComponent(value)}`;
      case "people":
        return `./people.html?person=${encodeURIComponent(value)}`;
      case "trainerPokemon":
        return `./trainer-pokemon.html?group=${encodeURIComponent(value)}`;
      case "fossil":
        return `./fossil.html?set=${encodeURIComponent(value)}`;
      case "world":
        return `./world.html?generation=${encodeURIComponent(value)}`;
      case "artThemes":
        return `./art-themes.html?theme=${encodeURIComponent(value)}`;
      case "national":
        return `./national.html?pokemon=${encodeURIComponent(value)}`;
      default:
        return registry?.COLLECTIONS?.[collectionId]?.href || "./";
    }
  }

  function relatedLabel(collectionId, groupLabel) {
    const title = registry?.COLLECTIONS?.[collectionId]?.title || "도감";
    const detail = relatedClean(groupLabel);
    return detail ? `${title} · ${detail}` : title;
  }

  function pushRelated(index, card, descriptor, context = {}) {
    const reference = relatedCardReference(card, context);
    if (!reference.fingerprint) return;
    const entry = {
      collectionId: descriptor.collectionId,
      groupKey: relatedClean(descriptor.groupKey),
      groupLabel: relatedClean(descriptor.groupLabel || descriptor.groupKey),
    };
    entry.href = relatedHref(entry.collectionId, entry.groupKey);
    entry.label = relatedLabel(entry.collectionId, entry.groupLabel);
    if (!index.has(reference.fingerprint)) index.set(reference.fingerprint, []);
    const items = index.get(reference.fingerprint);
    if (
      !items.some(
        (item) =>
          item.collectionId === entry.collectionId &&
          item.groupKey === entry.groupKey,
      )
    ) {
      items.push(entry);
    }
  }

  function decodeRelatedDexIndex(payload) {
    const map = new Map();
    const entries =
      payload?.entries &&
      typeof payload.entries === "object" &&
      !Array.isArray(payload.entries)
        ? payload.entries
        : {};
    Object.entries(entries).forEach(([fingerprint, rows]) => {
      const items = (Array.isArray(rows) ? rows : [])
        .map((row) => {
          if (!Array.isArray(row) || row.length < 2) return null;
          const collectionId = relatedClean(row[0]);
          const groupKey = relatedClean(row[1]);
          const groupLabel = relatedClean(row[2] || row[1]);
          if (!collectionId || !groupKey) return null;
          return {
            collectionId,
            groupKey,
            groupLabel,
            href: relatedHref(collectionId, groupKey),
            label: relatedLabel(collectionId, groupLabel),
          };
        })
        .filter(Boolean);
      if (items.length) map.set(fingerprint, items);
    });
    return map;
  }

  async function buildRelatedDexIndex() {
    const catalog = window.DigitalCardBinder?.catalog;
    if (!catalog) return new Map();

    try {
      const compactIndex = await catalog.json("./data/card-related-dex-index.json");
      if (compactIndex?.schemaVersion === 1 && compactIndex?.entries) {
        return decodeRelatedDexIndex(compactIndex);
      }
    } catch (error) {
      console.warn("경량 관련 도감 인덱스를 불러오지 못해 원본 데이터로 복구합니다.", error);
    }

    const safe = (promise, fallback) =>
      Promise.resolve(promise).catch((error) => {
        console.warn("관련 도감 연결 데이터를 불러오지 못했습니다.", error);
        return fallback;
      });

    const [
      pokemonGroups,
      arGroups,
      artistsPayload,
      peoplePayload,
      trainerPayload,
      fossilPayload,
      themesPayload,
      worldGroups,
      pokedexPayload,
    ] = await Promise.all([
      safe(catalog.pokemonCollections(), []),
      safe(catalog.ar(), []),
      safe(catalog.json("./data/artists.json"), { artists: [] }),
      safe(catalog.json("./data/people.json"), { people: [] }),
      safe(catalog.json("./data/trainer-pokemon.json"), { groups: [] }),
      safe(catalog.json("./data/fossil.json"), { groups: [] }),
      safe(catalog.json("./data/art-themes.json"), { groups: [] }),
      safe(catalog.worldGroups(), []),
      safe(catalog.json("./data/pokedex.json"), { records: [] }),
    ]);

    const index = new Map();

    (pokemonGroups || []).forEach((group) => {
      (group.cards || []).forEach((card) => {
        pushRelated(
          index,
          card,
          {
            collectionId: "pokemon",
            groupKey: group.name,
            groupLabel: group.name,
          },
          { setCode: relatedSetFromMeta(card.meta) },
        );
      });
    });

    (arGroups || []).forEach((group) => {
      (group.cards || []).forEach((card) => {
        pushRelated(index, card, {
          collectionId: "ar",
          groupKey: group.code,
          groupLabel: group.title || group.code,
        }, { setCode: group.code });
      });
    });

    (artistsPayload?.artists || []).forEach((artist) => {
      (artist.cards || []).forEach((card) => {
        pushRelated(index, card, {
          collectionId: "artist",
          groupKey: artist.name,
          groupLabel: artist.name,
        });
      });
    });

    (peoplePayload?.people || []).forEach((person) => {
      (person.cards || []).forEach((card) => {
        pushRelated(index, card, {
          collectionId: "people",
          groupKey: person.id,
          groupLabel: person.nameKo || person.nameEn || person.id,
        });
      });
    });

    (trainerPayload?.groups || []).forEach((group) => {
      (group.cards || []).forEach((card) => {
        pushRelated(index, card, {
          collectionId: "trainerPokemon",
          groupKey: group.name,
          groupLabel: group.name,
        });
      });
    });

    (fossilPayload?.groups || []).forEach((group) => {
      (group.cards || []).forEach((card) => {
        pushRelated(index, card, {
          collectionId: "fossil",
          groupKey: group.code,
          groupLabel: group.name || group.set || group.code,
        });
      });
    });

    (themesPayload?.groups || []).forEach((group) => {
      (group.cards || []).forEach((card) => {
        pushRelated(index, card, {
          collectionId: "artThemes",
          groupKey: group.code,
          groupLabel: group.name,
        });
      });
    });

    (worldGroups || []).forEach((group) => {
      const generation =
        String(group.code || "").match(/generation-(\d+)/i)?.[1] || "";
      (group.cards || []).forEach((card) => {
        const source = card.slot?.card || card;
        pushRelated(index, source, {
          collectionId: "world",
          groupKey: generation,
          groupLabel: group.name,
        }, {
          image: source.image || card.image,
        });
      });
    });

    (pokedexPayload?.records || []).forEach((record) => {
      pushRelated(index, record, {
        collectionId: "national",
        groupKey: record.number,
        groupLabel: record.nameKo || record.nameEn || `#${record.number}`,
      });
    });

    return index;
  }

  function getRelatedDexIndex() {
    if (!relatedDexIndexPromise) {
      relatedDexIndexPromise = buildRelatedDexIndex().catch((error) => {
        relatedDexIndexPromise = null;
        throw error;
      });
    }
    return relatedDexIndexPromise;
  }

  function relatedCurrentGroup(context = {}) {
    return relatedClean(
      context.currentGroupKey ||
        context.groupKey ||
        context.group?.code ||
        context.group?.name ||
        context.group?.title,
    );
  }

  function relatedSameDestination(item, context = {}) {
    const currentCollectionId =
      context.currentCollectionId ||
      registry?.collectionIdForPage?.() ||
      document.body?.dataset?.catalog ||
      "";
    if (item.collectionId !== currentCollectionId) return false;
    const currentGroup = relatedCurrentGroup(context);
    return currentGroup
      ? relatedClean(item.groupKey).toLowerCase() === currentGroup.toLowerCase()
      : true;
  }

  function relatedSort(left, right) {
    const leftOrder = RELATED_DEX_ORDER.indexOf(left.collectionId);
    const rightOrder = RELATED_DEX_ORDER.indexOf(right.collectionId);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.label.localeCompare(right.label, "ko");
  }

  function relatedDexHost(dialog) {
    if (!dialog) return null;
    let host = dialog.querySelector(".related-dex-links");
    if (host) return host;
    const copy =
      dialog.querySelector(".dialog-card-copy") ||
      dialog.querySelector(".people-dialog-copy") ||
      dialog.querySelector(".world-dialog-copy") ||
      dialog;
    host = document.createElement("section");
    host.className = "related-dex-links";
    host.hidden = true;
    host.innerHTML = `
      <div class="related-dex-heading">
        <strong>이 카드가 있는 다른 도감</strong>
        <small>보유 상태는 각 도감에서 독립적으로 관리됩니다.</small>
      </div>
      <div class="related-dex-items" aria-live="polite"></div>
    `;
    copy.append(host);
    return host;
  }

  async function renderRelatedDexLinks(dialog, card, context = {}) {
    const host = relatedDexHost(dialog);
    if (!host) return;
    const itemsHost = host.querySelector(".related-dex-items");
    if (!itemsHost) return;

    const reference = relatedCardReference(card, context);
    if (!reference.fingerprint) {
      host.hidden = true;
      itemsHost.replaceChildren();
      return;
    }

    const requestKey = `${reference.fingerprint}::${Date.now()}`;
    host.dataset.requestKey = requestKey;
    host.hidden = false;
    host.classList.add("is-loading");
    itemsHost.textContent = "관련 도감 확인 중…";

    try {
      const index = await getRelatedDexIndex();
      if (host.dataset.requestKey !== requestKey) return;

      const links = [...(index.get(reference.fingerprint) || [])];
      if (reference.setCode) {
        links.push({
          collectionId: "series",
          groupKey: reference.setCode,
          groupLabel: reference.setCode,
          href: relatedHref("series", reference.setCode),
          label: relatedLabel("series", reference.setCode),
        });
      }

      const unique = new Map();
      links
        .filter((item) => !relatedSameDestination(item, context))
        .forEach((item) => {
          unique.set(`${item.collectionId}::${item.groupKey}`, item);
        });
      const related = [...unique.values()].sort(relatedSort);

      itemsHost.replaceChildren();
      host.classList.remove("is-loading");
      if (!related.length) {
        host.hidden = true;
        return;
      }

      related.forEach((item) => {
        const link = document.createElement("a");
        link.className = "related-dex-link";
        link.href = item.href;
        link.textContent = item.label;
        link.setAttribute("aria-label", `${item.label}로 이동`);
        itemsHost.append(link);
      });
      host.hidden = false;
    } catch (error) {
      console.warn("관련 도감 링크를 만들지 못했습니다.", error);
      host.classList.remove("is-loading");
      host.hidden = true;
      itemsHost.replaceChildren();
    }
  }

  window.DigitalCardBinder = window.DigitalCardBinder || {};
  window.DigitalCardBinder.relatedDex = Object.freeze({
    reference: relatedCardReference,
    render: renderRelatedDexLinks,
  });

  const UNIFIED_DEX_CONTROL_CONFIG = Object.freeze({
    national: {
      status: "#status-filters",
      surfaces: [".filter-panel"],
    },
    series: {
      status: "#catalog-status",
      surfaces: [".catalog-toolbar", ".catalog-filter-row"],
    },
    ar: {
      status: "#catalog-status",
      surfaces: [".catalog-toolbar", ".catalog-filter-row"],
    },
    pack: {
      status: "#pack-status-filters",
      surfaces: [".pack-filter-panel"],
    },
    pokemon: {
      status: "#catalog-status",
      surfaces: [".catalog-toolbar", ".catalog-filter-row"],
    },
    artist: {
      status: "#artist-status-filters",
      surfaces: [".artist-filter-panel"],
    },
    people: {
      status: "#people-status-filters",
      surfaces: [".people-filter-panel"],
    },
    trainerPokemon: {
      status: "#tp-status-filters",
      surfaces: [".tp-filter-panel"],
    },
    fossil: {
      status: "#fossil-status-filters",
      surfaces: [".fossil-filter-panel"],
    },
    world: {
      status: "",
      surfaces: [".world-generation-panel"],
      worldVisualFilter: true,
    },
    artThemes: {
      status: "#art-theme-status-filters",
      surfaces: [".art-theme-filter-panel"],
    },
  });

  function unifiedFilterSurfaces(config) {
    return (config?.surfaces || [])
      .map((selector) => document.querySelector(selector))
      .filter(Boolean);
  }

  function activeSourceStatus(source) {
    const active =
      source?.querySelector?.("button.is-active[data-status]") ||
      source?.querySelector?.('button[aria-pressed="true"][data-status]');
    return active?.dataset?.status || "all";
  }

  function applyWorldVisualStatus(status) {
    const normalized = ["all", "owned", "missing"].includes(status)
      ? status
      : "all";
    if (document.body?.dataset) {
      document.body.dataset.worldQuickStatus = normalized;
    }

    document.querySelectorAll("#world-binder-content .world-slot").forEach((card) => {
      const owned = !card.classList.contains("is-missing");
      card.hidden =
        normalized === "owned"
          ? !owned
          : normalized === "missing"
            ? owned
            : false;
    });

    document.querySelectorAll("#world-binder-content .world-journey-chapter").forEach((chapter) => {
      const cards = [...chapter.querySelectorAll(".world-slot")];
      chapter.hidden = Boolean(cards.length) && cards.every((card) => card.hidden);
    });
  }

  function installUnifiedDexControls() {
    const collectionId = registry?.collectionIdForPage?.() || "";
    const config = UNIFIED_DEX_CONTROL_CONFIG[collectionId];
    if (!config || document.querySelector(".collector-quick-controls")) return;

    const surfaces = unifiedFilterSurfaces(config);
    const statusSource = config.status
      ? document.querySelector(config.status)
      : null;
    const anchor = surfaces[0] || document.querySelector(".world-binder-panel");
    if (!anchor || (!statusSource && !config.worldVisualFilter)) return;

    statusSource?.classList?.add?.("collector-status-source");
    surfaces.forEach((surface) => {
      surface.classList.add("collector-quick-filter-surface");
    });

    const controls = document.createElement("div");
    controls.className = "collector-quick-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "도감 빠른 보기");
    controls.innerHTML = `
      <button type="button" data-quick-status="all" aria-pressed="false">전체</button>
      <button type="button" data-quick-status="owned" aria-pressed="false">보유</button>
      <button type="button" data-quick-status="missing" aria-pressed="false">미보유</button>
      <button type="button" class="collector-quick-filter-button" data-quick-filter aria-expanded="true">필터</button>
    `;
    anchor.insertAdjacentElement("beforebegin", controls);

    const quickButtons = [
      ...controls.querySelectorAll("button[data-quick-status]"),
    ];
    const filterButton = controls.querySelector("[data-quick-filter]");

    const currentStatus = () =>
      config.worldVisualFilter
        ? document.body?.dataset?.worldQuickStatus || "all"
        : activeSourceStatus(statusSource);

    const syncQuickStatus = () => {
      const status = currentStatus();
      quickButtons.forEach((button) => {
        const active = button.dataset.quickStatus === status;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    };

    const setFilterOpen = (open) => {
      surfaces.forEach((surface) => {
        surface.classList.toggle("is-quick-filter-collapsed", !open);
      });
      controls.classList.toggle("is-filter-open", open);
      filterButton?.setAttribute("aria-expanded", String(open));
    };

    quickButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const status = button.dataset.quickStatus || "all";
        if (config.worldVisualFilter) {
          applyWorldVisualStatus(status);
          syncQuickStatus();
          return;
        }

        const target = statusSource?.querySelector?.(
          `button[data-status="${status}"]`,
        );
        target?.click?.();
        window.requestAnimationFrame?.(syncQuickStatus);
      });
    });

    filterButton?.addEventListener("click", () => {
      const open = filterButton.getAttribute("aria-expanded") !== "true";
      setFilterOpen(open);
      if (open) {
        surfaces[0]?.scrollIntoView?.({
          behavior: "smooth",
          block: "nearest",
        });
      }
    });

    if (statusSource && typeof MutationObserver === "function") {
      const statusObserver = new MutationObserver(syncQuickStatus);
      statusObserver.observe(statusSource, {
        attributes: true,
        attributeFilter: ["class", "aria-pressed"],
        childList: true,
        subtree: true,
      });
    }

    if (config.worldVisualFilter) {
      const binder = document.querySelector("#world-binder-content");
      if (binder && typeof MutationObserver === "function") {
        const worldObserver = new MutationObserver(() => {
          applyWorldVisualStatus(currentStatus());
        });
        worldObserver.observe(binder, {
          attributes: true,
          attributeFilter: ["class"],
          childList: true,
          subtree: true,
        });
      }
      applyWorldVisualStatus("all");
    }

    const syncFilterLayout = () => {
      setFilterOpen(false);
    };

    syncQuickStatus();
    syncFilterLayout();

    if (typeof mobileCardLayoutMedia?.addEventListener === "function") {
      mobileCardLayoutMedia.addEventListener("change", syncFilterLayout);
    } else if (typeof mobileCardLayoutMedia?.addListener === "function") {
      mobileCardLayoutMedia.addListener(syncFilterLayout);
    }
  }

  const SIMPLE_DEX_COLLECTIONS = new Set([
    "national",
    "series",
    "ar",
    "pack",
    "pokemon",
    "artist",
    "people",
    "trainerPokemon",
    "fossil",
    "world",
    "artThemes",
  ]);

  const SIMPLE_DEX_SUMMARIES = Object.freeze({
    series: ".catalog-summary",
    ar: ".catalog-summary",
    pokemon: ".catalog-summary",
    artist: ".artist-selection-summary",
    trainerPokemon: ".tp-selection-summary",
    fossil: ".fossil-selection-summary",
    artThemes: ".art-theme-selected-summary",
  });
  const SIMPLE_DEX_PRIMARY_SELECTORS = Object.freeze({
    ar: ".catalog-toolbar .catalog-select",
  });
  const STICKY_SELECTOR_COLLECTIONS = new Set([
    "artist",
    "pokemon",
    "trainerPokemon",
  ]);

  function installSimpleDexLayout() {
    const collectionId = registry?.collectionIdForPage?.() || "";
    if (!SIMPLE_DEX_COLLECTIONS.has(collectionId)) return;

    document.body?.classList?.add?.("collector-simple-dex");

    const controls = document.querySelector(".collector-quick-controls");
    const summarySelector = SIMPLE_DEX_SUMMARIES[collectionId];
    const summary = summarySelector
      ? document.querySelector(summarySelector)
      : null;

    if (summary && controls && summary.nextElementSibling !== controls) {
      controls.insertAdjacentElement("beforebegin", summary);
      summary.classList.add("collector-simple-summary");
    }

    const primarySelectorQuery = SIMPLE_DEX_PRIMARY_SELECTORS[collectionId];
    const primarySelector = primarySelectorQuery
      ? document.querySelector(primarySelectorQuery)
      : null;
    if (
      primarySelector &&
      summary &&
      !primarySelector.closest(".collector-primary-selector")
    ) {
      const primaryWrap = document.createElement("div");
      primaryWrap.className = "collector-primary-selector";
      primaryWrap.setAttribute("data-primary-selector", collectionId);
      summary.insertAdjacentElement("beforebegin", primaryWrap);
      primaryWrap.append(primarySelector);
    }

    if (
      summary &&
      controls &&
      STICKY_SELECTOR_COLLECTIONS.has(collectionId) &&
      !document.querySelector(".collector-sticky-selector-stack")
    ) {
      const stickyStack = document.createElement("div");
      stickyStack.className = "collector-sticky-selector-stack";
      stickyStack.setAttribute("data-sticky-selector", collectionId);
      summary.insertAdjacentElement("beforebegin", stickyStack);
      stickyStack.append(summary, controls);
    }

    const filterSurface = document.querySelector(
      ".collector-quick-filter-surface",
    );
    const catalogActions = document.querySelector(
      ".catalog-heading .catalog-actions",
    );
    if (filterSurface && catalogActions && !filterSurface.contains(catalogActions)) {
      catalogActions.classList.add("collector-simple-secondary-actions");
      filterSurface.append(catalogActions);
    }

    const heading = document.querySelector(".catalog-panel > .catalog-heading");
    if (heading) heading.classList.add("collector-simple-catalog-heading");
  }

  function addCardLayoutToggle() {
    if (!registry?.collectionIdForPage?.()) return;
    const resultsBar = document.querySelector(
      ".catalog-panel .results-bar:not(.promo-results-bar)",
    );
    if (!resultsBar || resultsBar.querySelector(".card-layout-options")) return;

    const actions = document.createElement("div");
    actions.className = "results-bar-actions";
    for (const child of [...resultsBar.children]) {
      if (child.matches("button")) actions.append(child);
    }

    const layoutOptions = document.createElement("div");
    layoutOptions.className = "card-layout-options";
    layoutOptions.setAttribute("role", "group");
    layoutOptions.setAttribute("aria-label", "카드 배열 선택");
    const buttons = ["2", "3", "4"].map((columns) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "card-layout-toggle";
      button.dataset.columns = columns;
      button.textContent = `${columns}열`;
      button.title = `카드를 한 줄에 ${columns}개씩 표시합니다.`;
      button.setAttribute("aria-label", `${columns}열로 보기`);
      button.addEventListener("click", () => {
        const mode = activeCardLayoutMode();
        if (![mode.defaultColumns, mode.alternateColumns].includes(columns)) return;
        updateCardLayout(columns, buttons, mode);
        saveCardColumns(columns, mode);
      });
      layoutOptions.append(button);
      return button;
    });
    const filterTarget = document.querySelector(
      ".catalog-era-filter, .filter-panel, .pack-filter-panel, .artist-filter-panel, .people-filter-panel, .fossil-filter-panel, .tp-filter-panel, .catalog-toolbar",
    );
    if (filterTarget && !document.querySelector(".collector-quick-controls")) {
      const filterButton = document.createElement("button");
      filterButton.type = "button";
      filterButton.className = "mobile-filter-jump";
      filterButton.textContent = "필터";
      filterButton.setAttribute("aria-label", "검색 및 필터로 이동");
      filterButton.addEventListener("click", () => {
        const reducedMotion = typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        filterTarget.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        });
      });
      actions.append(filterButton);
    }
    actions.append(layoutOptions);
    const simpleFilterSurface =
      document.body?.classList?.contains?.("collector-simple-dex")
        ? document.querySelector(".collector-quick-filter-surface")
        : null;
    if (simpleFilterSurface) {
      actions.classList.add("collector-simple-view-actions");
      simpleFilterSurface.append(actions);
    } else {
      resultsBar.append(actions);
    }

    const restoreLayout = () => {
      const mode = activeCardLayoutMode();
      updateCardLayout(storedCardColumns(mode), buttons, mode);
    };

    restoreLayout();

    if (typeof compactCardLayoutMedia?.addEventListener === "function") {
      compactCardLayoutMedia.addEventListener("change", restoreLayout);
    } else if (typeof compactCardLayoutMedia?.addListener === "function") {
      compactCardLayoutMedia.addListener(restoreLayout);
    }
    if (typeof mobileCardLayoutMedia?.addEventListener === "function") {
      mobileCardLayoutMedia.addEventListener("change", restoreLayout);
    } else if (typeof mobileCardLayoutMedia?.addListener === "function") {
      mobileCardLayoutMedia.addListener(restoreLayout);
    }
  }

  function centerActiveNavigationOnMobile() {
    // 691–920px에서는 가로형 압축 메뉴를 유지하므로 활성 항목을 가운데로 맞춥니다.
    // 690px 이하 모바일은 세로 아코디언이므로 가로 스크롤 보정이 필요하지 않습니다.
    if (!compactCardLayoutMedia?.matches || mobileCardLayoutMedia?.matches) return;
    const sidebar = document.querySelector(".sidebar");
    const active = sidebar?.querySelector(".collection-link.is-active");
    if (!sidebar || !active || active.closest(".collection-nav-group")?.hidden) return;

    const sidebarRect = sidebar.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const left = Math.max(
      0,
      sidebar.scrollLeft +
        (activeRect.left - sidebarRect.left) -
        (sidebar.clientWidth - activeRect.width) / 2,
    );

    if (typeof sidebar.scrollTo === "function") {
      sidebar.scrollTo({ left, behavior: "auto" });
    } else {
      sidebar.scrollLeft = left;
    }
  }

  function addHeroActions() {
    if (["collector-settings", "collector-directory", "collector-public", "custom-dex", "pokemon-search", "health", "operations", "news"].includes(document.body.dataset.page)) {
      return;
    }
    const heroContent = document.querySelector(".hero .hero-content");
    if (!heroContent || heroContent.querySelector(".collector-page-actions")) return;
    const collectionId = registry?.collectionIdForPage?.() || "";
    const publicView = window.CollectorPublicView;
    const actions = document.createElement("div");
    actions.className = "collector-page-actions";

    if (publicView?.requested) {
      const publicId = publicView.requestedPublicId;
      if (/^[a-z0-9]{12}$/.test(publicId)) {
        const profile = document.createElement("a");
        profile.href = `./collector.html?id=${encodeURIComponent(publicId)}`;
        profile.textContent = "컬렉터 프로필로 돌아가기";
        actions.append(profile);
      }
      heroContent.append(actions);
      window.addEventListener(
        "pokemon-dex:collector-public-ready",
        (event) => {
          if (actions.querySelector("a")) return;
          const profile = document.createElement("a");
          profile.href = `./collector.html?id=${encodeURIComponent(event.detail.publicId)}`;
          profile.textContent = "컬렉터 프로필로 돌아가기";
          actions.append(profile);
        },
        { once: true },
      );
      return;
    }

    const settings = document.createElement("a");
    settings.href = collectionId
      ? `./collector-settings.html?collection=${encodeURIComponent(collectionId)}`
      : "./collector-settings.html";
    settings.textContent = collectionId ? "이 도감 공유·설정" : "대시보드 편집";
    actions.append(settings);

    if (!collectionId) {
      const profile = document.createElement("a");
      profile.id = "collector-profile-shortcut";
      profile.href = "./collector-settings.html#collector-profile-title";
      profile.textContent = "컬렉터 프로필";
      actions.append(profile);
    }
    heroContent.append(actions);
  }

  function showPublicSyncWarning(event) {
    const main = document.querySelector(".main-content");
    if (!main) return;
    let warning = document.querySelector("#collector-sync-warning");
    if (!warning) {
      warning = document.createElement("div");
      warning.id = "collector-sync-warning";
      warning.className = "collector-sync-warning";
      warning.setAttribute("role", "status");
      warning.innerHTML = `
        <div><strong>개인 도감은 저장했지만 공개 화면 갱신이 지연되고 있습니다.</strong><span></span></div>
        <a href="./collector-settings.html">내 프로필 관리에서 다시 확인</a>
      `;
      main.prepend(warning);
    }
    const collectionId = event.detail?.collectionId || "";
    const meta = registry?.COLLECTIONS?.[collectionId];
    warning.querySelector("span").textContent = meta
      ? ` ${meta.title}의 공개 범위와 네트워크를 확인해 주세요.`
      : " 공개 범위와 네트워크를 확인해 주세요.";
    warning.querySelector("a").href = collectionId
      ? `./collector-settings.html?collection=${encodeURIComponent(collectionId)}`
      : "./collector-settings.html";
  }

  window.addEventListener("pokemon-dex:public-sync-error", showPublicSyncWarning);
  void refreshStaleShell({ force: true });
  window.addEventListener("pageshow", () => {
    void refreshStaleShell();
  }, { passive: true });
  if (typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void refreshStaleShell();
    });
  }
  activateCollectionUiShell();
  arrangeCollectorNavigation();
  loadCardScanner();
  centerActiveNavigationOnMobile();
  if (typeof mobileCardLayoutMedia?.addEventListener === "function") {
    mobileCardLayoutMedia.addEventListener("change", centerActiveNavigationOnMobile);
  } else if (typeof mobileCardLayoutMedia?.addListener === "function") {
    mobileCardLayoutMedia.addListener(centerActiveNavigationOnMobile);
  }
  const standaloneAccountHeaderPages = new Set(["custom-dex"]);
  if (standaloneAccountHeaderPages.has(document.body?.dataset?.page)) {
    void window.DigitalCardBinder?.firebaseAccount?.installHeaderPanel?.(CONFIG);
  }
  watchAccountProfileEntry();
  ensureProfileShortcutWithoutPanel();
  schedulePublicProjectionRepair();
  installUnifiedDexControls();
  installSimpleDexLayout();
  addCardLayoutToggle();
  addHeroActions();
  rememberCurrentDexPage();

})();
