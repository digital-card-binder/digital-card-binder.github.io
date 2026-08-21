"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const TRADE_DRAFT_KEY = "digitalCardBinderTradeDraftV1";
  const state = { firebase: null, user: null, profile: null, posts: [], draft: null };

  const $ = (id) => document.getElementById(id);
  const clean = (value, max = 160) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

  function configured() {
    const config = CONFIG.config || {};
    return Boolean(CONFIG.enabled && config.apiKey && config.authDomain && config.projectId);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  function safeImageUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function readDraft() {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(TRADE_DRAFT_KEY) || "null");
      if (!value || !clean(value.name, 100)) return null;
      return {
        name: clean(value.name, 100),
        imageUrl: safeImageUrl(value.imageUrl),
        detail: clean(value.detail, 160),
        sourcePage: clean(value.sourcePage, 80),
      };
    } catch {
      return null;
    }
  }

  function showRegistration() {
    state.draft = readDraft();
    const panel = $("trade-register-panel");
    if (!panel || !state.draft) return;
    const image = state.draft.imageUrl
      ? `<img src="${escapeHtml(state.draft.imageUrl)}" alt="" />`
      : '<span class="trade-image-placeholder" aria-hidden="true">CARD</span>';
    $("trade-offered-card").innerHTML = `${image}<div><span>내가 주는 카드</span><strong>${escapeHtml(state.draft.name)}</strong><small>${escapeHtml(state.draft.detail)}</small></div>`;
    panel.hidden = false;
    if (new URLSearchParams(window.location.search).get("register") === "1") {
      panel.scrollIntoView({ block: "start" });
    }
  }

  function timestampMillis(value) {
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (value?.seconds) return Number(value.seconds) * 1000;
    return 0;
  }

  function formatDate(value) {
    const millis = timestampMillis(value);
    if (!millis) return "방금 전";
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(millis));
  }

  function postMatches(post) {
    const query = clean($("trade-search")?.value, 100).toLocaleLowerCase("ko-KR");
    const status = $("trade-status-filter")?.value || "all";
    const offer = $("trade-offer-filter")?.value || "all";
    if (status !== "all" && post.status !== status) return false;
    if (offer === "yes" && !post.acceptOffers) return false;
    if (offer === "no" && post.acceptOffers) return false;
    if (!query) return true;
    return [post.authorNickname, post.offeredCard?.name, post.offeredCard?.detail, post.wantedCard]
      .join(" ").toLocaleLowerCase("ko-KR").includes(query);
  }

  function renderPosts() {
    const posts = state.posts.filter(postMatches);
    $("trade-count").innerHTML = `교환글 <strong>${posts.length}</strong>개`;
    $("trade-grid").hidden = posts.length === 0;
    $("trade-empty").hidden = posts.length !== 0;
    $("trade-grid").innerHTML = posts.map((post) => {
      const imageUrl = safeImageUrl(post.offeredCard?.imageUrl);
      const image = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(post.offeredCard?.name)}" loading="lazy" />`
        : '<span class="trade-image-placeholder" aria-hidden="true">CARD</span>';
      return `<article class="trade-card">
        <div class="trade-card-image">${image}</div>
        <div class="trade-card-copy">
          <div class="trade-card-meta"><strong>${escapeHtml(post.authorNickname || "컬렉터")}</strong><time>${escapeHtml(formatDate(post.createdAt))}</time></div>
          <div class="trade-card-status"><span class="${post.status === "closed" ? "is-closed" : ""}">${post.status === "closed" ? "교환완료" : "교환중"}</span>${post.acceptOffers ? "<small>제안 받아요</small>" : ""}</div>
          <dl><div><dt>내가 주는 카드</dt><dd><strong>${escapeHtml(post.offeredCard?.name)}</strong><small>${escapeHtml(post.offeredCard?.detail)}</small></dd></div><div><dt>원하는 카드</dt><dd>${escapeHtml(post.wantedCard)}</dd></div></dl>
        </div>
      </article>`;
    }).join("");
  }

  async function initializeFirebase() {
    if (!configured()) throw new Error("Firebase configuration is unavailable.");
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
    ]);
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(CONFIG.config);
    const auth = authModule.getAuth(app);
    state.firebase = { auth, authModule, db: firestoreModule.getFirestore(app), firestoreModule };
    authModule.onAuthStateChanged(auth, async (user) => {
      state.user = user || null;
      state.profile = null;
      if (user) {
        const profileSnapshot = await firestoreModule.getDoc(firestoreModule.doc(state.firebase.db, "users", user.uid, "profile", "main"));
        if (profileSnapshot.exists()) state.profile = profileSnapshot.data();
      }
    });
  }

  async function loadPosts() {
    const { db, firestoreModule } = state.firebase;
    const reference = firestoreModule.query(
      firestoreModule.collection(db, "tradePosts"),
      firestoreModule.orderBy("createdAt", "desc"),
      firestoreModule.limit(100),
    );
    const snapshot = await firestoreModule.getDocs(reference);
    state.posts = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    $("trade-loading").hidden = true;
    renderPosts();
  }

  async function signIn() {
    const { auth, authModule } = state.firebase;
    const result = await authModule.signInWithPopup(auth, new authModule.GoogleAuthProvider());
    state.user = result.user || auth.currentUser || null;
    if (state.user) {
      const { db, firestoreModule } = state.firebase;
      const profileSnapshot = await firestoreModule.getDoc(
        firestoreModule.doc(db, "users", state.user.uid, "profile", "main"),
      );
      state.profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
    }
  }

  async function submitTrade(event) {
    event.preventDefault();
    const message = $("trade-register-message");
    const submit = $("trade-register-submit");
    message.textContent = "";
    if (!state.draft) return;
    try {
      if (!state.user) {
        message.textContent = "교환글 등록을 위해 Google 로그인이 필요합니다.";
        await signIn();
      }
      if (!state.user) return;
      if (!state.profile?.profileCompleted || !clean(state.profile.nickname, 20)) {
        message.innerHTML = '먼저 <a href="./collector-settings.html#collector-profile-title">프로필설정에서 닉네임</a>을 만들어 주세요.';
        return;
      }
      const wantedCard = clean($("trade-wanted-card").value, 120);
      if (wantedCard.length < 2) {
        message.textContent = "원하는 카드를 2자 이상 입력해 주세요.";
        return;
      }
      submit.disabled = true;
      submit.textContent = "등록 중…";
      const { db, firestoreModule } = state.firebase;
      await firestoreModule.addDoc(firestoreModule.collection(db, "tradePosts"), {
        schemaVersion: 1,
        authorUid: state.user.uid,
        authorNickname: clean(state.profile.nickname, 20),
        offeredCard: state.draft,
        wantedCard,
        acceptOffers: $("trade-accept-offers").checked,
        status: "open",
        createdAt: firestoreModule.serverTimestamp(),
        updatedAt: firestoreModule.serverTimestamp(),
      });
      window.sessionStorage.removeItem(TRADE_DRAFT_KEY);
      state.draft = null;
      $("trade-register-form").reset();
      $("trade-register-panel").hidden = true;
      await loadPosts();
    } catch (error) {
      console.error("교환글을 등록하지 못했습니다.", error);
      message.textContent = "교환글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    } finally {
      submit.disabled = false;
      submit.textContent = "교환글 등록";
    }
  }

  async function start() {
    showRegistration();
    ["trade-search", "trade-status-filter", "trade-offer-filter"].forEach((id) => $(id)?.addEventListener("input", renderPosts));
    $("trade-register-form")?.addEventListener("submit", submitTrade);
    $("trade-register-close")?.addEventListener("click", () => { $("trade-register-panel").hidden = true; });
    try {
      await initializeFirebase();
      await loadPosts();
    } catch (error) {
      console.error("교환 게시판을 준비하지 못했습니다.", error);
      $("trade-loading").hidden = true;
      $("trade-error").hidden = false;
    }
  }

  start();
})();
