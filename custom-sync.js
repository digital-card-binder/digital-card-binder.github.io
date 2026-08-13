"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const sync = window.CollectorPublicSync;
  const registry = window.CollectorCollectionRegistry;
  if (!sync || !registry?.supportedCollectionId?.("custom")) return;

  let firebase = null;
  let user = null;
  let setting = null;
  let syncTimer = 0;
  let syncing = false;

  async function loadContext() {
    const settingSnapshot = await firebase.firestoreModule.getDoc(
      sync.settingRef(firebase.firestoreModule, firebase.db, user.uid, "custom"),
    );
    setting = registry.normalizeSetting(
      "custom",
      settingSnapshot.exists() ? settingSnapshot.data() || {} : null,
    );
  }

  async function syncNow() {
    if (!firebase || !user || !setting || setting.visibility !== "public" || syncing) return;
    syncing = true;
    try {
      await sync.syncCollectionWithRetry({
        db: firebase.db,
        firestoreModule: firebase.firestoreModule,
        user,
        collectionId: "custom",
      });
      await loadContext();
    } catch (error) {
      console.warn("나만의 도감 공개 projection 갱신 실패", error);
    } finally {
      syncing = false;
    }
  }

  function scheduleSync() {
    if (!setting || setting.visibility !== "public") return;
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => void syncNow(), 1200);
  }

  async function firstUser(auth, authModule) {
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
      return auth.currentUser || null;
    }
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(auth, (next) => {
        unsubscribe();
        resolve(next || null);
      }, reject);
    });
  }

  async function init() {
    if (!CONFIG.enabled || !CONFIG.config?.projectId) return;
    try {
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(CONFIG.config);
      const auth = authModule.getAuth(app);
      user = await firstUser(auth, authModule);
      if (!user) return;
      firebase = { db: firestoreModule.getFirestore(app), firestoreModule };
      await loadContext();
      void syncNow();

      const targets = [document.querySelector("#custom-dex-list"), document.querySelector("#custom-card-grid")].filter(Boolean);
      const observer = new MutationObserver(scheduleSync);
      targets.forEach((target) => observer.observe(target, { childList: true, subtree: true, attributes: true }));
    } catch (error) {
      console.warn("나만의 도감 공개 상태를 불러오지 못했습니다.", error);
    }
  }

  void init();
})();
