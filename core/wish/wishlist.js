"use strict";

// 위시카드 저장소.
// 경로: users/{uid}/wishlist/main  (기존 도감 수집 문서와 완전히 분리된 새 저장 공간)
// 문서: { schemaVersion: 1, items: { [key]: { n, t, i, p, a } }, visibility?, updatedAt }
// 공개로 켜면 publicProfiles/{publicId}/wishlist/main 에 같은 목록의 사본을 둔다.
(function () {
  const SDK_VERSION = "12.16.0";
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});
  const MAX_ITEMS = 300;
  const listeners = new Set();
  const state = {
    status: "loading", // loading | signed-out | ready | error | unconfigured
    items: new Map(),
    exists: false,
    uid: "",
    visibility: "private",
    publicId: "",
  };
  let firebase = null;
  let readyPromise = null;

  function cleanText(value, limit) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function hashText(text) {
    let hash = 5381;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
    }
    return hash.toString(36);
  }

  // 같은 카드는 어떤 도감에서 눌러도 같은 키가 되도록 이미지 경로를 우선 사용한다.
  function keyFor(info) {
    const image = String(info?.image || "");
    const match = image.match(/\/wmimages\/(.+?)\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i);
    if (match) return `w_${match[1].replace(/[^A-Za-z0-9]+/g, "_")}`.slice(0, 120);
    return `f_${hashText([info?.page, info?.name, info?.tag].map((part) => cleanText(part, 120)).join("|"))}`;
  }

  function normalizeItem(info) {
    return {
      n: cleanText(info.name, 60),
      t: cleanText(info.tag, 40),
      i: cleanText(info.image, 300),
      p: cleanText(info.page, 160),
      a: Date.now(),
    };
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        console.warn("위시 구독자 오류", error);
      }
    }
  }

  function configured() {
    const config = window.POKEMON_DEX_FIREBASE || {};
    const firebaseConfig = config.config || {};
    return Boolean(config.enabled && firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
  }

  function walletRef() {
    return firebase.firestoreModule.doc(firebase.db, "users", state.uid, "wishlist", "main");
  }

  function mirrorRef() {
    return firebase.firestoreModule.doc(firebase.db, "publicProfiles", state.publicId, "wishlist", "main");
  }

  function itemsObject() {
    return Object.fromEntries(state.items);
  }

  async function loadPublicId() {
    state.publicId = "";
    try {
      const profile = await firebase.firestoreModule.getDoc(
        firebase.firestoreModule.doc(firebase.db, "users", state.uid, "profile", "main"),
      );
      const data = profile.exists() ? profile.data() || {} : {};
      if (data.profileCompleted && /^[a-z0-9]{12}$/.test(String(data.publicId || ""))) {
        state.publicId = data.publicId;
      }
    } catch (error) {
      console.warn("컬렉터 프로필을 확인하지 못했습니다.", error);
    }
  }

  async function loadForUser(user) {
    state.uid = user.uid;
    const snapshot = await firebase.firestoreModule.getDoc(walletRef());
    state.exists = snapshot.exists();
    state.items = new Map();
    state.visibility = snapshot.exists() && snapshot.data()?.visibility === "public" ? "public" : "private";
    await loadPublicId();
    if (state.exists) {
      const items = snapshot.data()?.items || {};
      for (const [key, value] of Object.entries(items)) {
        if (value && typeof value === "object") state.items.set(key, value);
      }
    }
    state.status = "ready";
  }

  async function initialize() {
    if (!configured()) {
      state.status = "unconfigured";
      notify();
      return state;
    }
    try {
      const [appModule, authModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const config = window.POKEMON_DEX_FIREBASE.config;
      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(config);
      const auth = authModule.getAuth(app);
      firebase = { auth, db: firestoreModule.getFirestore(app), firestoreModule };
      await new Promise((resolve) => {
        let first = true;
        authModule.onAuthStateChanged(auth, async (user) => {
          try {
            if (!user) {
              state.uid = "";
              state.items = new Map();
              state.exists = false;
              state.visibility = "private";
              state.publicId = "";
              state.status = "signed-out";
            } else {
              await loadForUser(user);
            }
          } catch (error) {
            console.warn("위시카드를 불러오지 못했습니다.", error);
            state.status = "error";
          }
          notify();
          if (first) {
            first = false;
            resolve();
          }
        });
      });
    } catch (error) {
      console.warn("위시카드 초기화 실패", error);
      state.status = "error";
      notify();
    }
    return state;
  }

  function ready() {
    if (!readyPromise) readyPromise = initialize();
    return readyPromise;
  }

  function isPublic() {
    return state.visibility === "public" && Boolean(state.publicId);
  }

  async function write(key, item) {
    const { setDoc, updateDoc, serverTimestamp, deleteField, FieldPath, writeBatch } = firebase.firestoreModule;
    const value = item === null ? deleteField() : item;
    if (!state.exists) {
      if (item === null) return;
      await setDoc(walletRef(), { schemaVersion: 1, items: { [key]: value }, updatedAt: serverTimestamp() });
      state.exists = true;
      return;
    }
    if (!isPublic()) {
      await updateDoc(walletRef(), new FieldPath("items", key), value, "updatedAt", serverTimestamp());
      return;
    }
    // 공개 중이면 원본과 공개 사본을 한 번에 갱신한다.
    const batch = writeBatch(firebase.db);
    batch.update(walletRef(), new FieldPath("items", key), value, "updatedAt", serverTimestamp());
    batch.set(mirrorRef(), { schemaVersion: 1, items: itemsObject(), updatedAt: serverTimestamp() });
    await batch.commit();
  }

  // 공개 여부 변경. 결과: "ok" | "signed-out" | "no-profile" | "error"
  async function setVisibility(visible) {
    await ready();
    if (state.status === "signed-out") return "signed-out";
    if (state.status !== "ready") return "error";
    if (visible && !state.publicId) return "no-profile";
    const { serverTimestamp, writeBatch } = firebase.firestoreModule;
    const next = visible ? "public" : "private";
    try {
      const batch = writeBatch(firebase.db);
      batch.set(
        walletRef(),
        { schemaVersion: 1, items: itemsObject(), visibility: next, updatedAt: serverTimestamp() },
      );
      if (state.publicId) {
        if (visible) batch.set(mirrorRef(), { schemaVersion: 1, items: itemsObject(), updatedAt: serverTimestamp() });
        else batch.delete(mirrorRef());
      }
      await batch.commit();
      state.exists = true;
      state.visibility = next;
      notify();
      return "ok";
    } catch (error) {
      console.warn("위시카드 공개 설정 실패", error);
      return "error";
    }
  }

  // 위시 담기/빼기. 결과: "added" | "removed" | "signed-out" | "full" | "error"
  async function toggle(info) {
    await ready();
    if (state.status === "signed-out") return "signed-out";
    if (state.status !== "ready") return "error";
    const key = keyFor(info);
    const had = state.items.has(key);
    if (!had && state.items.size >= MAX_ITEMS) return "full";

    const previous = state.items.get(key);
    if (had) state.items.delete(key);
    else state.items.set(key, normalizeItem(info));
    notify();
    try {
      await write(key, had ? null : state.items.get(key));
      return had ? "removed" : "added";
    } catch (error) {
      console.warn("위시카드 저장 실패", error);
      if (had) state.items.set(key, previous);
      else state.items.delete(key);
      notify();
      return "error";
    }
  }

  function has(info) {
    return state.items.has(keyFor(info));
  }

  function list() {
    return [...state.items.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((left, right) => (right.a || 0) - (left.a || 0));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  root.wishlist = Object.freeze({
    MAX_ITEMS,
    state,
    keyFor,
    ready,
    toggle,
    setVisibility,
    has,
    list,
    subscribe,
    signIn: async function signIn() {
      await ready();
      if (!firebase) return;
      const authModule = await import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`);
      await authModule.signInWithPopup(firebase.auth, new authModule.GoogleAuthProvider());
    },
  });
})();
