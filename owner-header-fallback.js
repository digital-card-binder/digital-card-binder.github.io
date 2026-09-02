"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};

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

  const status = panel.querySelector("#firebase-auth-status");
  const login = panel.querySelector("#firebase-login");
  const logout = panel.querySelector("#firebase-logout");
  const headerChip = document.querySelector(".header-chip");

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(
      CONFIG.enabled &&
        config.apiKey &&
        config.authDomain &&
        config.projectId,
    );
  }

  function isOwner(user) {
    return Boolean(
      user &&
        normalizeEmail(CONFIG.ownerEmail) &&
        normalizeEmail(user.email) === normalizeEmail(CONFIG.ownerEmail),
    );
  }

  function update(user, error = null) {
    panel.classList.toggle("is-account", Boolean(user));
    panel.classList.toggle("is-owner", isOwner(user));

    if (headerChip) {
      headerChip.textContent = user ? "SIGNED IN" : "PUBLIC VIEW";
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

    if (!user) {
      status.textContent = "방문자";
      login.hidden = false;
      logout.hidden = true;
      return;
    }

    status.textContent = "프로필설정";
    if (status.tagName === "A") {
      status.href = "./collector-settings.html";
    }
    login.hidden = true;
    logout.hidden = false;
  }

  async function initialize() {
    if (!configured()) {
      update(null);
      return;
    }

    try {
      const [appModule, authModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(CONFIG.config);
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
  }

  initialize();
})();
