"use strict";

const $ = (id) => document.getElementById(id);
const mode = document.body.dataset.catalog;
let seriesBaseOnly = mode === "series" &&
  new URLSearchParams(window.location.search).get("scope") === "base";
const SERIES_DATA_URL = "./data/series.json";
const LEGACY_SERIES_DATA_URL = "./data/series-legacy.json";
const SERIES_PRINT_VARIANTS_URL = "./data/series-print-variants.json";
const SERIES_IMAGE_OVERRIDES_URL = "./data/series-image-overrides.json";
const SERIES_LEGACY_PACK_IMAGE_MANIFEST_URL = "./assets/packs/legacy/manifest.json";
const SERIES_PACK_SPRITE_URL = "./assets/packs/pack-sprite.webp";
const POKEMON_DATA_URL = "./data/pokemon-collections.json";
const POKEMON_SEQUENCE_DATA_URL = "./data/pokemon-collections-21-40.json";
const POKEDEX_DATA_URL = "./data/pokedex.json";

const SERIES_ERA_ORDER = Object.freeze(["M", "SV", "S", "SM", "XY", "BW", "DP", "ADV", "ORIGIN"]);
const SERIES_ERA_LABELS = Object.freeze({
  ORIGIN: "오리지널",
  ADV: "ADV",
  DP: "DP",
  BW: "BW",
  XY: "XY",
  SM: "썬&문",
  S: "소드&실드",
  SV: "스칼렛&바이올렛",
  M: "MEGA",
});
const SERIES_PACK_SPRITE_COLUMNS = 10;
const SERIES_PACK_SPRITE_ROWS = 7;
const SERIES_PACK_SPRITE_CODES = Object.freeze([
  "s1W", "s1H", "s1a", "s2", "s2a", "s3", "s3a", "s4", "s4a",
  "s5I", "s5R", "s5a", "s6H", "s6K", "s6a", "s7D", "s7R", "s8",
  "s8a", "s8b", "s9", "s9a", "s10P", "s10D", "s10a", "s10b",
  "s11", "s11a", "s12", "s12a",
  "sv1S", "sv1V", "sv1a", "sv2D", "sv2P", "sv2a", "sv3", "sv3a",
  "sv4K", "sv4M", "sv4a", "sv5K", "sv5M", "sv5a", "sv6", "sv6a",
  "sv7", "sv7a", "sv8", "sv8a", "sv9", "sv9a", "sv10", "sv11B", "sv11W",
  "m1S", "m1L", "m2", "m2a", "m3", "m4", "m5",
]);
const SERIES_PACK_SPRITE_INDEX = new Map(
  SERIES_PACK_SPRITE_CODES.map((code, index) => [code.toLowerCase(), index]),
);
const SERIES_INDIVIDUAL_PACK_IMAGES = Object.freeze({
  m6: "./assets/packs/m6.webp",
  m6a: "./assets/packs/m6a.webp",
});

const SERIES_NAMES = Object.freeze({
  sv1S: "스칼렛 ex",
  sv1V: "바이올렛 ex",
  sv1a: "트리플렛비트",
  sv2D: "클레이버스트",
  sv2P: "스노해저드",
  sv2a: "포켓몬 카드 151",
  sv3: "흑염의 지배자",
  sv3a: "레이징서프",
  sv4K: "고대의 포효",
  sv4M: "미래의 일섬",
  sv4a: "샤이니트레저 ex",
  sv5K: "와일드포스",
  sv5M: "사이버저지",
  sv5a: "크림슨헤이즈",
  sv6: "변환의 가면",
  sv6a: "나이트 원더러",
  sv7: "스텔라미라클",
  sv7a: "낙원드래고나",
  sv8: "초전브레이커",
  sv8a: "테라스탈 페스타 ex",
  sv9: "배틀파트너즈",
  sv9a: "열풍의 아레나",
  sv10: "로켓단의 영광",
  sv11B: "블랙볼트",
  sv11W: "화이트플레어",
  m1S: "메가심포니아",
  m1L: "메가브레이브",
  m2: "인페르노X",
  m2a: "MEGA 드림 ex",
  m3: "니힐제로",
  m4: "닌자스피너",
  m5: "어비스아이",
  sD: "스타터 세트 V",
});

let groups = [];
let allSeriesGroups = null;
let selected = null;
let cards = [];
let status = "all";
let query = "";
let activeCard = null;
let activeEra = mode === "series" ? "ALL" : "SM";
let mobileCatalogPreferences = {};
let seriesPrintVariantMetadata = { coverage: {}, slots: {} };
let seriesLegacyPackImages = new Map();
let quickCollectMode = false;
let quickVariantCard = null;
let renderedCards = [];
let mobileSheetGestureStart = null;
const QUICK_COLLECT_STORAGE_KEY = "pokemonDexQuickCollectV1";

const SERIES_PRINT_VARIANTS = Object.freeze([
  { id: "normal", label: "기본" },
  { id: "holo", label: "홀로" },
  { id: "mirror", label: "미러" },
  { id: "other", label: "기타" },
]);
const SERIES_PRINT_VARIANT_IDS = new Set(
  SERIES_PRINT_VARIANTS.map((variant) => variant.id),
);

function normalizedSeriesPrintVariants(value, owned = false) {
  const variants = Array.isArray(value)
    ? [...new Set(
        value
          .map((item) => String(item || "").trim().toLowerCase())
          .filter((item) => SERIES_PRINT_VARIANT_IDS.has(item)),
      )]
    : [];
  return variants.length ? variants : owned ? ["normal"] : [];
}

function seriesPrintVariantKey(group, card) {
  const groupCode = String(group?.code || "").trim().toLowerCase();
  const code = String(card?.code || card?.meta || "").trim();
  const match = code.match(/^([^_]+)_0*([0-9]+)(?:\/|$)/i);
  if (!groupCode || !match) return "";
  return `${groupCode}::${match[1].toLowerCase()}::${Number(match[2])}`;
}

function applySeriesPrintVariantMetadata(targetGroups, metadata) {
  const coverage = metadata?.coverage && typeof metadata.coverage === "object"
    ? metadata.coverage
    : {};
  const slots = metadata?.slots && typeof metadata.slots === "object"
    ? metadata.slots
    : {};
  const coveredSets = new Set();

  for (const era of Object.values(coverage)) {
    for (const code of Array.isArray(era?.setCodes) ? era.setCodes : []) {
      coveredSets.add(String(code || "").trim().toLowerCase());
    }
  }

  for (const group of Array.isArray(targetGroups) ? targetGroups : []) {
    const groupKey = String(group?.code || "").trim().toLowerCase();
    const covered = coveredSets.has(groupKey);
    group.printVariantAuditCovered = covered;

    for (const card of Array.isArray(group?.cards) ? group.cards : []) {
      const key = seriesPrintVariantKey(group, card);
      const extras = key && Array.isArray(slots[key])
        ? slots[key]
            .map((value) => String(value || "").trim().toLowerCase())
            .filter(
              (value) =>
                value !== "normal" && SERIES_PRINT_VARIANT_IDS.has(value),
            )
        : [];
      card.printVariantAuditCovered = covered;
      card.verifiedPrintVariants = [...new Set(extras)];
    }
  }

  return targetGroups;
}

function applySeriesImageOverrides(targetGroups, payload) {
  const sets = payload?.sets && typeof payload.sets === "object"
    ? payload.sets
    : {};

  for (const group of Array.isArray(targetGroups) ? targetGroups : []) {
    const groupKey = String(group?.code || group?.name || "").trim().toLowerCase();
    const overrides = sets[groupKey];
    if (!overrides || typeof overrides !== "object") continue;

    for (const card of Array.isArray(group?.cards) ? group.cards : []) {
      const code = String(card?.code || card?.meta || "").trim();
      const image = String(
        overrides[code] || overrides[code.toLowerCase()] || "",
      ).trim();
      if (!image) continue;
      card.image = image;
      card.originalImage = image;
    }
  }

  return targetGroups;
}

function seriesVariantChoices(card) {
  const allowed = new Set(["normal"]);
  if (card?.printVariantAuditCovered) {
    for (const variant of card.verifiedPrintVariants || []) {
      if (SERIES_PRINT_VARIANT_IDS.has(variant)) allowed.add(variant);
    }
    // Keep a manual escape hatch for legitimate special prints that are not
    // represented as duplicate images in Pokemon Korea's current archive.
    allowed.add("other");
  } else {
    for (const variant of SERIES_PRINT_VARIANTS) allowed.add(variant.id);
  }

  for (const variant of normalizedSeriesPrintVariants(
    card?.printVariants,
    card?.owned,
  )) {
    allowed.add(variant);
  }

  return SERIES_PRINT_VARIANTS.filter((variant) => allowed.has(variant.id));
}

function renderSeriesVariantOptions(card) {
  const container = $("series-print-variant-options");
  if (!container) return;

  const fragment = document.createDocumentFragment();
  for (const variant of seriesVariantChoices(card)) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.name = "series-print-variant";
    input.type = "checkbox";
    input.value = variant.id;
    input.addEventListener("change", updateSeriesEditorState);

    const text = document.createElement("span");
    text.textContent = variant.label;
    label.append(input, text);
    fragment.append(label);
  }
  container.replaceChildren(fragment);
}

function updateSeriesVariantHelp(card) {
  const help = $("series-variant-help");
  if (!help) return;

  if (!card?.printVariantAuditCovered) {
    help.textContent =
      "이 세트는 인쇄 형태 전수검수 전입니다. 기본·홀로·미러·기타를 직접 선택할 수 있습니다.";
    return;
  }

  const verified = seriesVariantChoices(card)
    .filter((variant) => variant.id !== "other")
    .map((variant) => variant.label);
  help.textContent =
    `포켓몬코리아 공식 이미지 기준 확인 형태: ${verified.join(" · ")}. 기타는 직접 확인용이며 같은 카드번호는 1장으로 집계됩니다.`;
}

const mobileCatalogMedia = typeof window.matchMedia === "function"
  ? window.matchMedia("(max-width: 690px)")
  : null;
const mobileCatalogPreferencesKey = () =>
  `pokemonDexMobileCatalogV1:${mode}:${seriesBaseOnly ? "base" : "all"}`;

const pct = (amount, total) =>
  total ? Math.round((amount / total) * 1000) / 10 : 0;

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function imageFor(card) {
  return card.image || "";
}

function displayName(card) {
  return mode === "series"
    ? card.name || card.pokemonName || card.code
    : card.actualName || card.name || card.code;
}

function actualCardCode(card) {
  if (
    mode !== "series" &&
    card.actualSetCode &&
    card.actualCardNumber
  ) {
    return `${card.actualSetCode}_${card.actualCardNumber}`;
  }
  return card.code || card.meta || "";
}

function groupName(group) {
  if (!group) return "";
  if (mode === "series") {
    return (
      group.displayName ||
      SERIES_NAMES[group.code] ||
      group.title ||
      group.name ||
      group.code
    );
  }
  return group.title || group.name || group.code;
}

function seriesEra(group) {
  if (group?.era) return String(group.era).toUpperCase();
  const code = String(group?.code || "").toLowerCase();
  if (code.startsWith("origin") || code.startsWith("base")) return "ORIGIN";
  if (code.startsWith("adv")) return "ADV";
  if (code.startsWith("dp")) return "DP";
  if (code.startsWith("bw")) return "BW";
  if (code.startsWith("xy")) return "XY";
  if (code.startsWith("sm")) return "SM";
  if (code.startsWith("sv")) return "SV";
  if (code.startsWith("m")) return "M";
  if (code.startsWith("s")) return "S";
  return "";
}

function applySeriesLegacyPackManifest(payload) {
  const images = payload?.images && typeof payload.images === "object"
    ? payload.images
    : {};
  const next = new Map();

  for (const [code, path] of Object.entries(images)) {
    const key = String(code || "").trim().toLowerCase();
    const value = String(path || "").trim();
    if (
      /^[a-z0-9+_-]+$/i.test(key) &&
      /^\.\/assets\/packs\/legacy\/[a-z0-9+_.-]+\.webp$/i.test(value)
    ) {
      next.set(key, value);
    }
  }

  seriesLegacyPackImages = next;
}

function seriesPackVisual(group) {
  const code = String(group?.code || "").trim().toLowerCase();
  if (!code) return null;

  const individual = SERIES_INDIVIDUAL_PACK_IMAGES[code];
  if (individual) {
    return { type: "image", source: "individual", src: individual };
  }

  const spriteIndex = SERIES_PACK_SPRITE_INDEX.get(code);
  if (Number.isInteger(spriteIndex)) {
    const col = spriteIndex % SERIES_PACK_SPRITE_COLUMNS;
    const row = Math.floor(spriteIndex / SERIES_PACK_SPRITE_COLUMNS);
    return {
      type: "sprite",
      source: "sprite",
      src: SERIES_PACK_SPRITE_URL,
      x: SERIES_PACK_SPRITE_COLUMNS === 1
        ? 0
        : (col / (SERIES_PACK_SPRITE_COLUMNS - 1)) * 100,
      y: SERIES_PACK_SPRITE_ROWS === 1
        ? 0
        : (row / (SERIES_PACK_SPRITE_ROWS - 1)) * 100,
    };
  }

  const legacy = seriesLegacyPackImages.get(code);
  if (legacy) {
    return { type: "image", source: "legacy", src: legacy };
  }

  return null;
}

function applySeriesPackVisual(target, group) {
  const visual = seriesPackVisual(group);
  if (!target || !visual) return false;

  target.classList.add("is-pack-art");
  if (visual.source) target.classList.add(`is-${visual.source}-pack-art`);
  target.setAttribute("aria-hidden", "true");
  target.title = `${groupName(group)} · 팩 이미지`;

  if (visual.type === "image") {
    const image = document.createElement("img");
    image.src = visual.src;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    target.append(image);
    return true;
  }

  target.classList.add("is-sprite-pack-art");
  target.style.backgroundImage = `url("${visual.src}")`;
  target.style.backgroundSize =
    `${SERIES_PACK_SPRITE_COLUMNS * 100}% ${SERIES_PACK_SPRITE_ROWS * 100}%`;
  target.style.backgroundPosition = `${visual.x}% ${visual.y}%`;
  target.style.backgroundRepeat = "no-repeat";
  return true;
}

function seriesEraVisualGroups(era, limit = 2) {
  return seriesGroupsForEra(era)
    .filter((group) => Boolean(seriesPackVisual(group)))
    .slice(0, limit);
}

function seriesReleaseTimestamp(group) {
  const raw =
    group?.releaseDate ||
    group?.releasedAt ||
    group?.release_date ||
    group?.date ||
    "";
  const timestamp = Date.parse(String(raw));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function seriesGroupsForEra(era) {
  return groups
    .map((group, sourceIndex) => ({ group, sourceIndex }))
    .filter(({ group }) => seriesEra(group) === era)
    .sort((left, right) => {
      const leftDate = seriesReleaseTimestamp(left.group);
      const rightDate = seriesReleaseTimestamp(right.group);
      if (leftDate || rightDate) {
        if (leftDate !== rightDate) return rightDate - leftDate;
      }
      // Generated catalog data is chronological; newest entries are appended.
      // Preserve that contract as the fallback when release dates are absent.
      return right.sourceIndex - left.sourceIndex;
    })
    .map(({ group }) => group);
}

function selectableGroups() {
  return mode === "series"
    ? seriesGroupsForEra(activeEra)
    : groups;
}

function readMobileCatalogPreferences() {
  if (!mobileCatalogMedia?.matches) return {};
  try {
    const stored = window.sessionStorage.getItem(mobileCatalogPreferencesKey());
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function rememberMobileCatalogPreferences() {
  if (!mobileCatalogMedia?.matches) return;
  try {
    mobileCatalogPreferences.status = status;
    if (mode === "series") {
      mobileCatalogPreferences.era = activeEra;
    }
    if (selected) {
      const groupValue = selected.code || selected.name;
      if (mode === "series") {
        mobileCatalogPreferences.groupByEra = {
          ...(mobileCatalogPreferences.groupByEra || {}),
          [activeEra]: groupValue,
        };
      } else {
        mobileCatalogPreferences.group = groupValue;
      }
    }
    window.sessionStorage.setItem(
      mobileCatalogPreferencesKey(),
      JSON.stringify(mobileCatalogPreferences),
    );
  } catch {
    // 세션 저장소가 제한되어도 도감 탐색은 그대로 동작합니다.
  }
}

function syncEraTabs() {
  if (mode !== "series") return;
  $("catalog-era")
    ?.querySelectorAll("button[data-era]")
    .forEach((button) => {
      const active = button.dataset.era === activeEra;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
}

function syncSeriesView() {
  if (mode !== "series") return;
  const overviewMode = activeEra === "ALL";
  document.body.classList.toggle("series-dashboard-mode", overviewMode);

  const dashboard = $("series-dashboard");
  if (dashboard) {
    dashboard.hidden = false;
    dashboard.classList.toggle("is-set-dashboard", !overviewMode);
    dashboard.setAttribute(
      "aria-label",
      overviewMode
        ? "시리즈 시대별 수집 현황"
        : `${SERIES_ERA_LABELS[activeEra] || activeEra} 세트별 수집 현황`,
    );
  }

  setText(
    "catalog-section-title",
    overviewMode
      ? "시리즈 전체 현황"
      : `${SERIES_ERA_LABELS[activeEra] || activeEra} 세트별 수집 현황`,
  );
}

const SERIES_REPRESENTATIVE_RARITY_SCORE = Object.freeze({
  MUR: 1200,
  FUR: 1180,
  RGB: 1170,
  SAR: 1150,
  HR: 1100,
  UR: 1080,
  SSR: 1060,
  CSR: 1050,
  SR: 1030,
  AR: 980,
  CHR: 970,
  S: 960,
  RRR: 900,
  RR: 850,
  R: 800,
  U: 700,
  C: 600,
  PROMO: 500,
});

function seriesRepresentativeNumber(card) {
  const range = seriesCardRange(card);
  if (range) return range.number;
  const match = String(card?.code || card?.meta || "").match(
    /_0*([0-9]+)(?:\/|$)/,
  );
  if (match) return Number(match[1]);
  const order = Number(card?.order);
  return Number.isFinite(order) ? order : 0;
}

function isSeriesSpecialPokemon(card) {
  const name = String(card?.name || card?.pokemonName || "").toUpperCase();
  return (
    [" EX", " GX", " VMAX", " VSTAR", " V-UNION", " LV.X", " LVX", " BREAK"]
      .some((token) => name.includes(token)) ||
    /(?:^|\s)V(?:\s|$)/.test(name) ||
    name.includes("프라임") ||
    name.includes("LEGEND")
  );
}

function isSeriesPokemonCard(card) {
  return Boolean(String(card?.pokemonName || "").trim()) ||
    isSeriesSpecialPokemon(card);
}

function seriesRepresentativeCard(group) {
  const candidates = (group?.cards || []).filter((card) => imageFor(card));
  if (!candidates.length) return null;

  const hasRarityMetadata = candidates.some((card) =>
    String(card?.rarity || "").trim(),
  );

  return candidates.reduce((best, card) => {
    const rarity = String(card?.rarity || "").trim().toUpperCase();
    const range = seriesCardRange(card);
    const number = seriesRepresentativeNumber(card);
    const pokemonBonus = isSeriesPokemonCard(card) ? 35 : 0;
    const specialBonus = isSeriesSpecialPokemon(card) ? 15 : 0;

    const score = hasRarityMetadata
      ? (SERIES_REPRESENTATIVE_RARITY_SCORE[rarity] || 0) +
        pokemonBonus +
        specialBonus +
        number / 100000
      : (range && range.number > range.denominator ? 1000 : 0) +
        (isSeriesPokemonCard(card) ? 200 : 0) +
        (isSeriesSpecialPokemon(card) ? 40 : 0) +
        number / 100000;

    if (!best || score > best.score) return { card, score };
    return best;
  }, null)?.card || null;
}

function seriesGroupThumbnail(group) {
  const card = seriesRepresentativeCard(group);
  if (card) return imageFor(card);

  return (
    group?.thumbnail ||
    group?.thumbnailImage ||
    group?.image ||
    group?.packImage ||
    ""
  );
}

function selectSeriesGroup(group) {
  if (!group) return;
  const value = group.code || group.name;
  const select = $("catalog-select");
  if (select) select.value = value;
  loadGroup(value);

  // The compact UI keeps .catalog-toolbar collapsed until "필터" is opened,
  // so scrolling to it makes a set tap look like nothing happened.
  // Move directly to the rendered card list instead.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const target =
        document.querySelector("#catalog-grid .pokemon-card") ||
        document.querySelector("#catalog-grid") ||
        document.querySelector(".results-bar");
      if (!target) return;

      const reducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  });
}

function renderSeriesDashboard() {
  if (mode !== "series") return;
  const dashboard = $("series-dashboard");
  if (!dashboard) return;

  const fragment = document.createDocumentFragment();

  if (activeEra !== "ALL") {
    const eraGroups = seriesGroupsForEra(activeEra);

    for (const [groupIndex, group] of eraGroups.entries()) {
      const total = Number(group.total || group.cards?.length || 0);
      const owned = Number(group.owned || 0);
      const missing = Math.max(0, total - owned);
      const rate = pct(owned, total);
      const value = group.code || group.name;
      const isActive =
        Boolean(selected) && (selected.code || selected.name) === value;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "series-dashboard-card series-set-dashboard-card";
      button.dataset.group = value;
      button.dataset.era = activeEra;
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("is-latest", groupIndex === 0);
      button.setAttribute(
        "aria-label",
        `${groupName(group)} ${owned}/${total}장, 수집률 ${rate}% 카드 목록 보기`,
      );

      const heading = document.createElement("span");
      heading.className = "series-dashboard-card-heading series-set-dashboard-heading";

      const thumbnail = document.createElement("span");
      thumbnail.className = "series-set-thumbnail";
      if (!applySeriesPackVisual(thumbnail, group)) {
        const representativeCard = seriesRepresentativeCard(group);
        const thumbnailUrl = representativeCard
          ? imageFor(representativeCard)
          : seriesGroupThumbnail(group);
        if (thumbnailUrl) {
          const image = document.createElement("img");
          image.src = thumbnailUrl;
          image.alt = "";
          image.loading = "lazy";
          image.decoding = "async";
          if (representativeCard) {
            const representativeName =
              representativeCard.name ||
              representativeCard.pokemonName ||
              representativeCard.code ||
              "";
            const representativeRarity = String(
              representativeCard.rarity || "",
            ).trim();
            thumbnail.title = representativeRarity
              ? `대표 카드 · ${representativeName} · ${representativeRarity}`
              : `대표 카드 · ${representativeName}`;
          }
          thumbnail.append(image);
        } else {
          thumbnail.classList.add("is-empty");
          thumbnail.textContent = String(group.code || "SET").slice(0, 4);
        }
      }

      const titleWrap = document.createElement("span");
      titleWrap.className = "series-set-title-wrap";

      const meta = document.createElement("span");
      meta.className = "series-set-meta";

      const code = document.createElement("span");
      code.className = "series-dashboard-code";
      code.textContent = group.code || activeEra;
      meta.append(code);

      if (groupIndex === 0) {
        const newest = document.createElement("span");
        newest.className = "series-set-latest-badge";
        newest.textContent = "최신";
        meta.append(newest);
      }

      const title = document.createElement("strong");
      title.className = "series-set-wordmark";
      title.textContent = groupName(group);
      titleWrap.append(meta, title);

      const arrow = document.createElement("span");
      arrow.className = "series-dashboard-arrow";
      arrow.textContent = "›";
      heading.append(thumbnail, titleWrap, arrow);

      const metrics = document.createElement("span");
      metrics.className = "series-dashboard-metrics";
      const count = document.createElement("strong");
      count.textContent = `${owned} / ${total}`;
      const rateText = document.createElement("span");
      rateText.textContent = `${rate}%`;
      metrics.append(count, rateText);

      const progress = document.createElement("span");
      progress.className = "series-dashboard-progress";
      const progressBar = document.createElement("span");
      progressBar.style.width = `${Math.min(100, Math.max(0, rate))}%`;
      progress.append(progressBar);

      const footer = document.createElement("span");
      footer.className = "series-dashboard-footer";
      const state = document.createElement("span");
      state.textContent = rate === 100 && total > 0 ? "완성" : `미보유 ${missing}장`;
      const hint = document.createElement("span");
      hint.textContent = isActive ? "현재 선택" : "카드 보기";
      footer.append(state, hint);

      button.append(heading, metrics, progress, footer);
      button.addEventListener("click", () => selectSeriesGroup(group));
      fragment.append(button);
    }

    dashboard.replaceChildren(fragment);
    return;
  }

  for (const era of SERIES_ERA_ORDER) {
    const eraGroups = groups.filter((group) => seriesEra(group) === era);
    const total = eraGroups.reduce((sum, group) => sum + group.total, 0);
    const owned = eraGroups.reduce((sum, group) => sum + group.owned, 0);
    const missing = Math.max(0, total - owned);
    const rate = pct(owned, total);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "series-dashboard-card series-era-dashboard-card";
    button.dataset.era = era;
    button.setAttribute(
      "aria-label",
      `${SERIES_ERA_LABELS[era]} ${owned}/${total}장, 수집률 ${rate}% 보기`,
    );

    const heading = document.createElement("span");
    heading.className = "series-dashboard-card-heading";

    const titleWrap = document.createElement("span");
    titleWrap.className = "series-era-title-wrap";

    const meta = document.createElement("span");
    meta.className = "series-era-meta";

    const code = document.createElement("span");
    code.className = "series-dashboard-code";
    code.textContent = era;
    meta.append(code);

    if (era === SERIES_ERA_ORDER[0]) {
      const newest = document.createElement("span");
      newest.className = "series-era-latest-badge";
      newest.textContent = "최신";
      meta.append(newest);
      button.classList.add("is-latest-era");
    }

    const title = document.createElement("strong");
    title.className = "series-era-name";
    title.textContent = SERIES_ERA_LABELS[era];
    titleWrap.append(meta, title);

    const visual = document.createElement("span");
    visual.className = "series-era-visual";
    for (const visualGroup of seriesEraVisualGroups(era)) {
      const pack = document.createElement("span");
      pack.className = "series-era-pack-visual";
      if (applySeriesPackVisual(pack, visualGroup)) {
        visual.append(pack);
      }
    }
    if (!visual.childElementCount) visual.hidden = true;

    const arrow = document.createElement("span");
    arrow.className = "series-dashboard-arrow";
    arrow.textContent = "›";
    heading.append(titleWrap, visual, arrow);

    const metrics = document.createElement("span");
    metrics.className = "series-dashboard-metrics";
    const rateText = document.createElement("strong");
    rateText.textContent = `${rate}%`;
    const count = document.createElement("span");
    count.textContent = `${owned} / ${total}장`;
    metrics.append(rateText, count);

    const progress = document.createElement("span");
    progress.className = "series-dashboard-progress";
    const progressBar = document.createElement("span");
    progressBar.style.width = `${Math.min(100, Math.max(0, rate))}%`;
    progress.append(progressBar);

    const footer = document.createElement("span");
    footer.className = "series-dashboard-footer";
    const sets = document.createElement("span");
    sets.textContent = `${eraGroups.length}개 세트`;
    const missingText = document.createElement("span");
    missingText.textContent = `미보유 ${missing}장`;
    footer.append(sets, missingText);

    button.append(heading, metrics, progress, footer);
    button.addEventListener("click", () => selectEra(era));
    fragment.append(button);
  }

  dashboard.replaceChildren(fragment);
}

function populateCatalogSelect() {
  const select = $("catalog-select");
  const visibleGroups = selectableGroups();
  select.replaceChildren();

  if (mode === "series" && !visibleGroups.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = `${activeEra} 데이터 준비 중`;
    select.append(option);
    select.disabled = true;
    return visibleGroups;
  }

  select.disabled = false;
  visibleGroups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.code || group.name;
    option.textContent =
      mode === "series"
        ? `${groupName(group)} · ${group.code} · ${group.owned}/${group.total}장 · ${pct(group.owned, group.total)}%`
        : `${pokemonGroupLabel(group)} · ${group.total}장`;
    select.append(option);
  });
  return visibleGroups;
}

function selectEra(era) {
  if (mode !== "series") return;
  activeEra = era;
  syncEraTabs();
  syncSeriesView();

  if (era === "ALL") {
    selected = null;
    cards = [];
    renderSeriesDashboard();
    render();
    rememberMobileCatalogPreferences();
    return;
  }

  const visibleGroups = seriesGroupsForEra(era);
  const select = $("catalog-select");
  const currentValue = selected?.code || selected?.name;
  populateCatalogSelect();

  if (!visibleGroups.length) {
    selected = null;
    cards = [];
    updateSelected();
    render();
    rememberMobileCatalogPreferences();
    return;
  }

  const rememberedValue = mobileCatalogPreferences.groupByEra?.[activeEra];
  const nextValue = [currentValue, rememberedValue].find((value) =>
    visibleGroups.some((group) => (group.code || group.name) === value),
  );
  select.value = nextValue || select.value;
  loadGroup(select.value || visibleGroups[0].code || visibleGroups[0].name);
}

function pokemonGroupLabel(group) {
  const name = groupName(group);
  if (mode === "series") return name;
  const number = Number(group?.dexNumber);
  return Number.isFinite(number)
    ? `#${String(number).padStart(4, "0")} ${name}`
    : name;
}

function syncPokemonChooserNavigation() {
  if (mode !== "pokemon") return;
  const prev = $("pokemon-prev");
  const next = $("pokemon-next");
  const select = $("catalog-select");
  if (!prev || !next || !select) return;

  const visibleGroups = selectableGroups();
  const value = selected?.code || selected?.name || select.value;
  const index = visibleGroups.findIndex(
    (group) => (group.code || group.name) === value,
  );
  const current = index >= 0 ? index : 0;
  const count = visibleGroups.length;

  prev.disabled = count < 2;
  next.disabled = count < 2;

  if (!count) {
    prev.title = "이전 포켓몬";
    next.title = "다음 포켓몬";
    return;
  }

  const prevGroup = visibleGroups[(current - 1 + count) % count];
  const nextGroup = visibleGroups[(current + 1) % count];
  prev.title = `이전 · ${pokemonGroupLabel(prevGroup)}`;
  next.title = `다음 · ${pokemonGroupLabel(nextGroup)}`;
  prev.setAttribute("aria-label", prev.title);
  next.setAttribute("aria-label", next.title);
}

function updatePokemonCollectionUrl(value) {
  if (mode !== "pokemon" || !value || typeof window.history?.replaceState !== "function") return;
  const url = new URL(window.location.href);
  url.searchParams.set("group", value);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function choosePokemonGroup(value) {
  if (mode !== "pokemon") {
    loadGroup(value);
    return;
  }
  const select = $("catalog-select");
  if (select) select.value = value;
  loadGroup(value);
  updatePokemonCollectionUrl(value);
}

function stepPokemonGroup(offset) {
  if (mode !== "pokemon") return;
  const visibleGroups = selectableGroups();
  if (!visibleGroups.length) return;

  const currentValue = selected?.code || selected?.name || $("catalog-select")?.value;
  const index = visibleGroups.findIndex(
    (group) => (group.code || group.name) === currentValue,
  );
  const current = index >= 0 ? index : 0;
  const nextIndex = (current + offset + visibleGroups.length) % visibleGroups.length;
  const group = visibleGroups[nextIndex];
  choosePokemonGroup(group.code || group.name);
}

function readQuickCollectPreference() {
  try {
    return window.localStorage.getItem(QUICK_COLLECT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeQuickCollectPreference(value) {
  try {
    window.localStorage.setItem(QUICK_COLLECT_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // 제한된 브라우저에서도 현재 세션의 빠른 수집은 그대로 동작합니다.
  }
}

function quickCollectCanEdit() {
  return Boolean(window.PokemonDexPageAccount?.canEdit?.());
}

function renderQuickCollectControl() {
  let wrap = document.querySelector("#catalog-quick-collect");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "catalog-quick-collect";
    wrap.className = "catalog-quick-collect";
    wrap.innerHTML = `
      <div class="catalog-quick-collect-copy">
        <strong>빠른 수집</strong>
        <span>카드를 한 번 눌러 보유 · 미보유를 바로 바꿉니다.</span>
      </div>
      <label class="catalog-quick-collect-switch">
        <input id="catalog-quick-collect-toggle" type="checkbox" />
        <span aria-hidden="true"></span>
        <b>OFF</b>
      </label>
    `;

    const simpleFilterSurface =
      document.body?.classList?.contains?.("collector-simple-dex")
        ? document.querySelector(".collector-quick-filter-surface")
        : null;
    if (simpleFilterSurface) {
      wrap.classList.add("catalog-quick-collect--nested");
      simpleFilterSurface.append(wrap);
    } else {
      const anchor =
        document.querySelector(".catalog-filter-row") ||
        document.querySelector(".catalog-toolbar");
      anchor?.insertAdjacentElement("afterend", wrap);
    }

    const input = wrap.querySelector("#catalog-quick-collect-toggle");
    input?.addEventListener("change", () => {
      const next = Boolean(input.checked);
      if (next && !quickCollectCanEdit()) {
        input.checked = false;
        alert("Google 로그인 후 빠른 수집 모드를 사용할 수 있습니다.");
        return;
      }
      quickCollectMode = next;
      writeQuickCollectPreference(next);
      document.body.classList.toggle("is-quick-collect", next);
      renderQuickCollectControl();
      render();
    });
  }

  const input = wrap.querySelector("#catalog-quick-collect-toggle");
  const label = wrap.querySelector(".catalog-quick-collect-switch b");
  if (input) input.checked = quickCollectMode;
  if (label) label.textContent = quickCollectMode ? "ON" : "OFF";
  wrap.classList.toggle("is-active", quickCollectMode);
  wrap.dataset.editable = String(quickCollectCanEdit());
}

function closeQuickVariantPicker() {
  quickVariantCard = null;
  document.querySelector("#catalog-quick-variant")?.remove();
}

async function saveQuickVariantSelection(card, picker) {
  const account = window.PokemonDexPageAccount;
  if (!account?.canEdit?.() || !card?.accountKey) return;

  const selected = [
    ...picker.querySelectorAll('input[name="quick-print-variant"]:checked'),
  ]
    .map((field) => String(field.value || "").trim().toLowerCase())
    .filter((value) => SERIES_PRINT_VARIANT_IDS.has(value));

  const variants = selected.length ? [...new Set(selected)] : ["normal"];
  const save = picker.querySelector("[data-quick-variant-save]");
  if (save) {
    save.disabled = true;
    save.textContent = "저장 중…";
  }

  try {
    const saved = await account.saveOverride(card.accountKey, {
      owned: true,
      printVariants: variants,
    });
    card.owned = Boolean(saved.owned);
    card.printVariants = normalizedSeriesPrintVariants(
      saved.printVariants,
      saved.owned,
    );
    refreshCounts();
    render();
    closeQuickVariantPicker();
  } catch (error) {
    console.error(error);
    alert(error.message || "인쇄 형태를 저장하지 못했습니다.");
    if (save) {
      save.disabled = false;
      save.textContent = "완료";
    }
  }
}

function openQuickVariantPicker(card) {
  if (mode !== "series" || !card?.owned) return;
  const verified = (card.verifiedPrintVariants || [])
    .filter((variant) => SERIES_PRINT_VARIANT_IDS.has(variant));
  if (!verified.length) return;

  closeQuickVariantPicker();
  quickVariantCard = card;

  const picker = document.createElement("section");
  picker.id = "catalog-quick-variant";
  picker.className = "catalog-quick-variant";
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-modal", "true");
  picker.setAttribute("aria-label", `${displayName(card)} 보유 형태 선택`);

  const selected = new Set(
    normalizedSeriesPrintVariants(card.printVariants, card.owned),
  );
  const choices = seriesVariantChoices(card).filter(
    (variant) => variant.id !== "other" || selected.has("other"),
  );

  picker.innerHTML = `
    <div class="catalog-quick-variant-head">
      <div><span>보유 형태</span><strong>${displayName(card)}</strong></div>
      <button type="button" data-quick-variant-close aria-label="닫기">×</button>
    </div>
    <div class="catalog-quick-variant-options"></div>
    <button type="button" class="primary-button" data-quick-variant-save>완료</button>
  `;

  const options = picker.querySelector(".catalog-quick-variant-options");
  choices.forEach((variant) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "quick-print-variant";
    input.value = variant.id;
    input.checked = selected.has(variant.id);
    if (variant.id === "normal") input.checked = selected.has("normal");
    const text = document.createElement("span");
    text.textContent = variant.label;
    label.append(input, text);
    options.append(label);
  });

  if (![...options.querySelectorAll("input")].some((field) => field.checked)) {
    const normal = options.querySelector('input[value="normal"]');
    if (normal) normal.checked = true;
  }

  picker.querySelector("[data-quick-variant-close]")
    ?.addEventListener("click", closeQuickVariantPicker);
  picker.querySelector("[data-quick-variant-save]")
    ?.addEventListener("click", () => void saveQuickVariantSelection(card, picker));
  document.body.append(picker);
}

async function quickToggleCatalogCard(card, button) {
  if (!quickCollectCanEdit()) {
    alert("Google 로그인 후 빠른 수집 모드를 사용할 수 있습니다.");
    return;
  }
  if (card.quickCollectSaving) return;

  const wasOwned = Boolean(card.owned);
  card.quickCollectSaving = true;
  try {
    await toggleCatalogCompletion(card, button);

    if (
      !wasOwned &&
      card.owned &&
      mode === "series" &&
      Array.isArray(card.verifiedPrintVariants) &&
      card.verifiedPrintVariants.length
    ) {
      openQuickVariantPicker(card);
    }
  } finally {
    card.quickCollectSaving = false;
  }
}

function badge(owned) {
  const element = document.createElement("span");
  element.className = `status-badge ${owned ? "is-owned" : "is-missing"}`;
  element.textContent = owned ? "보유" : "미보유";
  return element;
}

function updateCompletionButton(button, card) {
  const owned = Boolean(card.owned);
  const name = displayName(card);
  button.classList.toggle("is-complete", owned);
  button.classList.remove("is-saving");
  button.disabled = false;
  button.setAttribute("aria-pressed", String(owned));
  button.setAttribute(
    "aria-label",
    owned
      ? `${name} 수집완료 취소`
      : `${name} 수집완료로 표시`,
  );
  button.title = owned
    ? "다시 누르면 미보유로 변경됩니다."
    : "로그인한 내 도감에 수집완료로 저장합니다.";
  button.textContent = owned ? "✓ 수집완료" : "수집완료";
}

async function toggleCatalogCompletion(card, button) {
  const account = window.PokemonDexPageAccount;
  if (!account?.canEdit?.()) {
    alert("Google 로그인 후 내 수집 상태를 저장할 수 있습니다.");
    return;
  }

  const nextOwned = !card.owned;
  button.disabled = true;
  button.classList.add("is-saving");
  button.textContent = "저장 중…";

  try {
    const saved = await account.saveOwned(card.accountKey, nextOwned);
    card.owned = saved.owned;
    if (mode === "series") {
      card.printVariants = normalizedSeriesPrintVariants(
        saved.printVariants,
        saved.owned,
      );
      card.actualSetCode = "";
      card.actualCardNumber = "";
      card.actualName = "";
      card.actualImage = "";
      card.image = card.originalImage || "";
    }

    refreshCounts();
    if (activeCard === card) {
      updateDialog(card);
      fillSeriesEditor(card);
    }
    render();
  } catch (error) {
    console.error(error);
    alert(error.message || "수집 상태를 저장하지 못했습니다.");
    updateCompletionButton(button, card);
  }
}

function makeCompletionButton(card) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "collection-complete-button";
  updateCompletionButton(button, card);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void toggleCatalogCompletion(card, button);
  });
  return button;
}

function updateSummary() {
  const total = groups.reduce((amount, group) => amount + group.total, 0);
  const owned = groups.reduce((amount, group) => amount + group.owned, 0);
  const rate = pct(owned, total);

  setText("catalog-owned", owned);
  setText("catalog-total", total);
  setText("catalog-missing", total - owned);
  setText("catalog-rate", `${rate}%`);
  setText("stat-catalog-groups", groups.length);
  setText("stat-catalog-total", total);
  setText("stat-catalog-rate", rate);
  $("catalog-progress-ring").style.setProperty("--progress", rate);
}

function updateSelected() {
  if (mode === "series" && !selected) {
    setText("selected-name", `${activeEra} · 데이터 준비 중`);
    setText("selected-progress", "등록 예정");
    return;
  }

  const owned = cards.filter((card) => card.owned).length;
  setText(
    "selected-name",
    mode === "series"
      ? `${groupName(selected)} · ${selected.code}`
      : pokemonGroupLabel(selected),
  );
  const progress = `${owned} / ${cards.length}장 · ${pct(owned, cards.length)}%`;
  setText("selected-progress", progress);
}

function setSeriesEditorMessage(message, state = "") {
  const element = $("series-editor-message");
  if (!element) return;
  element.textContent = message;
  element.dataset.state = state;
}

function seriesEditorOwned() {
  return Boolean(
    document.querySelector('input[name="series-owned-status"]:checked')
      ?.value === "owned",
  );
}

function seriesEditorPrintVariants() {
  if (!seriesEditorOwned()) return [];
  const selected = [
    ...document.querySelectorAll('input[name="series-print-variant"]:checked'),
  ]
    .map((input) => String(input.value || "").trim().toLowerCase())
    .filter((value) => SERIES_PRINT_VARIANT_IDS.has(value));
  return selected.length ? [...new Set(selected)] : ["normal"];
}

function updateSeriesEditorState() {
  const editor = $("series-card-editor");
  if (!editor) return;

  const account = window.PokemonDexPageAccount;
  const canEdit = Boolean(account?.canEdit?.());
  const owned = seriesEditorOwned();

  editor
    .querySelectorAll('input[name="series-owned-status"]')
    .forEach((field) => {
      field.disabled = !canEdit;
    });

  const variantInputs = [
    ...editor.querySelectorAll('input[name="series-print-variant"]'),
  ];
  variantInputs.forEach((field) => {
    field.disabled = !canEdit || !owned;
  });
  if (canEdit && owned && !variantInputs.some((field) => field.checked)) {
    const base = variantInputs.find((field) => field.value === "normal");
    if (base) base.checked = true;
  }

  const save = $("series-card-save");
  if (save) {
    save.disabled = !canEdit;
    save.textContent = "보유 상태 저장";
  }

  if (!canEdit) {
    setSeriesEditorMessage(
      "Google 로그인 후 이 카드의 보유 상태와 인쇄 형태를 변경할 수 있습니다.",
      "guest",
    );
  } else if (owned) {
    setSeriesEditorMessage(
      "기본 카드가 기준이며, 같은 카드번호의 홀로·미러 등은 추가 보유 형태로 기록됩니다.",
    );
  } else {
    setSeriesEditorMessage(
      "미보유로 저장하면 인쇄 형태 선택은 집계에서 제외됩니다.",
    );
  }
}

function fillSeriesEditor(card) {
  if (mode !== "series" || !card) return;

  renderSeriesVariantOptions(card);
  updateSeriesVariantHelp(card);

  const ownedValue = card.owned ? "owned" : "missing";
  const statusInput = document.querySelector(
    `input[name="series-owned-status"][value="${ownedValue}"]`,
  );
  if (statusInput) statusInput.checked = true;

  const selectedVariants = new Set(
    normalizedSeriesPrintVariants(card.printVariants, card.owned),
  );
  document
    .querySelectorAll('input[name="series-print-variant"]')
    .forEach((input) => {
      input.checked = selectedVariants.has(input.value);
    });
  updateSeriesEditorState();
}

function createSeriesEditor() {
  if (mode !== "series" || $("series-card-editor")) return;

  const details = document.querySelector("#catalog-dialog .dialog-details");
  if (!details) return;

  const editor = document.createElement("section");
  editor.id = "series-card-editor";
  editor.className = "collection-editor series-card-editor";

  editor.innerHTML = `
    <div class="collection-editor-heading">
      <div><span>MY COLLECTION</span><strong>이 카드의 보유 상태</strong></div>
      <div class="series-status-toggle" role="radiogroup" aria-label="보유 상태">
        <label><input name="series-owned-status" type="radio" value="owned"><span>보유</span></label>
        <label><input name="series-owned-status" type="radio" value="missing"><span>미보유</span></label>
      </div>
    </div>
    <div class="series-variant-section">
      <span class="series-variant-label">보유 형태</span>
      <div id="series-print-variant-options" class="series-variant-options" role="group" aria-label="인쇄 형태"></div>
      <p id="series-variant-help">기본이 대표 카드입니다. 같은 카드번호의 인쇄 차이는 별도 장수로 계산하지 않습니다.</p>
    </div>
    <p id="series-editor-message" class="series-editor-message"></p>
    <div class="collection-editor-actions">
      <span></span>
      <button id="series-card-save" class="primary-button" type="button">보유 상태 저장</button>
    </div>
    <p class="collection-save-hint">검색과 도감 집계는 카드번호 기준 1장으로 유지되고, 선택한 인쇄 형태만 계정에 함께 저장됩니다.</p>
  `;
  details.after(editor);

  editor
    .querySelectorAll('input[name="series-owned-status"]')
    .forEach((input) => input.addEventListener("change", updateSeriesEditorState));
  $("series-card-save")?.addEventListener("click", saveSeriesCard);
  updateSeriesEditorState();
}

function refreshCounts() {
  groups.forEach((group) => {
    group.total = group.cards.length;
    group.owned = group.cards.filter((card) => card.owned).length;
  });
  updateSummary();
  if (mode === "series" && activeEra !== "ALL") {
    const currentValue = selected?.code || selected?.name || "";
    const select = $("catalog-select");
    populateCatalogSelect();
    if (select && currentValue) select.value = currentValue;
  }
  renderSeriesDashboard();
  updateSelected();
  rememberCurrentCatalog();
}

async function saveSeriesCard() {
  const account = window.PokemonDexPageAccount;
  if (!activeCard || !account?.canEdit?.()) {
    setSeriesEditorMessage(
      "Google 로그인 후 보유 상태를 저장할 수 있습니다.",
      "error",
    );
    return;
  }

  const owned = seriesEditorOwned();
  const printVariants = owned ? seriesEditorPrintVariants() : [];
  const save = $("series-card-save");

  save.disabled = true;
  save.textContent = "저장 중…";

  try {
    const saved = await account.saveOverride(activeCard.accountKey, {
      owned,
      printVariants,
    });

    activeCard.owned = saved.owned;
    activeCard.printVariants = normalizedSeriesPrintVariants(
      saved.printVariants,
      saved.owned,
    );
    activeCard.actualSetCode = "";
    activeCard.actualCardNumber = "";
    activeCard.actualName = "";
    activeCard.actualImage = "";
    activeCard.image = activeCard.originalImage || "";

    refreshCounts();
    render();
    updateDialog(activeCard);
    fillSeriesEditor(activeCard);
    setSeriesEditorMessage(
      owned
        ? `보유 카드로 저장되었습니다. · ${activeCard.printVariants
            .map(
              (id) =>
                SERIES_PRINT_VARIANTS.find((variant) => variant.id === id)?.label ||
                id,
            )
            .join(" · ")}`
        : "미보유 카드로 저장되었습니다.",
      "success",
    );
  } catch (error) {
    console.error(error);
    setSeriesEditorMessage(error.message || "저장하지 못했습니다.", "error");
  } finally {
    save.disabled = false;
    save.textContent = "보유 상태 저장";
  }
}

function updateDialog(card) {
  const image = $("catalog-dialog-image");
  const imageWrap = $("catalog-dialog-image-wrap");

  image.src = imageFor(card);
  image.alt = `${displayName(card)} 카드`;
  imageWrap.classList.toggle("is-missing", !card.owned);
  setText("dialog-code", actualCardCode(card));

  const statusBadge = $("dialog-status");
  statusBadge.className = `status-badge ${
    card.owned ? "is-owned" : "is-missing"
  }`;
  statusBadge.textContent = badge(card.owned).textContent;

  setText("dialog-name", displayName(card));
  setText("dialog-meta", card.code || card.meta);
  setText("dialog-group", groupName(selected));
}

function isMobileCardSheet() {
  return Boolean(window.matchMedia?.("(max-width: 690px)")?.matches);
}

function closeCatalogDialog() {
  const dialog = $("catalog-dialog");
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function updateMobileCardSheetControls() {
  const dialog = $("catalog-dialog");
  if (!dialog || !activeCard) return;

  const index = renderedCards.indexOf(activeCard);
  const previous = dialog.querySelector("[data-sheet-prev]");
  const next = dialog.querySelector("[data-sheet-next]");
  const collect = dialog.querySelector("[data-sheet-collect]");
  const variant = dialog.querySelector("[data-sheet-variant]");

  if (previous) previous.disabled = index <= 0;
  if (next) next.disabled = index < 0 || index >= renderedCards.length - 1;

  if (collect) {
    const owned = Boolean(activeCard.owned);
    collect.classList.toggle("is-owned", owned);
    collect.textContent = owned ? "✓ 보유 중 · 미보유로 변경" : "보유로 표시";
    collect.setAttribute("aria-pressed", String(owned));
  }

  if (variant) {
    const savedVariants = normalizedSeriesPrintVariants(
      activeCard.printVariants,
      activeCard.owned,
    );
    const hasVariantChoice =
      mode === "series" &&
      activeCard.owned &&
      (
        (activeCard.verifiedPrintVariants || []).length > 0 ||
        savedVariants.some((value) => value !== "normal")
      );
    variant.hidden = !hasVariantChoice;
  }
}

function animateMobileSheetDirection(direction) {
  const dialog = $("catalog-dialog");
  if (!dialog || !isMobileCardSheet()) return;
  const className = direction > 0
    ? "is-sheet-swipe-left"
    : "is-sheet-swipe-right";
  dialog.classList.remove("is-sheet-swipe-left", "is-sheet-swipe-right");
  void dialog.offsetWidth;
  dialog.classList.add(className);
  window.setTimeout(() => dialog.classList.remove(className), 220);
}

function openAdjacentCard(direction) {
  if (!activeCard || !renderedCards.length) return;
  const index = renderedCards.indexOf(activeCard);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= renderedCards.length) return;

  activeCard = renderedCards[nextIndex];
  updateDialog(activeCard);
  fillSeriesEditor(activeCard);
  updateMobileCardSheetControls();
  animateMobileSheetDirection(direction);
}

function ensureMobileCardSheetControls() {
  const dialog = $("catalog-dialog");
  const copy = dialog?.querySelector(".dialog-card-copy");
  const imageWrap = dialog?.querySelector(".dialog-card-image");
  if (!dialog || !copy || !imageWrap) return;

  if (!dialog.querySelector(".mobile-card-sheet-nav")) {
    const nav = document.createElement("div");
    nav.className = "mobile-card-sheet-nav";
    nav.innerHTML = `
      <button type="button" data-sheet-prev aria-label="이전 카드">‹</button>
      <button type="button" data-sheet-next aria-label="다음 카드">›</button>
    `;
    nav.querySelector("[data-sheet-prev]")
      ?.addEventListener("click", () => openAdjacentCard(-1));
    nav.querySelector("[data-sheet-next]")
      ?.addEventListener("click", () => openAdjacentCard(1));
    dialog.append(nav);
  }

  if (!dialog.querySelector(".mobile-card-sheet-actions")) {
    const actions = document.createElement("div");
    actions.className = "mobile-card-sheet-actions";
    actions.innerHTML = `
      <button type="button" class="is-primary" data-sheet-collect>보유로 표시</button>
      <button type="button" data-sheet-variant hidden>버전</button>
    `;
    actions.querySelector("[data-sheet-collect]")?.addEventListener("click", async () => {
      if (!activeCard) return;
      const control = actions.querySelector("[data-sheet-collect]");
      await toggleCatalogCompletion(activeCard, control);
      updateMobileCardSheetControls();
    });
    actions.querySelector("[data-sheet-variant]")?.addEventListener("click", () => {
      if (activeCard) openQuickVariantPicker(activeCard);
    });
    copy.append(actions);
  }

  if (!imageWrap.dataset.mobileSheetGesture) {
    imageWrap.dataset.mobileSheetGesture = "true";
    imageWrap.addEventListener("touchstart", (event) => {
      if (!isMobileCardSheet() || event.touches.length !== 1) return;
      const touch = event.touches[0];
      mobileSheetGestureStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    imageWrap.addEventListener("touchend", (event) => {
      if (!mobileSheetGestureStart || !isMobileCardSheet()) return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const dx = touch.clientX - mobileSheetGestureStart.x;
      const dy = touch.clientY - mobileSheetGestureStart.y;
      mobileSheetGestureStart = null;

      if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        openAdjacentCard(dx < 0 ? 1 : -1);
        return;
      }
      if (dy >= 90 && Math.abs(dy) > Math.abs(dx) * 1.25) {
        closeCatalogDialog();
      }
    }, { passive: true });
  }

  updateMobileCardSheetControls();
}

function openDialog(card) {
  const dialog = $("catalog-dialog");
  activeCard = card;
  updateDialog(card);
  fillSeriesEditor(card);
  ensureMobileCardSheetControls();
  void window.DigitalCardBinder?.relatedDex?.render?.(dialog, card, {
    currentCollectionId: mode,
    currentGroupKey: selected?.code || selected?.name || "",
    setCode: mode === "series" || mode === "ar" ? selected?.code || "" : "",
    name: displayName(card),
  });

  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  updateMobileCardSheetControls();
}

function makeCard(card) {
  const article = document.createElement("article");
  article.className = `pokemon-card catalog-card${
    card.owned ? "" : " is-missing"
  } has-completion-action`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pokemon-card-button";

  const imageWrap = document.createElement("span");
  imageWrap.className = "card-image-wrap";

  const image = document.createElement("img");
  image.className = "card-image";
  image.loading = "lazy";
  image.src = imageFor(card);
  image.alt = `${displayName(card)} 카드`;
  image.onerror = () => article.classList.add("has-image-error");

  const missing = document.createElement("span");
  missing.className = "missing-overlay";
  missing.textContent = "미보유";

  const fallback = document.createElement("span");
  fallback.className = "image-fallback";
  fallback.innerHTML =
    '<span class="fallback-ball"><span></span></span>이미지를 불러오지 못했습니다';
  imageWrap.append(image, missing, fallback);

  const body = document.createElement("span");
  body.className = "card-body";

  const top = document.createElement("span");
  top.className = "card-topline";
  const number = document.createElement("span");
  number.className = "number-badge";
  number.textContent = card.code || card.meta;
  top.append(number, badge(card.owned));

  const name = document.createElement("strong");
  name.className = "card-name-ko";
  name.textContent = displayName(card);

  const group = document.createElement("span");
  group.className = "card-name-en";
  group.textContent = groupName(selected);

  const meta = document.createElement("span");
  meta.className = "card-meta";
  meta.textContent = actualCardCode(card);

  body.append(top, name, group, meta);
  button.append(imageWrap, body);

  const completionButton = makeCompletionButton(card);
  button.onclick = () => {
    if (quickCollectMode) {
      void quickToggleCatalogCard(card, completionButton);
      return;
    }
    openDialog(card);
  };

  const detailButton = document.createElement("button");
  detailButton.type = "button";
  detailButton.className = "catalog-card-detail-button";
  detailButton.textContent = "•••";
  detailButton.setAttribute("aria-label", `${displayName(card)} 상세 보기`);
  detailButton.title = "상세 보기";
  detailButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDialog(card);
  });

  article.append(button, completionButton, detailButton);
  return article;
}

function render() {
  const normalizedQuery = query.trim().toLowerCase();
  const selectedGroupName = groupName(selected).toLowerCase();
  const shown = cards.filter((card) => {
    const matchesStatus =
      status === "all" || (status === "owned") === card.owned;
    const haystack = [
      card.name,
      card.pokemonName,
      card.actualName,
      card.actualSetCode,
      card.actualCardNumber,
      card.code,
      card.meta,
      selected?.code,
      selectedGroupName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  renderedCards = shown;
  $("catalog-grid").replaceChildren(...shown.map(makeCard));
  setText("result-count", shown.length);
  const empty = $("catalog-empty");
  empty.hidden = shown.length !== 0;
  const emptyTitle = empty.querySelector("h3");
  if (emptyTitle) {
    emptyTitle.textContent =
      (mode === "pokemon" && cards.length === 0) ||
      (mode === "series" && !selected)
        ? "카드 데이터 준비 중입니다"
        : "검색 결과가 없습니다";
  }
}

function seriesCardNumber(card) {
  const match = String(card.code || card.meta || "").match(/_([0-9]+)/);
  if (match) return Number(match[1]);

  const explicitOrder = Number(card?.order);
  return Number.isFinite(explicitOrder)
    ? explicitOrder
    : Number.POSITIVE_INFINITY;
}

function seriesCardRange(card) {
  const match = String(card.code || card.meta || "").match(
    /_([0-9]+)\/([0-9]+)/,
  );
  if (!match) return null;
  return {
    number: Number(match[1]),
    denominator: Number(match[2]),
  };
}

function isBaseSeriesCard(card) {
  const range = seriesCardRange(card);
  return !range || range.number <= range.denominator;
}

function applySeriesScope() {
  if (!seriesBaseOnly) return;
  groups = groups
    .map((group) => ({
      ...group,
      cards: (group.cards || []).filter(isBaseSeriesCard),
    }))
    .filter((group) => group.cards.length > 0);
}

function setSeriesScope(nextScope) {
  if (mode !== "series" || !allSeriesGroups) return false;
  const nextBaseOnly = nextScope === "base";
  if (seriesBaseOnly === nextBaseOnly) return true;

  const previousGroup = selected?.code || selected?.name || $("catalog-select")?.value;
  seriesBaseOnly = nextBaseOnly;
  groups = allSeriesGroups;
  applySeriesScope();
  groups.forEach((group) => {
    group.total = group.cards.length;
    group.owned = group.cards.filter((card) => card.owned).length;
  });
  updateSummary();
  syncEraTabs();
  syncSeriesView();
  renderSeriesDashboard();

  if (activeEra === "ALL") {
    selected = null;
    cards = [];
    render();
  } else {
    populateCatalogSelect();
    loadGroup(previousGroup);
  }
  return true;
}

function rememberCurrentCatalog() {
  if (!selected) return;
  const recentDex = window.DigitalCardBinder?.recentDex;
  if (typeof recentDex?.remember !== "function") return;

  const groupValue = selected.code || selected.name;
  const total = selected.cards?.length || 0;
  const owned = (selected.cards || []).filter((card) => card.owned).length;

  if (mode === "series") {
    const params = new URLSearchParams();
    params.set("group", groupValue);
    if (seriesBaseOnly) params.set("scope", "base");
    recentDex.remember({
      collectionId: "series",
      title: "시리즈 도감",
      detail: `${groupName(selected)} · ${selected.code || groupValue}`,
      href: `./series.html?${params.toString()}`,
      owned,
      total,
      unit: "장",
    });
    return;
  }

  if (mode === "pokemon") {
    recentDex.remember({
      collectionId: "pokemon",
      title: "포켓몬 컬렉션",
      detail: pokemonGroupLabel(selected),
      href: `./pokemon-collections.html?group=${encodeURIComponent(groupValue)}`,
      owned,
      total,
      unit: "장",
    });
  }
}

function loadGroup(value) {
  const fallback = selectableGroups()[0] || (mode === "series" ? null : groups[0]);
  selected =
    groups.find((group) => (group.code || group.name) === value) || fallback;

  if (!selected) {
    cards = [];
    updateSelected();
    renderSeriesDashboard();
    render();
    rememberMobileCatalogPreferences();
    return;
  }

  cards =
    mode === "series"
      ? [...selected.cards].sort(
          (left, right) => seriesCardNumber(left) - seriesCardNumber(right),
        )
      : selected.cards;
  if (mode === "pokemon") {
    const select = $("catalog-select");
    const value = selected.code || selected.name;
    if (select && value) select.value = value;
    syncPokemonChooserNavigation();
  }
  updateSelected();
  renderSeriesDashboard();
  render();
  rememberMobileCatalogPreferences();
  rememberCurrentCatalog();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

function mergeSeriesGroups(baseGroups, supplementGroups) {
  const merged = Array.isArray(baseGroups) ? [...baseGroups] : [];
  for (const extra of Array.isArray(supplementGroups) ? supplementGroups : []) {
    const code = String(extra?.code || "").trim().toLowerCase();
    if (!code) continue;
    const index = merged.findIndex(
      (group) => String(group?.code || "").trim().toLowerCase() === code,
    );
    if (index >= 0) merged[index] = extra;
    else merged.push(extra);
  }
  return merged;
}

async function loadCatalogGroups() {
  if (mode === "series") {
    if (window.DigitalCardBinder?.catalog?.series) {
      const [seriesGroups, variantMetadata, legacyPackManifest] = await Promise.all([
        window.DigitalCardBinder.catalog.series(),
        fetchJson(SERIES_PRINT_VARIANTS_URL).catch(() => ({ coverage: {}, slots: {} })),
        fetchJson(SERIES_LEGACY_PACK_IMAGE_MANIFEST_URL).catch(() => ({ images: {} })),
      ]);
      seriesPrintVariantMetadata = variantMetadata;
      applySeriesLegacyPackManifest(legacyPackManifest);
      return applySeriesPrintVariantMetadata(seriesGroups, variantMetadata);
    }
    const [baseGroups, legacyGroups, variantMetadata, imageOverrides, legacyPackManifest] = await Promise.all([
      fetchJson(SERIES_DATA_URL),
      fetchJson(LEGACY_SERIES_DATA_URL).catch(() => []),
      fetchJson(SERIES_PRINT_VARIANTS_URL).catch(() => ({
        coverage: {},
        slots: {},
      })),
      fetchJson(SERIES_IMAGE_OVERRIDES_URL).catch(() => ({ sets: {} })),
      fetchJson(SERIES_LEGACY_PACK_IMAGE_MANIFEST_URL).catch(() => ({ images: {} })),
    ]);
    seriesPrintVariantMetadata = variantMetadata;
    applySeriesLegacyPackManifest(legacyPackManifest);
    const mergedGroups = applySeriesImageOverrides(
      mergeSeriesGroups(baseGroups, legacyGroups),
      imageOverrides,
    );
    return applySeriesPrintVariantMetadata(
      mergedGroups,
      seriesPrintVariantMetadata,
    );
  }

  const [baseGroups, sequenceGroups, pokedex] = await Promise.all([
    fetchJson(POKEMON_DATA_URL),
    fetchJson(POKEMON_SEQUENCE_DATA_URL),
    fetchJson(POKEDEX_DATA_URL),
  ]);

  // 기존에 카드 데이터가 있는 포켓몬은 그대로 보존하되,
  // #0001~#1025 전국도감 전체를 선택 목록의 기준으로 사용합니다.
  const populatedByName = new Map();
  for (const group of baseGroups) {
    if (group?.name) populatedByName.set(group.name, group);
  }
  for (const group of sequenceGroups) {
    if (group?.name) populatedByName.set(group.name, group);
  }

  const records = Array.isArray(pokedex?.records) ? pokedex.records : [];
  if (records.length !== 1025) {
    throw new Error(`전국도감 데이터가 1025종이 아닙니다: ${records.length}`);
  }

  return records.map((record) => {
    const existing = populatedByName.get(record.nameKo);
    if (existing) {
      return { ...existing, dexNumber: record.number };
    }
    return {
      name: record.nameKo,
      dexNumber: record.number,
      cards: [],
    };
  });
}

async function init() {
  try {
    groups = await loadCatalogGroups();
    mobileCatalogPreferences = readMobileCatalogPreferences();

    const requestedGroupValue =
      new URLSearchParams(window.location.search).get("group") || "";
    const requestedGroup = requestedGroupValue
      ? groups.find((group) => (group.code || group.name) === requestedGroupValue)
      : null;

    if (mode === "series") {
      activeEra = requestedGroup ? seriesEra(requestedGroup) : "ALL";
    }
    if (["all", "owned", "missing"].includes(mobileCatalogPreferences.status)) {
      status = mobileCatalogPreferences.status;
    }

    const account = window.PokemonDexPageAccount;
    if (account) {
      await account.ready;
      account.applyGroups(groups);
    }

    quickCollectMode = readQuickCollectPreference() && quickCollectCanEdit();
    document.body.classList.toggle("is-quick-collect", quickCollectMode);

    // 기본 수록 도감은 기존 시리즈도감과 같은 accountKey를 먼저 부여한 뒤
    // 분모 번호 이하 카드만 화면에 남겨 보유 상태를 완전히 공유합니다.
    if (mode === "series") allSeriesGroups = groups;
    applySeriesScope();

    groups.forEach((group) => {
      group.total = group.cards.length;
      group.owned = group.cards.filter((card) => card.owned).length;
    });

    createSeriesEditor();
    renderQuickCollectControl();
    updateSummary();
    syncEraTabs();
    syncSeriesView();
    renderSeriesDashboard();

    const select = $("catalog-select");
    const initialGroups =
      mode === "series" && activeEra === "ALL" ? [] : populateCatalogSelect();
    const rememberedGroup = mode === "series"
      ? mobileCatalogPreferences.groupByEra?.[activeEra]
      : mobileCatalogPreferences.group;
    const initialGroupValue =
      requestedGroup &&
      initialGroups.some((group) =>
        (group.code || group.name) === requestedGroupValue,
      )
        ? requestedGroupValue
        : rememberedGroup;
    if (
      initialGroups.some((group) =>
        (group.code || group.name) === initialGroupValue,
      )
    ) {
      select.value = initialGroupValue;
    }
    $("catalog-status")
      ?.querySelectorAll("button[data-status]")
      .forEach((button) => {
        button.classList.toggle("is-active", button.dataset.status === status);
      });

    select.onchange = () =>
      mode === "pokemon"
        ? choosePokemonGroup(select.value)
        : loadGroup(select.value);
    $("pokemon-prev")?.addEventListener("click", () => stepPokemonGroup(-1));
    $("pokemon-next")?.addEventListener("click", () => stepPokemonGroup(1));
    $("catalog-era")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-era]");
      if (button) selectEra(button.dataset.era);
    });
    $("catalog-search").oninput = (event) => {
      query = event.target.value;
      render();
    };
    $("catalog-status").onclick = (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      status = button.dataset.status;
      event.currentTarget
        .querySelectorAll("button")
        .forEach((item) => item.classList.toggle("is-active", item === button));
      render();
      rememberMobileCatalogPreferences();
    };
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && quickVariantCard) closeQuickVariantPicker();
    });

    $("dialog-close").onclick = closeCatalogDialog;
    $("catalog-dialog")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeCatalogDialog();
    });

    if (mode === "series" && activeEra === "ALL") {
      selected = null;
      cards = [];
      render();
    } else {
      loadGroup(
        select.value ||
          initialGroups[0]?.code ||
          initialGroups[0]?.name ||
          groups[0].code ||
          groups[0].name,
      );
    }
    if (mode === "series") {
      window.PokemonDexSeriesScope = { setScope: setSeriesScope };
      window.dispatchEvent(new Event("pokemon-dex:catalog-ready"));
    }
  } catch (error) {
    console.error(error);
    $("catalog-error").hidden = false;
  }
}

init();
