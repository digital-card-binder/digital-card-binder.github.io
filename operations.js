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
    "worldDex",
  ]);
  const WORLD_KEYS = Object.freeze([
    "digitalCardBinderWorldExplorationOwnedV1",
    "digitalCardBinderWorldExplorationCardOverridesV1",
  ]);
  const LEGACY_BACKUP_FORMAT = "digital-card-binder-backup-v1";
  const BACKUP_FORMAT = "digital-card-binder-backup-v2";
  const MAX_CUSTOM_BINDERS = 30;
  const MAX_CUSTOM_BINDER_PAGES = 60;

  const state = {
    firebase: null,
    user: null,
    restorePayload: null,
  };

  const $ = (id) => document.getElementById(id);

  function worldLocalKeys() {
    return state.user?.uid ? [...WORLD_KEYS, ...WORLD_KEYS.map((key) => `${key}:${state.user.uid}`)] : [...WORLD_KEYS];
  }

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

  function customBinderCollectionRef() {
    return state.firebase.firestoreModule.collection(
      state.firebase.db,
      "users",
      state.user.uid,
      "customBinders",
    );
  }

  function customBinderDocumentRef(binderId) {
    return state.firebase.firestoreModule.doc(
      state.firebase.db,
      "users",
      state.user.uid,
      "customBinders",
      binderId,
    );
  }

  function backupChunk(chunkSnapshot, activeChunkSets) {
    const data = chunkSnapshot.data() || {};
    const chunkSet = String(data.chunkSet || "");
    if (!activeChunkSets.has(chunkSet)) return null;
    const encoded = data.data?.toBase64?.();
    if (!encoded) {
      throw new Error(`커스텀 바인더 이미지 조각을 읽지 못했습니다: ${chunkSnapshot.id}`);
    }
    return {
      id: chunkSnapshot.id,
      chunkSet,
      index: Number(data.index),
      size: Number(data.size),
      dataBase64: encoded,
    };
  }

  function backupPage(pageSnapshot) {
    const data = pageSnapshot.data() || {};
    return {
      id: pageSnapshot.id,
      metadata: {
        schemaVersion: 2,
        pageId: String(data.pageId || pageSnapshot.id),
        title: String(data.title || "페이지"),
        grid: data.grid || {},
        background: data.background || {},
        cards: Array.isArray(data.cards) ? data.cards : [],
        slots: Array.isArray(data.slots) ? data.slots : [],
      },
    };
  }

  async function readCustomBinders() {
    const { firestoreModule } = state.firebase;
    const snapshot = await firestoreModule.getDocs(customBinderCollectionRef());
    if (snapshot.size > MAX_CUSTOM_BINDERS) {
      throw new Error(`커스텀 바인더가 ${MAX_CUSTOM_BINDERS}개를 초과해 백업을 중단했습니다.`);
    }

    const binders = [];
    for (const binderSnapshot of snapshot.docs) {
      const data = binderSnapshot.data() || {};
      const schemaVersion = Number(data.schemaVersion) === 2 ? 2 : 1;
      const activeChunkSets = new Set();
      const expectedBySet = new Map();
      let pages = [];

      if (schemaVersion === 2) {
        const pageSnapshot = await firestoreModule.getDocs(
          firestoreModule.collection(binderSnapshot.ref, "pages"),
        );
        if (!pageSnapshot.size || pageSnapshot.size > MAX_CUSTOM_BINDER_PAGES) {
          throw new Error(
            `커스텀 바인더 ‘${String(data.title || binderSnapshot.id)}’의 페이지 수가 올바르지 않아 백업을 중단했습니다.`,
          );
        }
        pages = pageSnapshot.docs.map(backupPage);
        for (const page of pages) {
          const background = page.metadata.background || {};
          const chunkSet = String(background.chunkSet || "");
          const chunkCount = Number(background.chunkCount || 0);
          if (!chunkSet || !chunkCount || activeChunkSets.has(chunkSet)) {
            throw new Error(
              `커스텀 바인더 ‘${String(data.title || binderSnapshot.id)}’의 페이지 배경 정보가 올바르지 않아 백업을 중단했습니다.`,
            );
          }
          activeChunkSets.add(chunkSet);
          expectedBySet.set(chunkSet, chunkCount);
        }
      } else {
        const chunkSet = String(data.background?.chunkSet || "");
        const chunkCount = Number(data.background?.chunkCount || 0);
        if (chunkSet) activeChunkSets.add(chunkSet);
        if (chunkSet) expectedBySet.set(chunkSet, chunkCount);
      }

      const chunkSnapshot = await firestoreModule.getDocs(
        firestoreModule.collection(binderSnapshot.ref, "chunks"),
      );
      const chunks = chunkSnapshot.docs
        .map((item) => backupChunk(item, activeChunkSets))
        .filter(Boolean)
        .sort((a, b) => a.chunkSet.localeCompare(b.chunkSet) || a.index - b.index);

      for (const [chunkSet, expected] of expectedBySet) {
        const actual = chunks.filter((chunk) => chunk.chunkSet === chunkSet).length;
        if (!chunkSet || !expected || actual !== expected) {
          throw new Error(
            `커스텀 바인더 ‘${String(data.title || binderSnapshot.id)}’의 배경 이미지 조각이 완전하지 않아 백업을 중단했습니다.`,
          );
        }
      }

      binders.push({
        id: binderSnapshot.id,
        metadata: schemaVersion === 2
          ? {
              schemaVersion: 2,
              title: String(data.title || "커스텀 바인더"),
              linkedDexId: String(data.linkedDexId || ""),
              pageOrder: Array.isArray(data.pageOrder) ? data.pageOrder : [],
              summary: data.summary || {},
              settings: data.settings || {},
            }
          : {
              schemaVersion: 1,
              title: String(data.title || "커스텀 바인더"),
              grid: data.grid || {},
              background: data.background || {},
              cards: Array.isArray(data.cards) ? data.cards : [],
            },
        pages,
        chunks,
      });
    }
    return binders;
  }

  async function makeBackup() {
    const button = $("operations-backup");
    button.disabled = true;
    setStatus(
      $("operations-backup-status"),
      "도감 데이터와 커스텀 바인더를 읽고 있습니다.",
    );
    try {
      const documents = {};
      for (const documentId of DOCUMENT_IDS) {
        const data = await readCollection(documentId);
        if (data) documents[documentId] = data;
      }
      const overrideShards = {};
      for (const documentId of DOCUMENT_IDS.filter(accountCore.usesOverrideShards)) {
        const reference = accountCore.documentRef(state.firebase.firestoreModule, state.firebase.db, state.user, CONFIG, documentId);
        overrideShards[documentId] = await accountCore.readOverrideShards(state.firebase.firestoreModule, reference, { preferServer: true });
      }
      const customBinders = await readCustomBinders();
      let siteVersion = "";
      try {
        const response = await fetch("./site-version.json", { cache: "no-store" });
        if (response.ok) siteVersion = String((await response.json())?.version || "");
      } catch {}

      const local = {};
      for (const key of worldLocalKeys()) {
        const value = localStorage.getItem(key);
        if (value !== null) local[key] = value;
      }

      const payload = {
        format: BACKUP_FORMAT,
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
        siteVersion,
        documents,
        overrideShards,
        local,
        customBinders,
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
        `${Object.keys(documents).length}개 도감 문서와 커스텀 바인더 ${customBinders.length}개를 백업했습니다.`,
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

  function validBackupGrid(grid, v2 = false) {
    if (!grid || typeof grid !== "object") return false;
    const allowed = v2
      ? [
          [2, 2], [3, 3], [3, 4], [4, 3],
          [4, 4], [4, 5], [5, 4],
        ]
      : [[3, 3], [3, 4], [4, 4]];
    return allowed.some(([cols, rows]) => grid.cols === cols && grid.rows === rows)
      && grid.slotCount === grid.cols * grid.rows
      && grid.cardWidthMm === 63
      && grid.cardHeightMm === 88
      && grid.canvasWidthMm === grid.cols * 63
      && grid.canvasHeightMm === grid.rows * 88
      && !Object.keys(grid).some((key) =>
        !["cols", "rows", "slotCount", "cardWidthMm", "cardHeightMm", "canvasWidthMm", "canvasHeightMm"].includes(key)
      );
  }

  function validBackupBackground(background) {
    return Boolean(
      background &&
      typeof background === "object" &&
      typeof background.name === "string" &&
      background.name.length >= 1 &&
      background.name.length <= 180 &&
      ["image/png", "image/jpeg", "image/webp"].includes(background.type) &&
      Number.isInteger(background.size) &&
      background.size >= 1 &&
      background.size <= 10485760 &&
      Number.isInteger(background.chunkCount) &&
      background.chunkCount >= 1 &&
      background.chunkCount <= 24 &&
      typeof background.chunkSet === "string" &&
      background.chunkSet.length >= 8 &&
      background.chunkSet.length <= 80 &&
      Number.isInteger(background.width) &&
      background.width >= 1 &&
      background.width <= 20000 &&
      Number.isInteger(background.height) &&
      background.height >= 1 &&
      background.height <= 20000 &&
      !Object.keys(background).some((key) =>
        !["name", "type", "size", "chunkCount", "chunkSet", "width", "height"].includes(key)
      )
    );
  }

  function validateCustomBinderBackup(binders) {
    if (!Array.isArray(binders) || binders.length > MAX_CUSTOM_BINDERS) {
      throw new Error("백업의 커스텀 바인더 목록이 올바르지 않습니다.");
    }

    const seenBinders = new Set();
    for (const binder of binders) {
      if (
        !binder ||
        typeof binder !== "object" ||
        !/^[A-Za-z0-9_-]{8,120}$/.test(String(binder.id || ""))
      ) {
        throw new Error("백업의 커스텀 바인더 ID가 올바르지 않습니다.");
      }
      if (seenBinders.has(binder.id)) throw new Error("백업에 중복된 바인더 ID가 있습니다.");
      seenBinders.add(binder.id);

      const metadata = binder.metadata;
      const schemaVersion = Number(metadata?.schemaVersion) === 2 ? 2 : 1;
      const expectedBySet = new Map();

      if (
        !metadata ||
        typeof metadata !== "object" ||
        typeof metadata.title !== "string" ||
        metadata.title.length < 1 ||
        metadata.title.length > 60
      ) {
        throw new Error(`커스텀 바인더 ‘${binder.id}’의 메타데이터가 올바르지 않습니다.`);
      }

      if (schemaVersion === 1) {
        if (
          !validBackupGrid(metadata.grid, false) ||
          !validBackupBackground(metadata.background) ||
          !Array.isArray(metadata.cards) ||
          metadata.cards.length > 16
        ) {
          throw new Error(`커스텀 바인더 ‘${binder.id}’의 v1 메타데이터가 올바르지 않습니다.`);
        }
        expectedBySet.set(metadata.background.chunkSet, metadata.background.chunkCount);
      } else {
        const pages = Array.isArray(binder.pages) ? binder.pages : [];
        const pageOrder = Array.isArray(metadata.pageOrder) ? metadata.pageOrder : [];
        const summary = metadata.summary;
        const settings = metadata.settings;
        if (
          typeof metadata.linkedDexId !== "string" ||
          metadata.linkedDexId.length > 120 ||
          !pageOrder.length ||
          pageOrder.length > MAX_CUSTOM_BINDER_PAGES ||
          pages.length !== pageOrder.length ||
          !summary ||
          typeof summary !== "object" ||
          summary.pageCount !== pageOrder.length ||
          !Number.isInteger(summary.cardCount) ||
          summary.cardCount < 0 ||
          summary.cardCount > 1200 ||
          !summary.firstGrid ||
          !Number.isInteger(summary.firstGrid.cols) ||
          !Number.isInteger(summary.firstGrid.rows) ||
          !settings ||
          !["fit", "card", "sleeve"].includes(settings.defaultPrintMode) ||
          !["color", "grayscale", "dim", "empty"].includes(settings.missingCardDisplay)
        ) {
          throw new Error(`커스텀 바인더 ‘${binder.id}’의 v2 메타데이터가 올바르지 않습니다.`);
        }

        const pageMap = new Map();
        for (const page of pages) {
          const pageData = page?.metadata;
          const pageId = String(page?.id || "");
          if (
            !/^[A-Za-z0-9_-]{1,120}$/.test(pageId) ||
            pageMap.has(pageId) ||
            !pageData ||
            pageData.schemaVersion !== 2 ||
            pageData.pageId !== pageId ||
            typeof pageData.title !== "string" ||
            pageData.title.length < 1 ||
            pageData.title.length > 60 ||
            !validBackupGrid(pageData.grid, true) ||
            !validBackupBackground(pageData.background) ||
            !Array.isArray(pageData.cards) ||
            pageData.cards.length > 20 ||
            !Array.isArray(pageData.slots) ||
            pageData.slots.length > 20
          ) {
            throw new Error(`커스텀 바인더 ‘${binder.id}’의 페이지 데이터가 올바르지 않습니다.`);
          }
          pageMap.set(pageId, pageData);
          if (expectedBySet.has(pageData.background.chunkSet)) {
            throw new Error(`커스텀 바인더 ‘${binder.id}’에 중복된 배경 이미지 세트가 있습니다.`);
          }
          expectedBySet.set(pageData.background.chunkSet, pageData.background.chunkCount);
        }
        const orderedIds = pageOrder.map((pageId) => String(pageId));
        if (
          new Set(orderedIds).size !== orderedIds.length ||
          orderedIds.some((pageId) => !pageMap.has(pageId)) ||
          [...pageMap.keys()].some((pageId) => !orderedIds.includes(pageId))
        ) {
          throw new Error(`커스텀 바인더 ‘${binder.id}’의 페이지 순서가 올바르지 않습니다.`);
        }
      }

      const chunks = Array.isArray(binder.chunks) ? binder.chunks : [];
      const expectedTotal = [...expectedBySet.values()].reduce((sum, count) => sum + count, 0);
      if (!chunks.length || chunks.length !== expectedTotal) {
        throw new Error(`커스텀 바인더 ‘${binder.id}’의 이미지 조각이 올바르지 않습니다.`);
      }

      const seenChunkIds = new Set();
      const seenIndexesBySet = new Map();
      const bytesBySet = new Map();
      for (const chunk of chunks) {
        const expectedCount = expectedBySet.get(chunk?.chunkSet);
        const validChunk = chunk
          && /^[A-Za-z0-9_-]{12,90}$/.test(String(chunk.id || ""))
          && typeof chunk.chunkSet === "string"
          && expectedBySet.has(chunk.chunkSet)
          && chunk.chunkSet.length >= 8
          && chunk.chunkSet.length <= 80
          && Number.isInteger(chunk.index)
          && chunk.index >= 0
          && chunk.index < expectedCount
          && Number.isInteger(chunk.size)
          && chunk.size >= 1
          && chunk.size <= 614400
          && typeof chunk.dataBase64 === "string"
          && chunk.dataBase64.length > 0
          && chunk.dataBase64.length <= 820000;
        const indexes = seenIndexesBySet.get(chunk?.chunkSet) || new Set();
        if (!validChunk || indexes.has(chunk.index) || seenChunkIds.has(chunk.id)) {
          throw new Error(`커스텀 바인더 ‘${binder.id}’의 이미지 조각이 손상되었습니다.`);
        }
        const bytes = state.firebase.firestoreModule.Bytes.fromBase64String(chunk.dataBase64);
        if (bytes.toUint8Array().length !== chunk.size) {
          throw new Error(`커스텀 바인더 ‘${binder.id}’의 이미지 조각 크기가 맞지 않습니다.`);
        }
        indexes.add(chunk.index);
        seenIndexesBySet.set(chunk.chunkSet, indexes);
        bytesBySet.set(chunk.chunkSet, (bytesBySet.get(chunk.chunkSet) || 0) + chunk.size);
        seenChunkIds.add(chunk.id);
      }

      for (const [chunkSet, expectedCount] of expectedBySet) {
        const indexes = seenIndexesBySet.get(chunkSet) || new Set();
        const background = schemaVersion === 1
          ? metadata.background
          : binder.pages.find((page) => page.metadata.background.chunkSet === chunkSet).metadata.background;
        if (
          indexes.size !== expectedCount ||
          bytesBySet.get(chunkSet) !== background.size
        ) {
          throw new Error(`커스텀 바인더 ‘${binder.id}’의 이미지 조각 수가 맞지 않습니다.`);
        }
      }
    }
    return binders;
  }

  function validateBackup(payload) {
    const isLegacy = payload?.format === LEGACY_BACKUP_FORMAT
      && payload?.schemaVersion === 1;
    const isCurrent = payload?.format === BACKUP_FORMAT
      && payload?.schemaVersion === 2;
    if (!payload || (!isLegacy && !isCurrent)) {
      throw new Error("이 운영센터에서 만든 백업 파일이 아닙니다.");
    }
    if (!payload.documents || typeof payload.documents !== "object" || Array.isArray(payload.documents)) {
      throw new Error("백업의 도감 문서가 올바르지 않습니다.");
    }
    for (const key of Object.keys(payload.documents)) {
      if (!DOCUMENT_IDS.includes(key) || !payload.documents[key] || typeof payload.documents[key] !== "object" || Array.isArray(payload.documents[key])) {
        throw new Error(`지원하지 않는 도감 문서가 포함되어 있습니다: ${key}`);
      }
    }
    if (payload.overrideShards !== undefined) {
      if (!payload.overrideShards || typeof payload.overrideShards !== "object" || Array.isArray(payload.overrideShards)) throw new Error("백업의 분할 보유 문서가 올바르지 않습니다.");
      for (const [documentId, shards] of Object.entries(payload.overrideShards)) {
        if (!accountCore.usesOverrideShards(documentId) || !Array.isArray(shards) || shards.length > 128) throw new Error("지원하지 않는 분할 보유 문서입니다.");
        const seen = new Set();
        for (const shard of shards) {
          if (!shard || !/^s[0-7][0-9a-f]$/.test(shard.id) || seen.has(shard.id) || shard.schemaVersion !== 1
            || !shard.overrides || typeof shard.overrides !== "object" || Array.isArray(shard.overrides)
            || Object.keys(shard.overrides).length > 2000) throw new Error("분할 보유 문서가 손상되었습니다.");
          seen.add(shard.id);
        }
      }
    }
    if (payload.local !== undefined) {
      if (!payload.local || typeof payload.local !== "object" || Array.isArray(payload.local)) throw new Error("로컬 백업이 올바르지 않습니다.");
      for (const key of worldLocalKeys()) {
        if (payload.local[key] === undefined) continue;
        if (typeof payload.local[key] !== "string") throw new Error("로컬 백업이 올바르지 않습니다.");
        const value = JSON.parse(payload.local[key]);
        if (key.startsWith(WORLD_KEYS[0]) ? !Array.isArray(value) : !value || typeof value !== "object" || Array.isArray(value)) throw new Error("월드 로컬 백업이 올바르지 않습니다.");
      }
    }
    if (isCurrent) validateCustomBinderBackup(payload.customBinders);
    else payload.customBinders = [];
    return payload;
  }

  function restoreDocumentWrites(payload) {
    const writes = [];
    const timestamp = new Date().toISOString();
    for (const [documentId, source] of Object.entries(payload.documents)) {
      const data = { ...source };
      data.baseMode = source.baseMode === "legacy" && accountCore.baseMode(CONFIG, state.user) === "legacy"
        ? "legacy" : accountCore.baseMode(CONFIG, state.user);
      data.email = state.user.email || "";
      data.displayName = state.user.displayName || "";
      if (accountCore.usesOverrideShards(documentId)) {
        const effective = accountCore.mergedCollectionData(source, payload.overrideShards?.[documentId] || []);
        const buckets = new Map();
        for (const [key, raw] of Object.entries(effective.overrides)) {
          const value = typeof raw === "boolean" ? { owned: raw } : raw;
          if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("백업의 보유 값이 올바르지 않습니다.");
          const id = accountCore.overrideShardId(key);
          if (!buckets.has(id)) buckets.set(id, {});
          buckets.get(id)[key] = { ...value, updatedAt: timestamp };
        }
        delete data.overrides;
        for (const [shardId, overrides] of buckets) {
          if (Object.keys(overrides).length > 2000 || new TextEncoder().encode(JSON.stringify(overrides)).length > 750000) throw new Error("복구할 분할 문서가 너무 큽니다.");
          writes.push({ documentId, shardId, data: { schemaVersion: 1, overrides } });
        }
      }
      writes.push({ documentId, data });
    }

    const binderRootCount = payload.customBinders?.length || 0;
    const binderPageCount = (payload.customBinders || []).reduce(
      (sum, binder) => sum + (Array.isArray(binder.pages) ? binder.pages.length : 0),
      0,
    );
    const bytes = writes.reduce(
      (sum, write) => sum + new TextEncoder().encode(JSON.stringify(write.data)).length,
      0,
    ) + (payload.customBinders || []).reduce(
      (sum, binder) =>
        sum +
        new TextEncoder().encode(JSON.stringify(binder.metadata)).length +
        new TextEncoder().encode(JSON.stringify(binder.pages || [])).length,
      0,
    );
    if (writes.length + binderRootCount + binderPageCount > 450 || bytes > 8 * 1024 * 1024) {
      throw new Error("백업이 한 번에 안전하게 반영할 수 있는 크기를 초과합니다. 아무 도감도 변경하지 않았습니다.");
    }
    return writes;
  }

  async function restoreCustomBinders(binders, finalBatch) {
    const { firestoreModule, db } = state.firebase;
    for (const binder of binders) {
      const reference = customBinderDocumentRef(binder.id);
      const current = await firestoreModule.getDoc(reference);
      const currentPages = await firestoreModule.getDocs(
        firestoreModule.collection(reference, "pages"),
      );

      const chunkSetMap = new Map();
      for (const chunk of binder.chunks) {
        if (!chunkSetMap.has(chunk.chunkSet)) {
          chunkSetMap.set(
            chunk.chunkSet,
            `restore_${crypto.randomUUID().replaceAll("-", "")}`,
          );
        }
      }

      for (let start = 0; start < binder.chunks.length; start += 4) {
        const chunkBatch = firestoreModule.writeBatch(db);
        for (const chunk of binder.chunks.slice(start, start + 4)) {
          const bytes = firestoreModule.Bytes.fromBase64String(chunk.dataBase64);
          const restoredChunkSet = chunkSetMap.get(chunk.chunkSet);
          chunkBatch.set(
            firestoreModule.doc(
              reference,
              "chunks",
              `${restoredChunkSet}_${String(chunk.index).padStart(3, "0")}`,
            ),
            {
              ownerUid: state.user.uid,
              chunkSet: restoredChunkSet,
              index: chunk.index,
              data: bytes,
              size: chunk.size,
              updatedAt: firestoreModule.serverTimestamp(),
            },
          );
        }
        await chunkBatch.commit();
      }

      const schemaVersion = Number(binder.metadata?.schemaVersion) === 2 ? 2 : 1;

      if (schemaVersion === 2) {
        const existingPages = new Map(currentPages.docs.map((page) => [page.id, page.data() || {}]));
        const restoredPageIds = new Set((binder.pages || []).map((page) => page.id));
        currentPages.forEach((page) => {
          if (!restoredPageIds.has(page.id)) finalBatch.delete(page.ref);
        });
        for (const page of binder.pages || []) {
          const pageData = page.metadata;
          const restoredChunkSet = chunkSetMap.get(pageData.background.chunkSet);
          const pageReference = firestoreModule.doc(reference, "pages", page.id);
          finalBatch.set(pageReference, {
            schemaVersion: 2,
            ownerUid: state.user.uid,
            pageId: page.id,
            title: pageData.title,
            grid: pageData.grid,
            background: { ...pageData.background, chunkSet: restoredChunkSet },
            cards: pageData.cards,
            slots: pageData.slots,
            createdAt: existingPages.get(page.id)?.createdAt || firestoreModule.serverTimestamp(),
            updatedAt: firestoreModule.serverTimestamp(),
          });
        }
        finalBatch.set(reference, {
          schemaVersion: 2,
          ownerUid: state.user.uid,
          title: binder.metadata.title,
          linkedDexId: binder.metadata.linkedDexId,
          pageOrder: binder.metadata.pageOrder,
          summary: binder.metadata.summary,
          settings: binder.metadata.settings,
          createdAt: current.exists() ? current.data().createdAt : firestoreModule.serverTimestamp(),
          updatedAt: firestoreModule.serverTimestamp(),
        });
      } else {
        currentPages.forEach((page) => finalBatch.delete(page.ref));
        const restoredChunkSet = chunkSetMap.get(binder.metadata.background.chunkSet);
        finalBatch.set(reference, {
          schemaVersion: 1,
          ownerUid: state.user.uid,
          title: binder.metadata.title,
          grid: binder.metadata.grid,
          background: { ...binder.metadata.background, chunkSet: restoredChunkSet },
          cards: binder.metadata.cards,
          createdAt: current.exists() ? current.data().createdAt : firestoreModule.serverTimestamp(),
          updatedAt: firestoreModule.serverTimestamp(),
        });
      }
    }
    return binders.length;
  }

  async function readRestoreFile(file) {
    const text = await file.text();
    return validateBackup(JSON.parse(text));
  }

  async function restoreBackup() {
    const payload = state.restorePayload;
    if (!payload || !state.user) return;
    const documentCount = Object.keys(payload.documents).length;
    const binderCount = Array.isArray(payload.customBinders)
      ? payload.customBinders.length
      : 0;
    if (!confirm(
      `${documentCount}개 도감 문서와 커스텀 바인더 ${binderCount}개를 백업 내용으로 복구할까요?\n현재 저장 데이터가 변경됩니다.`,
    )) return;

    const button = $("operations-restore");
    button.disabled = true;
    setStatus($("operations-restore-status"), "백업을 복구하고 있습니다.");
    try {
      validateBackup(payload);
      const writes = restoreDocumentWrites(payload);
      const { firestoreModule, db } = state.firebase;
      const batch = firestoreModule.writeBatch(db);
      for (const write of writes) {
        let ref = accountCore.documentRef(firestoreModule, db, state.user, CONFIG, write.documentId);
        if (write.shardId) ref = firestoreModule.doc(ref, "overrideShards", write.shardId);
        const data = { ...write.data, updatedAt: firestoreModule.serverTimestamp() };
        if (write.shardId) {
          batch.set(ref, data, { mergeFields: ["schemaVersion", "updatedAt", ...Object.keys(data.overrides).map((key) => new firestoreModule.FieldPath("overrides", key))] });
        } else {
          batch.set(ref, data, { merge: true });
        }
      }
      const restoredBinders = await restoreCustomBinders(payload.customBinders || [], batch);
      await batch.commit();

      try {
      if (payload.local && typeof payload.local === "object") {
        for (const key of worldLocalKeys()) {
          if (typeof payload.local[key] === "string") {
            localStorage.setItem(key, payload.local[key]);
          }
        }
      }

      } catch (error) { console.warn("원격 복구는 완료됐지만 로컬 캐시 반영을 건너뛰었습니다.", error); }
      setStatus(
        $("operations-restore-status"),
        `복구를 완료했습니다. 도감 ${documentCount}개와 커스텀 바인더 ${restoredBinders}개를 반영했습니다. 새로고침하면 복구된 상태가 적용됩니다.`,
        "success",
      );
    } catch (error) {
      console.error("백업 복구 실패", error);
      setStatus(
        $("operations-restore-status"),
        `${error?.message || "백업을 복구하지 못했습니다."} 도감과 활성 바인더 변경은 한 번에 반영됩니다. 원격 반영 전 실패라면 기존 내용이 유지되며 같은 백업으로 재시도할 수 있습니다.`,
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
          `${Object.keys(state.restorePayload.documents).length}개 도감 문서와 커스텀 바인더 ${state.restorePayload.customBinders?.length || 0}개가 들어 있는 백업입니다.`,
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
