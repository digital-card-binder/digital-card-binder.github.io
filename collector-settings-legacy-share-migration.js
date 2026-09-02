"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const registry = window.CollectorCollectionRegistry;
  const saveButton = document.querySelector("#collector-settings-save");
  const statusElement = document.querySelector("#collector-settings-status");
  const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;

  if (
    !saveButton ||
    !registry ||
    !CONFIG.enabled ||
    !CONFIG.config?.projectId
  ) {
    return;
  }

  let firebase = null;
  let currentUser = null;
  let legacySettings = new Map();
  let bypassSave = false;

  function setStatus(message, state = "") {
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.dataset.state = state;
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

  function normalizedLegacySetting(collectionId, snapshot) {
    if (!snapshot.exists()) return null;
    const data = snapshot.data() || {};
    if (
      data.visibility !== "unlisted" ||
      !SHARE_ID_PATTERN.test(String(data.shareId || "")) ||
      !data.createdAt
    ) {
      return null;
    }
    return {
      collectionId,
      shareId: data.shareId,
      schemaVersion: data.schemaVersion === 1 ? 1 : 1,
      dashboardVisible:
        typeof data.dashboardVisible === "boolean"
          ? data.dashboardVisible
          : Boolean(registry.COLLECTIONS[collectionId]?.defaultDashboardVisible),
      displayOrder: Number.isInteger(data.displayOrder)
        ? data.displayOrder
        : Math.max(0, registry.COLLECTION_ORDER.indexOf(collectionId)),
      createdAt: data.createdAt,
    };
  }

  async function loadLegacySettings() {
    if (!firebase || !currentUser) return;
    const reads = await Promise.all(
      registry.COLLECTION_ORDER.map(async (collectionId) => {
        const reference = firebase.firestoreModule.doc(
          firebase.db,
          "users",
          currentUser.uid,
          "collectionSettings",
          collectionId,
        );
        const snapshot = await firebase.firestoreModule.getDoc(reference);
        const legacy = normalizedLegacySetting(collectionId, snapshot);
        return legacy ? [collectionId, legacy] : null;
      }),
    );
    legacySettings = new Map(reads.filter(Boolean));
  }

  const ready = (async () => {
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
      currentUser = await firstAuthUser(auth, authModule);
      if (!currentUser) return;
      firebase = {
        db: firestoreModule.getFirestore(app),
        firestoreModule,
      };
      await loadLegacySettings();
    } catch (error) {
      console.warn("기존 링크 공개 설정 확인을 건너뜁니다.", error);
    }
  })();

  async function revokeLegacyShares(collectionIds) {
    if (!firebase || !currentUser) return false;
    const legacy = collectionIds
      .map((collectionId) => legacySettings.get(collectionId))
      .filter(Boolean);
    if (!legacy.length) return false;

    const batch = firebase.firestoreModule.writeBatch(firebase.db);
    legacy.forEach((setting) => {
      const settingReference = firebase.firestoreModule.doc(
        firebase.db,
        "users",
        currentUser.uid,
        "collectionSettings",
        setting.collectionId,
      );
      batch.set(settingReference, {
        schemaVersion: 1,
        collectionId: setting.collectionId,
        dashboardVisible: setting.dashboardVisible,
        visibility: "private",
        displayOrder: setting.displayOrder,
        shareId: "",
        createdAt: setting.createdAt,
        updatedAt: firebase.firestoreModule.serverTimestamp(),
      });
      batch.delete(
        firebase.firestoreModule.doc(
          firebase.db,
          "sharedCollections",
          setting.shareId,
        ),
      );
      batch.delete(
        firebase.firestoreModule.doc(
          firebase.db,
          "collectorShareOwners",
          setting.shareId,
        ),
      );
    });
    await batch.commit();
    legacy.forEach((setting) => legacySettings.delete(setting.collectionId));
    return true;
  }

  saveButton.addEventListener(
    "click",
    async (event) => {
      if (bypassSave) return;
      const dirtyCards = [
        ...document.querySelectorAll(
          "#collector-settings-grid .collector-setting-card.is-dirty",
        ),
      ];
      if (!dirtyCards.length) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      saveButton.disabled = true;

      try {
        await ready;
        const collectionIds = dirtyCards
          .map((card) => card.dataset.collectionId || "")
          .filter(Boolean);
        const migrated = await revokeLegacyShares(collectionIds);
        if (migrated) {
          setStatus(
            "기존 링크 공개 설정을 정리했습니다. 변경사항을 저장합니다…",
            "loading",
          );
        }

        bypassSave = true;
        saveButton.disabled = false;
        saveButton.click();
      } catch (error) {
        console.error("기존 링크 공개 설정 정리 실패", error);
        saveButton.disabled = false;
        setStatus(
          error.message || "기존 링크 공개 설정을 정리하지 못했습니다.",
          "error",
        );
      } finally {
        bypassSave = false;
      }
    },
    true,
  );
})();
