"use strict";

(function () {
  const STORAGE_KEY = "digitalCardBinderWorldExplorationOwnedV1";
  const state = {
    data: null,
    people: null,
    generation: 1,
    owned: new Set(),
  };

  const el = (id) => document.getElementById(id);

  function loadOwned() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      state.owned = new Set(Array.isArray(saved) ? saved : []);
    } catch {
      state.owned = new Set();
    }
  }

  function saveOwned() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.owned]));
    } catch {
      // 저장소가 제한되어도 현재 세션의 체크 상태는 유지한다.
    }
  }

  function generationData() {
    return state.data?.generations?.find((item) => item.generation === state.generation) || null;
  }

  function resolvePerson(slot) {
    if (!slot.personId || !state.people?.people) return null;
    return state.people.people.find((person) => person.id === slot.personId) || null;
  }

  function resolvedSlot(slot) {
    const person = resolvePerson(slot);
    const card = person?.cards?.[0] || person || slot.card || {};
    return {
      ...slot,
      image: card.imageLarge || card.image || person?.imageLarge || person?.image || "",
      cardName: card.name || slot.card?.name || slot.title,
      setName: card.set || slot.card?.set || "",
      number: card.number || slot.card?.number || "",
      rarity: card.rarity || slot.card?.rarity || "",
      source: card.source || slot.card?.source || "",
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
      el("world-progress-ring").style.setProperty("--progress", `${rate * 3.6}deg`);
    }
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
      button.innerHTML = `
        <strong>${item.generation}세대</strong>
        <span>${item.region} · ${item.regionEn}</span>
        <small>${item.status === "active" ? "12 CARD STORY" : "COMING NEXT"}</small>
      `;
      button.addEventListener("click", () => {
        state.generation = item.generation;
        renderAll();
        document.querySelector(".world-binder-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      container.append(button);
    });
  }

  function makeSlot(slot, index) {
    const item = resolvedSlot(slot);
    const article = document.createElement("article");
    article.className = "world-slot";
    article.classList.toggle("is-owned", state.owned.has(slot.id));

    const imageWrap = document.createElement("div");
    imageWrap.className = "world-card-image-wrap";
    const image = document.createElement("img");
    image.className = "world-card-image";
    image.src = item.image;
    image.alt = `${item.cardName} 한국어판 포켓몬 카드`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => imageWrap.classList.add("is-broken"), { once: true });

    const fallback = document.createElement("div");
    fallback.className = "world-card-fallback";
    fallback.textContent = `${item.cardName}\n이미지 확인 중`;
    imageWrap.append(image, fallback);

    const badge = document.createElement("span");
    badge.className = "world-slot-index";
    badge.textContent = String(index + 1);

    const copy = document.createElement("div");
    copy.className = "world-slot-copy";
    const numberLabel = [item.number, item.rarity].filter(Boolean).join(" · ");
    copy.innerHTML = `
      <strong title="${item.title}">${item.title}</strong>
      <span>${item.subtitle || ""}</span>
      <small>${[item.setName, numberLabel].filter(Boolean).join(" · ")}</small>
    `;

    const actions = document.createElement("div");
    actions.className = "world-slot-actions";
    const ownedButton = document.createElement("button");
    ownedButton.type = "button";
    ownedButton.className = "world-owned-button";
    const refreshOwnedButton = () => {
      const owned = state.owned.has(slot.id);
      ownedButton.classList.toggle("is-owned", owned);
      ownedButton.setAttribute("aria-pressed", String(owned));
      ownedButton.textContent = owned ? "✓ 수집완료" : "수집하기";
      article.classList.toggle("is-owned", owned);
    };
    refreshOwnedButton();
    ownedButton.addEventListener("click", () => {
      if (state.owned.has(slot.id)) state.owned.delete(slot.id);
      else state.owned.add(slot.id);
      saveOwned();
      refreshOwnedButton();
      updateProgress();
    });
    actions.append(ownedButton);

    if (item.source) {
      const link = document.createElement("a");
      link.className = "world-source-link";
      link.href = item.source;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = "카드 출처 열기";
      link.setAttribute("aria-label", `${item.cardName} 카드 출처 열기`);
      link.textContent = "↗";
      actions.append(link);
    }

    article.append(badge, imageWrap, copy, actions);
    return article;
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
      [...(generation.people || []).slice(0, 4), ...(generation.places || []).slice(0, 3)].forEach((label) => {
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
      planned.innerHTML = `
        <strong>${generation.region}지방 4×3 스토리 페이지 준비 중</strong>
        <p>${generation.tagline}</p>
        <div class="world-planned-columns">
          <div class="world-planned-card"><b>대표 인물 후보</b><span>${(generation.people || []).join(" · ")}</span></div>
          <div class="world-planned-card"><b>대표 장소 후보</b><span>${(generation.places || []).join(" · ")}</span></div>
        </div>
      `;
      binder.append(planned);
      updateProgress();
      return;
    }

    generation.phases.forEach((phase) => {
      const section = document.createElement("section");
      section.className = "world-phase";
      const heading = document.createElement("div");
      heading.className = "world-phase-heading";
      heading.innerHTML = `<strong>${phase.label}</strong><span>${phase.description}</span>`;
      const grid = document.createElement("div");
      grid.className = "world-slot-grid";
      const phaseSlots = generation.slots.filter((slot) => slot.phase === phase.id);
      phaseSlots.forEach((slot) => {
        const overallIndex = generation.slots.findIndex((item) => item.id === slot.id);
        grid.append(makeSlot(slot, overallIndex));
      });
      section.append(heading, grid);
      binder.append(section);
    });
    updateProgress();
  }

  function renderRoadmap() {
    const list = el("world-roadmap-list");
    if (!list || !state.data) return;
    list.replaceChildren();
    state.data.generations.slice(1).forEach((item) => {
      const article = document.createElement("article");
      article.className = "world-roadmap-item";
      article.innerHTML = `<strong>${item.generation}세대 · ${item.region}</strong><span>${item.title}</span>`;
      list.append(article);
    });
  }

  function renderAll() {
    renderGenerationButtons();
    const generation = generationData();
    if (generation) renderActiveGeneration(generation);
  }

  async function init() {
    loadOwned();
    try {
      const [worldResponse, peopleResponse] = await Promise.all([
        fetch("./data/world-exploration.json", { cache: "no-store" }),
        fetch("./data/people.json", { cache: "no-store" }),
      ]);
      if (!worldResponse.ok) throw new Error("월드탐험도감 데이터를 불러오지 못했습니다.");
      state.data = await worldResponse.json();
      state.people = peopleResponse.ok ? await peopleResponse.json() : null;
      renderAll();
      renderRoadmap();
    } catch (error) {
      console.error(error);
      const binder = el("world-binder-content");
      if (binder) {
        binder.innerHTML = `<div class="world-planned"><strong>데이터를 불러오지 못했습니다.</strong><p>잠시 후 다시 시도해 주세요.</p></div>`;
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();
