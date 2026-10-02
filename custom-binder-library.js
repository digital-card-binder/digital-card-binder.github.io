"use strict";

(function () {
  const params = new URLSearchParams(window.location.search);
  if (/^[a-z0-9]{12}$/.test(params.get("collector") || "")) return;

  const panel = document.querySelector("#custom-binders");
  const list = document.querySelector("#custom-binder-library-list");
  const empty = document.querySelector("#custom-binder-library-empty");
  const status = document.querySelector("#custom-binder-library-status");
  if (!panel || !list || !empty || !status) return;

  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId
    );
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

  function formatTime(value) {
    try {
      const date = typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value || Date.now());
      return new Intl.DateTimeFormat("ko-KR", {
        month: "numeric",
        day: "numeric",
      }).format(date);
    } catch {
      return "";
    }
  }

  async function init() {
    panel.hidden = false;
    if (!configured()) {
      status.textContent = "저장 설정을 확인하지 못했습니다.";
      empty.hidden = false;
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
      const user = await firstAuthUser(auth, authModule);

      if (!user) {
        status.textContent = "Google 로그인 후 저장한 커스텀 바인더가 표시됩니다.";
        empty.textContent = "아직 로그인하지 않았습니다.";
        empty.hidden = false;
        return;
      }

      const db = firestoreModule.getFirestore(app);
      const reference = firestoreModule.collection(
        db,
        "users",
        user.uid,
        "customBinders",
      );
      const customDexReference = firestoreModule.doc(
        db,
        "users",
        user.uid,
        CONFIG.userCollection || "collections",
        "pokemonCollectionsDex",
      );
      const [snapshot, customDexSnapshot] = await Promise.all([
        firestoreModule.getDocs(
          firestoreModule.query(
            reference,
            firestoreModule.orderBy("updatedAt", "desc"),
            firestoreModule.limit(30),
          ),
        ),
        firestoreModule.getDoc(customDexReference),
      ]);
      const customDexSource = customDexSnapshot.exists()
        ? customDexSnapshot.data()?.customDexes || {}
        : {};
      const customDexTitles = new Map(
        Object.entries(customDexSource)
          .filter(([, dex]) => dex && typeof dex === "object")
          .map(([id, dex]) => [String(dex.id || id), String(dex.title || "").trim()]),
      );

      list.replaceChildren();
      const fragment = document.createDocumentFragment();
      snapshot.forEach((documentSnapshot) => {
        const data = documentSnapshot.data() || {};
        const isV2 = Number(data.schemaVersion) === 2;
        const grid = isV2 ? (data.summary?.firstGrid || {}) : (data.grid || {});
        const item = document.createElement("article");
        item.className = "custom-binder-library-card";

        const copy = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = String(data.title || "커스텀 바인더");
        const meta = document.createElement("span");
        const linkedDexTitle = customDexTitles.get(String(data.linkedDexId || "")) || "";
        meta.textContent = [
          grid.cols && grid.rows ? `${grid.cols}×${grid.rows}` : "",
          isV2
            ? `${Number(data.summary?.pageCount) || 1}페이지 · ${Number(data.summary?.cardCount) || 0}장 배치`
            : Array.isArray(data.cards) ? `${data.cards.length}장 배치` : "",
          linkedDexTitle ? `도감 연결: ${linkedDexTitle}` : "",
          formatTime(data.updatedAt),
        ].filter(Boolean).join(" · ");
        copy.append(title, meta);

        const open = document.createElement("a");
        open.className = "primary-button";
        open.href = `./studio.html?binder=${encodeURIComponent(documentSnapshot.id)}#studio-custom`;
        open.textContent = "열기";

        item.append(copy, open);
        fragment.append(item);
      });
      list.append(fragment);
      empty.hidden = snapshot.size > 0;
      empty.textContent = snapshot.size
        ? ""
        : "아직 저장한 커스텀 바인더가 없습니다.";
      status.textContent = snapshot.size
        ? `저장한 커스텀 바인더 ${snapshot.size}개`
        : "바인더 스튜디오에서 만든 작업을 여기에 저장할 수 있습니다.";
    } catch (error) {
      console.error("나만의도감 커스텀 바인더 목록 불러오기 실패", error);
      status.textContent = "커스텀 바인더 목록을 불러오지 못했습니다.";
      empty.hidden = false;
      empty.textContent = "잠시 후 다시 열어 주세요.";
    }
  }

  void init();
})();
