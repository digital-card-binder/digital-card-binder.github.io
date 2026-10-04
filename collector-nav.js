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
  const SITE_BUILD_VERSION = "b-66bed91deba1";
  const CARD_SCANNER_JS_VERSION = "03f62e451e5f";
  const CARD_SCANNER_CSS_VERSION = "1f4470ec220e";
  const NAV_ACCORDION_STORAGE_KEY = "digitalCardBinderNavAccordionV1";
  const SITE_BUILD_CHECK_URL = "./site-version.json";
  const BUILD_CHECK_MIN_INTERVAL_MS = 15_000;
  const PUBLIC_PROJECTION_REPAIR_VERSION = "projection-50k-v1";
  const PUBLIC_PROJECTION_REPAIR_STORAGE_KEY = "digitalCardBinderPublicProjectionRepairV1";
  let lastBuildCheckAt = 0;

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
    nav.querySelector('[href*="trades.html"]')?.remove();
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
    if (filterTarget) {
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
    resultsBar.append(actions);

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
    if (["collector-settings", "collector-directory", "collector-public", "custom-dex", "trades", "pokemon-search", "health", "operations", "news"].includes(document.body.dataset.page)) {
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
  addCardLayoutToggle();
  addHeroActions();

  const tradeEligiblePages = new Set([
    "national.html",
    "artists.html",
    "series.html",
    "pokemon-collections.html",
    "ar.html",
    "custom.html",
  ]);
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  if (tradeEligiblePages.has(currentPage)) {
    const script = document.createElement("script");
    script.src = `./trade-offer.js?v=${SITE_BUILD_VERSION}`;
    script.defer = true;
    document.head?.append(script);
  }
})();
