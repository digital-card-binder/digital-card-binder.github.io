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

  async function installHeaderFallback(config = window.POKEMON_DEX_FIREBASE || {}) {
    if (document.querySelector("#firebase-auth-panel")) {
      return document.querySelector("#firebase-auth-panel");
    }

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

    const login = panel.querySelector("#firebase-login");
    const logout = panel.querySelector("#firebase-logout");
    const headerChip = document.querySelector(".header-chip");

    const update = (user, error = null) => {
      const status = panel.querySelector("#firebase-auth-status");
      if (!status || !login || !logout) return;

      panel.classList.toggle("is-account", Boolean(user));
      panel.classList.toggle("is-owner", isOwner(config, user));
      if (headerChip) headerChip.textContent = user ? "로그인됨" : "공개 보기";

      if (!configured(config)) {
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
      if (!user) {
        status.textContent = "방문자";
        status.removeAttribute?.("href");
        login.hidden = false;
        logout.hidden = true;
        return;
      }

      status.textContent = "프로필설정";
      if (status.tagName === "A") status.href = "./collector-settings.html";
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
      login.addEventListener("click", async () => {
        try {
          const provider = new authModule.GoogleAuthProvider();
          await authModule.signInWithPopup(auth, provider);
        } catch (error) {
          console.warn("Google 로그인 실패", error);
          update(auth.currentUser, error);
        }
      });
      logout.addEventListener("click", async () => {
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

  root.firebaseAccount = Object.freeze({
    normalizeEmail,
    configured,
    isOwner,
    baseMode,
    firstAuthUser,
    documentRef,
    installHeaderFallback,
  });
})();
