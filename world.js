"use strict";

(function () {
  const OWNED_STORAGE_KEY = "digitalCardBinderWorldExplorationOwnedV1";
  const OWNED_MIGRATION_KEY = "digitalCardBinderWorldExplorationOwnedMigratedV1";
  const cardLookup = window.DigitalCardBinder?.cardLookup;
  if (!cardLookup) {
    throw new Error("공통 카드 탐색 코어를 불러오지 못했습니다.");
  }
  const CARD_OVERRIDE_STORAGE_KEY = "digitalCardBinderWorldExplorationCardOverridesV1";
  const state = {
    data: null,
    people: null,
    pokedex: null,
    generation: 1,
    referenceOwned: {
      pokemon: new Set(),
      people: new Set(),
    },
    referenceOwnershipLoaded: false,
    referenceSource: null,
    owned: new Set(),
    accountKeys: new Map(),
    accountManaged: false,
    cardOverrides: {},
    activeSlotId: "",
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

  function saveOwnedLocal() {
    try {
      localStorage.setItem(OWNED_STORAGE_KEY, JSON.stringify([...state.owned]));
    } catch {
      // 저장소 접근이 제한되어도 현재 세션의 체크 상태는 유지한다.
    }
  }

  function ownedMigrationDone() {
    try {
      return localStorage.getItem(OWNED_MIGRATION_KEY) === "done";
    } catch {
      return false;
    }
  }

  function markOwnedMigrationDone() {
    try {
      localStorage.setItem(OWNED_MIGRATION_KEY, "done");
    } catch {
      // 마이그레이션 표식을 저장하지 못해도 원격 저장 결과는 유지된다.
    }
  }

  function accountGroups() {
    return (state.data?.generations || []).map((generation) => ({
      code: `generation-${generation.generation}`,
      name: `${generation.generation}세대 ${generation.region || ""}`.trim(),
      cards: (generation.slots || []).map((slot) => ({
        code: slot.id,
        name: slot.title,
        owned: false,
        slotId: slot.id,
      })),
    }));
  }

  async function applyAccountOwnership() {
    const account = window.PokemonDexPageAccount;
    if (!account || !state.data) return;

    await account.ready;
    const groups = accountGroups();
    account.applyGroups(groups);

    const remoteOwned = new Set();
    const accountKeys = new Map();
    groups.forEach((group) => {
      (group.cards || []).forEach((card) => {
        if (!card.slotId || !card.accountKey) return;
        accountKeys.set(card.slotId, card.accountKey);
        if (card.owned) remoteOwned.add(card.slotId);
      });
    });
    state.accountKeys = accountKeys;

    const legacyOwned = new Set(state.owned);
    if (account.canEdit?.() && legacyOwned.size && !ownedMigrationDone()) {
      for (const slotId of legacyOwned) {
        const key = accountKeys.get(slotId);
        if (!key || remoteOwned.has(slotId)) continue;
        try {
          const saved = await account.saveOwned(key, true);
          if (saved?.owned) remoteOwned.add(slotId);
        } catch (error) {
          console.warn(`월드탐험도감 기존 보유상태 이전 실패: ${slotId}`, error);
        }
      }
      markOwnedMigrationDone();
    }

    state.accountManaged = Boolean(
      account.currentUser || window.CollectorPublicView?.requested,
    );
    if (state.accountManaged) {
      state.owned = remoteOwned;
      saveOwnedLocal();
    }
  }

  async function loadReferenceOwnership() {
    const account = window.PokemonDexPageAccount;
    const registry = window.CollectorCollectionRegistry;
    state.referenceOwned = {
      pokemon: new Set(),
      people: new Set(),
    };
    state.referenceOwnershipLoaded = false;
    state.referenceSource = null;

    if (!account || !registry || window.CollectorPublicView?.requested) return;
    await account.ready;
    const documentId = window.POKEMON_DEX_FIREBASE?.userDocument || "nationalDex";
    const source = await account.readCollectionDocument?.(documentId);
    if (!source) return;
    state.referenceSource = source;

    try {
      const [pokemonOwnership, peopleOwnership] = await Promise.all([
        registry.ownershipFor("national", source),
        registry.ownershipFor("people", source),
      ]);
      state.referenceOwned.pokemon = new Set(
        (pokemonOwnership?.ownedKeys || []).map((value) => String(value)),
      );
      state.referenceOwned.people = new Set(
        (peopleOwnership?.ownedKeys || []).map((value) => String(value)),
      );
      state.referenceOwnershipLoaded = true;
    } catch (error) {
      console.warn("월드탐험 원본 도감 보유상태를 불러오지 못했습니다.", error);
    }
  }

  function personById(personId) {
    if (!personId || !state.people?.people) return null;
    return state.people.people.find((person) => person.id === personId) || null;
  }

  function pokemonByNumber(number) {
    if (!state.pokedex?.records) return null;
    return state.pokedex.records.find(
      (pokemon) => Number(pokemon.number) === Number(number),
    ) || null;
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
    return personById(slot.personId);
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
      const pokemonCount = item.pokemonRefs?.length || 0;
      const peopleCount = item.peopleRefs?.length || 0;
      meta.textContent = item.status === "active"
        ? `${cardCount} 장소 · ${pokemonCount} 포켓몬 · ${peopleCount} 인물`
        : "준비 중";
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

  function makeSlot(slot, index, options = {}) {
    const item = resolvedSlot(slot);
    const storyMode = Boolean(options.story);
    const owned = state.owned.has(slot.id);

    const article = document.createElement("article");
    article.className = "pokemon-card world-slot has-completion-action";
    article.classList.toggle("world-journey-card", storyMode);
    article.classList.toggle("world-journey-card--place", storyMode);
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
    numberBadge.textContent = storyMode
      ? "장소"
      : String(index + 1).padStart(2, "0");
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
    const publicReadOnly = Boolean(window.CollectorPublicView?.requested);
    if (publicReadOnly) {
      ownedButton.disabled = true;
      ownedButton.title = "공개 도감은 읽기 전용입니다.";
    }
    ownedButton.addEventListener("click", async () => {
      if (publicReadOnly) return;
      const nextOwned = !state.owned.has(slot.id);
      const account = window.PokemonDexPageAccount;
      const accountKey = state.accountKeys.get(slot.id);

      ownedButton.disabled = true;
      try {
        let effectiveOwned = nextOwned;
        if (account?.canEdit?.() && accountKey) {
          const saved = await account.saveOwned(accountKey, nextOwned);
          effectiveOwned = Boolean(saved?.owned);
          state.accountManaged = true;
        }
        if (effectiveOwned) state.owned.add(slot.id);
        else state.owned.delete(slot.id);
        saveOwnedLocal();
        refreshOwnedButton();
        updateProgress();
      } catch (error) {
        console.error(error);
        alert(error?.message || "수집 상태를 저장하지 못했습니다.");
      } finally {
        ownedButton.disabled = false;
      }
    });

    article.append(openButton, ownedButton);
    return article;
  }

  function referenceImageUrl(kind, source) {
    if (kind === "pokemon") {
      const override = state.referenceSource?.overrides?.[String(source.number)];
      if (override?.owned && override.imageUrl) return String(override.imageUrl);
      return source.imageUrl || "";
    }
    const override = state.referenceSource?.peopleOverrides?.[source.id];
    return override?.imageUrl || source.imageLarge || source.image || "";
  }

  function referenceBadge(kind, key) {
    const badge = document.createElement("span");
    badge.className = "world-reference-badge";
    if (!state.referenceOwnershipLoaded) {
      badge.textContent = "원본 도감 연동";
      return badge;
    }
    const owned = state.referenceOwned[kind]?.has(String(key));
    badge.classList.toggle("is-owned", owned);
    badge.classList.toggle("is-missing", !owned);
    badge.textContent = owned ? "✓ 원본도감 보유" : "○ 원본도감 미보유";
    return badge;
  }

  function makeReferenceCard(kind, reference) {
    const isPokemon = kind === "pokemon";
    const source = isPokemon
      ? pokemonByNumber(reference)
      : personById(reference);
    if (!source) return null;

    const key = isPokemon ? source.number : source.id;
    const owned = state.referenceOwnershipLoaded
      ? state.referenceOwned[kind]?.has(String(key))
      : null;

    const link = document.createElement("a");
    link.className = `world-reference-card world-journey-card world-journey-card--${kind}`;
    link.classList.toggle("is-missing", owned === false);
    link.href = isPokemon ? "./national.html" : "./people.html";
    link.setAttribute(
      "aria-label",
      `${source.nameKo || source.nameEn || ""} 원본 도감 보기`,
    );

    const imageWrap = document.createElement("span");
    imageWrap.className = "card-image-wrap";
    const image = document.createElement("img");
    image.className = "card-image";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = referenceImageUrl(kind, source);
    image.alt = "";
    image.addEventListener("error", () => link.classList.add("has-image-error"), {
      once: true,
    });
    const missingOverlay = document.createElement("span");
    missingOverlay.className = "missing-overlay";
    missingOverlay.textContent = "미보유";
    imageWrap.append(image, missingOverlay, makeImageFallback());

    const copy = document.createElement("span");
    copy.className = "card-body world-card-body world-reference-copy";
    const topline = document.createElement("span");
    topline.className = "card-topline";
    const type = document.createElement("span");
    type.className = "number-badge";
    type.textContent = isPokemon ? "포켓몬" : "인물";
    const ownedBadge = referenceBadge(kind, key);
    ownedBadge.classList.add("status-badge");
    topline.append(type, ownedBadge);

    const name = document.createElement("strong");
    name.className = "card-name-ko";
    name.textContent = source.nameKo || source.nameEn || "";
    const sub = document.createElement("span");
    sub.className = "card-name-en world-story-subtitle";
    sub.textContent = isPokemon
      ? `#${String(source.number).padStart(4, "0")} · ${source.nameEn || ""}`
      : source.role || source.affiliation || source.nameEn || "";
    const origin = document.createElement("span");
    origin.className = "world-reference-origin";
    origin.textContent = isPokemon ? "전국도감에서 보기" : "인물도감에서 보기";

    copy.append(topline, name, sub, origin);
    link.append(imageWrap, copy);
    return link;
  }

  function storyItem(generation, item) {
    if (!item || !item.type) return null;
    if (item.type === "place") {
      const slot = generation.slots?.find((candidate) => candidate.id === item.ref);
      if (!slot) return null;
      const index = generation.slots.findIndex((candidate) => candidate.id === slot.id);
      return makeSlot(slot, index, { story: true });
    }
    if (item.type === "pokemon") return makeReferenceCard("pokemon", item.ref);
    if (item.type === "person") return makeReferenceCard("people", item.ref);
    return null;
  }

  function renderStoryChapter(generation, chapter, index) {
    const section = document.createElement("section");
    section.className = "world-journey-chapter";

    const heading = document.createElement("div");
    heading.className = "world-chapter-heading";
    const number = document.createElement("span");
    number.className = "world-chapter-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = chapter.title || "";
    const description = document.createElement("p");
    description.textContent = chapter.description || "";
    copy.append(title, description);
    heading.append(number, copy);

    const sequence = document.createElement("div");
    sequence.className = "world-chapter-sequence";
    for (const item of chapter.items || []) {
      const card = storyItem(generation, item);
      if (card) sequence.append(card);
    }

    section.append(heading, sequence);
    return section;
  }

  function renderStoryJourney(generation) {
    const wrapper = document.createElement("section");
    wrapper.className = "world-journey";

    const intro = document.createElement("div");
    intro.className = "world-journey-intro";
    const kicker = document.createElement("span");
    kicker.textContent = "스토리 탐험";
    const title = document.createElement("strong");
    title.textContent = `${generation.region}의 이야기를 카드로 따라가기`;
    const description = document.createElement("p");
    description.textContent =
      "장소·포켓몬·인물을 이야기 순서에 맞춰 함께 배치했습니다. 포켓몬과 인물의 보유상태는 원본 도감에서 읽으며 중복 저장하지 않습니다.";
    intro.append(kicker, title, description);
    wrapper.append(intro);

    (generation.chapters || []).forEach((chapter, index) => {
      wrapper.append(renderStoryChapter(generation, chapter, index));
    });

    const note = document.createElement("p");
    note.className = "world-journey-note";
    note.textContent =
      "이 지역의 기존 장소 카드 12장은 위 3개 챕터에 모두 포함되어 있으며 기존 worldDex 수집완료·대표카드 변경값을 그대로 사용합니다.";
    wrapper.append(note);
    return wrapper;
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
      const referenceLabels = [
        ...(generation.places || []).slice(0, 3),
        ...(generation.pokemonRefs || []).slice(0, 3).map((number) => pokemonByNumber(number)?.nameKo).filter(Boolean),
        ...(generation.peopleRefs || []).slice(0, 2).map((personId) => personById(personId)?.nameKo).filter(Boolean),
      ];
      referenceLabels.forEach((label) => {
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

    binder.append(renderStoryJourney(generation));
    updateProgress();
  }

  function renderAll() {
    renderGenerationButtons();
    const generation = generationData();
    if (generation) renderActiveGeneration(generation);
  }

  function normalizeSetCode(value) {
    return cardLookup.normalizeSetCode(value);
  }

  function normalizedCardNumber(value) {
    return cardLookup.normalizedCardNumber(value);
  }

  async function lookupSeriesCard(setCode, cardNumber, cardName) {
    return cardLookup.lookupSeriesCard(setCode, cardNumber, cardName, {
      includeLegacy: false,
    });
  }

  function officialImageCandidates(setCode, cardNumber) {
    return cardLookup.officialImageCandidates(setCode, cardNumber);
  }

  function imageLoads(url, timeout = 5000) {
    return cardLookup.imageLoads(url, { timeout });
  }

  async function findRepresentativeCard(setCode, cardNumber, cardName) {
    return cardLookup.findRepresentativeCard(setCode, cardNumber, cardName, {
      includeLegacy: false,
      timeout: 5000,
    });
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
      const [worldResponse, peopleResponse, pokedexResponse] = await Promise.all([
        fetch("./data/world-exploration.json", { cache: "no-store" }),
        fetch("./data/people.json", { cache: "no-store" }),
        fetch("./data/pokedex.json", { cache: "no-store" }),
      ]);
      if (!worldResponse.ok) throw new Error("월드탐험도감 데이터를 불러오지 못했습니다.");
      state.data = await worldResponse.json();
      state.people = peopleResponse.ok ? await peopleResponse.json() : null;
      state.pokedex = pokedexResponse.ok ? await pokedexResponse.json() : null;
      await applyAccountOwnership();
      await loadReferenceOwnership();
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
