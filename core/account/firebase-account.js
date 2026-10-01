"use strict";

(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function configured(config, options = {}) {
    const firebaseConfig = config?.config || {};
    const requireOwnerEmail = Boolean(options.requireOwnerEmail);
    return Boolean(
      config?.enabled &&
        firebaseConfig.apiKey &&
        firebaseConfig.authDomain &&
        firebaseConfig.projectId &&
        (!requireOwnerEmail || normalizeEmail(config?.ownerEmail)),
    );
  }

  function isOwner(config, user) {
    const ownerEmail = normalizeEmail(config?.ownerEmail);
    return Boolean(
      user &&
        ownerEmail &&
        normalizeEmail(user.email) === ownerEmail,
    );
  }

  function baseMode(config, user) {
    return isOwner(config, user) ? "legacy" : "empty";
  }

  function firstAuthUser(auth, authModule) {
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

  function documentRef(firestoreModule, db, user, config, documentId) {
    return firestoreModule.doc(
      db,
      "users",
      user.uid,
      config?.userCollection || "collections",
      documentId,
    );
  }


  async function installHeaderPanel(config = window.POKEMON_DEX_FIREBASE || {}) {
    const existing = document.querySelector("#firebase-auth-panel");
    if (existing) return existing;

    const header = document.querySelector(".site-header");
    if (!header) return null;

    const panel = document.createElement("div");
    panel.id = "firebase-auth-panel";
    panel.className = "firebase-auth-panel";
    panel.innerHTML = `
      <span class="firebase-auth-dot" aria-hidden="true"></span>
      <span id="firebase-auth-status">로그인 상태 확인 중</span>
      <button id="firebase-login" type="button">Google 로그인</button>
      <button id="firebase-logout" type="button" hidden>로그아웃</button>
    `;
    header.append(panel);

    const login = panel.querySelector("#firebase-login");
    const logout = panel.querySelector("#firebase-logout");
    const status = panel.querySelector("#firebase-auth-status");

    const update = (user, error = null) => {
      if (!status || !login || !logout) return;
      panel.classList.toggle("is-account", Boolean(user));
      panel.classList.toggle("is-owner", isOwner(config, user));

      if (!configured(config)) {
        status.textContent = "Firebase 설정 필요";
        login.hidden = true;
        logout.hidden = true;
        return;
      }
      if (error) {
        status.textContent = "Firebase 연결 오류";
        login.hidden = false;
        logout.hidden = true;
        return;
      }
      if (!user) {
        status.textContent = "방문자";
        login.hidden = false;
        logout.hidden = true;
        return;
      }
      status.textContent = "프로필설정";
      login.hidden = true;
      logout.hidden = false;
    };

    if (!configured(config)) {
      update(null);
      return panel;
    }

    try {
      const SDK_VERSION = "12.16.0";
      const [appModule, authModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(config.config);
      const auth = authModule.getAuth(app);

      authModule.onAuthStateChanged(auth, (user) => update(user));

      login?.addEventListener("click", async () => {
        try {
          const provider = new authModule.GoogleAuthProvider();
          await authModule.signInWithPopup(auth, provider);
        } catch (error) {
          console.warn("Google 로그인 실패", error);
          update(auth.currentUser, error);
        }
      });

      logout?.addEventListener("click", async () => {
        try {
          await authModule.signOut(auth);
        } catch (error) {
          console.warn("로그아웃 실패", error);
        }
      });
    } catch (error) {
      console.warn("공통 계정 헤더 초기화 실패", error);
      update(null, error);
    }

    return panel;
  }

  const OVERRIDE_SHARDS = "overrideShards";
  function usesOverrideShards(documentId) {
    return documentId === "seriesDex" || documentId === "arDex";
  }

  function overrideShardId(key) {
    let hash = 2166136261;
    for (const char of String(key)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    // Mix high and low bits: repeated numeric codes/indices must not crowd a bucket.
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    return `s${(hash >>> 0 & 127).toString(16).padStart(2, "0")}`;
  }

  function mergedCollectionData(source, shards) {
    const result = { ...(source || {}), overrides: { ...(source?.overrides || {}) } };
    for (const shard of shards) {
      for (const [key, value] of Object.entries(shard?.overrides || {})) {
        const previous = result.overrides[key];
        const oldTime = typeof previous?.updatedAt === "string" ? previous.updatedAt : "";
        const newTime = typeof value?.updatedAt === "string" ? value.updatedAt : "";
        if (!oldTime || newTime >= oldTime) result.overrides[key] = value;
      }
    }
    return result;
  }

  async function readOverrideShards(firestoreModule, reference, options = {}) {
    if (!usesOverrideShards(reference.id)) return [];
    const query = firestoreModule.collection(reference, OVERRIDE_SHARDS);
    let snapshot;
    if (options.preferServer && firestoreModule.getDocsFromServer) {
      try { snapshot = await firestoreModule.getDocsFromServer(query); } catch { /* offline cache */ }
    }
    snapshot ||= await firestoreModule.getDocs(query);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  async function readCollectionSnapshot(firestoreModule, reference, options = {}) {
    let snapshot;
    if (options.preferServer && firestoreModule.getDocFromServer) {
      try { snapshot = await firestoreModule.getDocFromServer(reference); } catch { /* offline cache */ }
    }
    snapshot ||= await firestoreModule.getDoc(reference);
    if (!usesOverrideShards(reference.id)) return snapshot;
    const shards = await readOverrideShards(firestoreModule, reference, options);
    const data = mergedCollectionData(snapshot.exists() ? snapshot.data() : {}, shards);
    return { ref: reference, id: reference.id, exists: () => snapshot.exists() || shards.length > 0, data: () => data };
  }

  async function writeOverrideEntry(firestoreModule, reference, key, value) {
    if (!usesOverrideShards(reference.id)) throw new Error("분할 저장 대상이 아닙니다.");
    const shard = firestoreModule.doc(reference, OVERRIDE_SHARDS, overrideShardId(key));
    // Only this entry is replaced; legacy data and other cards are untouched.
    await firestoreModule.setDoc(shard, {
      schemaVersion: 1,
      overrides: { [key]: value },
      updatedAt: firestoreModule.serverTimestamp(),
    }, { mergeFields: ["schemaVersion", new firestoreModule.FieldPath("overrides", key), "updatedAt"] });
  }

  function subscribeCollection(firestoreModule, reference, changed, failed) {
    if (!usesOverrideShards(reference.id)) return firestoreModule.onSnapshot(reference, changed, failed);
    let source = null;
    let shards = null;
    let exists = false;
    const publish = () => {
      if (source === null || shards === null) return;
      const data = mergedCollectionData(source, shards);
      changed({ exists: () => exists || shards.length > 0, data: () => data });
    };
    const rootStop = firestoreModule.onSnapshot(reference, (snapshot) => {
      exists = snapshot.exists(); source = exists ? snapshot.data() : {}; publish();
    }, failed);
    const shardsStop = firestoreModule.onSnapshot(firestoreModule.collection(reference, OVERRIDE_SHARDS), (snapshot) => {
      shards = snapshot.docs.map((item) => item.data()); publish();
    }, failed);
    return () => { rootStop(); shardsStop(); };
  }

  root.firebaseAccount = Object.freeze({
    normalizeEmail,
    configured,
    isOwner,
    baseMode,
    firstAuthUser,
    documentRef,
    installHeaderPanel,
    usesOverrideShards,
    overrideShardId,
    mergedCollectionData,
    readOverrideShards,
    readCollectionSnapshot,
    writeOverrideEntry,
    subscribeCollection,
  });
})();
