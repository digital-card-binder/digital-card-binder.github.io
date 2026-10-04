"use strict";

(function () {
  const DATA_URL = "./data/art-themes.json?v=20261005-regular-rarity";
  const el = (id) => document.getElementById(id);
  const account = () => window.PokemonDexPageAccount;
  let dataset = null;
  let selectedTheme = "";
  let statusFilter = "all";
  let searchQuery = "";
  let activeCard = null;

  const rate = (owned, total) => total ? Math.round((owned / total) * 1000) / 10 : 0;
  const allCards = () => (dataset?.groups || []).flatMap((group) => group.cards || []);
  const currentGroup = () => (dataset?.groups || []).find((group) => group.code === selectedTheme) || dataset?.groups?.[0] || null;
  const repairedImage = (source) => window.DigitalCardBinderImageCdn?.resolve?.(source) || window.DigitalCardBinderImageCdn?.repairSource?.(source) || source || "";

  function requestedTheme() {
    const value = new URL(window.location.href).searchParams.get("theme") || "";
    return (dataset?.groups || []).some((group) => group.code === value) ? value : dataset?.groups?.[0]?.code || "";
  }


  function renderSummary() {
    const cards = allCards();
    const owned = cards.filter((card) => card.owned).length;
    const overallRate = rate(owned, cards.length);
    el("art-theme-owned").textContent = owned;
    el("art-theme-total").textContent = cards.length;
    el("art-theme-missing").textContent = cards.length - owned;
    el("art-theme-rate").textContent = `${overallRate}%`;
    el("art-theme-progress-ring").style.setProperty("--progress", overallRate);
    el("art-theme-group-count").textContent = dataset.groups.length;

    const group = currentGroup();
    const selectedCards = group?.cards || [];
    const selectedOwned = selectedCards.filter((card) => card.owned).length;
    const selectedRate = rate(selectedOwned, selectedCards.length);
    el("art-theme-current-count").textContent = selectedCards.length;
    el("art-theme-current-rate").textContent = selectedRate;
    el("art-theme-selected-owned").textContent = selectedOwned;
    el("art-theme-selected-total").textContent = selectedCards.length;
    el("art-theme-selected-rate").textContent = `${selectedRate}%`;
    el("art-theme-selected-name").textContent = group?.name || "—";
    el("art-theme-selected-description").textContent = group?.description || "";
    el("art-theme-selected-icon").textContent = group?.icon || "✦";
    el("art-theme-selected-badge").textContent = group?.badge || "THEME";
    el("art-theme-catalog-title").textContent = `${group?.name || "테마"} · ${selectedCards.length}장`;
  }

  function matches(card) {
    if (statusFilter === "owned" && !card.owned) return false;
    if (statusFilter === "missing" && card.owned) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      card.name, card.series, card.set, card.setName, card.cardNumber,
      card.rarity, card.category, card.evidence,
    ].filter(Boolean).join(" ").toLowerCase().includes(query);
  }

  function ownedButton(card) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "art-theme-owned-button";
    button.classList.toggle("is-owned", Boolean(card.owned));
    button.textContent = card.owned ? "보유 중" : "미보유";
    button.setAttribute("aria-label", `${card.name} ${card.owned ? "보유 해제" : "보유 등록"}`);
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const manager = account();
      if (!manager?.canEdit?.()) {
        alert("Google 로그인 후 내 도감을 수정할 수 있습니다.");
        return;
      }
      button.disabled = true;
      try {
        const next = !card.owned;
        await manager.saveOwned(card.accountKey, next);
        card.owned = next;
        render();
      } catch (error) {
        console.error("아트 테마 보유 상태 저장 실패", error);
        alert(error?.message || "보유 상태를 저장하지 못했습니다.");
        button.disabled = false;
      }
    });
    return button;
  }

  function openDialog(card) {
    activeCard = card;
    const group = currentGroup();
    el("art-theme-dialog-image").src = repairedImage(card.image);
    el("art-theme-dialog-image").alt = card.name || "카드 이미지";
    el("art-theme-dialog-number").textContent = card.cardNumber || card.code || "";
    el("art-theme-dialog-status").textContent = card.owned ? "보유" : "미보유";
    el("art-theme-dialog-status").classList.toggle("is-owned", Boolean(card.owned));
    el("art-theme-dialog-name").textContent = card.name || "";
    el("art-theme-dialog-theme").textContent = group?.name || "";
    el("art-theme-dialog-set").textContent = [card.set, card.setName].filter(Boolean).join(" · ");
    el("art-theme-dialog-card-number").textContent = card.cardNumber || "—";
    el("art-theme-dialog-rarity").textContent = card.rarity || "—";
    el("art-theme-dialog-category").textContent = card.category || "—";
    el("art-theme-dialog-evidence").textContent = card.evidence || "—";
    el("art-theme-dialog").showModal();
  }

  function renderCards() {
    const group = currentGroup();
    const cards = (group?.cards || []).filter(matches);
    const grid = el("art-theme-card-grid");
    grid.replaceChildren();
    grid.setAttribute("aria-busy", "false");
    el("art-theme-result-count").textContent = cards.length;
    el("art-theme-empty").hidden = cards.length > 0;

    cards.forEach((card) => {
      const article = document.createElement("article");
      article.className = "art-theme-card";
      const image = repairedImage(card.image);
      article.innerHTML = `
        <div class="art-theme-card-image"><img src="${image}" alt="" loading="lazy" decoding="async" /></div>
        <div class="art-theme-card-body">
          <div class="art-theme-card-badges"><span>${card.cardNumber || card.set || ""}</span><span class="is-rarity">${card.rarity || "CARD"}</span></div>
          <h3>${card.name || ""}</h3>
          <p class="art-theme-card-meta">${[card.set, card.setName].filter(Boolean).join(" · ")}</p>
          <p class="art-theme-card-scene">${card.category || ""}</p>
        </div>
      `;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "art-theme-card-open";
      open.textContent = `${card.name} 상세 보기`;
      open.addEventListener("click", () => openDialog(card));
      article.append(open, ownedButton(card));
      grid.append(article);
    });
  }

  function renderSources() {
    const root = el("art-theme-source-list");
    root.replaceChildren();
    (dataset.sources || []).forEach((source) => {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.innerHTML = `${source.name}<span>${source.note || ""}</span>`;
      root.append(link);
    });
  }

  function renderStatusFilters() {
    el("art-theme-status-filters").querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.status === statusFilter);
    });
  }

  function render() {
    renderSummary();
    renderStatusFilters();
    renderCards();
  }

  async function initialize() {
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`${DATA_URL} ${response.status}`);
      dataset = await response.json();
      if (!Array.isArray(dataset.groups) || !dataset.groups.length) throw new Error("테마 데이터가 비어 있습니다.");
      const manager = account();
      await manager?.ready;
      if (manager?.applyGroups) dataset.groups = manager.applyGroups(dataset.groups);
      selectedTheme = requestedTheme();
      renderSources();
      render();

      el("art-theme-search").addEventListener("input", (event) => {
        searchQuery = event.target.value || "";
        renderCards();
      });
      el("art-theme-status-filters").addEventListener("click", (event) => {
        const button = event.target.closest("button[data-status]");
        if (!button) return;
        statusFilter = button.dataset.status || "all";
        renderStatusFilters();
        renderCards();
      });
      el("art-theme-dialog-close").addEventListener("click", () => el("art-theme-dialog").close());
      el("art-theme-dialog").addEventListener("click", (event) => {
        if (event.target === el("art-theme-dialog")) el("art-theme-dialog").close();
      });
    } catch (error) {
      console.error("아트 테마 도감 초기화 실패", error);
      el("art-theme-error").hidden = false;
      el("art-theme-card-grid")?.setAttribute("aria-busy", "false");
    }
  }

  initialize();
})();
