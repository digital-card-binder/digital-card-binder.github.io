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
    actionsList: document.querySelector("#health-actions-list"),
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
    accountStatus: document.querySelector("#health-account-status"),
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

  function fossilAccountKeys(payload) {
    const keys = new Set();
    (payload?.groups || []).forEach((group, groupIndex) => {
      (group?.cards || []).forEach((card, cardIndex) => {
        keys.add(
          registry.cardIdentity(
            "pokemon",
            group,
            card,
            groupIndex,
            cardIndex,
          ),
        );
      });
    });
    return keys;
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

    const [promoPayload, fossil, ...catalogs] = await Promise.all([
      fetchJson("./data/promo-packs.json"),
      fetchJson("./data/fossil.json"),
      ...registry.COLLECTION_ORDER.map((collectionId) =>
        registry.loadCatalog(collectionId),
      ),
    ]);
    const promoSet = promoIds(promoPayload);
    const catalogByCollection = new Map(
      registry.COLLECTION_ORDER.map((collectionId, index) => [
        collectionId,
        catalogs[index],
      ]),
    );
    const results = [];

    const pushOverrideResult = (
      id,
      title,
      source,
      allowedKeys,
      note = "",
    ) => {
      results.push({
        id,
        title,
        orphanKeys: overrideKeys(source).filter((key) => !allowedKeys.has(key)),
        note,
      });
    };

    const nationalCatalog = catalogByCollection.get("national");
    pushOverrideResult(
      "national",
      registry.COLLECTIONS.national.title,
      sourceByCollection.get("national") || {},
      new Set(nationalCatalog.items.map((item) => item.key)),
    );

    const peopleCatalog = catalogByCollection.get("people");
    const peopleSource = sourceByCollection.get("people") || {};
    const peopleOwned = peopleSource.peopleOwned &&
      typeof peopleSource.peopleOwned === "object" &&
      !Array.isArray(peopleSource.peopleOwned)
      ? peopleSource.peopleOwned
      : {};
    results.push({
      id: "people",
      title: registry.COLLECTIONS.people.title,
      orphanKeys: Object.keys(peopleOwned).filter(
        (key) => peopleOwned[key] === true && !peopleCatalog.itemMap.has(key),
      ),
      note: "",
    });

    const packCatalog = catalogByCollection.get("pack");
    const packSource = sourceByCollection.get("pack") || {};
    const packAllowed = new Set([
      ...packCatalog.items.map((item) => clean(item.key).toLowerCase()),
      ...promoSet,
    ]);
    const packCandidates = [
      ...(Array.isArray(packSource.ownedCodes) ? packSource.ownedCodes : []),
      ...(Array.isArray(packSource.ownedPromoPackIds)
        ? packSource.ownedPromoPackIds
        : []),
    ]
      .map((value) => clean(value).toLowerCase())
      .filter(Boolean);
    results.push({
      id: "pack",
      title: registry.COLLECTIONS.pack.title,
      orphanKeys: [...new Set(
        packCandidates.filter((key) => !packAllowed.has(key)),
      )],
      note: "",
    });

    for (const collectionId of ["series", "artist", "ar"]) {
      const meta = registry.COLLECTIONS[collectionId];
      const catalog = catalogByCollection.get(collectionId);
      pushOverrideResult(
        collectionId,
        meta.title,
        sourceByCollection.get(collectionId) || {},
        new Set(catalog.items.map((item) => item.key)),
      );
    }

    const pokemonCatalog = catalogByCollection.get("pokemon");
    const trainerCatalog = catalogByCollection.get("trainerPokemon");
    const sharedPokemonKeys = new Set([
      ...pokemonCatalog.items.map((item) => item.key),
      ...trainerCatalog.items.map((item) => item.key),
      ...fossilAccountKeys(fossil),
    ]);
    pushOverrideResult(
      "pokemonShared",
      "포켓몬·트레이너·화석 관련 기록",
      sourceByCollection.get("pokemon") || {},
      sharedPokemonKeys,
      "세 도감이 같은 계정 문서를 공유하므로 유효 키를 합쳐서 판정합니다.",
    );

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
      note: "브라우저에 저장된 월드탐험 기록입니다.",
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

  function disconnectedCount(result) {
    return (result?.results || []).reduce(
      (sum, item) => sum + item.orphanKeys.length,
      0,
    );
  }

  function renderAccount(result) {
    elements.accountGrid.replaceChildren();
    elements.accountDetails.replaceChildren();
    const totalDisconnected = disconnectedCount(result);

    result.results.forEach((item) => {
      const card = document.createElement("article");
      card.className = "health-account-card";
      const statusText = item.orphanKeys.length ? "확인 필요" : "정상";
      card.innerHTML = "<span></span><strong></strong><small></small>";
      card.children[0].textContent = item.title;
      card.children[1].textContent = statusText;
      card.children[1].className = item.orphanKeys.length
        ? "health-cell-warning"
        : "health-cell-ok";
      card.children[2].textContent = item.orphanKeys.length
        ? `연결 끊긴 보유 기록 ${formatNumber(item.orphanKeys.length)}건`
        : "연결 끊긴 보유 기록 없음";
      elements.accountGrid.append(card);
      if (item.orphanKeys.length) {
        makeDetails(
          elements.accountDetails,
          `${item.title} 연결 끊긴 보유 기록`,
          item.orphanKeys,
        );
      }
    });

    const custom = document.createElement("article");
    custom.className = "health-account-card";
    custom.innerHTML =
      "<span>나만의 도감</span><strong></strong><small>계정별 동적 데이터</small>";
    custom.children[1].textContent = `${formatNumber(result.customCount)}개`;
    elements.accountGrid.append(custom);

    setBadge(
      elements.accountBadge,
      totalDisconnected ? "warning" : "ok",
      totalDisconnected
        ? `확인 ${formatNumber(totalDisconnected)}`
        : "정상",
    );
    elements.accountStatus.dataset.state = totalDisconnected ? "warning" : "ok";
    elements.accountStatus.textContent = totalDisconnected
      ? "현재 도감과 연결되지 않는 예전 기록이 있습니다. 건강검진에서는 삭제하지 않으며, 아래 수정 요청문으로 원인부터 확인하세요."
      : "현재 도감과 연결이 끊긴 보유 기록이 없습니다.";
    return totalDisconnected;
  }

  async function copyText(text, button) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.append(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      const original = button.textContent;
      button.textContent = "복사됨";
      button.classList.add("is-copied");
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1800);
    } catch (error) {
      console.error("수정 요청문 복사 실패", error);
      alert("수정 요청문을 복사하지 못했습니다.");
    }
  }

  function promptHeader(issueTitle, siteVersion) {
    return [
      "digital-card-binder/digital-card-binder.github.io 저장소를 점검하고 수정해줘.",
      "",
      `[건강검진 문제] ${issueTitle}`,
      siteVersion ? `현재 사이트 빌드: ${siteVersion}` : "",
      "",
      "[중요 안전 조건]",
      "- 기존 보유/미보유 상태와 사용자 데이터를 임의로 초기화하거나 삭제하지 말 것.",
      "- Firestore 키나 카드 식별자를 바꿔야 한다면 먼저 기존 데이터와 호환되는지 확인할 것.",
      "- 삭제나 마이그레이션이 필요해 보여도 즉시 실행하지 말고, 원인과 대상 데이터를 먼저 보여줄 것.",
      "- 현재 구조를 최대한 유지하고 일회성 패치보다 구조적인 수정으로 해결할 것.",
      "- 수정 후 전체 테스트와 Verify를 실행하고 성공한 뒤 배포할 것.",
      "",
    ].filter(Boolean);
  }

  function disconnectedPrompt(account, versions) {
    const lines = promptHeader(
      "현재 도감과 연결되지 않는 예전 보유 기록",
      versions?.site,
    );
    lines.push(
      "건강검진에서 아래 기록이 현재 도감 카드와 연결되지 않는 것으로 표시됐다.",
      "각 기록이 정말 불필요한 예전 키인지, 카드 식별자 변경이나 공유 문서 구조 때문에 잘못 판정된 것인지 먼저 확인해줘.",
      "특히 pokemonCollectionsDex는 포켓몬 컬렉션·트레이너×포켓몬·화석 도감이 함께 사용하므로 서로의 키를 오판하지 않게 확인해줘.",
      "",
      "[검출 항목]",
    );
    account.results
      .filter((item) => item.orphanKeys.length)
      .forEach((item) => {
        lines.push(`- ${item.title}: ${item.orphanKeys.length}건`);
        item.orphanKeys.slice(0, 20).forEach((key) => lines.push(`  · ${key}`));
        if (item.orphanKeys.length > 20) {
          lines.push(`  · 외 ${item.orphanKeys.length - 20}건`);
        }
        if (item.note) lines.push(`  · 참고: ${item.note}`);
      });
    lines.push(
      "",
      "[요청]",
      "1. 왜 연결이 끊겼는지 원인을 분류해줘.",
      "2. 현재 카드에 다시 연결할 수 있는 기록은 안전하게 매핑/복구해줘.",
      "3. 정말 쓸모없는 과거 기록이라면 삭제하지 말고, 삭제 후보와 이유만 목록으로 보여줘.",
      "4. 같은 문제가 다시 생기지 않도록 건강검진 판정 또는 카드 identity 구조도 보완해줘.",
    );
    return lines.join("\n");
  }

  function catalogPrompt(collections, versions) {
    const lines = promptHeader("도감 데이터 상태 이상", versions?.site);
    lines.push(
      "건강검진에서 아래 도감 데이터 문제가 발견됐다.",
      "",
      "[검출 항목]",
    );
    collections
      .filter((row) => row.state !== "ok")
      .forEach((row) => {
        lines.push(
          `- ${row.title}: 실제 ${row.total}${row.unit}, 기준 ${Number.isFinite(row.expected) ? row.expected + row.unit : "동적"}, 중복 ${row.duplicates.length}건, 화면 연결 차이 ${row.renderMismatch}건, 이름 누락 ${row.emptyNames}건`,
        );
        row.duplicates.slice(0, 10).forEach((key) =>
          lines.push(`  · 중복 식별자: ${key}`),
        );
      });
    lines.push(
      "",
      "[요청]",
      "1. 기준 수치가 낡은 것인지 실제 데이터가 잘못된 것인지 먼저 확인해줘.",
      "2. 중복 식별자와 화면 연결 차이의 원인을 찾아 구조적으로 수정해줘.",
      "3. 정상 카드 데이터를 임의로 삭제하거나 보유 상태를 변경하지 말 것.",
      "4. 수정 후 해당 도감 수치와 렌더링이 일치하는지 테스트를 추가하거나 보완해줘.",
    );
    return lines.join("\n");
  }

  function imagePrompt(images, versions) {
    const lines = promptHeader("카드 이미지 상태 이상", versions?.site);
    lines.push(
      "건강검진에서 카드 이미지 문제가 발견됐다.",
      `- 이미지 주소 없음: ${images.missingReferences.length}건`,
      `- CDN 변환 불가: ${images.unroutable.length}건`,
      `- Cloudflare 보관소 누락: ${images.archiveMissing.length}건`,
      `- 보관소 연결 오류: ${images.archiveErrors.length}건`,
      "",
      "[대표 항목]",
    );
    images.missingReferences.slice(0, 15).forEach((item) =>
      lines.push(`- 주소 없음: ${item.label || JSON.stringify(item)}`),
    );
    images.unroutable.slice(0, 15).forEach((item) =>
      lines.push(`- CDN 변환 불가: ${item.label || JSON.stringify(item)}`),
    );
    images.archiveMissing.slice(0, 15).forEach((item) =>
      lines.push(`- 보관소 누락: ${item.label} · ${item.project}/${item.path}`),
    );
    images.archiveErrors.slice(0, 10).forEach((item) =>
      lines.push(`- 연결 오류: ${item}`),
    );
    lines.push(
      "",
      "[요청]",
      "1. 원본 카드 데이터의 이미지 주소와 CDN 매핑을 먼저 확인해줘.",
      "2. 공식/기존 저장 이미지가 있는데 경로만 잘못된 경우 올바른 경로로 수정해줘.",
      "3. 실제 이미지가 없는 경우 임의 생성 이미지로 대체하지 말고 누락 원인을 알려줘.",
      "4. 같은 이미지 오류가 다시 생기지 않도록 검사/빌드 테스트도 보완해줘.",
    );
    return lines.join("\n");
  }

  function makeAction({
    state,
    title,
    description,
    prompt,
  }) {
    const article = document.createElement("article");
    article.className = "health-action-item";
    article.dataset.state = state;

    const copy = document.createElement("div");
    copy.className = "health-action-copy";
    const tag = document.createElement("span");
    tag.className = "health-action-tag";
    tag.dataset.state = state === "ok" ? "ok" : "guide";
    tag.textContent = state === "ok" ? "정상" : "GPT로 수정 가능";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const paragraph = document.createElement("p");
    paragraph.textContent = description;
    copy.append(tag, strong, paragraph);
    article.append(copy);

    if (prompt) {
      const actions = document.createElement("div");
      actions.className = "health-action-buttons";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "manager-button health-copy-button";
      button.textContent = "GPT 수정 프롬프트 복사";
      button.addEventListener("click", () => copyText(prompt, button));
      actions.append(button);
      article.append(actions);
    }
    return article;
  }

  function renderActions(collections, images, account, versions) {
    elements.actionsList.replaceChildren();
    const disconnected = disconnectedCount(account);
    const collectionIssues = collections.filter((row) => row.state !== "ok");
    const imageIssueCount =
      images.missingReferences.length +
      images.unroutable.length +
      images.archiveMissing.length +
      images.archiveErrors.length;

    if (disconnected) {
      elements.actionsList.append(
        makeAction({
          state: "warning",
          title: `연결 끊긴 보유 기록 ${formatNumber(disconnected)}건`,
          description:
            "예전 키, 카드 식별자 변경, 공유 도감 구조 등 원인이 여러 가지일 수 있습니다. 삭제하지 않고 원인부터 확인하도록 요청문을 만듭니다.",
          prompt: disconnectedPrompt(account, versions),
        }),
      );
    }

    if (collectionIssues.length) {
      elements.actionsList.append(
        makeAction({
          state: "error",
          title: `도감 데이터 ${formatNumber(collectionIssues.length)}개 영역 확인 필요`,
          description:
            "기준 수치·중복 식별자·화면 연결 차이를 분석하고 안전하게 보완하도록 요청문을 만듭니다.",
          prompt: catalogPrompt(collections, versions),
        }),
      );
    }

    if (imageIssueCount) {
      elements.actionsList.append(
        makeAction({
          state: "error",
          title: `카드 이미지 ${formatNumber(imageIssueCount)}건 확인 필요`,
          description:
            "어떤 이미지가 왜 누락됐는지 확인하고, 경로 또는 보관소 문제를 수정하도록 요청문을 만듭니다.",
          prompt: imagePrompt(images, versions),
        }),
      );
    }

    if (!disconnected && !collectionIssues.length && !imageIssueCount) {
      elements.actionsList.append(
        makeAction({
          state: "ok",
          title: "지금 처리할 항목이 없습니다",
          description:
            "현재 건강검진에서 수정이 필요한 문제를 찾지 못했습니다.",
        }),
      );
    }
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
      renderActions(collections, images, account, versions);

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
