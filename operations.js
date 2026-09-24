"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const accountCore = window.DigitalCardBinder?.firebaseAccount;
  const DOCUMENT_IDS = Object.freeze([
    "nationalDex",
    "packDex",
    "artistDex",
    "seriesDex",
    "pokemonCollectionsDex",
    "arDex",
    "trainerPokemonDex",
  ]);
  const WORLD_KEYS = Object.freeze([
    "digitalCardBinderWorldExplorationOwnedV1",
    "digitalCardBinderWorldExplorationCardOverridesV1",
  ]);
  const BACKUP_FORMAT = "digital-card-binder-backup-v1";

  const state = {
    firebase: null,
    user: null,
    restorePayload: null,
  };

  const $ = (id) => document.getElementById(id);

  function setStatus(element, message, type = "") {
    if (!element) return;
    element.textContent = message;
    element.dataset.state = type;
  }

  async function firebaseContext() {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
    ]);
    const app = appModule.getApps().length
      ? appModule.getApp()
      : appModule.initializeApp(CONFIG.config);
    const auth = authModule.getAuth(app);
    const user = await accountCore.firstAuthUser(auth, authModule);
    return {
      authModule,
      firestoreModule,
      auth,
      db: firestoreModule.getFirestore(app),
      user,
    };
  }

  async function loadWatch() {
    try {
      const response = await fetch("./data/update-watch.json", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const report = await response.json();
      const products = Array.isArray(report.detectedProducts)
        ? report.detectedProducts.filter(Boolean)
        : [];
      const attention = report.status === "attention" || products.length > 0;
      const badge = $("operations-watch-badge");
      badge.dataset.state = attention ? "warning" : "ok";
      badge.textContent = attention ? "확인 필요" : "정상";
      $("operations-watch-status").textContent = attention
        ? "새 제품 후보 발견"
        : "새 제품 후보 없음";
      $("operations-watch-products").textContent = products.length
        ? products.join(", ")
        : "없음";
      $("operations-watch-date").textContent = report.lastChangedAt
        ? new Intl.DateTimeFormat("ko-KR", {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(report.lastChangedAt))
        : "—";
    } catch (error) {
      const badge = $("operations-watch-badge");
      badge.dataset.state = "warning";
      badge.textContent = "확인 실패";
      $("operations-watch-status").textContent = "감시 상태 파일을 불러오지 못했습니다.";
      console.warn("업데이트 감시 상태 로드 실패", error);
    }
  }

  async function readCollection(documentId) {
    const ref = accountCore.documentRef(
      state.firebase.firestoreModule,
      state.firebase.db,
      state.user,
      CONFIG,
      documentId,
    );
    const snapshot = await state.firebase.firestoreModule.getDoc(ref);
    return snapshot.exists() ? snapshot.data() || {} : null;
  }

  async function makeBackup() {
    const button = $("operations-backup");
    button.disabled = true;
    setStatus($("operations-backup-status"), "도감 데이터를 읽고 있습니다.");
    try {
      const documents = {};
      for (const documentId of DOCUMENT_IDS) {
        const data = await readCollection(documentId);
        if (data) documents[documentId] = data;
      }
      let siteVersion = "";
      try {
        const response = await fetch("./site-version.json", { cache: "no-store" });
        if (response.ok) siteVersion = String((await response.json())?.version || "");
      } catch {}

      const local = {};
      for (const key of WORLD_KEYS) {
        const value = localStorage.getItem(key);
        if (value !== null) local[key] = value;
      }

      const payload = {
        format: BACKUP_FORMAT,
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        siteVersion,
        documents,
        local,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      link.href = url;
      link.download = `digital-card-binder-backup-${date}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus(
        $("operations-backup-status"),
        `${Object.keys(documents).length}개 도감 문서를 백업했습니다.`,
        "success",
      );
    } catch (error) {
      console.error("백업 생성 실패", error);
      setStatus(
        $("operations-backup-status"),
        error?.message || "백업 파일을 만들지 못했습니다.",
        "error",
      );
    } finally {
      button.disabled = false;
    }
  }

  function validateBackup(payload) {
    if (!payload || payload.format !== BACKUP_FORMAT || payload.schemaVersion !== 1) {
      throw new Error("이 운영센터에서 만든 백업 파일이 아닙니다.");
    }
    if (!payload.documents || typeof payload.documents !== "object" || Array.isArray(payload.documents)) {
      throw new Error("백업의 도감 문서가 올바르지 않습니다.");
    }
    for (const key of Object.keys(payload.documents)) {
      if (!DOCUMENT_IDS.includes(key)) {
        throw new Error(`지원하지 않는 도감 문서가 포함되어 있습니다: ${key}`);
      }
    }
    return payload;
  }

  async function readRestoreFile(file) {
    const text = await file.text();
    return validateBackup(JSON.parse(text));
  }

  async function restoreBackup() {
    const payload = state.restorePayload;
    if (!payload || !state.user) return;
    const documentCount = Object.keys(payload.documents).length;
    if (!confirm(
      `${documentCount}개 도감 문서를 백업 시점 상태로 복구할까요?\n현재 도감 데이터가 변경됩니다.`,
    )) return;

    const button = $("operations-restore");
    button.disabled = true;
    setStatus($("operations-restore-status"), "백업을 복구하고 있습니다.");
    try {
      const { firestoreModule, db } = state.firebase;
      const batch = firestoreModule.writeBatch(db);
      const requiredBaseMode = accountCore.baseMode(CONFIG, state.user);

      for (const [documentId, source] of Object.entries(payload.documents)) {
        const data = source && typeof source === "object" && !Array.isArray(source)
          ? { ...source }
          : {};
        data.baseMode = data.baseMode === "legacy" && requiredBaseMode === "legacy"
          ? "legacy"
          : requiredBaseMode;
        data.email = state.user.email || "";
        data.displayName = state.user.displayName || "";
        data.updatedAt = firestoreModule.serverTimestamp();
        const ref = accountCore.documentRef(
          firestoreModule,
          db,
          state.user,
          CONFIG,
          documentId,
        );
        batch.set(ref, data);
      }
      await batch.commit();

      if (payload.local && typeof payload.local === "object") {
        for (const key of WORLD_KEYS) {
          if (typeof payload.local[key] === "string") {
            localStorage.setItem(key, payload.local[key]);
          }
        }
      }

      setStatus(
        $("operations-restore-status"),
        "복구를 완료했습니다. 새로고침하면 복구된 상태가 적용됩니다.",
        "success",
      );
    } catch (error) {
      console.error("백업 복구 실패", error);
      setStatus(
        $("operations-restore-status"),
        error?.message || "백업을 복구하지 못했습니다.",
        "error",
      );
      button.disabled = false;
    }
  }

  function bindEvents() {
    $("operations-backup").addEventListener("click", makeBackup);
    $("operations-restore-file").addEventListener("change", async (event) => {
      const file = event.currentTarget.files?.[0];
      state.restorePayload = null;
      $("operations-restore").disabled = true;
      if (!file) return;
      try {
        state.restorePayload = await readRestoreFile(file);
        $("operations-restore").disabled = false;
        setStatus(
          $("operations-restore-status"),
          `${Object.keys(state.restorePayload.documents).length}개 도감 문서가 들어 있는 백업입니다.`,
          "success",
        );
      } catch (error) {
        setStatus(
          $("operations-restore-status"),
          error?.message || "백업 파일을 읽지 못했습니다.",
          "error",
        );
      }
    });
    $("operations-restore").addEventListener("click", restoreBackup);
  }

  async function init() {
    await accountCore?.installHeaderPanel?.(CONFIG);
    await loadWatch();
    try {
      state.firebase = await firebaseContext();
      state.user = state.firebase.user;
      if (!state.user) {
        $("operations-gate-message").textContent =
          "관리자 계정으로 Google 로그인하면 운영센터를 사용할 수 있습니다.";
        $("operations-login").hidden = false;
        $("operations-login").addEventListener(
          "click",
          () => document.querySelector("#firebase-login")?.click(),
        );
        return;
      }
      if (!accountCore.isOwner(CONFIG, state.user)) {
        $("operations-gate-message").textContent =
          "이 화면은 사이트 관리자 계정에서만 사용할 수 있습니다.";
        return;
      }
      $("operations-gate").hidden = true;
      $("operations-content").hidden = false;
      bindEvents();
    } catch (error) {
      console.error("운영센터 초기화 실패", error);
      $("operations-gate-message").textContent = "관리자 계정을 확인하지 못했습니다.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    void init();
  }
})();
