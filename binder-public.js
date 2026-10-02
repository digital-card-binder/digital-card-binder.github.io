"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const params = new URLSearchParams(window.location.search);
  const publicId = String(params.get("collector") || "").trim();
  const binderId = String(params.get("binder") || "").trim();
  const objectUrls = new Set();
  const state = {
    binder: null,
    pages: [],
    pageIndex: 0,
    profile: null,
  };

  const $ = (id) => document.getElementById(id);

  function validPublicId(value) {
    return /^[a-z0-9]{12}$/.test(value);
  }

  function validBinderId(value) {
    return /^[A-Za-z0-9_-]{8,120}$/.test(value);
  }

  function showError(message) {
    $("binder-public-loading").hidden = true;
    $("binder-public-view").hidden = true;
    $("binder-public-error").hidden = false;
    const paragraph = $("binder-public-error").querySelector("p");
    if (paragraph && message) paragraph.textContent = message;
  }

  function bytesFromChunk(data) {
    return data?.data?.toUint8Array?.() || null;
  }

  function pageBlob(page, chunks) {
    const preview = page.preview || {};
    const rows = chunks
      .filter((chunk) => chunk.chunkSet === preview.chunkSet)
      .sort((a, b) => Number(a.index) - Number(b.index));
    if (!preview.chunkSet || rows.length !== Number(preview.chunkCount || 0)) {
      throw new Error("공개 페이지 이미지 일부를 찾지 못했습니다.");
    }
    let total = 0;
    const parts = rows.map((row) => {
      const bytes = bytesFromChunk(row);
      if (!bytes) throw new Error("공개 페이지 이미지 형식이 올바르지 않습니다.");
      total += bytes.length;
      return bytes;
    });
    if (preview.size && total !== Number(preview.size)) {
      throw new Error("공개 페이지 이미지 크기가 올바르지 않습니다.");
    }
    const blob = new Blob(parts, { type: String(preview.type || "image/webp") });
    const url = URL.createObjectURL(blob);
    objectUrls.add(url);
    return url;
  }

  function renderPageList() {
    const list = $("binder-public-page-list");
    list.replaceChildren(...state.pages.map((page, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(index + 1);
      button.classList.toggle("is-active", index === state.pageIndex);
      button.setAttribute("aria-label", `${index + 1}페이지 보기`);
      button.addEventListener("click", () => {
        state.pageIndex = index;
        renderCurrentPage();
      });
      return button;
    }));
  }

  function renderCurrentPage() {
    const page = state.pages[state.pageIndex];
    if (!page) return;
    const image = $("binder-public-image");
    const shell = $("binder-public-shell");
    image.src = page.objectUrl;
    image.alt = `${state.binder.title} ${state.pageIndex + 1}페이지`;
    if (shell) {
      shell.style.setProperty("--binder-cols", String(Math.max(1, Number(page.grid?.cols) || 3)));
      shell.style.setProperty("--binder-rows", String(Math.max(1, Number(page.grid?.rows) || 4)));
    }
    $("binder-public-page-title").textContent = page.title || `${state.pageIndex + 1}페이지`;
    $("binder-public-page-position").textContent = `${state.pageIndex + 1} / ${state.pages.length}`;
    $("binder-public-prev").disabled = state.pageIndex <= 0;
    $("binder-public-next").disabled = state.pageIndex >= state.pages.length - 1;
    renderPageList();
  }

  function renderBinder() {
    const binder = state.binder;
    const summary = binder.summary || {};
    $("binder-public-title").textContent = binder.title || "커스텀 바인더";
    $("binder-public-owner").textContent =
      `${state.profile?.nickname || "컬렉터"}님의 공개 커스텀 바인더 · 읽기 전용`;
    $("binder-public-page-count").textContent = String(summary.pageCount || state.pages.length);
    $("binder-public-card-count").textContent = String(summary.cardCount || 0);
    $("binder-public-owned-count").textContent = String(summary.ownedCount || 0);
    $("binder-public-missing-count").textContent = String(summary.missingCount || 0);
    $("binder-public-profile-link").href =
      `./collector.html?id=${encodeURIComponent(publicId)}`;
    document.title = `${binder.title || "커스텀 바인더"} · 디지털 카드 바인더`;
    $("binder-public-loading").hidden = true;
    $("binder-public-error").hidden = true;
    $("binder-public-view").hidden = false;
    renderCurrentPage();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      $("binder-public-copy-link").textContent = "복사됨";
      window.setTimeout(() => {
        $("binder-public-copy-link").textContent = "링크 복사";
      }, 1500);
    } catch {
      window.prompt("공개 바인더 링크를 복사하세요.", window.location.href);
    }
  }

  async function initialize() {
    if (!validPublicId(publicId) || !validBinderId(binderId)) {
      showError("공개 바인더 링크 형식이 올바르지 않습니다.");
      return;
    }
    if (!CONFIG.enabled || !CONFIG.config?.projectId) {
      showError("공개 바인더 연결 설정을 확인하지 못했습니다.");
      return;
    }

    try {
      const [appModule, firestoreModule] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      ]);
      const app = appModule.getApps().length
        ? appModule.getApp()
        : appModule.initializeApp(CONFIG.config);
      const db = firestoreModule.getFirestore(app);
      const binderRef = firestoreModule.doc(
        db,
        "publicProfiles",
        publicId,
        "binders",
        binderId,
      );
      const [profileSnapshot, binderSnapshot, pageSnapshot, chunkSnapshot] = await Promise.all([
        firestoreModule.getDoc(firestoreModule.doc(db, "publicProfiles", publicId)),
        firestoreModule.getDoc(binderRef),
        firestoreModule.getDocs(firestoreModule.collection(binderRef, "pages")),
        firestoreModule.getDocs(firestoreModule.collection(binderRef, "chunks")),
      ]);

      if (!profileSnapshot.exists() || profileSnapshot.data()?.profileCompleted !== true) {
        throw new Error("공개 컬렉터 프로필을 찾지 못했습니다.");
      }
      if (!binderSnapshot.exists()) {
        throw new Error("공개가 중단되었거나 존재하지 않는 바인더입니다.");
      }

      const binder = binderSnapshot.data() || {};
      if (
        binder.schemaVersion !== 1 ||
        binder.publicId !== publicId ||
        binder.binderId !== binderId
      ) {
        throw new Error("공개 바인더 데이터를 확인하지 못했습니다.");
      }
      const pageMap = new Map(
        pageSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data() || {}]),
      );
      const chunks = chunkSnapshot.docs.map((snapshot) => snapshot.data() || {});
      const order = Array.isArray(binder.pageOrder) ? binder.pageOrder : [];
      const pages = order.map((pageId) => {
        const page = pageMap.get(String(pageId));
        if (!page) throw new Error("공개 바인더 페이지를 찾지 못했습니다.");
        return {
          ...page,
          objectUrl: pageBlob(page, chunks),
        };
      });
      if (!pages.length) throw new Error("공개 바인더에 표시할 페이지가 없습니다.");

      state.profile = profileSnapshot.data() || {};
      state.binder = binder;
      state.pages = pages;
      renderBinder();
    } catch (error) {
      console.error("공개 커스텀 바인더 초기화 실패", error);
      showError(error?.message || "공개 바인더를 불러오지 못했습니다.");
    }
  }

  $("binder-public-prev")?.addEventListener("click", () => {
    if (state.pageIndex <= 0) return;
    state.pageIndex -= 1;
    renderCurrentPage();
  });
  $("binder-public-next")?.addEventListener("click", () => {
    if (state.pageIndex >= state.pages.length - 1) return;
    state.pageIndex += 1;
    renderCurrentPage();
  });
  $("binder-public-copy-link")?.addEventListener("click", () => void copyLink());
  window.addEventListener("beforeunload", () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
  });

  void initialize();
})();
