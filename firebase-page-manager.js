"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const registry = window.CollectorCollectionRegistry;
  const accountCore = window.DigitalCardBinder?.firebaseAccount;
  const identityService = window.DigitalCardBinder?.cardIdentity;
  if (!registry || !accountCore || !identityService) {
    throw new Error("공통 도감 코어를 불러오지 못했습니다.");
  }

  const mode = document.body?.dataset.catalog || "";
  const page = registry.COLLECTIONS?.[mode];
  if (!page?.documentId) return;

  let firebase = null;
  let currentUser = null;
  let userDocumentRef = null;
  let accountProfile = { baseMode: "empty" };
  let remoteOverrides = {};
  let resolvedOverrides = {};
  let sharedViewActive = false;
  let collectorPublicViewActive = false;
  let saveQueue = Promise.resolve();
  let largeCatalogPublicSyncTimer = null;
  let largeCatalogPublicSyncRunning = false;
  let largeCatalogPublicSyncRevision = 0;
  let largeCatalogPublicSyncRetryCount = 0;
  let largeCatalogPublicSyncNeedsFull = false;
  const largeCatalogPublicSyncChanges = new Map();
  const PUBLIC_SYNC_REPAIR_VERSION = "20261110";
  let resolveReady;

  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  function isOwnerAccount(user) {
    return accountCore.isOwner(CONFIG, user);
  }

  function configured() {
    return accountCore.configured(CONFIG, { requireOwnerEmail: true });
  }

  const SERIES_PRINT_VARIANTS = new Set(["normal", "holo", "mirror", "other"]);

  function normalizePrintVariants(value, owned = false) {
    const variants = Array.isArray(value)
      ? [...new Set(
          value
            .map((item) => String(item || "").trim().toLowerCase())
            .filter((item) => SERIES_PRINT_VARIANTS.has(item)),
        )]
      : [];
    return variants.length ? variants : owned ? ["normal"] : [];
  }

  function normalizeOverride(value) {
    if (typeof value === "boolean") {
      const item = { owned: value };
      if (mode === "series") {
        item.printVariants = normalizePrintVariants([], value);
      }
      return item;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const owned = Boolean(value.owned);
    const item = {
      owned,
      setCode: String(value.setCode || "").trim(),
      cardNumber: String(value.cardNumber || "").trim(),
      cardName: String(value.cardName || "").trim(),
      imageUrl: String(value.imageUrl || "").trim(),
      updatedAt: value.updatedAt || null,
      updatedBy: String(value.updatedBy || "").trim(),
    };
    if (mode === "series") {
      item.printVariants = normalizePrintVariants(value.printVariants, owned);
    }
    return item;
  }

  function sanitizeOverrides(source) {
    const cleaned = {};
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return cleaned;
    }

    for (const [key, value] of Object.entries(source)) {
      const item = normalizeOverride(value);
      if (key && item) cleaned[key] = item;
    }
    return cleaned;
  }

  function groupIdentity(group, groupIndex) {
    return identityService.groupIdentity(group, groupIndex);
  }

  function cardIdentity(group, card, groupIndex, cardIndex) {
    return identityService.cardIdentity(
      mode,
      group,
      card,
      groupIndex,
      cardIndex,
    );
  }

  function resolvePageOverrides(groups) {
    if (typeof registry.resolveOverrides !== "function") {
      return { effectiveOverrides: remoteOverrides };
    }

    const itemMap = new Map();
    const compatibilityMap = new Map();

    groups.forEach((group, groupIndex) => {
      (group.cards || []).forEach((card, cardIndex) => {
        const key = cardIdentity(group, card, groupIndex, cardIndex);
        itemMap.set(key, { key });
        for (const compatibilityKey of identityService.cardCompatibilityKeys(
          mode,
          group,
          card,
          groupIndex,
          cardIndex,
        )) {
          if (!compatibilityMap.has(compatibilityKey)) {
            compatibilityMap.set(compatibilityKey, new Set());
          }
          compatibilityMap.get(compatibilityKey).add(key);
        }
      });
    });

    return registry.resolveOverrides(
      mode,
      { itemMap, compatibilityMap },
      remoteOverrides,
    );
  }

  function applyGroups(groups) {
    const useLegacy = Boolean(
      currentUser && accountProfile.baseMode === "legacy",
    );
    resolvedOverrides = resolvePageOverrides(groups).effectiveOverrides;

    groups.forEach((group, groupIndex) => {
      (group.cards || []).forEach((card, cardIndex) => {
        if (!Object.prototype.hasOwnProperty.call(card, "legacyOwned")) {
          card.legacyOwned = Boolean(card.owned);
        }
        if (!Object.prototype.hasOwnProperty.call(card, "originalImage")) {
          card.originalImage = card.image || "";
        }

        const key = cardIdentity(group, card, groupIndex, cardIndex);
        const override = normalizeOverride(resolvedOverrides[key]);
        card.hasAccountOverride = Boolean(override);
        card.owned = override ? override.owned : useLegacy && card.legacyOwned;
        card.printVariants =
          mode === "series"
            ? normalizePrintVariants(override?.printVariants, card.owned)
            : [];
        card.accountKey = key;
        const usesFixedSeriesCard = mode === "series" || mode === "ar";
        const usesOwnedCardDetails =
          !usesFixedSeriesCard && (Boolean(override?.owned) || mode === "world");
        card.actualSetCode = !usesOwnedCardDetails
          ? ""
          : override?.setCode || "";
        card.actualCardNumber = !usesOwnedCardDetails
          ? ""
          : override?.cardNumber || "";
        card.actualName = usesOwnedCardDetails ? override?.cardName || "" : "";
        card.actualImage = usesOwnedCardDetails ? override?.imageUrl || "" : "";
        card.image = usesFixedSeriesCard
          ? card.originalImage
          : card.actualImage || card.originalImage;
      });
    });

    return groups;
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
    updateAuthUi();
  }

  function updateAuthUi(error) {
    const panel = document.querySelector("#firebase-auth-panel");
    if (!panel) return;

    const status = panel.querySelector("#firebase-auth-status");
    const login = panel.querySelector("#firebase-login");
    const logout = panel.querySelector("#firebase-logout");
    const headerChip = document.querySelector(".header-chip");
    const shared = window.PokemonDexSharedReadonly;
    sharedViewActive = collectorPublicViewActive
      || Boolean(shared?.updateControl?.(currentUser));

    panel.classList.toggle("is-account", Boolean(currentUser));
    panel.classList.toggle("is-owner", isOwnerAccount(currentUser));
    if (headerChip) {
      headerChip.textContent = sharedViewActive
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

    if (collectorPublicViewActive) {
      status.textContent = window.CollectorPublicView?.authLabel?.("공개 도감 · 읽기 전용")
        || "공개 도감 · 읽기 전용";
      login.hidden = true;
      logout.hidden = true;
      return;
    }

    if (!currentUser) {
      status.textContent = "방문자";
      login.hidden = false;
      logout.hidden = true;
      return;
    }

    const name = currentUser.displayName || currentUser.email || "내 계정";
    if (sharedViewActive) {
      status.textContent = `${shared.buttonLabel()} · 읽기 전용`;
      login.hidden = true;
      logout.hidden = false;
      return;
    }

    const startLabel =
      accountProfile.baseMode === "legacy"
        ? "기존 도감 유지"
        : "0장부터 시작";
    status.textContent = `${name} · ${startLabel}`;
    login.hidden = true;
    logout.hidden = false;
  }

  function firstAuthUser(auth, authModule) {
    return accountCore.firstAuthUser(auth, authModule);
  }

  async function loadAccountDocument(user, options = {}) {
    const fallbackMode = isOwnerAccount(user) ? "legacy" : "empty";
    accountProfile = { baseMode: fallbackMode };
    remoteOverrides = {};
    userDocumentRef = null;

    const shared = window.PokemonDexSharedReadonly;
    await shared?.ensureOwnerShare?.(
      firebase.db,
      firebase.firestoreModule,
      user,
    );
    sharedViewActive = Boolean(shared?.isActive?.(user));

    if (sharedViewActive) {
      accountProfile = { baseMode: "legacy" };
      try {
        const ownerDocument = await shared.loadOwnerDocument(
          firebase.db,
          firebase.firestoreModule,
          page.documentId,
        );
        if (!ownerDocument) {
          throw new Error(`${page.documentId} 공유 문서를 찾지 못했습니다.`);
        }
        const data = ownerDocument.data || {};
        accountProfile = {
          baseMode: data.baseMode === "legacy" ? "legacy" : "empty",
        };
        remoteOverrides = sanitizeOverrides(data.overrides || {});
      } catch (error) {
        console.warn(
          `${page.documentId} 읽기 전용 공유 데이터를 불러오지 못했습니다.`,
          error,
        );
      }
      return;
    }

    const { db, firestoreModule } = firebase;
    const documentRef = accountCore.documentRef(
      firestoreModule,
      db,
      user,
      CONFIG,
      page.documentId,
    );
    userDocumentRef = documentRef;

    try {
      const snapshot = await accountCore.readCollectionSnapshot(firestoreModule, documentRef, options);
      if (snapshot.exists()) {
        const data = snapshot.data() || {};
        accountProfile = {
          baseMode: data.baseMode === "legacy" ? "legacy" : "empty",
        };
        remoteOverrides = sanitizeOverrides(data.overrides || {});
        return;
      }

      await firestoreModule.setDoc(documentRef, {
        baseMode: fallbackMode,
        email: user.email || "",
        displayName: user.displayName || "",
        overrides: {},
        createdAt: firestoreModule.serverTimestamp(),
        updatedAt: firestoreModule.serverTimestamp(),
      });
    } catch (error) {
      console.warn(
        `${page.documentId} 계정 데이터를 불러오지 못해 기본 상태로 표시합니다.`,
        error,
      );
    }
  }

  async function initializeFirebase() {
    createAuthUi();

    if (!configured()) {
      updateAuthUi();
      resolveReady();
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
        await authModule.setPersistence(
          auth,
          authModule.browserLocalPersistence,
        );
      } catch (error) {
        console.warn("로그인 유지 설정에 실패했습니다.", error);
      }

      firebase = { auth, db, authModule, firestoreModule };
      currentUser = await firstAuthUser(auth, authModule);
      if (window.CollectorPublicView?.requested) {
        collectorPublicViewActive = true;
        sharedViewActive = true;
        accountProfile = { baseMode: "empty" };
        userDocumentRef = null;
        try {
          const context = await window.CollectorPublicView.loadProjection(
            db,
            firestoreModule,
            mode,
          );
          remoteOverrides = window.CollectorPublicView.projectionOverrides(
            context.projection,
          );
        } catch (error) {
          remoteOverrides = {};
          window.CollectorPublicView.showAccessError(error);
          console.warn("공개 도감을 불러오지 못했습니다.", error);
        }
      } else if (currentUser) {
        await loadAccountDocument(currentUser);
        repairLargeCatalogPublicSync();
      }
      updateAuthUi();
      resolveReady();
    } catch (error) {
      console.error("Firebase 초기화에 실패했습니다.", error);
      updateAuthUi(error);
      resolveReady();
    }
  }

  async function signIn() {
    if (!firebase) return;

    const { auth, authModule } = firebase;
    const login = document.querySelector("#firebase-login");
    if (login) {
      login.disabled = true;
      login.textContent = "로그인 중…";
    }

    const provider = new authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await authModule.signInWithPopup(auth, provider);
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
          "로그인 팝업이 차단되었습니다.\n팝업을 허용한 뒤 다시 시도하세요.";
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

  function canEdit() {
    return Boolean(
      currentUser &&
        firebase &&
        userDocumentRef &&
        !sharedViewActive,
    );
  }

  async function refreshAccountData() {
    if (
      !currentUser ||
      !firebase ||
      sharedViewActive ||
      collectorPublicViewActive
    ) {
      return false;
    }
    await loadAccountDocument(currentUser, { preferServer: true });
    updateAuthUi();
    return true;
  }

  async function readCollectionDocument(documentId) {
    const id = String(documentId || "").trim();
    if (
      !id ||
      !currentUser ||
      !firebase ||
      sharedViewActive ||
      collectorPublicViewActive
    ) {
      return null;
    }

    const { db, firestoreModule } = firebase;
    const ref = accountCore.documentRef(
      firestoreModule,
      db,
      currentUser,
      CONFIG,
      id,
    );

    try {
      const snapshot = await accountCore.readCollectionSnapshot(firestoreModule, ref, { preferServer: true });
      return snapshot.exists() ? snapshot.data() || {} : {};
    } catch (error) {
      console.warn(`${id} 도감 데이터를 읽지 못했습니다.`, error);
      return null;
    }
  }

  function notifyOwnerSheets(key) {
    window.dispatchEvent(
      new CustomEvent("pokemon-dex:collection-changed", {
        detail: {
          category: mode,
          key: String(key || ""),
        },
      }),
    );
  }

  function publicSyncStorageKey(suffix) {
    return `dcb-public-sync-v2:${currentUser?.uid || ""}:${mode}:${suffix}`;
  }

  function publicSyncStored(suffix) {
    try {
      return window.localStorage.getItem(publicSyncStorageKey(suffix));
    } catch {
      return null;
    }
  }

  function publicSyncStore(suffix, value) {
    try {
      if (value === null) {
        window.localStorage.removeItem(publicSyncStorageKey(suffix));
      } else {
        window.localStorage.setItem(publicSyncStorageKey(suffix), value);
      }
    } catch {
      // Private-mode browsers may disable localStorage; in-page retries still work.
    }
  }

  function showPublicSyncIssue(visible) {
    let notice = document.querySelector("#public-series-sync-issue");
    if (!notice && visible) {
      notice = document.createElement("p");
      notice.id = "public-series-sync-issue";
      notice.className = "catalog-caption";
      notice.setAttribute("role", "status");
      const label = document.createElement("span");
      label.className = "public-sync-error-message";
      label.textContent = "커뮤니티 공개 반영 실패. ";
      notice.append(label);
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "다시 시도";
      retry.addEventListener("click", () => queueLargeCatalogPublicSync());
      notice.append(retry);
      (document.querySelector(".catalog-toolbar") || document.querySelector(".hero-content"))?.append(notice);
    }
    if (notice) {
      if (visible) {
        const code = String(arguments[1]?.code || "");
        const messages = {
          "permission-denied": "공개 데이터 저장 권한이 거부되었습니다.",
          "resource-exhausted": "서버 요청 한도를 초과했습니다.",
          "unavailable": "서버에 연결하지 못했습니다.",
          "deadline-exceeded": "서버 응답 시간이 초과되었습니다.",
          "failed-precondition": "공개 데이터 저장 조건을 확인해야 합니다.",
        };
        notice.querySelector(".public-sync-error-message").textContent =
          (messages[code] || "커뮤니티 공개 반영에 실패했습니다.") +
          (code ? " (" + code + ")" : "") + " ";
      }
      notice.hidden = !visible;
    }
  }

  function scheduleLargeCatalogPublicSync(delay = 750) {
    if (largeCatalogPublicSyncTimer !== null) {
      window.clearTimeout(largeCatalogPublicSyncTimer);
    }
    largeCatalogPublicSyncTimer = window.setTimeout(() => {
      largeCatalogPublicSyncTimer = null;
      void flushLargeCatalogPublicSync();
    }, delay);
  }

  async function flushLargeCatalogPublicSync() {
    if (largeCatalogPublicSyncRunning || !firebase || !currentUser) return;
    const fullSync = window.CollectorPublicSync?.syncCollectionWithRetry;
    const deltaSync = window.CollectorPublicSync?.syncCollectionChangesWithRetry;
    if (typeof fullSync !== "function") return;
    largeCatalogPublicSyncRunning = true;
    const requestedRevision = largeCatalogPublicSyncRevision;
    const changes = [...largeCatalogPublicSyncChanges].map(([key, owned]) => ({ key, owned }));
    largeCatalogPublicSyncChanges.clear();
    // Even when a previous full repair failed, publish the newly saved keys
    // through the independent transaction path instead of repeating its failure.
    const useFullSync = !changes.length || typeof deltaSync !== "function";
    let failed = false;
    try {
      await saveQueue;
      const result = await (useFullSync ? fullSync : deltaSync)({
        db: firebase.db,
        firestoreModule: firebase.firestoreModule,
        user: currentUser,
        collectionId: mode,
        ...(useFullSync ? { preferServer: true } : { changes }),
      });
      if (!result?.synced && result?.visibility !== "private") {
        throw new Error("공개 도감 저장 결과를 확인하지 못했습니다.");
      }
      largeCatalogPublicSyncRetryCount = 0;
      showPublicSyncIssue(false);
      if (requestedRevision === largeCatalogPublicSyncRevision) {
        if (useFullSync) largeCatalogPublicSyncNeedsFull = false;
        if (!largeCatalogPublicSyncNeedsFull) {
          publicSyncStore("dirty", null);
          publicSyncStore("repair", PUBLIC_SYNC_REPAIR_VERSION);
        }
        // A successful delta must not falsely certify an older failed full
        // repair: the dirty flag remains for an explicit or future recheck.
      }
    } catch (error) {
      failed = true;
      largeCatalogPublicSyncRetryCount += 1;
      console.warn(`${page.documentId} 공개 도감 자동 반영 실패`, error);
      showPublicSyncIssue(true, error);
    } finally {
      if (failed && !useFullSync) {
        for (const change of changes) {
          if (!largeCatalogPublicSyncChanges.has(change.key)) {
            largeCatalogPublicSyncChanges.set(change.key, change.owned);
          }
        }
      }
      largeCatalogPublicSyncRunning = false;
      if (requestedRevision !== largeCatalogPublicSyncRevision) {
        scheduleLargeCatalogPublicSync();
      } else if (failed && largeCatalogPublicSyncRetryCount <= 3) {
        scheduleLargeCatalogPublicSync(
          [0, 3000, 10000, 30000][largeCatalogPublicSyncRetryCount],
        );
      }
    }
  }

  function queueLargeCatalogPublicSync(change = null) {
    if ((mode !== "series" && mode !== "ar") || !firebase || !currentUser) return;
    if (change && typeof change.key === "string" && typeof change.owned === "boolean") {
      largeCatalogPublicSyncChanges.set(change.key, change.owned);
    } else {
      largeCatalogPublicSyncNeedsFull = true;
    }
    largeCatalogPublicSyncRevision += 1;
    publicSyncStore("dirty", "1");
    scheduleLargeCatalogPublicSync();
  }

  function repairLargeCatalogPublicSync() {
    if (mode !== "series" || !currentUser || sharedViewActive || collectorPublicViewActive) {
      return;
    }
    if (publicSyncStored("dirty") || publicSyncStored("repair") !== PUBLIC_SYNC_REPAIR_VERSION) {
      // One-time repair for older unsynced public series plus interrupted updates.
      queueLargeCatalogPublicSync();
    }
  }

  async function saveOverride(key, value, options = {}) {
    if (!canEdit()) {
      throw new Error("Google 로그인 후 내 도감을 수정할 수 있습니다.");
    }

    const item = normalizeOverride(value);
    if (!key || !item) {
      throw new Error("저장할 카드 정보가 올바르지 않습니다.");
    }

    const operation = async () => {
      const savedItem = {
        ...item,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email || currentUser.uid,
      };
      const nextOverrides = {
        ...remoteOverrides,
        [key]: savedItem,
      };
      const isLargeFixedCatalog = mode === "series" || mode === "ar";
      const backgroundPublicSync =
        mode === "series" || Boolean(options.backgroundPublicSync);

      if (isLargeFixedCatalog) {
        await accountCore.writeOverrideEntry(firebase.firestoreModule, userDocumentRef, key, savedItem);
      } else {
        await firebase.firestoreModule.setDoc(
          userDocumentRef,
          {
            baseMode: accountProfile.baseMode,
            email: currentUser.email || "",
            displayName: currentUser.displayName || "",
            overrides: nextOverrides,
            updatedAt: firebase.firestoreModule.serverTimestamp(),
          },
          { merge: true },
        );
      }

      remoteOverrides = nextOverrides;
      resolvedOverrides = {
        ...resolvedOverrides,
        [key]: savedItem,
      };
      notifyOwnerSheets(key);
      if (isLargeFixedCatalog && backgroundPublicSync) {
        queueLargeCatalogPublicSync({ key, owned: Boolean(savedItem.owned) });
      } else {
        try {
          await window.CollectorPublicSync?.syncCollectionWithRetry?.({
            db: firebase.db,
            firestoreModule: firebase.firestoreModule,
            user: currentUser,
            collectionId: mode,
          });
        } catch (error) {
          console.warn(`${page.documentId} 공개 projection 갱신 실패`, error);
        }
      }
      return remoteOverrides[key];
    };

    const queued = saveQueue.then(operation, operation);
    saveQueue = queued.catch(() => undefined);
    return queued;
  }

  async function saveOwned(key, owned) {
    const current =
      normalizeOverride(remoteOverrides[key]) ||
      normalizeOverride(resolvedOverrides[key]) ||
      {};
    const nextOwned = Boolean(owned);
    return saveOverride(
      key,
      {
        ...current,
        owned: nextOwned,
        ...(mode === "series"
          ? {
              printVariants: nextOwned
                ? normalizePrintVariants(current.printVariants, true)
                : [],
            }
          : {}),
      },
      { backgroundPublicSync: mode === "ar" },
    );
  }

  window.PokemonDexPageAccount = {
    ready,
    applyGroups,
    canEdit,
    readCollectionDocument,
    refreshAccountData,
    saveOverride,
    saveOwned,
    get currentUser() {
      return currentUser;
    },
    get baseMode() {
      return accountProfile.baseMode;
    },
    get readOnly() {
      return sharedViewActive;
    },
  };

  initializeFirebase();
})();
