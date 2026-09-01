"use strict";

(function () {
  const OWNED_STORAGE_KEY = "digitalCardBinderWorldExplorationOwnedV1";
  const CARD_OVERRIDE_STORAGE_KEY = "digitalCardBinderWorldExplorationCardOverridesV1";
  const state = {
    data: null,
    people: null,
    generation: 1,
    owned: new Set(),
    cardOverrides: {},
    activeSlotId: "",
    seriesCatalogPromise: null,
  };

  const el = (id) => document.getElementById(id);

  function loadOwned() {
    try {
      const saved = JSON.parse(localStorage.getItem(OWNED_STORAGE_KEY) || "[]");
      state.owned = new Set(Array.isArray(saved) ? saved : []);
    } catch {
      state.owned = new Set();
    }
  }

  function saveOwned() {
    try {
      localStorage.setItem(OWNED_STORAGE_KEY, JSON.stringify([...state.owned]));
    } catch {
      // 저장소 접근이 제한되어도 현재 세션의 체크 상태는 유지한다.
    }
  }

  function normalizeCardOverride(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const image = String(value.image || "").trim();
    if (!image) return null;
    return {
      image,
      cardName: String(value.cardName || "").trim(),
      setName: String(value.setName || "").trim(),
      setCode: String(value.setCode || "").trim(),
      number: String(value.number || "").trim(),
      rarity: String(value.rarity || "").trim(),
      source: String(value.source || "").trim(),
    };
  }

  function loadCardOverrides() {
    try {
      const saved = JSON.parse(localStorage.getItem(CARD_OVERRIDE_STORAGE_KEY) || "{}");
      const normalized = {};
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        for (const [slotId, value] of Object.entries(saved)) {
          const item = normalizeCardOverride(value);
          if (item) normalized[slotId] = item;
        }
      }
      state.cardOverrides = normalized;
    } catch {
      state.cardOverrides = {};
    }
  }

  function saveCardOverrides() {
    try {
      localStorage.setItem(CARD_OVERRIDE_STORAGE_KEY, JSON.stringify(state.cardOverrides));
    } catch {
      // 저장소 접근이 제한되어도 현재 세션에서는 변경 결과를 유지한다.
    }
  }

  function generationData() {
    return state.data?.generations?.find((item) => item.generation === state.generation) || null;
  }

  function resolvePerson(slot) {
    if (!slot.personId || !state.people?.people) return null;
    return state.people.people.find((person) => person.id === slot.personId) || null;
  }

  function inferSetCodeFromImage(imageUrl) {
    const match = String(imageUrl || "").match(/\/wmimages\/(?:SV|SM|S|MEGA|XY|BW)\/([^/]+)\//i);
    return match?.[1] || "";
  }

  function baseSlotCard(slot) {
    const person = resolvePerson(slot);
    const card = person?.cards?.[0] || person || slot.card || {};
    const image = card.imageLarge || card.image || person?.imageLarge || person?.image || "";
    return {
      image,
      cardName: card.name || slot.card?.name || slot.title,
      setName: card.set || slot.card?.set || "",
      setCode: inferSetCodeFromImage(image),
      number: card.number || slot.card?.number || "",
      rarity: card.rarity || slot.card?.rarity || "",
      source: card.source || slot.card?.source || "",
    };
  }

  function resolvedSlot(slot) {
    const base = baseSlotCard(slot);
    const override = normalizeCardOverride(state.cardOverrides[slot.id]);
    return {
      ...slot,
      ...base,
      ...(override || {}),
      customized: Boolean(override),
    };
  }

  function updateProgress() {
    const generation = generationData();
    const slots = generation?.slots || [];
    const owned = slots.filter((slot) => state.owned.has(slot.id)).length;
    const total = slots.length;
    const rate = total ? Math.round((owned / total) * 100) : 0;

    if (el("world-rate")) el("world-rate").textContent = `${rate}%`;
    if (el("world-owned")) el("world-owned").textContent = String(owned);
    if (el("world-total")) el("world-total").textContent = String(total);
    if (el("world-missing")) el("world-missing").textContent = String(Math.max(0, total - owned));
    if (el("world-progress-ring")) {
      el("world-progress-ring").style.setProperty("--progress", String(rate));
    }
  }

  function applyOwnedBadge(badge, owned) {
    badge.classList.toggle("is-owned", owned);
    badge.classList.toggle("is-missing", !owned);
    badge.textContent = owned ? "✓ 보유" : "○ 미보유";
  }

  function renderGenerationButtons() {
    const container = el("world-generation-grid");
    if (!container || !state.data) return;
    container.replaceChildren();

    state.data.generations.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-generation-button";
      button.classList.toggle("is-active", item.generation === state.generation);
      button.classList.toggle("is-planned", item.status !== "active");
      button.setAttribute("aria-pressed", String(item.generation === state.generation));

      const cardCount = item.slots?.length || 0;
      const pageCount = item.pages?.length || (cardCount ? Math.ceil(cardCount / 12) : 0);
      const title = document.createElement("strong");
      title.textContent = `${item.generation}세대`;
      const region = document.createElement("span");
      region.textContent = `${item.region} · ${item.regionEn}`;
      const meta = document.createElement("small");
      meta.textContent = item.status === "active" ? `${cardCount} CARD · ${pageCount} PAGE` : "준비 중";
      button.append(title, region, meta);

      button.addEventListener("click", () => {
        state.generation = item.generation;
        renderAll();
        document.querySelector(".world-binder-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      container.append(button);
    });
  }

  function makeImageFallback() {
    const fallback = document.createElement("span");
    fallback.className = "image-fallback";
    const ball = document.createElement("span");
    ball.className = "fallback-ball";
    const text = document.createTextNode("이미지를 불러오지 못했습니다");
    fallback.append(ball, text);
    return fallback;
  }

  function makeSlot(slot, index) {
    const item = resolvedSlot(slot);
    const owned = state.owned.has(slot.id);

    const article = document.createElement("article");
    article.className = "pokemon-card world-slot has-completion-action";
    article.classList.toggle("is-missing", !owned);
    article.classList.toggle("has-custom-card", item.customized);

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "pokemon-card-button world-card-open";
    openButton.setAttribute("aria-label", `${slot.title} 대표 카드 보기 및 변경`);

    const imageWrap = document.createElement("span");
    imageWrap.className = "card-image-wrap";
    const image = document.createElement("img");
    image.className = "card-image";
    image.src = item.image;
    image.alt = `${item.cardName} 한국어판 포켓몬 카드`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => article.classList.add("has-image-error"), { once: true });
    const missingOverlay = document.createElement("span");
    missingOverlay.className = "missing-overlay";
    missingOverlay.textContent = "미보유";
    imageWrap.append(image, missingOverlay, makeImageFallback());

    const body = document.createElement("span");
    body.className = "card-body world-card-body";

    const topline = document.createElement("span");
    topline.className = "card-topline";
    const numberBadge = document.createElement("span");
    numberBadge.className = "number-badge";
    numberBadge.textContent = String(index + 1).padStart(2, "0");
    const statusBadge = document.createElement("span");
    statusBadge.className = "status-badge";
    applyOwnedBadge(statusBadge, owned);
    topline.append(numberBadge, statusBadge);

    const storyTitle = document.createElement("strong");
    storyTitle.className = "card-name-ko";
    storyTitle.textContent = slot.title;
    const storySubtitle = document.createElement("span");
    storySubtitle.className = "card-name-en world-story-subtitle";
    storySubtitle.textContent = slot.subtitle || "";

    const selectedCard = document.createElement("span");
    selectedCard.className = "world-selected-card";
    selectedCard.textContent = item.cardName || slot.title;

    const meta = document.createElement("span");
    meta.className = "card-meta world-card-meta";
    const numberLabel = [item.number, item.rarity].filter(Boolean).join(" · ");
    meta.textContent = [item.setName, numberLabel].filter(Boolean).join(" · ");

    body.append(topline, storyTitle, storySubtitle, selectedCard, meta);
    if (item.customized) {
      const changed = document.createElement("span");
      changed.className = "collection-mini-badge world-custom-badge";
      changed.textContent = "대표 카드 변경됨";
      body.append(changed);
    }

    openButton.append(imageWrap, body);
    openButton.addEventListener("click", () => openCardDialog(slot));

    const ownedButton = document.createElement("button");
    ownedButton.type = "button";
    ownedButton.className = "collection-complete-button world-owned-button";
    const refreshOwnedButton = () => {
      const isOwned = state.owned.has(slot.id);
      ownedButton.classList.toggle("is-complete", isOwned);
      ownedButton.setAttribute("aria-pressed", String(isOwned));
      ownedButton.textContent = isOwned ? "✓ 수집완료" : "수집하기";
      article.classList.toggle("is-missing", !isOwned);
      applyOwnedBadge(statusBadge, isOwned);
    };
    refreshOwnedButton();
    ownedButton.addEventListener("click", () => {
      if (state.owned.has(slot.id)) state.owned.delete(slot.id);
      else state.owned.add(slot.id);
      saveOwned();
      refreshOwnedButton();
      updateProgress();
    });

    article.append(openButton, ownedButton);
    return article;
  }

  function renderPhase(generation, phaseId) {
    const phase = generation.phases?.find((item) => item.id === phaseId);
    if (!phase) return null;

    const section = document.createElement("section");
    section.className = "world-phase";

    const heading = document.createElement("div");
    heading.className = "world-phase-heading";
    const label = document.createElement("strong");
    label.textContent = phase.label;
    const description = document.createElement("span");
    description.textContent = phase.description;
    heading.append(label, description);

    const grid = document.createElement("div");
    grid.className = "world-slot-grid";
    const phaseSlots = generation.slots.filter((slot) => slot.phase === phase.id);
    phaseSlots.forEach((slot) => {
      const overallIndex = generation.slots.findIndex((item) => item.id === slot.id);
      grid.append(makeSlot(slot, overallIndex));
    });

    section.append(heading, grid);
    return section;
  }

  function renderBinderPage(generation, page, pageIndex) {
    const pageSection = document.createElement("section");
    pageSection.className = "world-binder-page";
    pageSection.dataset.page = String(pageIndex + 1);

    const pageHeading = document.createElement("div");
    pageHeading.className = "world-page-heading";
    const titleWrap = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = page.label || `PAGE ${pageIndex + 1}`;
    const title = document.createElement("strong");
    title.textContent = page.title || "";
    titleWrap.append(label, title);
    const description = document.createElement("p");
    description.textContent = page.description || "";
    pageHeading.append(titleWrap, description);
    pageSection.append(pageHeading);

    (page.phases || []).forEach((phaseId) => {
      const phase = renderPhase(generation, phaseId);
      if (phase) pageSection.append(phase);
    });

    return pageSection;
  }

  function renderActiveGeneration(generation) {
    const title = el("world-story-title");
    const tagline = el("world-story-tagline");
    const kicker = el("world-story-kicker");
    if (title) title.textContent = generation.title;
    if (tagline) tagline.textContent = generation.tagline;
    if (kicker) kicker.textContent = `${generation.generation}세대 · ${generation.region} · ${generation.regionEn}`;

    const chips = el("world-story-chips");
    if (chips) {
      chips.replaceChildren();
      [...(generation.people || []).slice(0, 5), ...(generation.places || []).slice(0, 4)].forEach((label) => {
        const chip = document.createElement("span");
        chip.className = "world-story-chip";
        chip.textContent = label;
        chips.append(chip);
      });
    }

    const binder = el("world-binder-content");
    if (!binder) return;
    binder.replaceChildren();

    if (generation.status !== "active" || !generation.slots?.length) {
      const planned = document.createElement("div");
      planned.className = "world-planned";
      const heading = document.createElement("strong");
      heading.textContent = `${generation.region}지방 4×3 스토리 페이지 준비 중`;
      const copy = document.createElement("p");
      copy.textContent = generation.tagline;
      planned.append(heading, copy);
      binder.append(planned);
      updateProgress();
      return;
    }

    const pages = generation.pages?.length
      ? generation.pages
      : [{ id: "page1", label: "PAGE 1", title: "스토리 페이지", description: generation.tagline, phases: generation.phases.map((phase) => phase.id) }];

    pages.forEach((page, index) => {
      binder.append(renderBinderPage(generation, page, index));
    });

    updateProgress();
  }

  function renderAll() {
    renderGenerationButtons();
    const generation = generationData();
    if (generation) renderActiveGeneration(generation);
  }

  function normalizeSetCode(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9-]/gi, "")
      .toUpperCase();
  }

  function normalizedCardNumber(value) {
    const numerator = String(value || "").split("/")[0].match(/\d{1,4}/)?.[0];
    return numerator ? numerator.padStart(3, "0") : "";
  }

  function normalizeCardName(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("ko-KR")
      .replace(/[\s·._()\-]+/g, "");
  }

  function namesAreCompatible(inputName, catalogName) {
    const input = normalizeCardName(inputName);
    const catalog = normalizeCardName(catalogName);
    return !input || !catalog || input === catalog || input.includes(catalog) || catalog.includes(input);
  }

  function catalogCardNumber(card) {
    const value = String(card?.cardNumber || card?.code || card?.meta || "");
    const separator = value.lastIndexOf("_");
    return separator >= 0 ? value.slice(separator + 1) : value;
  }

  async function loadSeriesCatalog() {
    if (!state.seriesCatalogPromise) {
      state.seriesCatalogPromise = fetch("./data/series.json", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`series.json ${response.status}`);
          return response.json();
        })
        .catch((error) => {
          console.warn("시리즈 카드 목록을 불러오지 못했습니다.", error);
          return [];
        });
    }
    return state.seriesCatalogPromise;
  }

  async function lookupSeriesCard(setCode, cardNumber, cardName) {
    const normalizedSet = normalizeSetCode(setCode);
    const normalizedNumber = normalizedCardNumber(cardNumber);
    if (!normalizedSet || !normalizedNumber) return null;

    const groups = await loadSeriesCatalog();
    const group = groups.find((candidate) => normalizeSetCode(candidate.code || candidate.name) === normalizedSet);
    if (!group) return null;

    const numberMatches = (group.cards || []).filter((card) => {
      const code = String(card.code || card.meta || "");
      const codeSet = code.includes("_") ? code.split("_")[0] : group.code;
      return normalizeSetCode(codeSet) === normalizedSet && normalizedCardNumber(catalogCardNumber(card)) === normalizedNumber;
    });
    if (!numberMatches.length) return null;

    const matched = numberMatches.find((card) => namesAreCompatible(cardName, card.name)) || numberMatches[0];
    if (matched.name && cardName && !namesAreCompatible(cardName, matched.name)) {
      throw new Error(`입력한 카드명(${cardName})과 검색된 카드명(${matched.name})이 다릅니다. 카드번호를 확인해주세요.`);
    }

    return {
      imageUrl: matched.originalImage || matched.image || "",
      cardName: matched.name || cardName,
      setName: group.name || setCode,
    };
  }

  function officialImageCandidates(setCode, cardNumber) {
    const code = normalizeSetCode(setCode);
    const number = normalizedCardNumber(cardNumber);
    if (!code || !number) return [];

    const typedCode = String(setCode || "").trim().replace(/\s+/g, "").replace(/[^a-z0-9-]/gi, "");
    const canonicalCode = typedCode
      .replace(/^sv/i, "SV")
      .replace(/^sm/i, "SM")
      .replace(/^xy/i, "XY")
      .replace(/^bw/i, "BW")
      .replace(/^m/i, "M")
      .replace(/^s/i, "S");
    const codeVariants = [canonicalCode, code].filter((value, index, values) => value && values.indexOf(value) === index);

    let primaryRoot = "";
    if (code.startsWith("SV")) primaryRoot = "SV";
    else if (code.startsWith("SM")) primaryRoot = "SM";
    else if (code.startsWith("XY")) primaryRoot = "XY";
    else if (code.startsWith("BW")) primaryRoot = "BW";
    else if (/^M\d/.test(code)) primaryRoot = "MEGA";
    else if (code.startsWith("S")) primaryRoot = "S";

    const roots = [primaryRoot, "SV", "S", "MEGA", "SM", "XY", "BW"].filter(
      (root, index, values) => root && values.indexOf(root) === index,
    );
    const base = "https://cards.image.pokemonkorea.co.kr/data/wmimages";
    return roots.flatMap((root) =>
      codeVariants.flatMap((candidateCode) => [
        `${base}/${root}/${candidateCode}/${candidateCode}_${number}.png`,
        `${base}/${root}/${candidateCode}/${candidateCode}_${number}.jpg`,
      ]),
    );
  }

  function imageLoads(url, timeout = 5000) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }
      let parsed;
      try {
        parsed = new URL(url, window.location.href);
      } catch {
        resolve(false);
        return;
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        resolve(false);
        return;
      }

      const probe = new Image();
      let settled = false;
      const finish = (success) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        probe.onload = null;
        probe.onerror = null;
        resolve(success);
      };
      const timer = window.setTimeout(() => finish(false), timeout);
      probe.onload = () => finish(probe.naturalWidth > 0);
      probe.onerror = () => finish(false);
      probe.src = parsed.href;
    });
  }

  async function findRepresentativeCard(setCode, cardNumber, cardName) {
    const catalogMatch = await lookupSeriesCard(setCode, cardNumber, cardName);
    if (catalogMatch?.imageUrl && (await imageLoads(catalogMatch.imageUrl))) return catalogMatch;

    const candidates = officialImageCandidates(setCode, cardNumber);
    const results = await Promise.all(
      candidates.map(async (imageUrl) => ({ imageUrl, loaded: await imageLoads(imageUrl) })),
    );
    const match = results.find((result) => result.loaded);
    return match ? { imageUrl: match.imageUrl, cardName, setName: setCode } : null;
  }

  function activeSlot() {
    const generation = generationData();
    return generation?.slots?.find((slot) => slot.id === state.activeSlotId) || null;
  }

  function setCardEditorMessage(message, status = "") {
    const messageElement = el("world-card-editor-message");
    if (!messageElement) return;
    messageElement.textContent = message;
    messageElement.dataset.state = status;
  }

  function populateCardDialog(slot) {
    const item = resolvedSlot(slot);
    const dialogImage = el("world-dialog-image");
    if (dialogImage) {
      dialogImage.src = item.image;
      dialogImage.alt = `${item.cardName} 한국어판 포켓몬 카드 크게 보기`;
    }
    if (el("world-dialog-slot")) el("world-dialog-slot").textContent = `SLOT ${String((generationData()?.slots || []).findIndex((candidate) => candidate.id === slot.id) + 1).padStart(2, "0")}`;
    if (el("world-dialog-title")) el("world-dialog-title").textContent = slot.title;
    if (el("world-dialog-subtitle")) el("world-dialog-subtitle").textContent = slot.subtitle || "";
    if (el("world-dialog-card-name")) el("world-dialog-card-name").textContent = item.cardName || "—";
    if (el("world-dialog-set")) el("world-dialog-set").textContent = item.setName || "—";
    if (el("world-dialog-number")) el("world-dialog-number").textContent = [item.number, item.rarity].filter(Boolean).join(" · ") || "—";

    const sourceLink = el("world-dialog-source");
    if (sourceLink) {
      sourceLink.hidden = !item.source;
      sourceLink.href = item.source || "https://pokemoncard.co.kr/cards";
    }

    if (el("world-edit-set-code")) el("world-edit-set-code").value = item.setCode || inferSetCodeFromImage(item.image);
    if (el("world-edit-card-number")) el("world-edit-card-number").value = item.number || "";
    if (el("world-edit-card-name")) el("world-edit-card-name").value = item.cardName || "";
    if (el("world-edit-rarity")) el("world-edit-rarity").value = item.rarity || "";
    if (el("world-edit-image-url")) el("world-edit-image-url").value = "";

    const resetButton = el("world-reset-card");
    if (resetButton) resetButton.disabled = !item.customized;
    setCardEditorMessage("세트 코드와 카드번호를 입력하면 전국도감과 같은 방식으로 실제 카드 이미지를 자동 검색합니다.");
  }

  function openCardDialog(slot) {
    state.activeSlotId = slot.id;
    populateCardDialog(slot);
    el("world-card-dialog")?.showModal();
  }

  async function applyCardOverride() {
    const slot = activeSlot();
    if (!slot) return;

    const saveButton = el("world-save-card");
    const setCode = el("world-edit-set-code")?.value.trim() || "";
    const cardNumber = el("world-edit-card-number")?.value.trim() || "";
    const cardName = el("world-edit-card-name")?.value.trim() || "";
    const rarity = el("world-edit-rarity")?.value.trim() || "";
    const manualImageUrl = el("world-edit-image-url")?.value.trim() || "";

    if (!setCode || !cardNumber) {
      setCardEditorMessage("세트 코드와 카드번호를 입력해 주세요.", "error");
      return;
    }

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "카드 찾는 중…";
    }
    setCardEditorMessage("실제 한국어판 카드 이미지를 확인하고 있습니다.", "loading");

    try {
      let match = await findRepresentativeCard(setCode, cardNumber, cardName);
      if (!match && manualImageUrl && (await imageLoads(manualImageUrl))) {
        match = { imageUrl: manualImageUrl, cardName, setName: setCode };
      }
      if (!match?.imageUrl) {
        throw new Error("해당 세트 코드와 카드번호로 이미지를 찾지 못했습니다. 번호를 확인하거나 이미지 URL을 직접 입력해 주세요.");
      }

      state.cardOverrides[slot.id] = {
        image: match.imageUrl,
        cardName: match.cardName || cardName || slot.title,
        setName: match.setName || setCode,
        setCode,
        number: cardNumber,
        rarity,
        source: "https://pokemoncard.co.kr/cards",
      };
      saveCardOverrides();
      renderAll();
      populateCardDialog(slot);
      setCardEditorMessage("대표 카드를 변경했습니다. 이 슬롯에는 선택한 카드가 표시됩니다.", "success");
    } catch (error) {
      setCardEditorMessage(error?.message || "카드를 변경하지 못했습니다.", "error");
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "이미지 찾아 적용";
      }
    }
  }

  function resetCardOverride() {
    const slot = activeSlot();
    if (!slot || !state.cardOverrides[slot.id]) return;
    delete state.cardOverrides[slot.id];
    saveCardOverrides();
    renderAll();
    populateCardDialog(slot);
    setCardEditorMessage("이 슬롯을 월드탐험도감의 기본 대표 카드로 되돌렸습니다.", "success");
  }

  function bindCardDialog() {
    const dialog = el("world-card-dialog");
    el("world-dialog-close")?.addEventListener("click", () => dialog?.close());
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    el("world-save-card")?.addEventListener("click", applyCardOverride);
    el("world-reset-card")?.addEventListener("click", resetCardOverride);
  }

  async function init() {
    loadOwned();
    loadCardOverrides();
    bindCardDialog();
    try {
      const [worldResponse, peopleResponse] = await Promise.all([
        fetch("./data/world-exploration.json", { cache: "no-store" }),
        fetch("./data/people.json", { cache: "no-store" }),
      ]);
      if (!worldResponse.ok) throw new Error("월드탐험도감 데이터를 불러오지 못했습니다.");
      state.data = await worldResponse.json();
      state.people = peopleResponse.ok ? await peopleResponse.json() : null;
      renderAll();
    } catch (error) {
      console.error(error);
      const binder = el("world-binder-content");
      if (binder) {
        const planned = document.createElement("div");
        planned.className = "world-planned";
        planned.innerHTML = "<strong>데이터를 불러오지 못했습니다.</strong><p>잠시 후 다시 시도해 주세요.</p>";
        binder.replaceChildren(planned);
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();
