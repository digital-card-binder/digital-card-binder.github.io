"use strict";

(function () {
  const EEVEE_MODE = new URL(window.location.href).searchParams.get("eevee") === "1";
  const DATA_URL = EEVEE_MODE ? "./data/eevee-dex.json?v=20261014" : "./data/art-themes.json?v=20261005-regular-rarity";
  const THEME_DESCRIPTIONS = Object.freeze({
    sleeping: "잠들거나 느긋하게 쉬는 포켓몬이 등장하는 카드를 모은 테마 도감입니다.",
    connected: "여러 장을 나란히 놓았을 때 하나의 풍경이나 이야기가 이어지는 카드를 모았습니다.",
    evolution: "진화 전후의 모습이 성장과 시간의 흐름으로 이어지는 카드를 모았습니다.",
    night: "달, 별, 야경처럼 밤의 분위기가 돋보이는 카드를 모은 테마 도감입니다.",
    season: "꽃, 바다, 설원, 비와 숲 등 계절과 자연 풍경이 돋보이는 카드를 모았습니다.",
    color: "색감이 돋보이는 카드들을 모은 테마 도감입니다. 카드마다 다른 색과 분위기를 감상해보세요.",
    sunset: "노을과 골든아워의 따뜻한 빛이 인상적인 카드들을 모았습니다.",
    reflections: "물, 유리, 거울 등에 포켓몬이나 풍경이 비치는 카드를 모았습니다.",
    food: "음식과 간식, 식사 장면이 중심이 되는 포켓몬 카드를 모았습니다.",
    work: "포켓몬이 일하거나 사람의 생활을 돕는 장면의 카드를 모았습니다.",
    street: "거리, 골목, 상점과 빌딩 등 도시 일상이 담긴 카드를 모았습니다.",
    cameo: "주인공 외 다른 포켓몬이 배경이나 구석에 숨어 등장하는 카드를 모았습니다.",
  });
  const el = (id) => document.getElementById(id);
  const account = () => window.PokemonDexPageAccount;
  let dataset = null;
  let selectedTheme = "";
  let statusFilter = "all";
  let searchQuery = "";
  let activeCard = null;
  let storyReview = null;
  const storyModes = new Set(["connected", "evolution"]);
  const isStoryGroup = (group) => !EEVEE_MODE && storyModes.has(group?.code);
  function reviewedCards(group) {
    if (!isStoryGroup(group)) return group?.cards || [];
    const reviews = storyReview?.groups?.[group.code]?.cards || {};
    return (group?.cards || []).filter((card) => reviews[card.code]?.status === "accepted");
  }
  function applyStoryReview() {
    for (const group of dataset?.groups || []) {
      if (!isStoryGroup(group)) continue;
      const reviews = storyReview?.groups?.[group.code]?.cards || {};
      for (const card of group.cards || []) {
        const check = reviews[card.code];
        card.storyTitle = check?.title || card.category || "검수 보류";
        card.storyKind = check?.kind || "";
        card.storyReviewStatus = check?.status || "pending";
      }
    }
  }

  const rate = (owned, total) => total ? Math.round((owned / total) * 1000) / 10 : 0;
  const allCards = () => (dataset?.groups || []).flatMap((group) => reviewedCards(group));
  const visibleGroups = () => (dataset?.groups || []).filter((group) => !EEVEE_MODE || !group.hiddenInNavigation);
  const currentGroup = () => visibleGroups().find((group) => group.code === selectedTheme) || visibleGroups()[0] || null;
  const isVariantGroup = (group) => EEVEE_MODE && group?.code === "eevee-c";

  // Keep all three original account identities, even though the UI shows one combined dex.
  function variantsOf(card, group = currentGroup()) {
    if (!isVariantGroup(group)) return [card];
    return [
      card,
      ...["eevee-pokeball", "eevee-masterball"].map((code) => {
        const source = dataset?.groups?.find((entry) => entry.code === code);
        return source?.cards?.find((entry) => entry.name === card.name && entry.cardNumber === card.cardNumber);
      }),
    ].filter(Boolean);
  }

  const collectionCards = (group) => reviewedCards(group).flatMap((card) => variantsOf(card, group));
  const repairedImage = (source) => window.DigitalCardBinderImageCdn?.resolve?.(source) || window.DigitalCardBinderImageCdn?.repairSource?.(source) || source || "";

  function requestedTheme() {
    const value = new URL(window.location.href).searchParams.get("theme") || "";
    if (EEVEE_MODE && ["eevee-pokeball", "eevee-masterball"].includes(value)) return "eevee-c";
    return visibleGroups().some((group) => group.code === value) ? value : visibleGroups()[0]?.code || "";
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
    el("art-theme-group-count").textContent = visibleGroups().length;

    const group = currentGroup();
    const selectedCards = collectionCards(group);
    const selectedOwned = selectedCards.filter((card) => card.owned).length;
    const selectedRate = rate(selectedOwned, selectedCards.length);
    el("art-theme-current-count").textContent = selectedCards.length;
    el("art-theme-current-rate").textContent = selectedRate;
    el("art-theme-selected-owned").textContent = selectedOwned;
    el("art-theme-selected-total").textContent = selectedCards.length;
    el("art-theme-selected-rate").textContent = `${selectedRate}%`;
    el("art-theme-selected-name").textContent = group?.name || "—";
    const description = THEME_DESCRIPTIONS[group?.code] || group?.description || "";
    const tally = storyReview?.groups?.[group?.code]?.summary;
    el("art-theme-selected-description").textContent = tally
      ? description + " · 연결 근거를 확인한 " + tally.accepted + "장만 표시합니다. " + (tally.pending + tally.excluded) + "장은 검수 보류·분류 제외 상태로 기록되어 있습니다."
      : description;
    el("art-theme-selected-icon").textContent = group?.icon || "✦";
    el("art-theme-selected-badge").textContent = group?.badge || "THEME";
    el("art-theme-catalog-title").textContent = `${group?.name || "테마"} · ${selectedCards.length}장`;
  }

  function matches(card) {
    const versions = variantsOf(card);
    if (statusFilter === "owned" && !versions.some((version) => version.owned)) return false;
    if (statusFilter === "missing" && !versions.some((version) => !version.owned)) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      card.name, card.series, card.set, card.setName, card.cardNumber,
      card.rarity, card.category, card.storyTitle, card.evidence,
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
    const dialog = el("art-theme-dialog");
    el("art-theme-dialog-image").src = repairedImage(card.image);
    el("art-theme-dialog-image").alt = card.name || "카드 이미지";
    el("art-theme-dialog-image").classList.toggle("is-missing", !card.owned);
    el("art-theme-dialog-number").textContent = card.cardNumber || card.code || "";
    const versions = variantsOf(card);
    const variantOwned = versions.filter((version) => version.owned).length;
    el("art-theme-dialog-status").textContent = versions.length > 1 ? `${variantOwned}/3 보유` : card.owned ? "보유" : "미보유";
    el("art-theme-dialog-status").classList.toggle("is-owned", variantOwned > 0);
    el("art-theme-dialog-name").textContent = card.name || "";
    el("art-theme-dialog-theme").textContent = group?.name || "";
    el("art-theme-dialog-set").textContent = [card.set, card.setName].filter(Boolean).join(" · ");
    el("art-theme-dialog-card-number").textContent = card.cardNumber || "—";
    el("art-theme-dialog-rarity").textContent = card.rarity || "—";
    el("art-theme-dialog-category").textContent = card.category || "—";
    el("art-theme-dialog-evidence").textContent = card.evidence || "—";
    void window.DigitalCardBinder?.relatedDex?.render?.(dialog, card, {
      currentCollectionId: "artThemes",
      currentGroupKey: group?.code || "",
      setCode: card.set || "",
      cardNumber: card.cardNumber || card.code || "",
      name: card.name,
    });
    dialog.showModal();
  }

  function variantButtons(card) {
    const variants = variantsOf(card);
    const panel = document.createElement("div");
    panel.className = "eevee-variant-options";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", `${card.name} 일반, 몬스터볼, 마스터볼 보유 체크`);
    ["일반", "몬스터볼", "마스터볼"].forEach((label, index) => {
      const version = variants[index];
      if (!version) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "eevee-variant-button";
      button.classList.toggle("is-owned", Boolean(version.owned));
      button.setAttribute("aria-pressed", String(Boolean(version.owned)));
      button.setAttribute("aria-label", `${card.name} ${label} ${version.owned ? "보유 해제" : "보유 등록"}`);
      button.textContent = `${version.owned ? "✓ " : ""}${label}`;
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        const manager = account();
        if (!manager?.canEdit?.()) {
          alert("Google 로그인 후 내 도감을 수정할 수 있습니다.");
          return;
        }
        button.disabled = true;
        try {
          const next = !version.owned;
          await manager.saveOwned(version.accountKey, next);
          version.owned = next;
          render();
        } catch (error) {
          console.error("이브이 인쇄 사양 저장 실패", error);
          alert(error?.message || "보유 상태를 저장하지 못했습니다.");
          button.disabled = false;
        }
      });
      panel.append(button);
    });
    return panel;
  }

  function renderCards() {
    const group = currentGroup();
    const cards = reviewedCards(group).filter(matches);
    const grid = el("art-theme-card-grid");
    grid.replaceChildren();
    grid.classList.toggle("is-story-groups", isStoryGroup(group));
    const sections = new Map();
    grid.setAttribute("aria-busy", "false");
    el("art-theme-result-count").textContent = cards.length;
    el("art-theme-empty").hidden = cards.length > 0;

    cards.forEach((card) => {
      let destination = grid;
      if (isStoryGroup(group)) {
        const title = card.storyTitle || card.category || "연결 그룹";
        if (!sections.has(title)) {
          const section = document.createElement("section");
          section.className = "art-story-section";
          const head = document.createElement("div");
          head.className = "art-story-section-header";
          const heading = document.createElement("h3");
          heading.textContent = title;
          const detail = document.createElement("span");
          detail.textContent = card.storyKind || "연결 이야기";
          head.append(heading, detail);
          const note = storyReview?.storyNotes?.[title];
          section.append(head);
          if (note) {
            const p = document.createElement("p");
            p.className = "art-story-section-note";
            p.textContent = note;
            section.append(p);
          }
          const cardsRoot = document.createElement("div");
          cardsRoot.className = "art-theme-card-grid art-story-card-grid";
          section.append(cardsRoot);
          grid.append(section);
          sections.set(title, { root: cardsRoot, count: 0, heading: detail, kind: card.storyKind });
        }
        const sectionData = sections.get(title);
        sectionData.count += 1;
        sectionData.heading.textContent = sectionData.count + "장 · " + (sectionData.kind || "연결 이야기");
        destination = sectionData.root;
      }
      const article = document.createElement("article");
      article.className = "art-theme-card";
      const anyOwned = variantsOf(card, group).some((version) => version.owned);
      article.classList.toggle("is-owned", anyOwned);
      article.classList.toggle("is-missing", !anyOwned);
      article.classList.toggle("eevee-variant-card", isVariantGroup(group));
      const image = repairedImage(card.image);
      article.innerHTML = `
        <div class="art-theme-card-image"><img src="${image}" alt="" loading="lazy" decoding="async" /></div>
        <div class="art-theme-card-body">
          <div class="art-theme-card-badges"><span>${card.cardNumber || card.set || ""}</span><span class="is-rarity">${card.rarity || "CARD"}</span></div>
          <h3>${card.name || ""}</h3>
          <p class="art-theme-card-meta">${[card.set, card.setName].filter(Boolean).join(" · ")}</p>
          <p class="art-theme-card-scene">${card.storyTitle || card.category || ""}</p>
        </div>
      `;
      const open = document.createElement("button");
      open.type = "button";
      open.className = "art-theme-card-open";
      open.textContent = `${card.name} 상세 보기`;
      open.addEventListener("click", () => openDialog(card));
      if (isVariantGroup(group)) {
        article.append(open, variantButtons(card));
      } else {
        article.append(open, ownedButton(card));
      }
      destination.append(article);
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

  function rememberCurrentTheme() {
    const group = currentGroup();
    const recentDex = window.DigitalCardBinder?.recentDex;
    if (!group || typeof recentDex?.remember !== "function") return;
    const cards = collectionCards(group);
    const owned = cards.filter((card) => card.owned).length;
    recentDex.remember({
      collectionId: "artThemes",
      title: EEVEE_MODE ? "이브이 도감" : "테마 도감",
      detail: group.name || "테마",
      href: `./art-themes.html?${EEVEE_MODE ? "eevee=1&" : ""}theme=${encodeURIComponent(group.code || "")}`,
      owned,
      total: cards.length,
      unit: "장",
    });
  }

  function render() {
    renderSummary();
    renderStatusFilters();
    renderCards();
    rememberCurrentTheme();
  }

  async function initialize() {
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`${DATA_URL} ${response.status}`);
      dataset = await response.json();
      if (!EEVEE_MODE) {
        const auditResponse = await fetch("./data/art-theme-story-review.json?v=20261017c", { cache: "no-store" });
        if (auditResponse.ok) storyReview = await auditResponse.json();
      }
      if (!Array.isArray(dataset.groups) || !dataset.groups.length) throw new Error("테마 데이터가 비어 있습니다.");
      const manager = account();
      await manager?.ready;
      if (manager?.applyGroups) dataset.groups = manager.applyGroups(dataset.groups);
      selectedTheme = requestedTheme();
      if (storyModes.has(selectedTheme) && !storyReview?.groups?.[selectedTheme]?.cards) {
        throw new Error("스토리 도감 검수 데이터가 아직 배포되지 않았습니다.");
      }
      applyStoryReview();
      if (EEVEE_MODE) {
        document.title = "이브이 도감 | 디지털 카드 바인더";
        el("page-title").textContent = "이브이 도감";
        const hero = document.querySelector(".art-theme-hero .hero-description");
        if (hero) hero.textContent = "이브이와 8종 진화체 · 6개 하위도감, 73개 보유 항목을 체크합니다.";
        const kicker = document.querySelector(".art-theme-kicker");
        if (kicker) kicker.textContent = "EEVEE FAMILY COLLECTION";
        const panel = document.querySelector(".art-theme-catalog");
        if (panel && !document.querySelector(".eevee-back-link")) {
          const back = document.createElement("p");
          back.className = "eevee-back-link";
          back.style.cssText = "margin:0 0 16px;font-weight:700";
          const link = document.createElement("a");
          link.href = "./eevee.html";
          link.textContent = "← 6개 이브이 하위도감";
          back.append(link);
          panel.before(back);
        }
        const summary = document.querySelector(".hero-progress-copy > span");
        if (summary) summary.textContent = "이브이 카드 체크";
        const groupMetric = document.querySelector(".stats-grid .stat-card--owned span:not(.stat-icon)");
        if (groupMetric) groupMetric.textContent = "하위도감 수";
        if (selectedTheme === "eevee-c") {
          const mirrorNote = document.createElement("p");
          mirrorNote.className = "eevee-mirror-note";
          mirrorNote.style.cssText = "margin:10px 0;font-size:13px;line-height:1.5;color:var(--text-muted,#737b88)";
          mirrorNote.textContent = "각 카드 아래에서 일반·몬스터볼·마스터볼을 각각 선택하세요. 이미지는 일반 카드 1장만 표시하며, 실물 미러 무늬는 표시되지 않습니다.";
          document.querySelector(".art-theme-filter-panel")?.after(mirrorNote);
        }
      }
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
