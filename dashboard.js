"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const registry = window.CollectorCollectionRegistry;
  const accountCore = window.DigitalCardBinder?.firebaseAccount;
  if (!registry || !accountCore) {
    throw new Error("공통 도감 코어를 불러오지 못했습니다.");
  }
  const FALLBACK_CATEGORY_META = {
    national: {
      number: "01",
      title: "전국도감",
      description: "1세대부터 9세대까지",
      href: "./national.html",
      documentId: CONFIG.userDocument || "nationalDex",
      unit: "종",
    },
    series: {
      number: "02",
      title: "시리즈 도감",
      description: "확장팩별 카드 목록",
      href: "./series.html",
      documentId: "seriesDex",
      unit: "장",
    },
    ar: {
      number: "03",
      title: "AR 전종도감",
      description: "SV · M 시리즈 AR",
      href: "./ar.html",
      documentId: "arDex",
      unit: "장",
    },
    pack: {
      number: "04",
      title: "팩 전종수집",
      description: "S · SV · M 확장팩",
      href: "./packs.html",
      documentId: "packDex",
      unit: "팩",
    },
    pokemon: {
      number: "05",
      title: "포켓몬 컬렉션",
      description: "좋아하는 포켓몬별 카드",
      href: "./pokemon-collections.html",
      documentId: "pokemonCollectionsDex",
      unit: "장",
    },
    artist: {
      number: "06",
      title: "작가 도감",
      description: "일러스트레이터별 카드",
      href: "./artists.html",
      documentId: "artistDex",
      unit: "장",
    },
    people: {
      number: "07",
      title: "인물도감",
      description: "트레이너·주요 인물 아카이브",
      href: "./people.html",
      documentId: CONFIG.userDocument || "nationalDex",
      unit: "명",
    },
    trainerPokemon: {
      number: "08",
      title: "트레이너 × 포켓몬",
      description: "인물과 포켓몬이 함께 등장하는 일러스트",
      href: "./trainer-pokemon.html",
      documentId: "pokemonCollectionsDex",
      unit: "장",
    },
    custom: {
      number: "MY",
      title: "나만의 도감",
      description: "직접 만드는 테마 도감",
      href: "./custom.html",
      documentId: "pokemonCollectionsDex",
      unit: "장",
    },
  };
  const CATEGORY_ORDER = registry?.COLLECTION_ORDER?.length
    ? [...registry.COLLECTION_ORDER]
    : Object.keys(FALLBACK_CATEGORY_META);
  const CATEGORY_META = Object.fromEntries(
    CATEGORY_ORDER.map((key) => [
      key,
      {
        ...FALLBACK_CATEGORY_META[key],
        ...(registry?.COLLECTIONS?.[key] || {}),
      },
    ]),
  );
  const DOCUMENT_IDS = Object.fromEntries(
    CATEGORY_ORDER.map((key) => [key, CATEGORY_META[key].documentId]),
  );
  const PRIMARY_CATEGORIES = new Set(["national", "series", "ar", "pack"]);
  const THEME_CATEGORIES = new Set(["pokemon", "artist", "people", "trainerPokemon", "fossil", "world"]);
  const elements = {
    headerChip: document.querySelector(".header-chip"),
    activeCollections: document.querySelector("#dashboard-active-collections"),
    completeCollections: document.querySelector("#dashboard-complete-collections"),
    accountNote: document.querySelector("#dashboard-account-note"),
    loginCta: document.querySelector("#dashboard-login-cta"),
    primaryGrid: document.querySelector("#dashboard-primary-grid"),
    themeGrid: document.querySelector("#dashboard-theme-grid"),
    themeCount: document.querySelector("#dashboard-theme-count"),
    nearestList: document.querySelector("#dashboard-nearest-list"),
    nearestEmpty: document.querySelector("#dashboard-nearest-empty"),
    nearestCount: document.querySelector("#nearest-count"),
    recentList: document.querySelector("#dashboard-recent-list"),
    recentEmpty: document.querySelector("#dashboard-recent-empty"),
    error: document.querySelector("#dashboard-error"),
  };

  let firebase = null;
  let currentUser = null;
  let sharedViewActive = false;
  let catalogs = null;
  let documents = Object.fromEntries(CATEGORY_ORDER.map((key) => [key, null]));
  let collectionSettings = Object.fromEntries(
    CATEGORY_ORDER.map((key) => [
      key,
      window.CollectorCollectionRegistry?.defaultSetting?.(key) || {
        dashboardVisible: key !== "people",
      },
    ]),
  );
  let collectorProfile = null;
  let collectorPrompt = { exists: false, createdAt: null, dismissed: false };
  let documentReadFailed = false;
  let unsubscribeDocuments = [];

  function preserveLegacyNationalLinks() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("pokemon") || window.location.hash === "#national-dex") {
      const target = new URL("./national.html", window.location.href);
      target.search = window.location.search;
      window.location.replace(target.href);
      return true;
    }
    return false;
  }

  if (preserveLegacyNationalLinks()) return;

  function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function percentage(owned, total) {
    return total ? Number(((owned / total) * 100).toFixed(1)) : 0;
  }

  function isOwner(user) {
    return accountCore.isOwner(CONFIG, user);
  }

  function configured() {
    return accountCore.configured(CONFIG);
  }

  function createCategory(key, items, groups) {
    return {
      key,
      ...CATEGORY_META[key],
      items,
      groups,
      itemMap: new Map(items.map((item) => [item.key, item])),
    };
  }

  function cloneRegistryCatalog(category, catalog) {
    const items = (catalog?.items || []).map((item) => ({ ...item }));
    const groups = (catalog?.groups || []).map((group) => ({
      ...group,
      itemKeys: [...(group.itemKeys || [])],
    }));
    return createCategory(category, items, groups);
  }

  async function loadCatalogs() {
    const categories = CATEGORY_ORDER.filter(
      (category) => category !== "custom" && registry?.COLLECTIONS?.[category],
    );
    const entries = await Promise.all(
      categories.map(async (category) => [
        category,
        cloneRegistryCatalog(category, await registry.loadCatalog(category)),
      ]),
    );
    const loaded = Object.fromEntries(entries);
    if (CATEGORY_ORDER.includes("custom")) {
      loaded.custom = createCategory("custom", [], []);
    }
    return loaded;
  }

  function createAuthUi() {
    if (document.querySelector("#firebase-auth-panel")) return;

    const panel = document.createElement("div");
    panel.id = "firebase-auth-panel";
    panel.className = "firebase-auth-panel";
    panel.innerHTML = `
      <span class="firebase-auth-dot" aria-hidden="true"></span>
      <span id="firebase-auth-status">로그인 상태 확인 중</span>
      <button id="firebase-login" type="button">Google 로그인</button>
      <button id="firebase-logout" type="button" hidden>로그아웃</button>
    `;
    document.querySelector(".site-header")?.append(panel);
    panel.querySelector("#firebase-login")?.addEventListener("click", signIn);
    panel.querySelector("#firebase-logout")?.addEventListener("click", signOutUser);
    elements.loginCta?.addEventListener("click", signIn);
    updateAuthUi();
  }

  function updateAuthUi(error = null) {
    const panel = document.querySelector("#firebase-auth-panel");
    if (!panel) return;
    const status = panel.querySelector("#firebase-auth-status");
    const login = panel.querySelector("#firebase-login");
    const logout = panel.querySelector("#firebase-logout");
    const shared = window.PokemonDexSharedReadonly;
    sharedViewActive = Boolean(shared?.updateControl?.(currentUser));

    panel.classList.toggle("is-account", Boolean(currentUser));
    panel.classList.toggle("is-owner", isOwner(currentUser));
    if (elements.headerChip) {
      elements.headerChip.textContent = sharedViewActive
        ? "읽기 전용"
        : currentUser
          ? "로그인됨"
          : "공개 보기";
    }

    if (!configured()) {
      status.textContent = "Firebase 설정 필요 · 공개 도감";
      login.hidden = true;
      logout.hidden = true;
      return;
    }

    if (error) {
      status.textContent = "Firebase 연결 오류 · 공개 도감";
      login.hidden = false;
      logout.hidden = true;
      return;
    }

    if (!currentUser) {
      status.textContent = "방문자";
      login.hidden = false;
      logout.hidden = true;
      return;
    }

    status.textContent = sharedViewActive
      ? `${shared.buttonLabel()} · 읽기 전용`
      : currentUser.displayName || currentUser.email || "내 계정";
    login.hidden = true;
    logout.hidden = false;
  }

  function firstAuthUser(auth, authModule) {
    return accountCore.firstAuthUser(auth, authModule);
  }

  async function signIn() {
    if (!firebase) {
      alert("로그인 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    const login = document.querySelector("#firebase-login");
    if (login) {
      login.disabled = true;
      login.textContent = "로그인 중…";
    }
    const provider = new firebase.authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await firebase.authModule.signInWithPopup(firebase.auth, provider);
      window.location.reload();
    } catch (error) {
      if (login) {
        login.disabled = false;
        login.textContent = "Google 로그인";
      }
      if (error.code === "auth/popup-closed-by-user") return;

      let message = "Google 로그인에 실패했습니다.";
      if (error.code === "auth/popup-blocked") {
        message =
          "로그인 팝업이 차단되었습니다.\nChrome 또는 Safari에서 사이트를 직접 열고 다시 시도하세요.";
      } else if (error.code === "auth/unauthorized-domain") {
        message = `Firebase 승인 도메인에 ${window.location.hostname}가 등록되지 않았습니다.`;
      } else if (error.message) {
        message += `\n${error.message}`;
      }
      alert(message);
    }
  }

  async function signOutUser() {
    if (!firebase) return;
    window.PokemonDexSharedReadonly?.clear?.();
    await firebase.authModule.signOut(firebase.auth);
    window.location.reload();
  }

  async function initializeFirebase() {
    createAuthUi();
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

      try {
        await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      } catch (error) {
        console.warn("로그인 유지 설정에 실패했습니다.", error);
      }

      firebase = { auth, db, authModule, firestoreModule };
      currentUser = await firstAuthUser(auth, authModule);
      await window.PokemonDexSharedReadonly?.ensureOwnerShare?.(
        db,
        firestoreModule,
        currentUser,
      );
      updateAuthUi();
    } catch (error) {
      console.error("대시보드 Firebase 초기화 실패", error);
      updateAuthUi(error);
      elements.error.hidden = false;
    }
  }

  async function loadUserDocuments() {
    documents = Object.fromEntries(CATEGORY_ORDER.map((key) => [key, null]));
    collectionSettings = Object.fromEntries(
      CATEGORY_ORDER.map((key) => [
        key,
        window.CollectorCollectionRegistry?.defaultSetting?.(key) || {
          dashboardVisible: key !== "people",
        },
      ]),
    );
    collectorProfile = null;
    collectorPrompt = { exists: false, createdAt: null, dismissed: false };
    documentReadFailed = false;
    if (!currentUser || !firebase) return;

    if (sharedViewActive) {
      try {
        const ownerDocuments =
          await window.PokemonDexSharedReadonly.loadOwnerDocuments(
            firebase.db,
            firebase.firestoreModule,
          );
        documents = Object.fromEntries(
          CATEGORY_ORDER.map((category) => [
            category,
            ownerDocuments.get(DOCUMENT_IDS[category])?.data || null,
          ]),
        );
      } catch (error) {
        documentReadFailed = true;
        console.warn("읽기 전용 공유 도감을 불러오지 못했습니다.", error);
      }
      return;
    }

    const readsByDocument = new Map();
    const reads = CATEGORY_ORDER.map(async (category) => {
      const documentId = DOCUMENT_IDS[category];
      if (!readsByDocument.has(documentId)) {
        const reference = firebase.firestoreModule.doc(
          firebase.db,
          "users",
          currentUser.uid,
          CONFIG.userCollection || "collections",
          documentId,
        );
        readsByDocument.set(
          documentId,
          firebase.firestoreModule.getDoc(reference)
            .then((snapshot) => (
              snapshot.exists() ? snapshot.data() || {} : null
            ))
            .catch((error) => {
              documentReadFailed = true;
              console.warn(`${documentId} 문서를 읽지 못했습니다.`, error);
              return null;
            }),
        );
      }
      return [category, await readsByDocument.get(documentId)];
    });

    const settingReads = CATEGORY_ORDER.map(async (category) => {
      const reference = firebase.firestoreModule.doc(
        firebase.db,
        "users",
        currentUser.uid,
        "collectionSettings",
        category,
      );
      try {
        const snapshot = await firebase.firestoreModule.getDoc(reference);
        const source = snapshot.exists() ? snapshot.data() || {} : null;
        return [
          category,
          window.CollectorCollectionRegistry?.normalizeSetting?.(category, source)
            || collectionSettings[category],
        ];
      } catch (error) {
        console.warn(`${category} 대시보드 설정을 읽지 못했습니다.`, error);
        return [category, collectionSettings[category]];
      }
    });
    const profileRef = firebase.firestoreModule.doc(
      firebase.db,
      "users",
      currentUser.uid,
      "profile",
      "main",
    );
    const promptRef = firebase.firestoreModule.doc(
      firebase.db,
      "users",
      currentUser.uid,
      "settings",
      "collector",
    );
    const [documentEntries, settingEntries, profileSnapshot, promptSnapshot] =
      await Promise.all([
        Promise.all(reads),
        Promise.all(settingReads),
        firebase.firestoreModule.getDoc(profileRef).catch(() => null),
        firebase.firestoreModule.getDoc(promptRef).catch(() => null),
      ]);

    documents = Object.fromEntries(documentEntries);
    collectionSettings = Object.fromEntries(settingEntries);
    collectorProfile = profileSnapshot?.exists()
      ? profileSnapshot.data() || null
      : null;
    collectorPrompt = promptSnapshot?.exists()
      ? {
          exists: true,
          createdAt: promptSnapshot.data()?.createdAt || null,
          dismissed: Boolean(promptSnapshot.data()?.profilePromptDismissedAt),
        }
      : { exists: false, createdAt: null, dismissed: false };
    updateCollectorShortcut();
  }

  function subscribeToDocuments() {
    unsubscribeDocuments.forEach((unsubscribe) => unsubscribe());
    unsubscribeDocuments = [];
    if (!currentUser || !firebase || sharedViewActive) return;

    const categoriesByDocument = new Map();
    for (const category of CATEGORY_ORDER) {
      const documentId = DOCUMENT_IDS[category];
      if (!categoriesByDocument.has(documentId)) {
        categoriesByDocument.set(documentId, []);
      }
      categoriesByDocument.get(documentId).push(category);
    }

    for (const [documentId, categories] of categoriesByDocument) {
      const reference = firebase.firestoreModule.doc(
        firebase.db,
        "users",
        currentUser.uid,
        CONFIG.userCollection || "collections",
        documentId,
      );
      const unsubscribe = firebase.firestoreModule.onSnapshot(
        reference,
        (snapshot) => {
          const data = snapshot.exists() ? snapshot.data() || {} : null;
          categories.forEach((category) => {
            documents[category] = data;
          });
          if (catalogs) renderDashboard();
        },
        (error) => {
          documentReadFailed = true;
          console.warn(`${documentId} 실시간 업데이트 실패`, error);
        },
      );
      unsubscribeDocuments.push(unsubscribe);
    }

    for (const category of CATEGORY_ORDER) {
      const settingReference = firebase.firestoreModule.doc(
        firebase.db,
        "users",
        currentUser.uid,
        "collectionSettings",
        category,
      );
      const unsubscribeSetting = firebase.firestoreModule.onSnapshot(
        settingReference,
        (snapshot) => {
          collectionSettings[category] =
            window.CollectorCollectionRegistry?.normalizeSetting?.(
              category,
              snapshot.exists() ? snapshot.data() || {} : null,
            ) || collectionSettings[category];
          if (catalogs) renderDashboard();
        },
        (error) => {
          console.warn(`${category} 대시보드 설정 실시간 업데이트 실패`, error);
        },
      );
      unsubscribeDocuments.push(unsubscribeSetting);
    }
  }

  function overrideOwned(value) {
    if (typeof value === "boolean") return value;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return Boolean(value.owned);
  }

  function applyOwnership(category) {
    const document = documents[category] || {};

    if (category === "custom") {
      const ownership = registry?.customOwnership?.(document);
      if (!ownership?.catalog) {
        catalogs.custom = createCategory("custom", [], []);
        return;
      }
      const ownedKeys = new Set(ownership.ownedKeys || []);
      const items = ownership.catalog.items.map((item) => ({
        ...item,
        owned: ownedKeys.has(item.key),
      }));
      const groups = ownership.catalog.groups.map((group) => ({
        ...group,
        itemKeys: [...group.itemKeys],
      }));
      catalogs.custom = createCategory("custom", items, groups);
      return;
    }

    const catalog = catalogs[category];
    const fallbackMode = isOwner(currentUser) ? "legacy" : "empty";
    const baseMode = currentUser
      ? document.baseMode === "legacy"
        ? "legacy"
        : document.baseMode === "empty"
          ? "empty"
          : fallbackMode
      : "empty";

    if (category === "pack") {
      const sourceCodes = Array.isArray(document.ownedCodes)
        ? document.ownedCodes
        : baseMode === "legacy"
          ? catalog.items.filter((item) => item.baselineOwned).map((item) => item.key)
          : [];
      const ownedCodes = new Set(
        sourceCodes.map((code) => String(code).trim().toLowerCase()),
      );
      catalog.items.forEach((item) => {
        item.owned = ownedCodes.has(item.key.toLowerCase());
      });
      return;
    }

    if (category === "people") {
      const peopleOwned =
        document.peopleOwned &&
        typeof document.peopleOwned === "object" &&
        !Array.isArray(document.peopleOwned)
          ? document.peopleOwned
          : {};
      catalog.items.forEach((item) => {
        item.owned = peopleOwned[item.key] === true;
      });
      return;
    }

    const overrides =
      document.overrides &&
      typeof document.overrides === "object" &&
      !Array.isArray(document.overrides)
        ? document.overrides
        : {};

    catalog.items.forEach((item) => {
      const explicit = overrideOwned(overrides[item.key]);
      item.owned =
        explicit === null
          ? baseMode === "legacy" && item.baselineOwned
          : explicit;
    });
  }

  function getMetrics() {
    const categoryMetrics = {};
    const allGroups = [];
    let overallOwned = 0;
    let overallTotal = 0;

    const visibleCategories = CATEGORY_ORDER.filter(
      (category) => collectionSettings[category]?.dashboardVisible !== false,
    );

    for (const category of visibleCategories) {
      applyOwnership(category);
      const catalog = catalogs[category];
      const owned = catalog.items.filter((item) => item.owned).length;
      const canonicalTotal = Number(CATEGORY_META[category]?.catalogCount);
      const total =
        Number.isInteger(canonicalTotal) && canonicalTotal >= 0
          ? canonicalTotal
          : catalog.items.length;
      if (category !== "custom" && total !== catalog.items.length) {
        console.warn(
          `${category} 대시보드 분모가 카탈로그와 다릅니다: ${total} / ${catalog.items.length}`,
        );
      }
      const groups = catalog.groups.map((group) => {
        const groupItems = group.itemKeys
          .map((key) => catalog.itemMap.get(key))
          .filter(Boolean);
        const groupOwned = groupItems.filter((item) => item.owned).length;
        const groupTotal = groupItems.length;
        return {
          category,
          href: catalog.href,
          name: group.name,
          owned: groupOwned,
          total: groupTotal,
          missing: groupTotal - groupOwned,
          rate: percentage(groupOwned, groupTotal),
        };
      });

      categoryMetrics[category] = {
        ...catalog,
        owned,
        total,
        missing: total - owned,
        rate: percentage(owned, total),
        groups,
      };
      overallOwned += owned;
      overallTotal += total;
      allGroups.push(...groups);
    }

    return {
      categories: categoryMetrics,
      groups: allGroups,
      owned: overallOwned,
      total: overallTotal,
      missing: overallTotal - overallOwned,
      rate: percentage(overallOwned, overallTotal),
      completedGroups: allGroups.filter(
        (group) => group.total > 0 && group.owned === group.total,
      ).length,
      completedCollections: visibleCategories.filter((category) => {
        const metric = categoryMetrics[category];
        return metric && metric.total > 0 && metric.owned === metric.total;
      }).length,
      visibleCategories,
    };
  }

  function renderSummary(metrics) {
    if (elements.activeCollections) {
      elements.activeCollections.textContent = formatNumber(metrics.visibleCategories.length);
    }
    if (elements.completeCollections) {
      elements.completeCollections.textContent = formatNumber(metrics.completedCollections);
    }
  }

  function createCollectionCard(metric) {
    const link = document.createElement("a");
    link.className = "dashboard-collection-card";
    link.dataset.category = metric.key;
    link.href = metric.href;
    link.style.setProperty("--rate", metric.rate);
    link.setAttribute(
      "aria-label",
      `${metric.title} ${metric.owned}/${metric.total}${metric.unit}, ${metric.rate.toFixed(1)}%`,
    );
    link.innerHTML = `
      <div class="dashboard-card-top">
        <span class="dashboard-card-icon" aria-hidden="true">${metric.number}</span>
        <span class="dashboard-card-rate">${metric.rate.toFixed(1)}%</span>
      </div>
      <div class="dashboard-card-title">
        <strong>${escapeHtml(metric.title)}</strong>
      </div>
      <div class="dashboard-card-count">
        <strong>${formatNumber(metric.owned)}</strong>
        <span>/ ${formatNumber(metric.total)}${metric.unit}</span>
      </div>
      <div class="dashboard-card-progress" aria-hidden="true"><span></span></div>
    `;
    return link;
  }

  function renderCollections(metrics) {
    const primaryFragment = document.createDocumentFragment();
    const themeFragment = document.createDocumentFragment();
    let primaryCount = 0;
    let themeCount = 0;

    for (const category of metrics.visibleCategories) {
      const metric = metrics.categories[category];
      if (PRIMARY_CATEGORIES.has(category)) {
        primaryFragment.append(createCollectionCard(metric));
        primaryCount += 1;
      } else if (THEME_CATEGORIES.has(category)) {
        themeFragment.append(createCollectionCard(metric));
        themeCount += 1;
      }
    }

    if (!primaryCount) {
      const empty = document.createElement("div");
      empty.className = "dashboard-list-empty dashboard-list-empty--compact";
      empty.innerHTML =
        '표시할 주요 도감이 없습니다. <a href="./collector-settings.html">표시 설정</a>에서 선택해 주세요.';
      primaryFragment.append(empty);
    }

    elements.primaryGrid?.replaceChildren(primaryFragment);
    elements.themeGrid?.replaceChildren(themeFragment);
    elements.primaryGrid?.setAttribute("aria-busy", "false");
    elements.themeGrid?.setAttribute("aria-busy", "false");
    if (elements.themeCount) elements.themeCount.textContent = formatNumber(themeCount);
  }

  function renderNearest(metrics) {
    const nearest = metrics.groups
      .filter(
        (group) =>
          group.total > 0 &&
          group.owned > 0 &&
          group.missing > 0,
      )
      .sort(
        (a, b) =>
          a.missing - b.missing ||
          b.rate - a.rate ||
          b.total - a.total ||
          a.name.localeCompare(b.name, "ko-KR"),
      )
      .slice(0, 3);

    elements.nearestCount.textContent = `${nearest.length}개`;
    elements.nearestEmpty.hidden = nearest.length > 0;
    elements.nearestList.hidden = nearest.length === 0;

    const items = nearest.map((group, index) => {
      const item = document.createElement("li");
      item.className = "dashboard-ranking-item";
      item.innerHTML = `
        <a class="dashboard-ranking-link" href="${escapeHtml(group.href)}">
          <span class="dashboard-rank">${index + 1}</span>
          <span class="dashboard-list-copy">
            <span class="dashboard-list-title">${escapeHtml(group.name)}</span>
            <span class="dashboard-list-meta">${CATEGORY_META[group.category].title} · ${formatNumber(group.owned)}/${formatNumber(group.total)}</span>
          </span>
          <span class="dashboard-list-progress">
            <strong>${formatNumber(group.missing)}개 남음</strong>
            <span>${group.rate.toFixed(1)}%</span>
          </span>
        </a>
      `;
      return item;
    });
    elements.nearestList.replaceChildren(...items);
  }

  function timestampToDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatRelativeTime(date) {
    const elapsed = Date.now() - date.getTime();
    if (elapsed < 0) {
      return new Intl.DateTimeFormat("ko-KR", {
        month: "numeric",
        day: "numeric",
      }).format(date);
    }
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
    }).format(date);
  }

  function getRecentEntries() {
    if (!currentUser) return [];
    const entries = [];

    for (const category of CATEGORY_ORDER.filter(
      (key) => collectionSettings[key]?.dashboardVisible !== false,
    )) {
      const document = documents[category] || {};
      const catalog = catalogs[category];

      if (category === "pack") {
        const date = timestampToDate(document.updatedAt);
        if (date) {
          entries.push({
            category,
            name: "팩 수집 상태 업데이트",
            meta: `${Array.isArray(document.ownedCodes) ? document.ownedCodes.length : 0}팩 수집완료`,
            date,
          });
        }
        continue;
      }

      if (category === "custom") {
        const customDexes =
          document.customDexes &&
          typeof document.customDexes === "object" &&
          !Array.isArray(document.customDexes)
            ? Object.values(document.customDexes)
            : [];
        customDexes.forEach((dex) => {
          if (!dex || typeof dex !== "object" || Array.isArray(dex)) return;
          const date = timestampToDate(dex.updatedAt || document.updatedAt);
          if (!date) return;
          const cards = Array.isArray(dex.cards) ? dex.cards : [];
          const owned = cards.filter((card) => card?.owned === true).length;
          entries.push({
            category,
            name: String(dex.title || "나만의 도감").trim().slice(0, 60),
            meta: `${formatNumber(owned)}/${formatNumber(cards.length)}장 보유`,
            date,
          });
        });
        continue;
      }

      // peopleOwned에는 항목별 수정 시각이 없고 nationalDex.updatedAt을 함께
      // 사용하므로, 전국도감 변경을 인물도감 변경으로 잘못 표시하지 않습니다.
      if (category === "people") continue;

      const overrides =
        document.overrides &&
        typeof document.overrides === "object" &&
        !Array.isArray(document.overrides)
          ? document.overrides
          : {};

      for (const [key, value] of Object.entries(overrides)) {
        if (!value || typeof value !== "object") continue;
        const date = timestampToDate(value.updatedAt);
        if (!date) continue;
        const catalogItem = catalog.itemMap.get(key);
        entries.push({
          category,
          name: catalogItem?.name || "수집 상태 업데이트",
          meta: catalogItem?.group || CATEGORY_META[category].title,
          date,
        });
      }
    }

    return entries
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5);
  }

  function renderRecent() {
    const recent = getRecentEntries();
    elements.recentEmpty.hidden = recent.length > 0;
    elements.recentList.hidden = recent.length === 0;

    const items = recent.map((entry) => {
      const item = document.createElement("li");
      item.className = "dashboard-recent-item";
      item.innerHTML = `
        <span class="dashboard-recent-icon" aria-hidden="true">${CATEGORY_META[entry.category].number}</span>
        <span class="dashboard-list-copy">
          <span class="dashboard-list-title">${escapeHtml(entry.name)}</span>
          <span class="dashboard-list-meta">${escapeHtml(CATEGORY_META[entry.category].title)} · ${escapeHtml(entry.meta)}</span>
        </span>
        <time class="dashboard-recent-time" datetime="${entry.date.toISOString()}">${formatRelativeTime(entry.date)}</time>
      `;
      return item;
    });
    elements.recentList.replaceChildren(...items);
  }

  function updateCollectorShortcut() {
    const shortcut = document.querySelector("#collector-profile-shortcut");
    if (!shortcut) return;
    if (collectorProfile?.profileCompleted && collectorProfile.publicId) {
      shortcut.href = `./collector.html?id=${encodeURIComponent(collectorProfile.publicId)}`;
      shortcut.textContent = "내 공개 프로필";
    } else {
      shortcut.href = "./collector-settings.html#collector-profile-title";
      shortcut.textContent = "컬렉터 프로필";
    }
  }

  function closeOnboarding(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  async function dismissCollectorOnboarding(dialog) {
    closeOnboarding(dialog);
    if (!firebase || !currentUser) return;
    const reference = firebase.firestoreModule.doc(
      firebase.db,
      "users",
      currentUser.uid,
      "settings",
      "collector",
    );
    try {
      await firebase.firestoreModule.setDoc(reference, {
        schemaVersion: 1,
        profilePromptDismissedAt: firebase.firestoreModule.serverTimestamp(),
        createdAt: collectorPrompt.exists
          ? collectorPrompt.createdAt
          : firebase.firestoreModule.serverTimestamp(),
        updatedAt: firebase.firestoreModule.serverTimestamp(),
      });
      collectorPrompt.dismissed = true;
    } catch (error) {
      console.warn("컬렉터 프로필 안내 상태를 저장하지 못했습니다.", error);
    }
  }

  function maybePromptCollectorProfile() {
    if (
      !currentUser ||
      sharedViewActive ||
      collectorProfile?.profileCompleted ||
      collectorPrompt.dismissed ||
      document.querySelector("#collector-onboarding-dialog")
    ) {
      return;
    }

    const dialog = document.createElement("dialog");
    dialog.id = "collector-onboarding-dialog";
    dialog.className = "collector-onboarding-dialog";
    dialog.innerHTML = `
      <div class="collector-onboarding-shell">
        <span class="collector-onboarding-icon" aria-hidden="true">CP</span>
        <h2>컬렉터 프로필 만들기</h2>
        <p>Google 실명 대신 사용할 컬렉터 닉네임을 정하고, 원하는 도감만 다른 사람에게 공유할 수 있습니다.</p>
        <ul class="collector-onboarding-points">
          <li>기존 도감과 보유 기록은 그대로 유지됩니다.</li>
          <li>모든 도감의 공개 범위는 기본 나만 보기입니다.</li>
          <li>지금 만들지 않아도 기존 기능을 계속 사용할 수 있습니다.</li>
        </ul>
        <div class="collector-onboarding-actions">
          <button class="manager-button" type="button" data-onboarding-later>나중에</button>
          <a class="primary-button" href="./collector-settings.html#collector-profile-title">프로필 만들기</a>
        </div>
      </div>
    `;
    dialog.querySelector("[data-onboarding-later]").addEventListener("click", () => {
      void dismissCollectorOnboarding(dialog);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      void dismissCollectorOnboarding(dialog);
    });
    document.body.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderAccountNote() {
    if (!currentUser) {
      elements.accountNote.hidden = false;
      elements.accountNote.dataset.state = "";
      return;
    }

    if (documentReadFailed) {
      elements.accountNote.hidden = false;
      elements.accountNote.dataset.state = "warning";
      elements.accountNote.querySelector("strong").textContent =
        "일부 도감 기록을 읽지 못했습니다.";
      elements.accountNote.querySelector("p").textContent =
        "읽지 못한 도감은 계정의 기본 수집 상태로 표시됩니다.";
      elements.loginCta.hidden = true;
      return;
    }

    if (sharedViewActive) {
      elements.accountNote.hidden = false;
      elements.accountNote.dataset.state = "readonly";
      elements.accountNote.querySelector("strong").textContent =
        "공개 도감을 읽기 전용으로 보고 있습니다.";
      elements.accountNote.querySelector("p").textContent =
        "수집 현황은 확인할 수 있지만 카드 상태를 수정하거나 동기화할 수 없습니다.";
      elements.loginCta.hidden = true;
      return;
    }

    elements.accountNote.hidden = true;
  }

  function initializeThemeDisclosure() {
    const section = document.querySelector("#dashboard-theme-section");
    if (!section) return;

    const storageKey = "digitalCardBinderDashboardThemeOpenV1";
    let stored = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {}

    if (stored === "open") {
      section.open = true;
    } else if (stored === "closed") {
      section.open = false;
    } else {
      section.open = window.matchMedia("(min-width: 761px)").matches;
    }

    section.addEventListener("toggle", () => {
      try {
        window.localStorage.setItem(storageKey, section.open ? "open" : "closed");
      } catch {}
    });
  }

  function renderDashboard() {
    if (!catalogs) return;
    const metrics = getMetrics();
    renderSummary(metrics);
    renderCollections(metrics);
    renderNearest(metrics);
    renderRecent();
    renderAccountNote();
  }

  async function initialize() {
    createAuthUi();
    initializeThemeDisclosure();

    try {
      const [loadedCatalogs] = await Promise.all([
        loadCatalogs(),
        initializeFirebase(),
      ]);
      catalogs = loadedCatalogs;
      await loadUserDocuments();
      renderDashboard();
      subscribeToDocuments();
      maybePromptCollectorProfile();
    } catch (error) {
      console.error("통합 대시보드 초기화 실패", error);
      elements.error.hidden = false;
      if (catalogs) renderDashboard();
    }
  }

  initialize();
})();
