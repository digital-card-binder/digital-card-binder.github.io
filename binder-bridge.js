"use strict";

(function () {
  const STORAGE_KEY = "dcb:binder-add-card:v1";
  const clean = (value) => String(value ?? "").trim();

  const PAGE_LABELS = {
    series: "시리즈 도감",
    ar: "AR 전종도감",
    pokemon: "포켓몬 컬렉션",
    artist: "작가 도감",
    trainerPokemon: "트레이너 × 포켓몬",
    fossil: "화석 도감",
    world: "월드탐험도감",
  };

  const CONFIGS = [
    {
      dialog: "#catalog-dialog",
      image: "#catalog-dialog-image",
      name: "#dialog-name",
      set: "#dialog-group",
      number: "#dialog-code",
      meta: "#dialog-meta",
    },
    {
      dialog: "#card-dialog",
      image: "#dialog-image",
      name: "#dialog-name-ko",
      set: "#dialog-generation",
      number: "#dialog-number",
      meta: "#dialog-name-en",
      label: "전국도감",
    },
    {
      dialog: "#pokemon-search-dialog",
      image: "#pokemon-search-dialog-image",
      name: "#pokemon-search-dialog-name",
      set: "#pokemon-search-dialog-set",
      number: "#pokemon-search-dialog-number",
      meta: "#pokemon-search-dialog-code",
      label: "카드 검색",
    },
    {
      dialog: "#artist-dialog",
      image: "#artist-dialog-image",
      name: "#artist-dialog-name",
      set: "#artist-dialog-set",
      number: "#artist-dialog-card-number",
      meta: "#artist-dialog-number",
      label: "작가 도감",
    },
    {
      dialog: "#tp-dialog",
      image: "#tp-dialog-image",
      name: "#tp-dialog-name",
      set: "#tp-dialog-set",
      number: "#tp-dialog-card-number",
      meta: "#tp-dialog-number",
      label: "트레이너 × 포켓몬",
    },
    {
      dialog: "#fossil-dialog",
      image: "#fossil-dialog-image",
      name: "#fossil-dialog-name",
      set: "#fossil-dialog-set",
      number: "#fossil-dialog-card-number",
      meta: "#fossil-dialog-number",
      label: "화석 도감",
    },
    {
      dialog: "#world-card-dialog",
      image: "#world-dialog-image",
      name: "#world-dialog-card-name",
      set: "#world-dialog-set",
      number: "#world-dialog-number",
      meta: "#world-dialog-slot",
      label: "월드탐험도감",
    },
    {
      dialog: "#art-theme-dialog",
      image: "#art-theme-dialog-image",
      name: "#art-theme-dialog-name",
      set: "#art-theme-dialog-set",
      number: "#art-theme-dialog-card-number",
      meta: "#art-theme-dialog-number",
      label: "테마 도감",
    },
  ];

  function text(selector, root = document) {
    return clean(root.querySelector(selector)?.textContent);
  }

  function sourceLabel(config) {
    if (config.label) return config.label;
    const mode = clean(document.body?.dataset?.catalog);
    return PAGE_LABELS[mode] || text("main h1") || "도감";
  }

  function imageUrl(config, dialog) {
    const image = dialog.querySelector(config.image);
    if (!image) return "";
    return clean(image.currentSrc || image.getAttribute("src") || image.src);
  }

  function currentPayload(config, dialog) {
    const name = text(config.name, dialog);
    const image = imageUrl(config, dialog);
    const setText = text(config.set, dialog);
    const numberText = text(config.number, dialog);
    const meta = text(config.meta, dialog);
    if (!name || !image) return null;

    return {
      version: 1,
      createdAt: Date.now(),
      name,
      image,
      setText,
      numberText,
      meta,
      sourceLabel: sourceLabel(config),
      sourceUrl: window.location.href,
    };
  }

  function sendToBinder(payload) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("바인더 전달 정보를 저장하지 못했습니다.", error);
      window.alert("바인더로 카드를 전달하지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    const url = new URL("./studio.html", window.location.href);
    url.searchParams.set("from", "card");
    url.hash = "studio-custom";
    window.location.assign(url.href);
  }

  function install(config) {
    const dialog = document.querySelector(config.dialog);
    if (!dialog || dialog.querySelector("[data-binder-bridge-action]")) return;

    const copy =
      dialog.querySelector(".dialog-card-copy") ||
      dialog.querySelector(".art-theme-dialog-copy");
    if (!copy) return;

    const actions = document.createElement("div");
    actions.className = "binder-bridge-actions";
    actions.dataset.binderBridgeAction = "true";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary-button binder-bridge-add";
    button.innerHTML =
      '<span class="ui-icon ui-icon--binder" aria-hidden="true"></span><strong>바인더에 넣기</strong>';
    button.addEventListener("click", () => {
      const payload = currentPayload(config, dialog);
      if (!payload) {
        window.alert("이 카드 정보를 바인더로 전달하지 못했습니다.");
        return;
      }
      sendToBinder(payload);
    });

    const note = document.createElement("small");
    note.textContent = "보유 상태는 변경하지 않습니다.";
    actions.append(button, note);
    copy.append(actions);
  }

  function peopleArchivePayload(cardItem) {
    const image = cardItem.querySelector("img");
    const name = clean(cardItem.querySelector("strong")?.textContent);
    const meta = clean(cardItem.querySelector("small")?.textContent);
    const parts = meta.split("·").map(clean).filter(Boolean);
    const setText = parts[0] || "";
    const numberText = parts[1] || "";
    const imageValue = clean(image?.currentSrc || image?.getAttribute("src") || image?.src);
    if (!name || !imageValue) return null;
    return {
      version: 1,
      createdAt: Date.now(),
      name,
      image: imageValue,
      setText,
      numberText,
      meta,
      sourceLabel: "인물도감",
      sourceUrl: window.location.href,
    };
  }

  function installPeopleArchiveCards(root = document) {
    root.querySelectorAll?.(".people-archive-card").forEach((cardItem) => {
      if (cardItem.querySelector("[data-binder-archive-action]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "binder-archive-add";
      button.dataset.binderArchiveAction = "true";
      button.textContent = "바인더에 넣기";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const payload = peopleArchivePayload(cardItem);
        if (!payload) {
          window.alert("이 카드 정보를 바인더로 전달하지 못했습니다.");
          return;
        }
        sendToBinder(payload);
      });
      cardItem.append(button);
    });
  }

  function observePeopleArchive() {
    const host = document.querySelector("#people-dialog-card-list");
    if (!host) return;
    installPeopleArchiveCards(host);
    const observer = new MutationObserver(() => installPeopleArchiveCards(host));
    observer.observe(host, { childList: true, subtree: true });
  }

  function installAll() {
    CONFIGS.forEach(install);
    observePeopleArchive();
  }

  window.DigitalCardBinderBridge = Object.freeze({
    sendCard(payload) {
      const normalized = {
        version: 1,
        createdAt: Date.now(),
        name: clean(payload?.name),
        image: clean(payload?.image),
        setText: clean(payload?.setText),
        numberText: clean(payload?.numberText),
        meta: clean(payload?.meta),
        sourceLabel: clean(payload?.sourceLabel) || "도감",
        sourceUrl: clean(payload?.sourceUrl) || window.location.href,
      };
      if (!normalized.name || !normalized.image) return false;
      sendToBinder(normalized);
      return true;
    },
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installAll, { once: true });
  } else {
    installAll();
  }
})();
