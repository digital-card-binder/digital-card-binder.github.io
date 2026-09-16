"use strict";

const FOSSIL_DATA_URL = "./data/fossil.json?v=20260916-2";
const FOSSIL_ALL = "__all__";
const fossilEl = (id) => document.getElementById(id);

let fossilDataset = null;
let selectedSet = FOSSIL_ALL;
let selectedCategory = FOSSIL_ALL;
let statusFilter = "all";
let searchQuery = "";
let activeCard = null;

const rate = (owned, total) => total ? Math.round((owned / total) * 1000) / 10 : 0;
const allCards = () => fossilDataset.groups.flatMap((group) => group.cards || []);

function setVariants(setCode) {
  const raw = String(setCode || "").trim();
  if (!raw) return [];
  const variants = new Set([raw, raw.toUpperCase(), raw.toLowerCase()]);
  const match = raw.match(/^(sv)(\d+)([a-z]*)$/i);
  if (match) {
    variants.add(`SV${match[2]}${match[3].toLowerCase()}`);
    variants.add(`SV${match[2]}${match[3].toUpperCase()}`);
  }
  return [...variants].filter(Boolean);
}

function imageLocation(card) {
  const setCode = String(card.set || "").trim();
  let series = String(card.series || "").trim().toUpperCase();
  if (!series) {
    if (/^SV/i.test(setCode)) series = "SV";
    else if (/^(?:M\d|MC|M-P)/i.test(setCode)) series = "MEGA";
    else series = "S";
  }

  let folder = setCode;
  if (/^S5[RI]$/i.test(setCode)) folder = "S5";
  else if (/^S6[HK]$/i.test(setCode)) folder = "S6";
  else if (/^S10[DP]$/i.test(setCode)) folder = "S10";
  return { series, folder };
}

function imageCandidates(card) {
  const candidates = [];
  const add = (value) => {
    const url = String(value || "").trim();
    if (url && !candidates.includes(url)) candidates.push(url);
  };
  add(card.image);
  const number = String(card.cardNumber || "").split("/", 1)[0].trim().padStart(3, "0");
  if (!number) return candidates;
  const { series, folder } = imageLocation(card);
  for (const setCode of setVariants(card.set)) {
    ["png", "jpg", "jpeg", "webp"].forEach((extension) => {
      add(`https://cards.image.pokemonkorea.co.kr/data/wmimages/${series}/${folder}/${setCode}_${number}.${extension}`);
    });
  }
  return candidates;
}

function loadImage(image, card, onError) {
  const candidates = imageCandidates(card);
  let index = 0;
  image.onload = () => {
    if (image.src) card.image = image.src;
  };
  image.onerror = () => {
    if (index >= candidates.length) {
      image.onerror = null;
      if (typeof onError === "function") onError();
      return;
    }
    image.src = candidates[index++];
  };
  if (candidates.length) image.src = candidates[index++];
  else if (typeof onError === "function") onError();
}

function setScopedCards() {
  if (selectedSet === FOSSIL_ALL) return allCards();
  return fossilDataset.groups.find((group) => group.code === selectedSet)?.cards || [];
}

function selectedCards() {
  const cards = setScopedCards();
  if (selectedCategory === FOSSIL_ALL) return cards;
  return cards.filter((card) => card.category === selectedCategory);
}

function matches(card) {
  const statusOk = statusFilter === "all" || (statusFilter === "owned") === Boolean(card.owned);
  const query = searchQuery.trim().toLowerCase();
  if (!statusOk) return false;
  if (!query) return true;
  const haystack = [card.series, card.name, card.set, card.setName, card.cardNumber, card.rarity, card.category, card.evidence, card.illustrator]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function setSummary() {
  const cards = allCards();
  const categoryCounts = cards.reduce((counts, card) => {
    const category = card.category || "화석 카드";
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  const seriesCounts = cards.reduce((counts, card) => {
    const series = card.series || "기타";
    counts[series] = (counts[series] || 0) + 1;
    return counts;
  }, {});
  const owned = cards.filter((card) => card.owned).length;
  const completion = rate(owned, cards.length);
  fossilEl("fossil-owned").textContent = owned;
  fossilEl("fossil-total").textContent = cards.length;
  fossilEl("fossil-missing").textContent = cards.length - owned;
  fossilEl("fossil-rate").textContent = `${completion}%`;
  fossilEl("fossil-progress-ring").style.setProperty("--progress", completion);
  fossilEl("fossil-set-count").textContent = fossilDataset.groups.length;
  fossilEl("fossil-card-count").textContent = cards.length;
  fossilEl("fossil-stat-rate").textContent = completion;
  fossilEl("fossil-pokemon-count").textContent = categoryCounts["화석 포켓몬"] || 0;
  fossilEl("fossil-item-count").textContent = categoryCounts["화석 아이템"] || 0;
  fossilEl("fossil-illustration-count").textContent = categoryCounts["일러스트 속 화석"] || 0;
  fossilEl("fossil-rule-title").textContent = `${cards.length}장 수록 기준`;
  fossilEl("fossil-catalog-title").textContent = `${fossilDataset.scope} 화석 카드 · ${cards.length}장`;
  fossilEl("fossil-scope").textContent = `FOSSIL DEX · ${fossilDataset.scope} · ${cards.length} CARDS`;
  fossilEl("fossil-hero-description").textContent =
    `S ${seriesCounts.S || 0}장 · SV ${seriesCounts.SV || 0}장 · MEGA ${seriesCounts.MEGA || 0}장, 총 ${cards.length}장을 공식 카드 이미지 기준으로 관리합니다.`;
  fossilEl("fossil-footer-note").textContent =
    `카드 정보·이미지 기준: 포켓몬코리아 공식 카드 검색 · S ${seriesCounts.S || 0}장 + SV ${seriesCounts.SV || 0}장 + MEGA ${seriesCounts.MEGA || 0}장 = 총 ${cards.length}장`;
}

function populateSetFilter() {
  const select = fossilEl("fossil-set-select");
  select.replaceChildren();
  const all = document.createElement("option");
  all.value = FOSSIL_ALL;
  all.textContent = `전체 · ${allCards().length}장`;
  select.append(all);
  fossilDataset.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.code;
    option.textContent = `${group.name} · ${(group.cards || []).length}장`;
    select.append(option);
  });
  select.value = selectedSet;
}

function populateCategoryFilter() {
  const select = fossilEl("fossil-category-select");
  const counts = new Map();
  allCards().forEach((card) => {
    const category = card.category || "화석 카드";
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  select.replaceChildren();
  const all = document.createElement("option");
  all.value = FOSSIL_ALL;
  all.textContent = `전체 · ${allCards().length}장`;
  select.append(all);

  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .forEach(([category, count]) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = `${category} · ${count}장`;
      select.append(option);
    });
  select.value = selectedCategory;
}

function statusBadge(card) {
  const badge = document.createElement("span");
  badge.className = `status-badge ${card.owned ? "is-owned" : "is-missing"}`;
  badge.textContent = card.owned ? "보유" : "미보유";
  return badge;
}

function updateComplete(button, card) {
  button.disabled = false;
  button.classList.toggle("is-complete", Boolean(card.owned));
  button.setAttribute("aria-pressed", String(Boolean(card.owned)));
  button.textContent = card.owned ? "✓ 수집완료" : "수집완료";
}

async function toggleOwned(card, button) {
  const account = window.PokemonDexPageAccount;
  if (!account?.canEdit?.()) {
    alert("Google 로그인 후 내 수집 상태를 저장할 수 있습니다.");
    return;
  }
  button.disabled = true;
  button.textContent = "저장 중…";
  try {
    const saved = await account.saveOwned(card.accountKey, !card.owned);
    card.owned = Boolean(saved?.owned);
    setSummary();
    if (activeCard === card) updateDialog(card);
    render();
  } catch (error) {
    console.error(error);
    alert(error.message || "수집 상태를 저장하지 못했습니다.");
    updateComplete(button, card);
  }
}

function completeButton(card) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fossil-complete-button";
  updateComplete(button, card);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void toggleOwned(card, button);
  });
  return button;
}

function createCard(card) {
  const article = document.createElement("article");
  article.className = `pokemon-card fossil-card${card.owned ? "" : " is-missing"}`;

  const button = document.createElement("button");
  button.className = "fossil-card-button";
  button.type = "button";
  button.setAttribute("aria-label", `${card.name} 상세 보기`);

  const imageWrap = document.createElement("span");
  imageWrap.className = "card-image-wrap";
  const image = document.createElement("img");
  image.className = "card-image";
  image.alt = `${card.name} 포켓몬 카드`;
  image.loading = "lazy";
  loadImage(image, card, () => article.classList.add("has-image-error"));
  const missing = document.createElement("span");
  missing.className = "missing-overlay";
  missing.textContent = "미보유";
  const fallback = document.createElement("span");
  fallback.className = "image-fallback";
  fallback.textContent = "카드 이미지를 불러오지 못했습니다";
  imageWrap.append(image, missing, fallback);

  const body = document.createElement("span");
  body.className = "card-body";
  const top = document.createElement("span");
  top.className = "card-topline";
  const number = document.createElement("span");
  number.className = "number-badge";
  number.textContent = card.set;
  top.append(number, statusBadge(card));
  const name = document.createElement("strong");
  name.className = "card-name-ko";
  name.textContent = card.name;
  const category = document.createElement("span");
  category.className = "card-name-en";
  category.textContent = card.category || "화석 카드";
  const meta = document.createElement("span");
  meta.className = "card-meta";
  const set = document.createElement("span");
  set.textContent = card.setName;
  const cardNumber = document.createElement("span");
  cardNumber.textContent = `${card.cardNumber} · ${card.rarity || "—"}`;
  meta.append(set, cardNumber);
  body.append(top, name, category, meta);
  button.append(imageWrap, body);
  button.addEventListener("click", () => openDialog(card));
  article.append(button, completeButton(card));
  return article;
}

function updateDialog(card) {
  const wrap = fossilEl("fossil-dialog-image-wrap");
  const image = fossilEl("fossil-dialog-image");
  wrap.classList.remove("has-image-error");
  loadImage(image, card, () => wrap.classList.add("has-image-error"));
  image.alt = `${card.name} 포켓몬 카드`;
  wrap.classList.toggle("is-missing", !card.owned);
  fossilEl("fossil-dialog-number").textContent = card.cardNumber;
  const badge = fossilEl("fossil-dialog-status");
  badge.textContent = card.owned ? "보유" : "미보유";
  badge.className = `status-badge ${card.owned ? "is-owned" : "is-missing"}`;
  fossilEl("fossil-dialog-name").textContent = card.name;
  fossilEl("fossil-dialog-category").textContent = card.category || "화석 카드";
  fossilEl("fossil-dialog-set").textContent = `${card.setName} · ${card.set}`;
  fossilEl("fossil-dialog-card-number").textContent = card.cardNumber || "—";
  fossilEl("fossil-dialog-rarity").textContent = card.rarity || "—";
  fossilEl("fossil-dialog-illustrator").textContent = card.illustrator || "확인 중";
  fossilEl("fossil-dialog-evidence").textContent = card.evidence || "공식 카드 이미지 확인";
}

function openDialog(card) {
  activeCard = card;
  updateDialog(card);
  const dialog = fossilEl("fossil-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog() {
  const dialog = fossilEl("fossil-dialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function render() {
  const cards = selectedCards();
  const owned = cards.filter((card) => card.owned).length;
  const completion = rate(owned, cards.length);
  const group = fossilDataset.groups.find((item) => item.code === selectedSet);
  const scopeParts = [group?.name || "전체"];
  if (selectedCategory !== FOSSIL_ALL) scopeParts.push(selectedCategory);
  fossilEl("fossil-selected-set").textContent = scopeParts.join(" · ");
  fossilEl("fossil-selected-owned").textContent = owned;
  fossilEl("fossil-selected-total").textContent = cards.length;
  fossilEl("fossil-selected-rate").textContent = completion;

  const shown = cards.filter(matches);
  const grid = fossilEl("fossil-card-grid");
  grid.replaceChildren(...shown.map(createCard));
  grid.setAttribute("aria-busy", "false");
  fossilEl("fossil-result-count").textContent = shown.length;
  fossilEl("fossil-empty").hidden = shown.length !== 0;
}

function bindControls() {
  fossilEl("fossil-set-select").addEventListener("change", (event) => {
    selectedSet = event.target.value;
    render();
  });
  fossilEl("fossil-category-select").addEventListener("change", (event) => {
    selectedCategory = event.target.value;
    render();
  });
  fossilEl("fossil-search").addEventListener("input", (event) => {
    searchQuery = event.target.value;
    render();
  });
  fossilEl("fossil-status-filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    statusFilter = button.dataset.status;
    event.currentTarget.querySelectorAll("button[data-status]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    render();
  });
  fossilEl("fossil-dialog-close").addEventListener("click", closeDialog);
  fossilEl("fossil-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeDialog();
  });
}

async function initFossilDex() {
  try {
    const response = await fetch(FOSSIL_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    fossilDataset = await response.json();
    const account = window.PokemonDexPageAccount;
    if (account) {
      await account.ready;
      account.applyGroups(fossilDataset.groups);
    }
    setSummary();
    populateSetFilter();
    populateCategoryFilter();
    bindControls();
    render();
  } catch (error) {
    console.error(error);
    fossilEl("fossil-card-grid")?.setAttribute("aria-busy", "false");
    if (fossilEl("fossil-error")) fossilEl("fossil-error").hidden = false;
  }
}

initFossilDex();
