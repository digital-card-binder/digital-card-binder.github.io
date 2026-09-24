"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const registry = window.CollectorCollectionRegistry;
  const sync = window.CollectorPublicSync;
  const catalogService = window.DigitalCardBinder?.catalog;
  const accountService = window.DigitalCardBinder?.firebaseAccount;
  const imageCdn = window.DigitalCardBinderImageCdn;

  const elements = {
    gate: document.querySelector("#health-access-gate"),
    accessMessage: document.querySelector("#health-access-message"),
    login: document.querySelector("#health-login"),
    content: document.querySelector("#health-content"),
    overallDot: document.querySelector("#health-overall-dot"),
    overallLabel: document.querySelector("#health-overall-label"),
    runTime: document.querySelector("#health-run-time"),
    summaryCollections: document.querySelector("#health-summary-collections"),
    summaryWarnings: document.querySelector("#health-summary-warnings"),
    summaryImages: document.querySelector("#health-summary-images"),
    summaryOrphans: document.querySelector("#health-summary-orphans"),
    collectionRows: document.querySelector("#health-collection-rows"),
    dataBadge: document.querySelector("#health-data-badge"),
    dataDetails: document.querySelector("#health-data-details"),
    imageBadge: document.querySelector("#health-image-badge"),
    imageExpected: document.querySelector("#health-image-expected"),
    imageMissingRef: document.querySelector("#health-image-missing-ref"),
    imageUnroutable: document.querySelector("#health-image-unroutable"),
    imageArchiveMissing: document.querySelector("#health-image-archive-missing"),
    imageStatus: document.querySelector("#health-image-status"),
    imageDetails: document.querySelector("#health-image-details"),
    accountBadge: document.querySelector("#health-account-badge"),
    accountGrid: document.querySelector("#health-account-grid"),
    accountDetails: document.querySelector("#health-account-details"),
    siteVersion: document.querySelector("#health-site-version"),
    appVersion: document.querySelector("#health-app-version"),
    cdnVersion: document.querySelector("#health-cdn-version"),
    dataDate: document.querySelector("#health-data-date"),
    refresh: document.querySelector("#health-refresh"),
  };

  const dataCache = new Map();
  let firebase = null;
  let currentUser = null;
  let running = false;

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "—";
    return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function configured() {
    return Boolean(
      CONFIG.enabled &&
        CONFIG.config?.apiKey &&
        CONFIG.config?.authDomain &&
        CONFIG.config?.projectId,
    );
  }

  async function fetchJson(path) {
    if (!dataCache.has(path)) {
      dataCache.set(
        path,
        fetch(path, { cache: "no-store" }).then((response) => {
          if (!response.ok) throw new Error(`${path} ${response.status}`);
          return response.json();
        }),
      );
    }
    return dataCache.get(path);
  }

  async function fetchText(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return response.text();
  }

  function duplicateValues(values) {
    const seen = new Set();
    const duplicates = new Set();
    values.forEach((value) => {
      const key = clean(value);
      if (!key) return;
      if (seen.has(key)) duplicates.add(key);
      else seen.add(key);
    });
    return [...duplicates];
  }

  function sumGroupCards(groups) {
    return (Array.isArray(groups) ? groups : []).reduce(
      (sum, group) => sum + (Array.isArray(group?.cards) ? group.cards.length : 0),
      0,
    );
  }

  async function rawCountFor(collectionId) {
    if (collectionId === "national") {
      const payload = await fetchJson("./data/pokedex.json");
      return Array.isArray(payload?.records) ? payload.records.length : 0;
    }
    if (collectionId === "people") {
      const payload = await fetchJson("./data/people.json");
      return Array.isArray(payload?.people) ? payload.people.length : 0;
    }
    if (collectionId === "pack") {
      const source = await fetchText("./packs.js");
      return [...source.matchAll(/\["[^"]+","[^"]+","[^"]+",[01]\]/g)].length;
    }
    if (collectionId === "artist") {
      const payload = await fetchJson("./data/artists.json");
      return sumGroupCards(payload?.artists || []);
    }
    if (collectionId === "trainerPokemon") {
      const payload = await fetchJson("./data/trainer-pokemon.json");
      return sumGroupCards(payload?.groups || []);
    }
    if (collectionId === "series") {
      return sumGroupCards(await catalogService.series());
    }
    if (collectionId === "ar") {
      return sumGroupCards(await catalogService.ar());
    }
    if (collectionId === "pokemon") {
      return sumGroupCards(await catalogService.pokemonCollections());
    }
    return 0;
  }

  function rowState(row) {
    if (row.duplicates.length || row.renderMismatch || row.emptyNames) return "error";
    if (Number.isFinite(row.expected) && row.expected !== row.total) return "warning";
    return "ok";
  }

  async function auditCoreCollections() {
    const rows = await Promise.all(
      registry.COLLECTION_ORDER.map(async (collectionId) => {
        const meta = registry.COLLECTIONS[collectionId];
        const [catalog, rawCount] = await Promise.all([
          registry.loadCatalog(collectionId),
          rawCountFor(collectionId),
        ]);
        const keys = catalog.items.map((item) => item.key);
        const duplicates = duplicateValues(keys);
        const emptyNames = catalog.items.filter((item) => !clean(item.name)).length;
        const expected = Number(meta.catalogCount);
        const row = {
          id: collectionId,
          title: meta.title,
          unit: meta.unit,
          total: catalog.items.length,
          rawCount,
          expected: Number.isFinite(expected) ? expected : null,
          duplicates,
          emptyNames,
          renderMismatch: Math.abs(rawCount - catalog.items.length),
          source: "핵심 도감",
        };
        row.state = rowState(row);
        return row;
      }),
    );

    const [fossil, world] = await Promise.all([
      fetchJson("./data/fossil.json"),
      fetchJson("./data/world-exploration.json"),
    ]);

    const fossilCards = (fossil?.groups || []).flatMap((group) =>
      (group.cards || []).map((card) => ({
        key: `${clean(card.set)}::${clean(card.cardNumber || card.meta)}`,
        name: card.name,
      })),
    );
    const worldSlots = (world?.generations || []).flatMap((generation) =>
      (generation.slots || []).map((slot) => ({
        key: clean(slot.id),
        name: slot.title,
      })),
    );

    const auxiliary = [
      {
        id: "fossil",
        title: "화석 도감",
        unit: "장",
        total: fossilCards.length,
        rawCount: fossilCards.length,
        expected: Number.isFinite(Number(fossil?.total)) ? Number(fossil.total) : null,
        duplicates: duplicateValues(fossilCards.map((item) => item.key)),
        emptyNames: fossilCards.filter((item) => !clean(item.name)).length,
        renderMismatch: 0,
        source: "보조 도감",
      },
      {
        id: "world",
        title: "월드탐험도감",
        unit: "장",
        total: worldSlots.length,
        rawCount: worldSlots.length,
        expected: null,
        duplicates: duplicateValues(worldSlots.map((item) => item.key)),
        emptyNames: worldSlots.filter((item) => !clean(item.name)).length,
        renderMismatch: 0,
        source: "보조 도감",
      },
    ].map((row) => ({ ...row, state: rowState(row) }));

    return [...rows, ...auxiliary];
  }

  function imageValue(record) {
    return clean(
      record?.image ||
        record?.imageUrl ||
        record?.imageLarge ||
        record?.officialImageSource,
    );
  }

  function cardLabel(prefix, record, fallback = "") {
    return [
      prefix,
      record?.name || record?.nameKo || record?.pokemonName || fallback,
      record?.cardNumber || record?.meta || record?.code || record?.number || "",
    ].filter(Boolean).join(" · ");
  }

  async function cardImageRecords() {
    const [pokedex, artists, people, trainer, fossil, world, series, ar, pokemon] =
      await Promise.all([
        fetchJson("./data/pokedex.json"),
        fetchJson("./data/artists.json"),
        fetchJson("./data/people.json"),
        fetchJson("./data/trainer-pokemon.json"),
        fetchJson("./data/fossil.json"),
        fetchJson("./data/world-exploration.json"),
        catalogService.series(),
        catalogService.ar(),
        catalogService.pokemonCollections(),
      ]);

    const records = [];
    const addCards = (label, groups) => {
      (groups || []).forEach((group) => {
        (group.cards || []).forEach((card) => {
          records.push({
            label: cardLabel(label, card, group.name || group.title || group.code),
            image: imageValue(card),
          });
        });
      });
    };

    (pokedex?.records || []).forEach((record) => {
      records.push({
        label: cardLabel("전국도감", record),
        image: imageValue(record),
      });
    });
    addCards("시리즈 도감", series);
    addCards("AR 전종도감", ar);
    addCards("포켓몬 컬렉션", pokemon);
    addCards("작가 도감", artists?.artists || []);
    addCards("트레이너 × 포켓몬", trainer?.groups || []);
    addCards("화석 도감", fossil?.groups || []);

    (people?.people || []).filter((person) => person.cardExists === true).forEach((person) => {
      records.push({
        label: cardLabel("인물도감", person),
        image: imageValue(person),
      });
    });

    (world?.generations || []).forEach((generation) => {
      (generation.slots || []).forEach((slot) => {
        records.push({
          label: `월드탐험도감 · ${slot.title || slot.id}`,
          image: imageValue(slot.card || {}),
        });
      });
    });

    return records;
  }

  function archiveOrigins() {
    const probes = {
      modern: "https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV1S/SV1S_001.png",
      legacy: "https://cards.image.pokemonkorea.co.kr/data/wmimages/BW/BGR/bw4_001.jpg",
    };
    const result = {};
    for (const [project, source] of Object.entries(probes)) {
      const destination = imageCdn?.destinationFor?.(source) || "";
      if (!destination) throw new Error(`${project} 이미지 보관소 주소를 확인하지 못했습니다.`);
      result[project] = new URL(destination).origin;
    }
    return result;
  }

  async function auditImages() {
    const records = await cardImageRecords();
    const missingReferences = records.filter((record) => !record.image);
    const unroutable = [];
    const expected = new Map();
    const origins = archiveOrigins();

    records.forEach((record) => {
      if (!record.image) return;
      const destination = imageCdn?.destinationFor?.(record.image) || "";
      if (!destination) {
        unroutable.push(record);
        return;
      }
      const url = new URL(destination);
      const project = url.origin === origins.modern ? "modern"
        : url.origin === origins.legacy ? "legacy"
          : "";
      if (!project) {
        unroutable.push(record);
        return;
      }
      const path = url.pathname.replace(/^\/+/, "");
      expected.set(`${project}:${path}`, {
        project,
        path,
        label: record.label,
      });
    });

    const archiveSets = {};
    const archiveErrors = [];
    for (const project of ["modern", "legacy"]) {
      try {
        const payload = await fetchJson(`${origins[project]}/asset-sources.json`);
        archiveSets[project] = new Set(
          (payload?.assets || []).map((asset) => clean(asset.path)).filter(Boolean),
        );
      } catch (error) {
        archiveSets[project] = null;
        archiveErrors.push(`${project}: ${error.message || error}`);
      }
    }

    const archiveMissing = [];
    for (const item of expected.values()) {
      const archive = archiveSets[item.project];
      if (archive && !archive.has(item.path)) archiveMissing.push(item);
    }

    return {
      totalRecords: records.length,
      expectedCount: expected.size,
      missingReferences,
      unroutable,
      archiveMissing,
      archiveErrors,
      archives: {
        modern: archiveSets.modern?.size ?? null,
        legacy: archiveSets.legacy?.size ?? null,
      },
    };
  }

  function promoIds(payload) {
    const values = Array.isArray(payload)
      ? payload
      : [
          ...(Array.isArray(payload?.packs) ? payload.packs : []),
          ...(Array.isArray(payload?.cards) ? payload.cards : []),
        ];
    return new Set(values.map((item) => clean(item?.id).toLowerCase()).filter(Boolean));
  }

  function overrideKeys(source) {
    if (!source?.overrides || typeof source.overrides !== "object" || Array.isArray(source.overrides)) {
      return [];
    }
    return Object.keys(source.overrides);
  }

  async function auditAccount(user) {
    const byDocument = new Map();
    const sourceByCollection = new Map();

    for (const collectionId of registry.COLLECTION_ORDER) {
      const documentId = registry.COLLECTIONS[collectionId].documentId;
      if (!byDocument.has(documentId)) {
        const reference = sync.sourceRef(
          firebase.firestoreModule,
          firebase.db,
          user.uid,
          collectionId,
        );
        byDocument.set(documentId, firebase.firestoreModule.getDoc(reference));
      }
    }

    for (const collectionId of registry.COLLECTION_ORDER) {
      const documentId = registry.COLLECTIONS[collectionId].documentId;
      const snapshot = await byDocument.get(documentId);
      sourceByCollection.set(
        collectionId,
        sync.sourceDocumentFromSnapshot(snapshot, user),
      );
    }

    const promoSet = promoIds(await fetchJson("./data/promo-packs.json"));
    const results = [];

    for (const collectionId of registry.COLLECTION_ORDER) {
      const meta = registry.COLLECTIONS[collectionId];
      const catalog = await registry.loadCatalog(collectionId);
      const source = sourceByCollection.get(collectionId) || {};
      let orphanKeys = [];

      if (collectionId === "people") {
        const owned = source.peopleOwned && typeof source.peopleOwned === "object"
          ? source.peopleOwned
          : {};
        orphanKeys = Object.keys(owned).filter(
          (key) => owned[key] === true && !catalog.itemMap.has(key),
        );
      } else if (collectionId === "pack") {
        const baseKeys = new Set(catalog.items.map((item) => clean(item.key).toLowerCase()));
        const candidates = [
          ...(Array.isArray(source.ownedCodes) ? source.ownedCodes : []),
          ...(Array.isArray(source.ownedPromoPackIds) ? source.ownedPromoPackIds : []),
        ].map((value) => clean(value).toLowerCase()).filter(Boolean);
        orphanKeys = [...new Set(candidates.filter(
          (key) => !baseKeys.has(key) && !promoSet.has(key),
        ))];
      } else {
        orphanKeys = overrideKeys(source).filter((key) => !catalog.itemMap.has(key));
      }

      results.push({
        id: collectionId,
        title: meta.title,
        orphanKeys,
      });
    }

    let worldOwned = [];
    try {
      const stored = JSON.parse(
        localStorage.getItem("digitalCardBinderWorldExplorationOwnedV1") || "[]",
      );
      worldOwned = Array.isArray(stored) ? stored.map(clean).filter(Boolean) : [];
    } catch {}

    const world = await fetchJson("./data/world-exploration.json");
    const worldIds = new Set(
      (world?.generations || []).flatMap((generation) =>
        (generation.slots || []).map((slot) => clean(slot.id)).filter(Boolean),
      ),
    );
    results.push({
      id: "world",
      title: "월드탐험도감",
      orphanKeys: [...new Set(worldOwned.filter((id) => !worldIds.has(id)))],
    });

    const pokemonSource = sourceByCollection.get("pokemon") || {};
    const customDexes = pokemonSource.customDexes;
    const customCount = Array.isArray(customDexes)
      ? customDexes.length
      : customDexes && typeof customDexes === "object"
        ? Object.keys(customDexes).length
        : 0;

    return { results, customCount };
  }

  function dateCandidates(value, depth = 0, output = []) {
    if (!value || typeof value !== "object" || depth > 2) return output;
    for (const [key, item] of Object.entries(value)) {
      if (["updatedAt", "generatedOn"].includes(key) && typeof item === "string") {
        const date = new Date(item);
        if (!Number.isNaN(date.getTime())) output.push(date);
      } else if (depth < 2 && item && typeof item === "object" && !Array.isArray(item)) {
        dateCandidates(item, depth + 1, output);
      }
    }
    return output;
  }

  async function auditVersions() {
    const [site, app, pokedex, people, trainer, fossil, world] = await Promise.all([
      fetchJson("./site-version.json"),
      fetchJson("./app-version.json"),
      fetchJson("./data/pokedex.json"),
      fetchJson("./data/people.json"),
      fetchJson("./data/trainer-pokemon.json"),
      fetchJson("./data/fossil.json"),
      fetchJson("./data/world-exploration.json"),
    ]);
    const dates = [pokedex, people, trainer, fossil, world]
      .flatMap((payload) => dateCandidates(payload));
    dates.sort((a, b) => b.getTime() - a.getTime());
    return {
      site: clean(site?.version) || "—",
      app: clean(app?.versionName) ? `v${app.versionName}` : "—",
      cdn: clean(imageCdn?.version) || "—",
      dataDate: dates[0] || null,
    };
  }

  function makeDetails(container, title, items) {
    if (!container || !items?.length) return;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `${title} (${formatNumber(items.length)})`;
    const list = document.createElement("ul");
    items.slice(0, 30).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = typeof item === "string"
        ? item
        : item.label || item.path || JSON.stringify(item);
      list.append(li);
    });
    if (items.length > 30) {
      const li = document.createElement("li");
      li.textContent = `외 ${formatNumber(items.length - 30)}건`;
      list.append(li);
    }
    details.append(summary, list);
    container.append(details);
  }

  function setBadge(element, state, text) {
    if (!element) return;
    element.dataset.state = state;
    element.textContent = text;
  }

  function renderCollections(rows) {
    elements.collectionRows.replaceChildren();
    elements.dataDetails.replaceChildren();

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const expectedMismatch = Number.isFinite(row.expected) && row.expected !== row.total;
      tr.innerHTML = `
        <td><strong></strong><small></small></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td><span class="health-row-status"></span></td>
      `;
      tr.children[0].querySelector("strong").textContent = row.title;
      tr.children[0].querySelector("small").textContent = row.source;
      tr.children[1].textContent = `${formatNumber(row.total)}${row.unit}`;
      tr.children[2].textContent = Number.isFinite(row.expected)
        ? `${formatNumber(row.expected)}${row.unit}`
        : "동적";
      tr.children[2].className = expectedMismatch ? "health-cell-warning" : "health-cell-ok";
      tr.children[3].textContent = formatNumber(row.duplicates.length);
      tr.children[3].className = row.duplicates.length ? "health-cell-error" : "health-cell-ok";
      tr.children[4].textContent = formatNumber(row.renderMismatch);
      tr.children[4].className = row.renderMismatch ? "health-cell-error" : "health-cell-ok";
      const status = tr.querySelector(".health-row-status");
      status.dataset.state = row.state;
      status.textContent = row.state === "ok" ? "정상" : row.state === "warning" ? "확인" : "오류";
      elements.collectionRows.append(tr);

      if (expectedMismatch) {
        makeDetails(elements.dataDetails, `${row.title} 기준 수치 차이`, [
          `현재 데이터 ${row.total}${row.unit} / 등록 기준 ${row.expected}${row.unit}`,
        ]);
      }
      if (row.duplicates.length) {
        makeDetails(elements.dataDetails, `${row.title} 중복 식별자`, row.duplicates);
      }
      if (row.renderMismatch) {
        makeDetails(elements.dataDetails, `${row.title} 데이터·화면 연결 차이`, [
          `원본 데이터 ${row.rawCount}${row.unit} / 공통 레지스트리 ${row.total}${row.unit}`,
        ]);
      }
      if (row.emptyNames) {
        makeDetails(elements.dataDetails, `${row.title} 이름 누락`, [
          `이름이 비어 있는 항목 ${row.emptyNames}건`,
        ]);
      }
    });

    const errors = rows.filter((row) => row.state === "error").length;
    const warnings = rows.filter((row) => row.state === "warning").length;
    setBadge(
      elements.dataBadge,
      errors ? "error" : warnings ? "warning" : "ok",
      errors ? `오류 ${errors}` : warnings ? `확인 ${warnings}` : "정상",
    );
  }

  function renderImages(result) {
    elements.imageExpected.textContent = formatNumber(result.expectedCount);
    elements.imageMissingRef.textContent = formatNumber(result.missingReferences.length);
    elements.imageUnroutable.textContent = formatNumber(result.unroutable.length);
    elements.imageArchiveMissing.textContent = result.archiveErrors.length
      ? "확인 실패"
      : formatNumber(result.archiveMissing.length);
    elements.imageDetails.replaceChildren();

    makeDetails(
      elements.imageDetails,
      "이미지 주소가 없는 카드",
      result.missingReferences,
    );
    makeDetails(
      elements.imageDetails,
      "CDN 경로로 변환할 수 없는 이미지",
      result.unroutable,
    );
    makeDetails(
      elements.imageDetails,
      "Cloudflare 보관소에서 찾지 못한 이미지",
      result.archiveMissing.map((item) => ({
        label: `${item.label} · ${item.project}/${item.path}`,
      })),
    );
    makeDetails(elements.imageDetails, "이미지 보관소 연결 오류", result.archiveErrors);

    const issueCount =
      result.missingReferences.length +
      result.unroutable.length +
      result.archiveMissing.length +
      result.archiveErrors.length;
    const state = issueCount ? (result.archiveErrors.length ? "warning" : "error") : "ok";
    setBadge(elements.imageBadge, state, issueCount ? `확인 ${formatNumber(issueCount)}` : "정상");
    elements.imageStatus.dataset.state = state;
    elements.imageStatus.textContent = result.archiveErrors.length
      ? "보관소 목록 일부를 불러오지 못해 해당 부분은 판정에서 제외했습니다."
      : `Cloudflare modern ${formatNumber(result.archives.modern)}장 · legacy ${formatNumber(result.archives.legacy)}장과 대조했습니다.`;
  }

  function renderAccount(result) {
    elements.accountGrid.replaceChildren();
    elements.accountDetails.replaceChildren();
    let totalOrphans = 0;

    result.results.forEach((item) => {
      totalOrphans += item.orphanKeys.length;
      const card = document.createElement("article");
      card.className = "health-account-card";
      const statusText = item.orphanKeys.length ? "확인 필요" : "정상";
      card.innerHTML = "<span></span><strong></strong><small></small>";
      card.children[0].textContent = item.title;
      card.children[1].textContent = statusText;
      card.children[1].className = item.orphanKeys.length ? "health-cell-warning" : "health-cell-ok";
      card.children[2].textContent = item.orphanKeys.length
        ? `고아 키 ${formatNumber(item.orphanKeys.length)}건`
        : "연결되지 않은 보유 키 없음";
      elements.accountGrid.append(card);
      if (item.orphanKeys.length) {
        makeDetails(elements.accountDetails, `${item.title} 고아 보유 키`, item.orphanKeys);
      }
    });

    const custom = document.createElement("article");
    custom.className = "health-account-card";
    custom.innerHTML = "<span>나만의 도감</span><strong></strong><small>계정별 동적 데이터</small>";
    custom.children[1].textContent = `${formatNumber(result.customCount)}개`;
    elements.accountGrid.append(custom);

    setBadge(
      elements.accountBadge,
      totalOrphans ? "warning" : "ok",
      totalOrphans ? `확인 ${formatNumber(totalOrphans)}` : "정상",
    );
    return totalOrphans;
  }

  function renderVersions(result) {
    elements.siteVersion.textContent = result.site;
    elements.appVersion.textContent = result.app;
    elements.cdnVersion.textContent = result.cdn;
    elements.dataDate.textContent = result.dataDate
      ? new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(result.dataDate)
      : "메타데이터 없음";
  }

  async function runHealthCheck() {
    if (running || !currentUser || !accountService?.isOwner?.(CONFIG, currentUser)) return;
    running = true;
    elements.refresh.disabled = true;
    elements.refresh.textContent = "검사 중…";
    elements.overallDot.dataset.state = "loading";
    elements.overallLabel.textContent = "검사 중";
    elements.runTime.textContent = "데이터를 확인하고 있습니다.";

    try {
      dataCache.clear();
      const [collections, images, account, versions] = await Promise.all([
        auditCoreCollections(),
        auditImages(),
        auditAccount(currentUser),
        auditVersions(),
      ]);

      renderCollections(collections);
      renderImages(images);
      const orphanCount = renderAccount(account);
      renderVersions(versions);

      const collectionIssueGroups = collections.filter((row) => row.state !== "ok").length;
      const imageIssueGroups = [
        images.missingReferences.length,
        images.unroutable.length,
        images.archiveMissing.length,
        images.archiveErrors.length,
      ].filter((value) => value > 0).length;
      const warningGroups = collectionIssueGroups + imageIssueGroups + (orphanCount ? 1 : 0);
      const imageIssueCount =
        images.missingReferences.length +
        images.unroutable.length +
        images.archiveMissing.length;

      elements.summaryCollections.textContent = formatNumber(collections.length);
      elements.summaryWarnings.textContent = formatNumber(warningGroups);
      elements.summaryImages.textContent = formatNumber(imageIssueCount);
      elements.summaryOrphans.textContent = formatNumber(orphanCount);

      const state = warningGroups ? "warning" : "ok";
      elements.overallDot.dataset.state = state;
      elements.overallLabel.textContent = warningGroups
        ? `확인 필요 ${formatNumber(warningGroups)}개 영역`
        : "전체 정상";
      elements.runTime.textContent = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
    } catch (error) {
      console.error("도감 건강검진 실패", error);
      elements.overallDot.dataset.state = "error";
      elements.overallLabel.textContent = "검사 실패";
      elements.runTime.textContent = error?.message || "일부 데이터를 확인하지 못했습니다.";
    } finally {
      running = false;
      elements.refresh.disabled = false;
      elements.refresh.textContent = "다시 검사";
    }
  }

  function showGate(message, options = {}) {
    elements.gate.hidden = false;
    elements.content.hidden = true;
    elements.accessMessage.textContent = message;
    elements.login.hidden = !options.login;
    elements.overallDot.dataset.state = options.error ? "error" : "loading";
    elements.overallLabel.textContent = options.error ? "접근 제한" : "계정 확인 중";
  }

  async function initializeFirebase() {
    await accountService?.installHeaderPanel?.(CONFIG);

    if (!configured()) {
      showGate("Firebase 설정을 확인할 수 없어 관리자 검사를 시작하지 못했습니다.", { error: true });
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
      firebase = {
        auth,
        db: firestoreModule.getFirestore(app),
        authModule,
        firestoreModule,
      };
      currentUser = await accountService.firstAuthUser(auth, authModule);

      if (!currentUser) {
        showGate("관리자 계정으로 Google 로그인하면 건강검진을 실행할 수 있습니다.", { login: true });
        return;
      }
      if (!accountService.isOwner(CONFIG, currentUser)) {
        showGate("이 화면은 사이트 관리자 계정에서만 확인할 수 있습니다.", { error: true });
        return;
      }

      elements.gate.hidden = true;
      elements.content.hidden = false;
      await runHealthCheck();
    } catch (error) {
      console.error("건강검진 관리자 인증 실패", error);
      showGate("관리자 로그인 상태를 확인하지 못했습니다.", { error: true, login: true });
    }
  }

  elements.login?.addEventListener("click", () => {
    const headerLogin = document.querySelector("#firebase-login");
    if (headerLogin && !headerLogin.hidden) headerLogin.click();
  });
  elements.refresh?.addEventListener("click", runHealthCheck);

  void initializeFirebase();
})();
