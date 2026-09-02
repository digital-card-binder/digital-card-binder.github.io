"use strict";

const TP_DATA_URL = "./data/trainer-pokemon.json?v=20260902-3";
const tp = (id) => document.getElementById(id);

let tpDataset = null;
let tpSelected = null;
let tpStatus = "all";
let tpQuery = "";
let tpSort = "order";
let tpActiveCard = null;

const tpRate = (owned, total) => total ? Math.round((owned / total) * 1000) / 10 : 0;
const allCards = () => tpDataset.groups.flatMap((group) => group.cards || []);

function setSummary() {
  const cards = allCards();
  const owned = cards.filter((card) => card.owned).length;
  const total = cards.length;
  const completion = tpRate(owned, total);
  tp("tp-owned").textContent = owned;
  tp("tp-total").textContent = total;
  tp("tp-missing").textContent = total - owned;
  tp("tp-rate").textContent = `${completion}%`;
  tp("tp-progress-ring").style.setProperty("--progress", completion);
  tp("tp-group-count").textContent = tpDataset.groups.length;
  tp("tp-card-count").textContent = total;
  tp("tp-stat-rate").textContent = completion;
}

function populateGroups() {
  const select = tp("tp-group-select");
  tpDataset.groups.sort((a, b) => Number(a.nationalDexNo || 9999) - Number(b.nationalDexNo || 9999)).forEach((group) => {
    const option = document.createElement("option");
    option.value = group.name;
    option.textContent = `#${String(group.nationalDexNo).padStart(3, "0")} ${group.name} · ${(group.cards || []).length}장`;
    select.append(option);
  });
  tpSelected = tpDataset.groups[0];
  select.value = tpSelected.name;
  select.addEventListener("change", () => {
    tpSelected = tpDataset.groups.find((group) => group.name === select.value) || tpDataset.groups[0];
    render();
  });
}

function matches(card) {
  const statusOk = tpStatus === "all" || (tpStatus === "owned") === card.owned;
  const query = tpQuery.trim().toLowerCase();
  const haystack = `${card.name} ${card.pokemonName} ${card.personName || ""} ${card.trainer || ""} ${card.set} ${card.setName} ${card.rarity} ${card.cardNumber} ${card.illustrator}`.toLowerCase();
  return statusOk && (!query || haystack.includes(query));
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (tpSort === "name") {
      return String(a.name).localeCompare(String(b.name), "ko");
    }
    if (tpSort === "set") {
      return String(a.set).localeCompare(String(b.set), "en", { numeric: true }) || (a.order || 0) - (b.order || 0);
    }
    return (a.order || 0) - (b.order || 0);
  });
}

function statusBadge(card) {
  const badge = document.createElement("span");
  badge.className = `status-badge ${card.owned ? "is-owned" : "is-missing"}`;
  badge.textContent = card.owned ? "보유" : "미보유";
  return badge;
}

function updateDialog(card) {
  const wrap = tp("tp-dialog-image-wrap");
  const image = tp("tp-dialog-image");
  image.src = card.image;
  image.alt = `${card.name} 포켓몬 카드`;
  wrap.classList.toggle("is-missing", !card.owned);
  tp("tp-dialog-number").textContent = card.cardNumber || card.set;
  const badge = tp("tp-dialog-status");
  badge.textContent = card.owned ? "보유" : "미보유";
  badge.className = `status-badge ${card.owned ? "is-owned" : "is-missing"}`;
  tp("tp-dialog-name").textContent = card.name;
  tp("tp-dialog-person").textContent = String(card.personName || card.trainer || "그 외의 사람들").toUpperCase();
  tp("tp-dialog-person-detail").textContent = card.personName || card.trainer || "그 외의 사람들";
  tp("tp-dialog-pokemon").textContent = card.pokemonName || tpSelected.name;
  tp("tp-dialog-set").textContent = [card.set, card.setName].filter(Boolean).join(" · ") || "—";
  tp("tp-dialog-rarity").textContent = card.rarity || "—";
  tp("tp-dialog-card-number").textContent = card.cardNumber || "—";
  tp("tp-dialog-illustrator").textContent = card.illustrator || "—";
}

function openDialog(card) {
  tpActiveCard = card;
  updateDialog(card);
  const dialog = tp("tp-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog() {
  const dialog = tp("tp-dialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function updateComplete(button, card) {
  const owned = Boolean(card.owned);
  button.classList.toggle("is-complete", owned);
  button.classList.remove("is-saving");
  button.disabled = false;
  button.setAttribute("aria-pressed", String(owned));
  button.setAttribute("aria-label", owned ? `${card.name} 수집완료 취소` : `${card.name} 수집완료로 표시`);
  button.textContent = owned ? "✓ 수집완료" : "수집완료";
}

async function toggle(card, button) {
  const account = window.PokemonDexPageAccount;
  if (!account?.canEdit?.()) {
    alert("Google 로그인 후 내 수집 상태를 저장할 수 있습니다.");
    return;
  }
  button.disabled = true;
  button.classList.add("is-saving");
  button.textContent = "저장 중…";
  try {
    const saved = await account.saveOwned(card.accountKey, !card.owned);
    card.owned = saved.owned;
    setSummary();
    if (tpActiveCard === card) updateDialog(card);
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
  button.className = "collection-complete-button";
  updateComplete(button, card);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void toggle(card, button);
  });
  return button;
}

function createCard(card) {
  const article = document.createElement("article");
  article.className = `pokemon-card tp-card has-completion-action${card.owned ? "" : " is-missing"}`;
  const button = document.createElement("button");
  button.className = "pokemon-card-button tp-card-button";
  button.type = "button";
  button.setAttribute("aria-label", `${card.name} 상세 보기`);

  const imageWrap = document.createElement("span");
  imageWrap.className = "card-image-wrap";
  const image = document.createElement("img");
  image.className = "card-image";
  image.src = card.image;
  image.alt = `${card.name} 포켓몬 카드`;
  image.loading = "lazy";
  image.addEventListener("error", () => article.classList.add("has-image-error"));
  const missing = document.createElement("span");
  missing.className = "missing-overlay";
  missing.textContent = "미보유";
  const fallback = document.createElement("span");
  fallback.className = "image-fallback";
  fallback.setAttribute("aria-hidden", "true");
  fallback.innerHTML = '<span class="fallback-ball"><span></span></span>이미지를 불러오지 못했습니다';
  imageWrap.append(image, missing, fallback);

  const body = document.createElement("span");
  body.className = "card-body";
  const top = document.createElement("span");
  top.className = "card-topline";
  const number = document.createElement("span");
  number.className = "number-badge";
  number.textContent = card.set || `#${card.order}`;
  top.append(number, statusBadge(card));
  const name = document.createElement("strong");
  name.className = "card-name-ko";
  name.textContent = card.name;
  const person = document.createElement("span");
  person.className = "card-name-en";
  person.textContent = `${card.personName || card.trainer || "그 외의 사람들"} × ${card.pokemonName || tpSelected.name}`;
  const meta = document.createElement("span");
  meta.className = "card-meta";
  const set = document.createElement("span");
  set.className = "card-set";
  set.textContent = [card.setName, card.rarity].filter(Boolean).join(" · ");
  const cardNumber = document.createElement("span");
  cardNumber.className = "card-number";
  cardNumber.textContent = card.cardNumber || "";
  meta.append(set, cardNumber);
  body.append(top, name, person, meta);
  button.append(imageWrap, body);
  button.addEventListener("click", () => openDialog(card));
  article.append(button, completeButton(card));
  return article;
}

function render() {
  const cards = tpSelected.cards || [];
  const owned = cards.filter((card) => card.owned).length;
  const completion = tpRate(owned, cards.length);
  tp("tp-selected-group").textContent = `#${String(tpSelected.nationalDexNo).padStart(3, "0")} ${tpSelected.name}`;
  tp("tp-selected-owned").textContent = owned;
  tp("tp-selected-total").textContent = cards.length;
  tp("tp-selected-rate").textContent = completion;
  const shown = sortCards(cards.filter(matches));
  const grid = tp("tp-card-grid");
  grid.replaceChildren(...shown.map(createCard));
  grid.setAttribute("aria-busy", "false");
  tp("tp-result-count").textContent = shown.length;
  tp("tp-empty").hidden = shown.length !== 0;
}

function controls() {
  tp("tp-search").addEventListener("input", (event) => {
    tpQuery = event.target.value;
    render();
  });
  tp("tp-status-filters").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    tpStatus = button.dataset.status;
    event.currentTarget.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
    render();
  });
  tp("tp-sort").addEventListener("change", (event) => {
    tpSort = event.target.value;
    render();
  });
  tp("tp-dialog-close").addEventListener("click", closeDialog);
  tp("tp-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeDialog();
  });
}

async function init() {
  try {
    const response = await fetch(TP_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    tpDataset = await response.json();
    const account = window.PokemonDexPageAccount;
    if (account) {
      await account.ready;
      account.applyGroups(tpDataset.groups);
    }
    setSummary();
    populateGroups();
    controls();
    render();
  } catch (error) {
    console.error(error);
    tp("tp-card-grid").setAttribute("aria-busy", "false");
    tp("tp-error").hidden = false;
  }
}

init();
