"use strict";

(function () {
  const HEADER_METRICS_VERSION = 4;
  if (window.PokemonDexSiteMetrics?.headerMetricsVersion === HEADER_METRICS_VERSION) return;

  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const OWNER_EMAIL = String(CONFIG.ownerEmail || "").trim().toLowerCase();
  const KNOWN_VIEWER_UID = "9K11y6y4U4dlVmmi9bkxaT4Ci8u2";
  const VISITOR_STORAGE_KEY = "pokemonDexVisitorIdV1";
  const DAILY_RECORDED_STORAGE_KEY = "pokemonDexDailyVisitRecordedV2";
  const REGISTERED_USER_STORAGE_KEY = "pokemonDexRegisteredUserV1";
  const SEEDED_VIEWER_STORAGE_KEY = "pokemonDexKnownViewerSeededV1";
  const METRICS_COLLECTION = "siteMetrics";
  const METRICS_DOCUMENT = "public";
  const DAILY_COLLECTION = "siteDailyMetrics";
  const USER_COLLECTION = "siteUserRegistry";
  const DISPLAY_PUBLIC_METRICS = false;

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId,
    );
  }

  function counter(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : 0;
  }

  function dateKeyInKorea(date = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);
      const values = Object.fromEntries(
        parts
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, part.value]),
      );
      return `${values.year}-${values.month}-${values.day}`;
    } catch {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  function createVisitorId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    if (window.crypto?.getRandomValues) {
      const values = new Uint8Array(16);
      window.crypto.getRandomValues(values);
      return Array.from(values, (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function validVisitorId(value) {
    return /^[A-Za-z0-9-]{24,64}$/.test(String(value || ""));
  }

  function storageValue(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function setStorageValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function visitorId() {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        const stored = storage.getItem(VISITOR_STORAGE_KEY);
        if (validVisitorId(stored)) return stored;
      } catch {
        // Continue with the next browser storage option.
      }
    }

    const created = createVisitorId();
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        storage.setItem(VISITOR_STORAGE_KEY, created);
        return created;
      } catch {
        // Continue with the next browser storage option.
      }
    }
    return created;
  }

  function dailyVisitRecorded(day, id) {
    return storageValue(DAILY_RECORDED_STORAGE_KEY) === `${day}:${id}`;
  }

  function markDailyVisitRecorded(day, id) {
    setStorageValue(DAILY_RECORDED_STORAGE_KEY, `${day}:${id}`);
  }

  function userRegisteredLocally(userId) {
    return storageValue(REGISTERED_USER_STORAGE_KEY) === userId;
  }

  function markUserRegistered(userId) {
    setStorageValue(REGISTERED_USER_STORAGE_KEY, userId);
  }

  function firstAuthUser(auth, authModule) {
    if (typeof auth.authStateReady === "function") {
      return auth.authStateReady().then(() => auth.currentUser || null);
    }
    return new Promise((resolve) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user || null);
        },
        () => {
          unsubscribe();
          resolve(null);
        },
      );
    });
  }

  function summaryPayload(data, changes, firestoreModule) {
    return {
      cumulativeVisits: counter(
        changes.cumulativeVisits ?? data.cumulativeVisits,
      ),
      userCount: counter(changes.userCount ?? data.userCount),
      lastVisitDate: String(
        changes.lastVisitDate ?? data.lastVisitDate ?? "",
      ),
      lastVisitorId: String(
        changes.lastVisitorId ?? data.lastVisitorId ?? "",
      ),
      updatedAt: firestoreModule.serverTimestamp(),
    };
  }

  async function ensureDailyVisit(db, firestoreModule, day, id) {
    const summaryRef = firestoreModule.doc(
      db,
      METRICS_COLLECTION,
      METRICS_DOCUMENT,
    );
    const dailyRef = firestoreModule.doc(db, DAILY_COLLECTION, day);
    const visitorRef = firestoreModule.doc(
      db,
      DAILY_COLLECTION,
      day,
      "visitors",
      id,
    );

    await firestoreModule.runTransaction(db, async (transaction) => {
      const visitorSnapshot = await transaction.get(visitorRef);
      if (visitorSnapshot.exists()) return;

      const summarySnapshot = await transaction.get(summaryRef);
      const dailySnapshot = await transaction.get(dailyRef);
      const summary = summarySnapshot.exists()
        ? summarySnapshot.data() || {}
        : {};
      const daily = dailySnapshot.exists() ? dailySnapshot.data() || {} : {};

      transaction.set(visitorRef, {
        visitorId: id,
        date: day,
        createdAt: firestoreModule.serverTimestamp(),
      });
      transaction.set(
        summaryRef,
        summaryPayload(
          summary,
          {
            cumulativeVisits: counter(summary.cumulativeVisits) + 1,
            lastVisitDate: day,
            lastVisitorId: id,
          },
          firestoreModule,
        ),
      );
      transaction.set(dailyRef, {
        date: day,
        visits: counter(daily.visits) + 1,
        lastVisitorId: id,
        updatedAt: firestoreModule.serverTimestamp(),
      });
    });
  }

  async function registerUser(db, firestoreModule, userId, source = "login") {
    const summaryRef = firestoreModule.doc(
      db,
      METRICS_COLLECTION,
      METRICS_DOCUMENT,
    );
    const userRef = firestoreModule.doc(db, USER_COLLECTION, userId);

    await firestoreModule.runTransaction(db, async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      if (userSnapshot.exists()) return;

      const summarySnapshot = await transaction.get(summaryRef);
      if (!summarySnapshot.exists()) return;

      const summary = summarySnapshot.data() || {};
      transaction.set(userRef, {
        createdAt: firestoreModule.serverTimestamp(),
        source,
      });
      transaction.set(
        summaryRef,
        summaryPayload(
          summary,
          { userCount: counter(summary.userCount) + 1 },
          firestoreModule,
        ),
      );
    });
  }

  function isOwner(user) {
    return Boolean(
      user &&
        OWNER_EMAIL &&
        String(user.email || "").trim().toLowerCase() === OWNER_EMAIL,
    );
  }

  async function initialize() {
    if (!configured()) return;

    const day = dateKeyInKorea();
    const id = visitorId();

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

      if (!dailyVisitRecorded(day, id)) {
        try {
          await ensureDailyVisit(db, firestoreModule, day, id);
          markDailyVisitRecorded(day, id);
        } catch (error) {
          console.warn("사이트 접속 집계를 저장하지 못했습니다.", error);
        }
      }

      const user = await firstAuthUser(auth, authModule);
      if (user && !userRegisteredLocally(user.uid)) {
        try {
          await registerUser(db, firestoreModule, user.uid, "login");
          markUserRegistered(user.uid);
        } catch (error) {
          console.warn("사이트 사용 인원을 저장하지 못했습니다.", error);
        }
      }

      if (
        isOwner(user) &&
        storageValue(SEEDED_VIEWER_STORAGE_KEY) !== "done"
      ) {
        try {
          await registerUser(db, firestoreModule, KNOWN_VIEWER_UID, "seeded");
          setStorageValue(SEEDED_VIEWER_STORAGE_KEY, "done");
        } catch (error) {
          console.warn("기존 사용 인원 기준값을 확인하지 못했습니다.", error);
        }
      }
    } catch (error) {
      console.warn("사이트 이용 현황 집계를 초기화하지 못했습니다.", error);
    }
  }

  function scheduleInitialize() {
    const run = () => {
      void initialize();
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 1800 });
      return;
    }
    window.setTimeout(run, 450);
  }

  window.PokemonDexSiteMetrics = Object.freeze({
    dateKeyInKorea,
    displayPublicMetrics: DISPLAY_PUBLIC_METRICS,
    headerMetricsVersion: HEADER_METRICS_VERSION,
  });

  scheduleInitialize();
})();
