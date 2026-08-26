"use strict";

const $ = (id) => document.getElementById(id);
const DATA_URL = "./data/ar.json";
const SUPPLEMENT_URL = "./data/ar-supplement.json";
const NATIONAL_DEX_URL = "./data/pokedex.json";
const EXPECTED_GROUPS = 33;
const EXPECTED_TOTAL = 510;
const BASE_GROUPS = 32;
const BASE_TOTAL = 498;

let groups = [];
let allCards = [];
let nationalCards = [];
let selectedCode = "national";
let status = "all";
let query = "";
let activeCard = null;
let accountApplied = false;

const pct = (amount, total) =>
  total ? Math.round((amount / total) * 1000) / 10 : 0;

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function pad(number) {
  return String(number).padStart(3, "0");
}

function padDex(number) {
  return String(number).padStart(4, "0");
}

function mergeGroups(baseGroups, supplementGroups) {
  const merged = Array.isArray(baseGroups) ? [...baseGroups] : [];
  const extras = Array.isArray(supplementGroups) ? supplementGroups : [];

  extras.forEach((extra) => {
    const code = String(extra?.code || "").toLowerCase();
    if (!code) return;
    const index = merged.findIndex(
      (group) => String(group?.code || "").toLowerCase() === code,
    );
    if (index >= 0) merged[index] = extra;
    else merged.push(extra);
  });

  return merged;
}

async function fetchJson(url, required = true) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} ${response.status}`);
    return await response.json();
  } catch (error) {
    if (required) throw error;
    console.warn(`${url} 데이터를 불러오지 못했습니다.`, error);
    return null;
  }
}

function normalizeGroups(sourceGroups) {
  const safeGroups = Array.isArray(sourceGroups) ? sourceGroups : [];
  groups = safeGroups.map((group) => ({
    ...group,
    cards: (Array.isArray(group.cards) ? group.cards : []).map((card) => ({
      ...card,
      setCode: String(group.code || ""),
      setTitle: String(group.title || ""),
      owned: Boolean(card.owned),
    })),
  }));

  allCards = groups.flatMap((group) => group.cards);

  const isCurrent =
    groups.length === EXPECTED_GROUPS && allCards.length === EXPECTED_TOTAL;
  const isBase =
    groups.length === BASE_GROUPS && allCards.length === BASE_TOTAL;

  if (!isCurrent && !isBase) {
    console.warn(
      `AR 데이터 수가 예상과 다릅니다: ${groups.length}세트 ${allCards.length}장`,
    );
  }
}

function normalizePokemonName(name) {
  return String(name || "")
    .replace(/\s+(ex|V|VMAX|VSTAR)$/i, "")
    .trim();
}

function dexCandidates(name) {
  const normalized = normalizePokemonName(name);
  const candidates = [normalized];

  if (normalized.includes("의 ")) {
    candidates.push(normalized.slice(normalized.indexOf("의 ") + 2));
  }

  const parts = normalized.split(/\s+/);
  if (parts.length > 1) candidates.push(parts[parts.length - 1]);

  return [...new Set(candidates.filter(Boolean))];
}

function applyNationalDex(records) {
  if (!Array.isArray(records)) {
    nationalCards = [...allCards];
    return;
  }

  const dexByName = new Map(
    records
      .filter((record) => record && record.nameKo)
      .map((record) => [String(record.nameKo), Number(record.number)]),
  );

  let unmatched = 0;
  allCards.forEach((card, releaseIndex) => {
    card.releaseIndex = releaseIndex;
    card.dexNumber = null;

    for (const candidate of dexCandidates(card.name)) {
      const dexNumber = dexByName.get(candidate);
      if (Number.isFinite(dexNumber) && dexNumber > 0) {
        card.dexNumber = dexNumber;
        break;
      }
    }

    if (!card.dexNumber) unmatched += 1;
  });

  nationalCards = [...allCards].sort((a, b) => {
    const aDex = a.dexNumber ?? Number.POSITIVE_INFINITY;
    const bDex = b.dexNumber ?? Number.POSITIVE_INFINITY;
    return aDex - bDex || a.releaseIndex - b.releaseIndex;
  });

  if (unmatched) {
    console.warn(`전국도감 번호를 찾지 못한 AR 카드가 ${unmatched}장 있습니다.`);
  }
}

function visibleCards() {
  if (selectedCode === "national") return nationalCards.length ? nationalCards : allCards;
  if (selectedCode === "all") return allCards;
  return groups.find((group) => group.code === selectedCode)?.cards || [];
}

function selectedLabel() {
  if (selectedCode === "national") return "전국도감 순";
  if (selectedCode === "all") return "시리즈 발매 순";
  const group = groups.find((item) => item.code === selectedCode);
  return group ? `${group.code} · ${group.title}` : "전체 AR 모음";
}

function selectedOrderNote() {
  if (selectedCode === "national") {
    return "전국도감 번호 오름차순 · 같은 포켓몬은 공식 발매 순";
  }
  if (selectedCode === "all") return "공식 발매 순서 · 카드번호 오름차순";
  return "세트 카드번호 오름차순";
}

function badge(owned) {
  const element = document.createElement("span");
  element.className = `status-badge ${owned ? "is-owned" : "is-missing"}`;
  element.textContent = owned ? "보유" : "미보유";
  return element;
}

function refreshCounts() {
  groups.forEach((group) => {
    group.total = group.cards.length;
    group.owned = group.cards.filter((card) => card.owned).length;
  });

  const total = allCards.length;
  const owned = allCards.filter((card) => card.owned).length;
  const rate = pct(owned, total);
  const selectedCards = visibleCards();
  const selectedOwned = selectedCards.filter((card) => card.owned).length;

  setText("catalog-owned", owned);
  setText("catalog-total", total);
  setText("catalog-missing", total - owned);
  setText("catalog-rate", `${rate}%`);
  setText("stat-catalog-groups", groups.length);
  setText("stat-catalog-total", total);
  setText("stat-catalog-rate", rate);
  setText("selected-name", selectedLabel());
  setText(
    "selected-progress",
    `${selectedOwned} / ${selectedCards.length}장 · ${pct(selectedOwned, selectedCards.length)}%`,
  );

  const orderNote = document.querySelector(".ar-order-note");
  if (orderNote) orderNote.textContent = selectedOrderNote();

  const ring = $("catalog-progress-ring");
  if (ring) ring.style.setProperty("--progress", rate);
}

function updateCompletionButton(button, card) {
  if (!button) return;
  const owned = Boolean(card.owned);
  button.classList.toggle("is-complete", owned);
  button.classList.remove("is-saving");
  button.disabled = false;
  button.setAttribute("aria-pressed", String(owned));
  button.setAttribute(
    "aria-label",
    owned ? `${card.name} 수집완료 취소` : `${card.name} 수집완료로 표시`,
  );
  button.title = owned
    ? "다시 누르면 미보유로 변경됩니다."
    : "로그인한 내 도감에 수집완료로 저장합니다.";
  button.textContent = owned ? "✓ 수집완료" : "수집완료";
}

function updateDialog(card) {
  const image = $("catalog-dialog-image");
  const imageWrap = $("catalog-dialog-image-wrap");
  const imageFallback = $("catalog-dialog-image-fallback");

  if (image && imageWrap) {
    imageWrap.classList.remove("has-image-error");
    image.onload = () => imageWrap.classList.remove("has-image-error");
    image.onerror = () => imageWrap.classList.add("has-image-error");
    image.src = card.image || "";
    image.alt = `${card.name} 카드`;
    imageWrap.classList.toggle("is-missing", !card.owned);
  }

  if (imageFallback) {
    imageFallback.textContent =
      ["m5", "m6"].includes(String(card.setCode).toLowerCase())
        ? "포켓몬코리아 공식 AR 이미지 준비 중"
        : "이미지를 불러오지 못했습니다";
  }

  setText("dialog-code", card.code);
  setText("dialog-name", card.name);
  setText("dialog-meta", `${String(card.setCode).toUpperCase()} ART RARE`);
  setText("dialog-group", `${card.setCode} · ${card.setTitle}`);
  setText("dialog-number", `${pad(card.number)} / ${card.denominator}`);

  const statusBadge = $("dialog-status");
  if (statusBadge) {
    statusBadge.className = `status-badge ${card.owned ? "is-owned" : "is-missing"}`;
    statusBadge.textContent = card.owned ? "보유" : "미보유";
  }

  const toggle = $("dialog-toggle");
  if (toggle) {
    toggle.classList.toggle("is-complete", card.owned);
    toggle.disabled = false;
    toggle.textContent = card.owned ? "✓ 수집완료" : "수집완료로 표시";
  }
}

function openDialog(card) {
  activeCard = card;
  updateDialog(card);
  const dialog = $("catalog-dialog");
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

async function toggleCard(card, button) {
  const account = window.PokemonDexPageAccount;
  if (!account?.canEdit?.()) {
    alert("Google 로그인 후 내 수집 상태를 저장할 수 있습니다.");
    return;
  }

  if (!card.accountKey) {
    alert("보유정보를 불러오는 중입니다. 잠시 후 다시 눌러주세요.");
    return;
  }

  const nextOwned = !card.owned;
  if (button) {
    button.disabled = true;
    button.classList.add("is-saving");
    button.textContent = "저장 중…";
  }

  const dialogToggle = $("dialog-toggle");
  if (activeCard === card && dialogToggle) {
    dialogToggle.disabled = true;
    dialogToggle.textContent = "저장 중…";
  }

  try {
    const saved = await account.saveOwned(card.accountKey, nextOwned);
    card.owned = Boolean(saved?.owned);
    refreshCounts();
    render();
    if (activeCard === card) updateDialog(card);
  } catch (error) {
    console.error(error);
    alert(error?.message || "수집 상태를 저장하지 못했습니다.");
    if (button) updateCompletionButton(button, card);
    if (activeCard === card) updateDialog(card);
  }
}

function makeCard(card) {
  const article = document.createElement("article");
  article.className = `pokemon-card ar-card catalog-card has-completion-action${
    card.owned ? "" : " is-missing"
  }`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pokemon-card-button";
  button.addEventListener("click", () => openDialog(card));

  const imageWrap = document.createElement("span");
  imageWrap.className = "card-image-wrap";

  const image = document.createElement("img");
  image.className = "card-image";
  image.loading = "lazy";
  image.src = card.image || "";
  image.alt = `${card.name} 카드`;
  image.onerror = () => article.classList.add("has-image-error");

  const missing = document.createElement("span");
  missing.className = "missing-overlay";
  missing.textContent = "미보유";

  const rarity = document.createElement("span");
  rarity.className = "ar-rarity-badge";
  rarity.textContent = "AR";

  const fallback = document.createElement("span");
  fallback.className = "image-fallback";
  const fallbackBall = document.createElement("span");
  fallbackBall.className = "fallback-ball";
  fallbackBall.append(document.createElement("span"));
  const fallbackCopy = document.createElement("span");
  fallbackCopy.textContent =
    ["m5", "m6"].includes(String(card.setCode).toLowerCase())
      ? "포켓몬코리아 공식 AR 이미지 준비 중"
      : "이미지를 불러오지 못했습니다";
  fallback.append(fallbackBall, fallbackCopy);
  imageWrap.append(image, missing, rarity, fallback);

  const body = document.createElement("span");
  body.className = "card-body";

  const top = document.createElement("span");
  top.className = "card-topline";
  const number = document.createElement("span");
  number.className = "number-badge";
  number.textContent = card.code;
  top.append(number, badge(card.owned));

  const name = document.createElement("strong");
  name.className = "card-name-ko";
  name.textContent = card.name;

  const setName = document.createElement("span");
  setName.className = "ar-card-set";
  setName.textContent =
    selectedCode === "national" && card.dexNumber
      ? `#${padDex(card.dexNumber)} · ${card.setCode} · ${card.setTitle}`
      : `${card.setCode} · ${card.setTitle}`;

  const meta = document.createElement("span");
  meta.className = "card-meta";
  meta.textContent = `${pad(card.number)} / ${card.denominator} · ART RARE`;

  body.append(top, name, setName, meta);
  button.append(imageWrap, body);

  const complete = document.createElement("button");
  complete.type = "button";
  complete.className = "collection-complete-button";
  updateCompletionButton(complete, card);
  complete.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void toggleCard(card, complete);
  });

  article.append(button, complete);
  return article;
}

function render() {
  const grid = $("catalog-grid");
  if (!grid) return;

  const normalizedQuery = query.trim().toLowerCase();
  const baseCards = visibleCards();
  const shown = baseCards.filter((card) => {
    const matchesStatus =
      status === "all" || (status === "owned") === Boolean(card.owned);
    const haystack = [
      card.name,
      card.code,
      card.setCode,
      card.setTitle,
      card.number,
      card.dexNumber,
      card.dexNumber ? `#${padDex(card.dexNumber)}` : "",
    ]
      .join(" ")
      .toLowerCase();
    return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  grid.replaceChildren(...shown.map(makeCard));
  setText("result-count", shown.length);

  const empty = $("catalog-empty");
  if (empty) {
    empty.hidden = shown.length !== 0;
    if (!shown.length && selectedCode === "sv8a" && !normalizedQuery) {
      setText("empty-title", "이 세트에는 AR이 없습니다");
      setText("empty-copy", "테라스탈 페스티벌 ex는 AR 0종으로 확인되었습니다.");
    } else {
      setText("empty-title", "검색 결과가 없습니다");
      setText("empty-copy", "다른 세트나 검색어를 선택해 보세요.");
    }
  }
}

function buildSelect() {
  const select = $("catalog-select");
  if (!select) return;
  select.replaceChildren();

  const allViews = document.createElement("optgroup");
  allViews.label = "전체 보기";

  const national = document.createElement("option");
  national.value = "national";
  national.textContent = `전국도감 순 · ${allCards.length}장`;

  const all = document.createElement("option");
  all.value = "all";
  all.textContent = `시리즈 발매 순 · ${allCards.length}장`;

  allViews.append(national, all);
  select.append(allViews);

  const seriesViews = document.createElement("optgroup");
  seriesViews.label = "시리즈별";
  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.code;
    option.textContent = `${group.code} · ${group.title} · ${group.cards.length}장`;
    seriesViews.append(option);
  });
  select.append(seriesViews);
  select.value = selectedCode;
}

function bindUi() {
  $("catalog-select")?.addEventListener("change", (event) => {
    selectedCode = event.target.value;
    refreshCounts();
    render();
  });

  $("catalog-search")?.addEventListener("input", (event) => {
    query = event.target.value;
    render();
  });

  $("catalog-status")?.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    status = button.dataset.status;
    event.currentTarget
      .querySelectorAll("button")
      .forEach((item) => item.classList.toggle("is-active", item === button));
    render();
  });

  $("dialog-close")?.addEventListener("click", () => {
    const dialog = $("catalog-dialog");
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  });

  $("dialog-toggle")?.addEventListener("click", () => {
    if (activeCard) void toggleCard(activeCard, $("dialog-toggle"));
  });
}

function showFatalError(error) {
  console.error("AR 초기화 실패", error);
  const errorBox = $("catalog-error");
  if (!errorBox) return;
  errorBox.hidden = false;
  const copy = errorBox.querySelector("span");
  if (copy) copy.textContent = error?.message || "페이지를 새로고침해 주세요.";
}

async function applyAccountState() {
  const account = window.PokemonDexPageAccount;
  if (!account) return;

  try {
    await account.ready;
    account.applyGroups(groups);
    accountApplied = true;
    refreshCounts();
    render();
  } catch (error) {
    accountApplied = false;
    console.warn(
      "AR 보유정보 적용에 실패했습니다. 카드 목록은 기본 상태로 계속 표시합니다.",
      error,
    );
  }
}

async function init() {
  try {
    // 1) 카드 데이터는 일반 fetch만 사용한다. 보충 데이터 실패 시 기존 498장으로라도 연다.
    const [baseData, supplementData] = await Promise.all([
      fetchJson(DATA_URL, true),
      fetchJson(SUPPLEMENT_URL, false),
    ]);

    normalizeGroups(mergeGroups(baseData, supplementData || []));
    nationalCards = [...allCards];

    // 2) 목록/필터를 먼저 만든다. 이후 부가 기능이 실패해도 빈 화면이 되지 않는다.
    buildSelect();
    refreshCounts();
    render();
    bindUi();

    const heroDescription = document.querySelector(".hero-description");
    if (heroDescription) {
      heroDescription.textContent =
        "전국도감 순 또는 공식 발매 순서로 모아보는 AR 컬렉션";
    }
    const filterLabel = document.querySelector(".catalog-select .filter-label");
    if (filterLabel) filterLabel.textContent = "보기 선택";

    // 3) 전국도감 정렬은 독립적으로 적용한다. 실패해도 시리즈 발매 순 목록은 유지한다.
    const dexData = await fetchJson(NATIONAL_DEX_URL, false);
    if (dexData?.records) {
      try {
        applyNationalDex(dexData.records);
        refreshCounts();
        render();
      } catch (error) {
        console.warn("AR 전국도감 정렬 적용에 실패했습니다.", error);
        nationalCards = [...allCards];
      }
    }

    // 4) 마지막에 기존 Firestore 보유상태를 덮어씌운다. 실패해도 목록 자체는 유지한다.
    await applyAccountState();
  } catch (error) {
    showFatalError(error);
  }
}

void init();
