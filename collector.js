"use strict";

(function () {
  const SDK_VERSION = "12.16.0";
  const CONFIG = window.POKEMON_DEX_FIREBASE || {};
  const registry = window.CollectorCollectionRegistry;
  const elements = {
    profile: document.querySelector("#collector-public-profile"),
    avatarFallback: document.querySelector("#collector-public-avatar-fallback"),
    name: document.querySelector("#collector-public-name"),
    bio: document.querySelector("#collector-public-bio"),
    collections: document.querySelector("#collector-public-collections"),
    grid: document.querySelector("#collector-public-grid"),
    empty: document.querySelector("#collector-public-empty"),
    wish: document.querySelector("#collector-public-wish"),
    wishGrid: document.querySelector("#collector-public-wish-grid"),
    binders: document.querySelector("#collector-public-binders"),
    binderGrid: document.querySelector("#collector-public-binder-grid"),
    binderEmpty: document.querySelector("#collector-public-binder-empty"),
    loading: document.querySelector("#collector-public-loading"),
    error: document.querySelector("#collector-public-error"),
  };
  const publicId = new URLSearchParams(window.location.search).get("id") || "";
  const MISSING_PROFILE_MESSAGE =
    "공개가 중단되었거나 존재하지 않는 컬렉터 프로필입니다.";
  const LOAD_ERROR_MESSAGE =
    "공개 컬렉터 프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

  function clean(value, limit = 0) {
    const text = String(value || "").trim();
    return limit ? text.slice(0, limit) : text;
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

  function renderProfile(profile) {
    elements.name.textContent = profile.nickname || "컬렉터";
    elements.bio.textContent = profile.bio || "Pokémon Collection";
    elements.avatarFallback.textContent = (profile.nickname || "C")
      .slice(0, 1)
      .toUpperCase();
    document.title = "디지털 카드 바인더";
    elements.profile.hidden = false;
  }

  function normalizeCustomDexes(source) {
    if (!Array.isArray(source)) return [];
    return source.slice(0, 30).map((dex) => {
      if (!dex || typeof dex !== "object" || Array.isArray(dex)) return null;
      const id = clean(dex.id, 120);
      const title = clean(dex.title, 60);
      if (!id || !title) return null;
      const cards = Array.isArray(dex.cards) ? dex.cards.slice(0, 1500) : [];
      return {
        id,
        title,
        description: clean(dex.description, 180) || "직접 만든 테마 카드 도감",
        totalCount: cards.length,
        ownedCount: cards.filter((card) => Boolean(card?.owned)).length,
      };
    }).filter(Boolean);
  }

  function normalizedProjection(snapshot) {
    const data = snapshot.data() || {};
    if (
      data.schemaVersion !== 1 ||
      data.collectionId !== snapshot.id ||
      data.publicId !== publicId ||
      !registry.supportedCollectionId(snapshot.id)
    ) {
      return null;
    }
    const metrics = registry.publicProjectionMetrics(data);
    if (!metrics) return null;
    const eeveeKeys = snapshot.id === "artThemes" && Array.isArray(data.eeveeOwnedKeys)
      ? new Set(data.eeveeOwnedKeys.map((key) => clean(key)).filter(Boolean))
      : null;
    const themes = snapshot.id === "artThemes" && Array.isArray(data.themeCounts)
      ? data.themeCounts.slice(0, 20).map((entry) => {
          const code = clean(entry?.c, 40);
          const name = clean(entry?.n, 40);
          const total = Math.max(0, Math.min(50000, Number(entry?.t) || 0));
          const owned = Math.max(0, Math.min(total, Number(entry?.o) || 0));
          return /^[A-Za-z0-9_-]{1,40}$/.test(code) && name ? { code, name, owned, total } : null;
        }).filter(Boolean)
      : null;
    return {
      collectionId: snapshot.id,
      ...metrics,
      themes,
      eevee: eeveeKeys
        ? {
            ownedCount: eeveeKeys.size,
            totalCount: Math.max(eeveeKeys.size, Math.min(200, Number(data.eeveeTotalCount) || 0)),
          }
        : null,
      customDexes: snapshot.id === "custom"
        ? normalizeCustomDexes(data.customDexes)
        : [],
    };
  }

  function createCardShell({ number, title, description, href, ownedCount, totalCount, unit = "장", promoOwnedCount = 0 }) {
    const rate = totalCount
      ? Number(((ownedCount / totalCount) * 100).toFixed(1))
      : 0;
    const link = document.createElement("a");
    link.href = href;
    link.className = "collector-public-card";
    link.style.setProperty("--rate", rate);
    link.setAttribute(
      "aria-label",
      `${title} ${ownedCount}/${totalCount}${unit}, ${rate.toFixed(1)}%`,
    );
    link.innerHTML = `
      <div>
        <div class="collector-public-card-top">
          <span class="collector-public-card-number ui-icon" aria-hidden="true"></span>
          <span class="collector-public-card-rate">${rate.toFixed(1)}%</span>
        </div>
        <h3></h3>
        <p></p>
      </div>
      <div>
        <div class="collector-public-card-count"><strong></strong><span></span></div>
        <div class="collector-public-card-progress" aria-hidden="true"><span></span></div>
      </div>
    `;
    const iconPage = new URL(href, window.location.href).pathname.split("/").pop();
    const iconName = ({ "national.html": "national", "series.html": "series", "ar.html": "ar", "packs.html": "pack", "pokemon-collections.html": "pokemon", "artists.html": "artist", "people.html": "people", "trainer-pokemon.html": "trainerPokemon", "fossil.html": "fossil", "world.html": "world", "art-themes.html": "artThemes", "custom.html": "binder" })[iconPage] || "binder";
    link.querySelector(".collector-public-card-number").classList.add(`ui-icon--${iconName}`);
    link.querySelector("h3").textContent = title;
    link.querySelector("p").textContent = description;
    link.querySelector(".collector-public-card-count strong").textContent =
      ownedCount.toLocaleString("ko-KR");
    link.querySelector(".collector-public-card-count span").textContent =
      `/ ${totalCount.toLocaleString("ko-KR")}${unit}`;
    if (promoOwnedCount > 0) {
      const promo = document.createElement("small");
      promo.className = "collector-public-card-promo";
      promo.textContent = `프로모 ${promoOwnedCount.toLocaleString("ko-KR")}종`;
      link.querySelector(".collector-public-card-count").after(promo);
    }
    return link;
  }

  function createCollectionCard(projection) {
    const meta = registry.COLLECTIONS[projection.collectionId];
    const url = new URL(meta.href, window.location.href);
    url.searchParams.set("collector", publicId);
    return createCardShell({
      number: meta.number,
      title: meta.title,
      description: meta.description,
      href: url.href,
      ownedCount: projection.ownedCount,
      totalCount: projection.totalCount,
      unit: meta.unit,
      promoOwnedCount: projection.collectionId === "pack"
        ? projection.promoOwnedCount
        : 0,
    });
  }

  function createThemeCard(theme) {
    const url = new URL("./art-themes.html", window.location.href);
    url.searchParams.set("theme", theme.code);
    url.searchParams.set("collector", publicId);
    return createCardShell({
      number: "11",
      title: theme.name,
      description: "아트 테마 도감",
      href: url.href,
      ownedCount: theme.owned,
      totalCount: theme.total,
      unit: "장",
    });
  }

  function createEeveeCard(eevee) {
    const url = new URL("./art-themes.html", window.location.href);
    url.searchParams.set("eevee", "1");
    url.searchParams.set("theme", "eevee-v");
    url.searchParams.set("collector", publicId);
    return createCardShell({
      number: "11",
      title: "이브이 도감",
      description: "이브이와 8종 진화체",
      href: url.href,
      ownedCount: eevee.ownedCount,
      totalCount: eevee.totalCount,
      unit: "장",
    });
  }

  function createCustomDexCard(dex) {
    const url = new URL("./custom.html", window.location.href);
    url.searchParams.set("collector", publicId);
    url.searchParams.set("dex", dex.id);
    return createCardShell({
      number: "08",
      title: dex.title,
      description: dex.description,
      href: url.href,
      ownedCount: dex.ownedCount,
      totalCount: dex.totalCount,
      unit: "장",
    });
  }

  function renderCollections(projections) {
    const order = new Map(
      registry.COLLECTION_ORDER.map((collectionId, index) => [collectionId, index]),
    );
    projections.sort(
      (a, b) => order.get(a.collectionId) - order.get(b.collectionId),
    );
    const cards = projections.flatMap((projection) => {
      if (projection.collectionId === "custom") {
        return projection.customDexes.map(createCustomDexCard);
      }
      if (projection.collectionId === "artThemes") {
        const result = [];
        if (projection.themes) {
          // 공개한 테마마다 카드를 만들어 해당 테마로 바로 연결한다.
          for (const theme of projection.themes) result.push(createThemeCard(theme));
        } else if (projection.totalCount > 0) {
          // 테마별 집계가 없는 예전 사본은 기존처럼 한 장으로 보여 준다.
          result.push(createCollectionCard(projection));
        }
        if (projection.eevee) result.push(createEeveeCard(projection.eevee));
        return result;
      }
      return [createCollectionCard(projection)];
    });
    elements.grid.replaceChildren(...cards);
    elements.empty.hidden = cards.length > 0;
    elements.grid.hidden = cards.length === 0;
    elements.collections.hidden = false;
  }

  function normalizePublicBinder(snapshot) {
    const data = snapshot.data() || {};
    const summary = data.summary || {};
    if (
      data.schemaVersion !== 1 ||
      data.publicId !== publicId ||
      data.binderId !== snapshot.id ||
      !Array.isArray(data.pageOrder) ||
      !data.pageOrder.length
    ) {
      return null;
    }
    return {
      id: snapshot.id,
      title: clean(data.title, 60) || "커스텀 바인더",
      pageCount: Math.max(1, Number(summary.pageCount) || data.pageOrder.length),
      cardCount: Math.max(0, Number(summary.cardCount) || 0),
      ownedCount: Math.max(0, Number(summary.ownedCount) || 0),
      missingCount: Math.max(0, Number(summary.missingCount) || 0),
    };
  }

  function createBinderCard(binder) {
    const link = document.createElement("a");
    const url = new URL("./binder.html", window.location.href);
    url.searchParams.set("collector", publicId);
    url.searchParams.set("binder", binder.id);
    link.href = url.href;
    link.className = "collector-public-binder-card";
    link.setAttribute(
      "aria-label",
      `${binder.title} · ${binder.pageCount}페이지 · 카드 ${binder.cardCount}장`,
    );
    link.innerHTML = `
      <span class="collector-public-binder-icon ui-icon ui-icon--binder" aria-hidden="true"></span>
      <span class="collector-public-binder-copy">
        <strong></strong>
        <small></small>
      </span>
      <span class="collector-public-binder-arrow" aria-hidden="true">›</span>
    `;
    link.querySelector("strong").textContent = binder.title;
    link.querySelector("small").textContent =
      `${binder.pageCount}페이지 · 카드 ${binder.cardCount}장 · 보유 ${binder.ownedCount} · 미보유 ${binder.missingCount}`;
    return link;
  }

  function renderBinders(binders) {
    const cards = binders.map(createBinderCard);
    elements.binderGrid.replaceChildren(...cards);
    elements.binderGrid.hidden = cards.length === 0;
    elements.binderEmpty.hidden = cards.length > 0;
    elements.binders.hidden = false;
  }

  function renderWish(snapshot) {
    if (!elements.wish || !elements.wishGrid || !snapshot?.exists?.()) return;
    const data = snapshot.data() || {};
    const items = Object.values(data.items && typeof data.items === "object" ? data.items : {})
      .filter((item) => item && typeof item === "object" && clean(item.n))
      .sort((left, right) => (Number(right.a) || 0) - (Number(left.a) || 0))
      .slice(0, 300);
    if (!items.length) return;
    const cards = items.map((item) => {
      const article = document.createElement("article");
      article.className = "collector-public-wish-card";
      const image = document.createElement("span");
      image.className = "collector-public-wish-image";
      const src = clean(item.i, 300);
      if (/^https:\/\//.test(src)) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.addEventListener("error", () => image.classList.add("is-broken"), { once: true });
        image.append(img);
      }
      const tag = document.createElement("small");
      tag.textContent = clean(item.t, 40);
      const name = document.createElement("strong");
      name.textContent = clean(item.n, 60);
      article.append(image, tag, name);
      return article;
    });
    elements.wishGrid.replaceChildren(...cards);
    elements.wish.hidden = false;
  }

  function showError(message) {
    elements.loading.hidden = true;
    elements.error.hidden = false;
    const paragraph = elements.error.querySelector("p");
    if (paragraph && message) paragraph.textContent = message;
  }

  function publicProfileErrorMessage(error) {
    const code = String(error?.code || "").replace(/^firestore\//, "");
    if (
      code === "permission-denied" ||
      code === "not-found" ||
      error?.message === MISSING_PROFILE_MESSAGE
    ) {
      return MISSING_PROFILE_MESSAGE;
    }
    return LOAD_ERROR_MESSAGE;
  }

  async function initialize() {
    if (!/^[a-z0-9]{12}$/.test(publicId)) {
      showError("컬렉터 프로필 링크 형식이 올바르지 않습니다.");
      return;
    }
    if (!configured()) {
      showError("공개 프로필 연결 설정을 확인하지 못했습니다.");
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
      const [profileSnapshot, collectionSnapshots, binderSnapshots, wishSnapshot] = await Promise.all([
        firestoreModule.getDoc(
          firestoreModule.doc(db, "publicProfiles", publicId),
        ),
        firestoreModule.getDocs(
          firestoreModule.collection(
            db,
            "publicProfiles",
            publicId,
            "collections",
          ),
        ),
        firestoreModule.getDocs(
          firestoreModule.collection(
            db,
            "publicProfiles",
            publicId,
            "binders",
          ),
        ),
        firestoreModule
          .getDoc(firestoreModule.doc(db, "publicProfiles", publicId, "wishlist", "main"))
          .catch(() => null),
      ]);
      if (!profileSnapshot.exists() || !profileSnapshot.data()?.profileCompleted) {
        throw new Error(MISSING_PROFILE_MESSAGE);
      }
      const profile = profileSnapshot.data() || {};
      const projections = collectionSnapshots.docs
        .map(normalizedProjection)
        .filter(Boolean);
      const binders = binderSnapshots.docs
        .map(normalizePublicBinder)
        .filter(Boolean)
        .sort((a, b) => a.title.localeCompare(b.title, "ko-KR", { numeric: true }));
      renderProfile(profile);
      renderCollections(projections);
      renderBinders(binders);
      renderWish(wishSnapshot);
      elements.loading.hidden = true;
    } catch (error) {
      console.error("공개 컬렉터 프로필 초기화 실패", error);
      showError(publicProfileErrorMessage(error));
    }
  }

  void initialize();
})();
