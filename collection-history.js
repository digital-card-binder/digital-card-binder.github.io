"use strict";

(function () {
  const STORAGE_KEY = "digitalCardBinderPendingHistoryV1";
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const accountCore = window.DigitalCardBinder?.firebaseAccount;
  let flushing = false;

  function clean(value, max = 180) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function pending() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.slice(-80) : [];
    } catch {
      return [];
    }
  }

  function savePending(items) {
    try {
      if (items.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-80)));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  function makeEntry(detail = {}) {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      category: clean(detail.category, 40) || "collection",
      key: clean(detail.key, 180),
      action: clean(detail.action, 60) || "changed",
      name: clean(detail.name, 120),
    };
  }

  function queue(detail) {
    const items = pending();
    items.push(makeEntry(detail));
    savePending(items);
    void flush();
  }

  async function firebaseContext() {
    if (!accountCore?.configured?.(CONFIG)) return null;
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
    ]);
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(CONFIG.config);
    const auth = authModule.getAuth(app);
    const user = await accountCore.firstAuthUser(auth, authModule);
    return user ? { user, db: firestoreModule.getFirestore(app), firestoreModule } : null;
  }

  async function flush() {
    if (flushing) return;
    const items = pending();
    if (!items.length) return;
    flushing = true;
    try {
      const context = await firebaseContext();
      if (!context) return;
      const { user, db, firestoreModule } = context;
      const ref = accountCore.documentRef(
        firestoreModule,
        db,
        user,
        CONFIG,
        "pokemonCollectionsDex",
      );
      await firestoreModule.runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const current = snapshot.exists() ? snapshot.data() || {} : {};
        const history = Array.isArray(current.historyV1) ? current.historyV1 : [];
        const merged = [...history, ...items].slice(-300);
        transaction.set(ref, {
          baseMode: current.baseMode || accountCore.baseMode(CONFIG, user),
          email: user.email || "",
          displayName: user.displayName || "",
          historyVersion: 1,
          historyV1: merged,
          updatedAt: firestoreModule.serverTimestamp(),
        }, { merge: true });
      });
      const ids = new Set(items.map((item) => item.id));
      savePending(pending().filter((item) => !ids.has(item.id)));
    } catch (error) {
      console.warn("수집 히스토리를 저장하지 못했습니다.", error);
    } finally {
      flushing = false;
    }
  }

  window.DigitalCardBinderHistory = Object.freeze({
    record: queue,
    flush,
  });

  window.addEventListener("pokemon-dex:collection-changed", (event) => {
    queue(event.detail || {});
  });

  void flush();
})();
