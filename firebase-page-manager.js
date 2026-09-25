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
  let largeCatalogPublicSyncQueue = Promise.resolve();
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

  function normalizeOverride(value) {
    if (typeof value === "boolean") return { owned: value };
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return {
      owned: Boolean(value.owned),
      setCode: String(value.setCode || "").trim(),
      cardNumber: String(value.cardNumber || "").trim(),
      cardName: String(value.cardName || "").trim(),
      imageUrl: String(value.imageUrl || "").trim(),
      updatedAt: value.updatedAt || null,
      updatedBy: String(value.updatedBy || "").trim(),
    };
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
        card.owned = override ? override.owned : useLegacy && card.legacyOwned;
        card.accountKey = key;
        const usesFixedSeriesCard = mode === "series" || mode === "ar";
        const usesOwnedCardDetails =
          !usesFixedSeriesCard && Boolean(override?.owned);
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
      let snapshot;
      if (options.preferServer && typeof firestoreModule.getDocFromServer === "function") {
        try {
          snapshot = await firestoreModule.getDocFromServer(documentRef);
        } catch (error) {
          console.warn(`${page.documentId} 서버 보유상태 확인 실패, 로컬 상태로 대체합니다.`, error);
        }
      }
      if (!snapshot) snapshot = await firestoreModule.getDoc(documentRef);
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
      let snapshot;
      if (typeof firestoreModule.getDocFromServer === "function") {
        try {
          snapshot = await firestoreModule.getDocFromServer(ref);
        } catch (error) {
          console.warn(`${id} 서버 조회 실패, 로컬 캐시로 대체합니다.`, error);
        }
      }
      if (!snapshot) snapshot = await firestoreModule.getDoc(ref);
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

  function queueLargeCatalogPublicSync() {
    const sync = window.CollectorPublicSync?.syncCollectionWithRetry;
    if (typeof sync !== "function" || !firebase || !currentUser) return;

    const operation = async () => {
      try {
        await sync({
          db: firebase.db,
          firestoreModule: firebase.firestoreModule,
          user: currentUser,
          collectionId: mode,
        });
      } catch (error) {
        console.warn(`${page.documentId} 공개 projection 갱신 실패`, error);
      }
    };

    const queued = largeCatalogPublicSyncQueue.then(operation, operation);
    largeCatalogPublicSyncQueue = queued.catch(() => undefined);
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
        const { firestoreModule } = firebase;
        try {
          await firestoreModule.updateDoc(
            userDocumentRef,
            new firestoreModule.FieldPath("overrides", key),
            savedItem,
            "baseMode",
            accountProfile.baseMode,
            "email",
            currentUser.email || "",
            "displayName",
            currentUser.displayName || "",
            "updatedAt",
            firestoreModule.serverTimestamp(),
          );
        } catch (error) {
          if (error?.code !== "not-found") throw error;
          await firestoreModule.setDoc(
            userDocumentRef,
            {
              baseMode: accountProfile.baseMode,
              email: currentUser.email || "",
              displayName: currentUser.displayName || "",
              overrides: nextOverrides,
              updatedAt: firestoreModule.serverTimestamp(),
            },
            { merge: true },
          );
        }
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
        queueLargeCatalogPublicSync();
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
    return saveOverride(
      key,
      {
        ...current,
        owned: Boolean(owned),
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
