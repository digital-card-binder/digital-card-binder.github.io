"use strict";

(function () {
  const ERA_ORDER = Object.freeze(["ORIGIN", "ADV", "DP", "BW", "XY", "SM", "S", "SV", "M"]);
  const ERA_LABELS = Object.freeze({
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

  const state = {
    groups: [],
    cards: [],
    pokedex: [],
    query: "",
    target: null,
    era: "ALL",
    setCode: "ALL",
    status: "all",
    suggestions: [],
    suggestionIndex: -1,
    activeCard: null,
  };

  const el = (id) => document.getElementById(id);
  const formatNumber = (value) => new Intl.NumberFormat("ko-KR").format(Number(value) || 0);

  function compact(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("ko-KR")
      .replace(/[\s·._()\-]+/g, "");
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function seriesEra(group) {
    if (group?.era) return String(group.era).toUpperCase();
    const code = clean(group?.code || group?.name).toLowerCase();
    if (code.startsWith("origin") || code.startsWith("base")) return "ORIGIN";
    if (code.startsWith("adv")) return "ADV";
    if (code.startsWith("dp")) return "DP";
    if (code.startsWith("bw")) return "BW";
    if (code.startsWith("xy")) return "XY";
    if (code.startsWith("sm")) return "SM";
    if (code.startsWith("sv")) return "SV";
    if (/^m\d/.test(code) && !code.startsWith("sm")) return "M";
    if (code.startsWith("s")) return "S";
    return "";
  }

  function groupName(group) {
    return clean(group?.displayName || group?.title || group?.name || group?.code);
  }

  function cardNumber(card) {
    const match = clean(card?.code || card?.meta).match(/_([0-9]+)/);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
  }

  function legacyEra(groupIndex) {
    if (groupIndex === 0) return "ORIGIN";
    if (groupIndex <= 5) return "ADV";
    if (groupIndex <= 21) return "DP";
    if (groupIndex <= 58) return "BW";
    return "XY";
  }

  function tagSeriesGroups(baseGroups, legacyGroups) {
    const taggedBase = (Array.isArray(baseGroups) ? baseGroups : []).map((group) => ({
      ...group,
      era: seriesEra(group),
    }));
    const taggedLegacy = (Array.isArray(legacyGroups) ? legacyGroups : []).map((group, groupIndex) => ({
      ...group,
      era: legacyEra(groupIndex),
    }));
    return { taggedBase, taggedLegacy };
  }

  function mergeSeriesGroups(baseGroups, legacyGroups) {
    const { taggedBase, taggedLegacy } = tagSeriesGroups(baseGroups, legacyGroups);
    const merged = [...taggedBase];
    for (const extra of taggedLegacy) {
      const code = clean(extra?.code || extra?.name).toLowerCase();
      if (!code) continue;
      const index = merged.findIndex(
        (group) => clean(group?.code || group?.name).toLowerCase() === code,
      );
      if (index >= 0) merged[index] = extra;
      else merged.push(extra);
    }
    return merged;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  }

  function flattenGroups(groups) {
    const output = [];
    groups.forEach((group, groupIndex) => {
      const era = seriesEra(group);
      const setCode = clean(group.code || group.name);
      const setName = groupName(group);
      (group.cards || []).forEach((card, cardIndex) => {
        output.push({
          card,
          group,
          groupIndex,
          cardIndex,
          era,
          setCode,
          setName,
        });
      });
    });
    return output;
  }

  function exactPokemon(query) {
    const needle = compact(query);
    if (!needle) return null;
    return state.pokedex.find((record) =>
      [record.nameKo, record.nameEn].some((name) => compact(name) === needle),
    ) || null;
  }

  function occurrences(haystack, needle) {
    const indexes = [];
    let start = 0;
    while (needle && start <= haystack.length - needle.length) {
      const index = haystack.indexOf(needle, start);
      if (index < 0) break;
      indexes.push(index);
      start = index + 1;
    }
    return indexes;
  }

  function occurrenceCoveredByLongerPokemon(haystack, start, target) {
    const end = start + target.length;
    for (const record of state.pokedex) {
      const candidate = compact(record.nameKo);
      if (!candidate || candidate.length <= target.length || !candidate.includes(target)) {
        continue;
      }
      for (const candidateStart of occurrences(haystack, candidate)) {
        const candidateEnd = candidateStart + candidate.length;
        if (candidateStart <= start && candidateEnd >= end) return true;
      }
    }
    return false;
  }

  function matchesExactPokemon(item, targetRecord) {
    const target = compact(targetRecord?.nameKo);
    if (!target) return false;

    const explicitPokemon = compact(item.card?.pokemonName);
    if (explicitPokemon && explicitPokemon === target) return true;

    const haystack = compact(item.card?.name);
    if (!haystack.includes(target)) return false;

    for (const start of occurrences(haystack, target)) {
      if (!occurrenceCoveredByLongerPokemon(haystack, start, target)) {
        return true;
      }
    }
    return false;
  }

  function matchesFreeQuery(item, query) {
    const needle = compact(query);
    if (needle.length < 2) return false;
    const haystacks = [
      item.card?.name,
      item.card?.pokemonName,
    ].map(compact);
    return haystacks.some((value) => value.includes(needle));
  }

  function targetCards() {
    const query = clean(state.query);
    if (!query) return [];
    return state.target
      ? state.cards.filter((item) => matchesExactPokemon(item, state.target))
      : state.cards.filter((item) => matchesFreeQuery(item, query));
  }

  function filteredCards() {
    return targetCards()
      .filter((item) => state.era === "ALL" || item.era === state.era)
      .filter((item) => state.setCode === "ALL" || item.setCode === state.setCode)
      .filter((item) => {
        if (state.status === "owned") return Boolean(item.card.owned);
        if (state.status === "missing") return !item.card.owned;
        return true;
      })
      .sort((left, right) => {
        const eraDiff = ERA_ORDER.indexOf(left.era) - ERA_ORDER.indexOf(right.era);
        if (eraDiff) return eraDiff;
        if (left.groupIndex !== right.groupIndex) return left.groupIndex - right.groupIndex;
        return cardNumber(left.card) - cardNumber(right.card);
      });
  }

  function updateSummary() {
    const all = targetCards();
    const owned = all.filter((item) => item.card.owned).length;
    const total = all.length;
    const missing = total - owned;
    const rate = total ? Math.round((owned / total) * 1000) / 10 : 0;
    const label = state.target?.nameKo || clean(state.query) || "포켓몬을 검색해 주세요";

    el("search-summary-label").textContent = total ? label : "포켓몬을 검색해 주세요";
    el("search-owned").textContent = total ? formatNumber(owned) : "—";
    el("search-total").textContent = total ? formatNumber(total) : "—";
    el("search-missing").textContent = total ? formatNumber(missing) : "—";
    el("search-rate").textContent = total ? `${rate.toFixed(1)}%` : "—";
    el("search-progress-ring").style.setProperty("--progress", total ? rate : 0);
  }

  function populateSetFilter() {
    const select = el("pokemon-search-set");
    const previous = state.setCode;
    const items = targetCards().filter(
      (item) => state.era === "ALL" || item.era === state.era,
    );
    const sets = [];
    const seen = new Set();

    items.forEach((item) => {
      if (!item.setCode || seen.has(item.setCode)) return;
      seen.add(item.setCode);
      sets.push({
        code: item.setCode,
        name: item.setName,
        groupIndex: item.groupIndex,
      });
    });
    sets.sort((a, b) => a.groupIndex - b.groupIndex);

    select.replaceChildren();
    const all = document.createElement("option");
    all.value = "ALL";
    all.textContent = "전체 세트";
    select.append(all);

    for (const set of sets) {
      const option = document.createElement("option");
      option.value = set.code;
      option.textContent = `${set.code} · ${set.name}`;
      select.append(option);
    }

    const stillAvailable = previous === "ALL" || sets.some((set) => set.code === previous);
    state.setCode = stillAvailable ? previous : "ALL";
    select.value = state.setCode;
    select.disabled = sets.length === 0;
  }

  function statusBadge(owned) {
    const badge = document.createElement("span");
    badge.className = `status-badge ${owned ? "is-owned" : "is-missing"}`;
    badge.textContent = owned ? "✓ 보유" : "○ 미보유";
    return badge;
  }

  function makeCard(item) {
    const card = item.card;
    const article = document.createElement("article");
    article.className = `pokemon-card catalog-card pokemon-search-card${card.owned ? "" : " is-missing"}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "pokemon-card-button";

    const imageWrap = document.createElement("span");
    imageWrap.className = "card-image-wrap";
    const image = document.createElement("img");
    image.className = "card-image";
    image.loading = "lazy";
    image.src = clean(card.image || card.originalImage);
    image.alt = `${clean(card.name || card.pokemonName || "포켓몬")} 카드`;
    image.addEventListener("error", () => article.classList.add("has-image-error"), { once: true });

    const missing = document.createElement("span");
    missing.className = "missing-overlay";
    missing.textContent = "미보유";

    const fallback = document.createElement("span");
    fallback.className = "image-fallback";
    fallback.innerHTML = '<span class="fallback-ball"><span></span></span>이미지를 불러오지 못했습니다';
    imageWrap.append(image, missing, fallback);

    const body = document.createElement("span");
    body.className = "card-body";

    const top = document.createElement("span");
    top.className = "card-topline";
    const number = document.createElement("span");
    number.className = "number-badge";
    number.textContent = clean(card.code || card.meta);
    top.append(number, statusBadge(Boolean(card.owned)));

    const name = document.createElement("strong");
    name.className = "card-name-ko";
    name.textContent = clean(card.name || card.pokemonName || card.code);

    const set = document.createElement("span");
    set.className = "card-name-en";
    set.textContent = item.setName;

    const meta = document.createElement("span");
    meta.className = "card-meta";
    meta.textContent = `${ERA_LABELS[item.era] || item.era} · ${item.setCode}`;

    body.append(top, name, set, meta);
    button.append(imageWrap, body);
    button.addEventListener("click", () => openDialog(item));
    article.append(button);
    return article;
  }

  function activeFilterLabel() {
    const labels = [];
    if (state.era !== "ALL") labels.push(ERA_LABELS[state.era] || state.era);
    if (state.setCode !== "ALL") labels.push(state.setCode);
    if (state.status === "owned") labels.push("보유");
    if (state.status === "missing") labels.push("미보유");
    return labels.length ? `· ${labels.join(" · ")}` : "";
  }

  function renderEmpty(shown) {
    const empty = el("pokemon-search-empty");
    const title = empty.querySelector("h3");
    const copy = empty.querySelector("p");
    const hasQuery = Boolean(clean(state.query));

    if (shown.length) {
      empty.hidden = true;
      return;
    }

    empty.hidden = false;
    if (!hasQuery) {
      title.textContent = "포켓몬 이름을 검색해 주세요";
      copy.textContent = "예: 피카츄, 리자몽, 루카리오";
    } else if (!state.target && compact(state.query).length < 2) {
      title.textContent = "두 글자 이상 입력해 주세요";
      copy.textContent = "포켓몬 이름을 조금 더 입력하면 검색할 수 있습니다.";
    } else {
      title.textContent = "검색 결과가 없습니다";
      copy.textContent = "검색어 또는 필터를 바꿔보세요.";
    }
  }

  function render() {
    const shown = filteredCards();
    const grid = el("pokemon-search-grid");
    grid.replaceChildren(...shown.map(makeCard));
    grid.setAttribute("aria-busy", "false");
    el("pokemon-search-result-count").textContent = formatNumber(shown.length);
    el("pokemon-search-active-filter").textContent = activeFilterLabel();
    el("pokemon-search-reset").hidden =
      !clean(state.query) && state.era === "ALL" && state.setCode === "ALL" && state.status === "all";
    renderEmpty(shown);
    updateSummary();
  }

  function suggestionCandidates(query) {
    const needle = compact(query);
    if (!needle) return [];
    const candidates = state.pokedex
      .filter((record) => {
        const ko = compact(record.nameKo);
        const en = compact(record.nameEn);
        return ko.includes(needle) || en.includes(needle);
      })
      .sort((a, b) => {
        const aKo = compact(a.nameKo);
        const bKo = compact(b.nameKo);
        const aStarts = aKo.startsWith(needle) ? 0 : 1;
        const bStarts = bKo.startsWith(needle) ? 0 : 1;
        return aStarts - bStarts || a.number - b.number;
      });
    return candidates.slice(0, 8);
  }

  function closeSuggestions() {
    state.suggestions = [];
    state.suggestionIndex = -1;
    const box = el("pokemon-search-suggestions");
    box.hidden = true;
    box.replaceChildren();
    el("pokemon-search-input").setAttribute("aria-expanded", "false");
  }

  function chooseSuggestion(record) {
    const input = el("pokemon-search-input");
    input.value = record.nameKo;
    state.query = record.nameKo;
    state.target = record;
    state.era = "ALL";
    state.setCode = "ALL";
    el("pokemon-search-era").value = "ALL";
    closeSuggestions();
    populateSetFilter();
    render();
  }

  function renderSuggestions() {
    const box = el("pokemon-search-suggestions");
    box.replaceChildren();
    state.suggestions = suggestionCandidates(state.query);
    state.suggestionIndex = -1;

    if (!state.suggestions.length) {
      closeSuggestions();
      return;
    }

    state.suggestions.forEach((record, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pokemon-search-suggestion";
      button.setAttribute("role", "option");
      button.dataset.index = String(index);
      const number = String(record.number).padStart(4, "0");
      button.innerHTML = `<strong>${record.nameKo}</strong><span>#${number} · ${record.nameEn || ""}</span>`;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        chooseSuggestion(record);
      });
      box.append(button);
    });

    box.hidden = false;
    el("pokemon-search-input").setAttribute("aria-expanded", "true");
  }

  function syncSuggestionHighlight() {
    const buttons = el("pokemon-search-suggestions").querySelectorAll(".pokemon-search-suggestion");
    buttons.forEach((button, index) => {
      const active = index === state.suggestionIndex;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      if (active) button.scrollIntoView({ block: "nearest" });
    });
  }

  function onSearchInput(event) {
    state.query = event.currentTarget.value;
    state.target = exactPokemon(state.query);
    state.era = "ALL";
    state.setCode = "ALL";
    el("pokemon-search-era").value = "ALL";
    renderSuggestions();
    populateSetFilter();
    render();
  }

  function onSearchKeydown(event) {
    if (event.key === "ArrowDown" && state.suggestions.length) {
      event.preventDefault();
      state.suggestionIndex = Math.min(state.suggestions.length - 1, state.suggestionIndex + 1);
      syncSuggestionHighlight();
      return;
    }
    if (event.key === "ArrowUp" && state.suggestions.length) {
      event.preventDefault();
      state.suggestionIndex = Math.max(0, state.suggestionIndex - 1);
      syncSuggestionHighlight();
      return;
    }
    if (event.key === "Enter" && state.suggestionIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(state.suggestions[state.suggestionIndex]);
      return;
    }
    if (event.key === "Escape") {
      closeSuggestions();
    }
  }

  function resetSearch() {
    state.query = "";
    state.target = null;
    state.era = "ALL";
    state.setCode = "ALL";
    state.status = "all";
    const input = el("pokemon-search-input");
    input.value = "";
    el("pokemon-search-era").value = "ALL";
    el("pokemon-search-set").value = "ALL";
    el("pokemon-search-status").querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.status === "all");
    });
    closeSuggestions();
    populateSetFilter();
    render();
    input.focus();
  }

  function updateDialog(item) {
    const card = item.card;
    const owned = Boolean(card.owned);
    el("pokemon-search-dialog-image").src = clean(card.image || card.originalImage);
    el("pokemon-search-dialog-image").alt = `${clean(card.name || card.pokemonName || "포켓몬")} 카드 크게 보기`;
    el("pokemon-search-dialog-image-wrap").classList.toggle("is-missing", !owned);
    el("pokemon-search-dialog-code").textContent = clean(card.code || card.meta);
    const badge = el("pokemon-search-dialog-status");
    badge.classList.toggle("is-owned", owned);
    badge.classList.toggle("is-missing", !owned);
    badge.textContent = owned ? "✓ 보유" : "○ 미보유";
    el("pokemon-search-dialog-name").textContent = clean(card.name || card.pokemonName || card.code);
    el("pokemon-search-dialog-meta").textContent = item.setCode;
    el("pokemon-search-dialog-era").textContent = ERA_LABELS[item.era] || item.era;
    el("pokemon-search-dialog-set").textContent = item.setName;

    const account = window.PokemonDexPageAccount;
    const toggle = el("pokemon-search-toggle-owned");
    const canEdit = Boolean(account?.canEdit?.());
    toggle.disabled = !canEdit;
    toggle.textContent = canEdit
      ? owned ? "미보유로 변경" : "보유로 변경"
      : "로그인 후 변경";
    el("pokemon-search-dialog-message").textContent = canEdit
      ? "보유 상태는 시리즈 도감과 동일하게 저장됩니다."
      : "Google 로그인 후 보유 상태를 변경할 수 있습니다.";
    el("pokemon-search-dialog-message").dataset.state = canEdit ? "" : "guest";
  }

  function openDialog(item) {
    state.activeCard = item;
    updateDialog(item);
    const dialog = el("pokemon-search-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  async function toggleOwned() {
    const item = state.activeCard;
    const account = window.PokemonDexPageAccount;
    if (!item || !account?.canEdit?.() || !item.card.accountKey) return;

    const button = el("pokemon-search-toggle-owned");
    const message = el("pokemon-search-dialog-message");
    const nextOwned = !Boolean(item.card.owned);
    button.disabled = true;
    button.textContent = "저장 중…";
    message.textContent = "보유 상태를 저장하고 있습니다.";
    message.dataset.state = "loading";

    try {
      await account.saveOwned(item.card.accountKey, nextOwned);
      item.card.owned = nextOwned;
      updateDialog(item);
      populateSetFilter();
      render();
      message.textContent = nextOwned
        ? "보유 카드로 저장했습니다."
        : "미보유 카드로 저장했습니다.";
      message.dataset.state = "success";
    } catch (error) {
      console.error(error);
      message.textContent = error?.message || "보유 상태를 저장하지 못했습니다.";
      message.dataset.state = "error";
      updateDialog(item);
    }
  }

  function bindEvents() {
    const input = el("pokemon-search-input");
    input.addEventListener("input", onSearchInput);
    input.addEventListener("keydown", onSearchKeydown);
    input.addEventListener("focus", () => {
      if (clean(state.query)) renderSuggestions();
    });
    input.addEventListener("blur", () => {
      window.setTimeout(closeSuggestions, 120);
    });

    el("pokemon-search-era").addEventListener("change", (event) => {
      state.era = event.currentTarget.value;
      state.setCode = "ALL";
      populateSetFilter();
      render();
    });

    el("pokemon-search-set").addEventListener("change", (event) => {
      state.setCode = event.currentTarget.value;
      render();
    });

    el("pokemon-search-status").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-status]");
      if (!button) return;
      state.status = button.dataset.status;
      event.currentTarget.querySelectorAll("button").forEach((candidate) => {
        candidate.classList.toggle("is-active", candidate === button);
      });
      render();
    });

    el("pokemon-search-reset").addEventListener("click", resetSearch);
    el("pokemon-search-dialog-close").addEventListener("click", () => {
      const dialog = el("pokemon-search-dialog");
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    });
    el("pokemon-search-dialog").addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      if (typeof event.currentTarget.close === "function") event.currentTarget.close();
      else event.currentTarget.removeAttribute("open");
    });
    el("pokemon-search-toggle-owned").addEventListener("click", toggleOwned);

    document.addEventListener("keydown", (event) => {
      const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!shortcut) return;
      event.preventDefault();
      input.focus();
      input.select();
    });
  }

  async function init() {
    try {
      const [baseGroups, legacyGroups, pokedex] = await Promise.all([
        fetchJson("./data/series.json"),
        fetchJson("./data/series-legacy.json").catch(() => []),
        fetchJson("./data/pokedex.json"),
      ]);

      state.groups = mergeSeriesGroups(baseGroups, legacyGroups);
      state.pokedex = Array.isArray(pokedex?.records) ? pokedex.records : [];

      const account = window.PokemonDexPageAccount;
      if (account) {
        await account.ready;
        account.applyGroups(state.groups);
      }

      state.cards = flattenGroups(state.groups);
      bindEvents();
      populateSetFilter();
      render();

      const requested = new URLSearchParams(window.location.search).get("q");
      if (requested) {
        el("pokemon-search-input").value = requested;
        state.query = requested;
        state.target = exactPokemon(requested);
        populateSetFilter();
        render();
      }
    } catch (error) {
      console.error(error);
      el("pokemon-search-grid").setAttribute("aria-busy", "false");
      el("pokemon-search-error").hidden = false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    void init();
  }
})();
