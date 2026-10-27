"use strict";

// Presentation-only enhancements for the personal dex. No account or card records change.
(function () {
  const mobile = window.matchMedia("(max-width: 760px)");
  let listScroll = 0;
  let activeDex = "";
  const $ = (id) => document.getElementById(id);

  function currentTile() {
    return document.querySelector("#custom-dex-list .custom-dex-tile.is-active");
  }

  function updateSwitcher() {
    const select = $("custom-mobile-switch");
    const list = $("custom-dex-list");
    if (!select || !list) return;
    const tiles = [...list.querySelectorAll(".custom-dex-tile")];
    const selected = currentTile()?.dataset.dexId || "";
    select.replaceChildren();
    tiles.forEach((tile) => {
      const option = document.createElement("option");
      option.value = tile.dataset.dexId;
      option.textContent = tile.querySelector(".custom-dex-tile-copy strong")?.textContent || "내 도감";
      select.append(option);
    });
    select.value = selected;
    if (mobile.matches && document.body.dataset.customView === "detail" && activeDex && !tiles.some((tile) => tile.dataset.dexId === activeDex)) {
      showList();
    }
    activeDex = selected;
  }

  function showList() {
    document.body.dataset.customView = "list";
    requestAnimationFrame(() => window.scrollTo(0, listScroll));
  }

  function showDetail() {
    if (!mobile.matches) return;
    if (document.body.dataset.customView !== "detail") {
      listScroll = window.scrollY;
      window.history.pushState({ customDexMobileDetail: true }, "", window.location.href);
    }
    document.body.dataset.customSection = "dex";
    document.body.dataset.customView = "detail";
    window.scrollTo(0, 0);
  }

  function selectSection(section) {
    document.body.dataset.customSection = section;
    document.querySelectorAll("#custom-mobile-tabs button").forEach((button) => {
      const selected = button.dataset.customSection === section;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function prepareCard(article) {
    if (article.dataset.compactReady === "1") return;
    const actions = article.querySelector(".custom-card-actions");
    if (!actions) return;
    const own = actions.querySelector(".custom-owned-toggle");
    const up = actions.querySelector('[title="앞으로 이동"]');
    const down = actions.querySelector('[title="뒤로 이동"]');
    const remove = actions.querySelector(".custom-remove-card");
    if (!own || !up || !down || !remove) return;
    article.dataset.compactReady = "1";

    const more = document.createElement("button");
    more.type = "button";
    more.className = "custom-card-more";
    more.innerHTML = '<span class="custom-more-icon" aria-hidden="true">⋯</span><span class="custom-more-label" aria-hidden="true">관리</span>';
    more.setAttribute("aria-label", "카드 관리 메뉴 열기");
    const title = article.querySelector(".card-name-ko")?.textContent || "카드";
    actions.replaceChildren(own, more);

    up.textContent = "↑ 앞으로 이동";
    down.textContent = "↓ 뒤로 이동";
    remove.textContent = "도감에서 제거";
    const dialog = $("custom-card-menu-dialog");
    [up, down, remove].forEach((button) => {
      button.addEventListener("click", () => dialog.close(), { capture: true });
    });
    more.addEventListener("click", () => {
      $("custom-card-menu-title").textContent = title + " 관리";
      const controls = $("custom-card-menu-actions");
      controls.replaceChildren();
      const ownedAction = document.createElement("button");
      ownedAction.type = "button";
      ownedAction.className = "custom-card-menu-owned";
      ownedAction.textContent = article.classList.contains("is-owned") ? "✓ 보유 취소" : "○ 보유로 표시";
      ownedAction.disabled = own.disabled;
      ownedAction.addEventListener("click", () => {
        dialog.close();
        if (!own.disabled) own.click();
      });
      controls.append(ownedAction);
      if (document.body.classList.contains("custom-bulk-mode")) controls.append(up, down);
      controls.append(remove);
      dialog.showModal();
    });
  }

  function setCardImportMode(mode, focus = false) {
    if (mode !== "search" && mode !== "photo") return;
    const dialog = $("card-picker-dialog");
    if (!dialog) return;
    dialog.dataset.customImportMode = mode;
    dialog.querySelectorAll(".custom-import-methods button[data-import-mode]").forEach((button) => {
      const active = button.dataset.importMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (focus) {
      const target = mode === "search" ? $("card-picker-search") : $("custom-photo-trigger");
      target?.focus();
    }
  }

  function prepareCards() {
    document.querySelectorAll("#custom-card-grid .custom-card").forEach(prepareCard);
  }

  function updateHint() {
    const hint = document.querySelector(".custom-sort-hint");
    if (hint) hint.textContent = "손잡이를 드래그하거나 카드 관리 메뉴에서 순서를 이동하세요.";
  }

  function init() {
    document.body.dataset.customView = "list";
    selectSection("dex");

    $("custom-mobile-tabs")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-custom-section]");
      if (button) selectSection(button.dataset.customSection);
    });
    $("custom-mobile-back")?.addEventListener("click", () => {
      if (window.history.state?.customDexMobileDetail) window.history.back();
      else showList();
    });
    window.addEventListener("popstate", () => {
      if (document.body.dataset.customView === "detail") showList();
    });
    $("custom-mobile-switch")?.addEventListener("change", (event) => {
      const id = event.currentTarget.value;
      const tile = [...document.querySelectorAll("#custom-dex-list .custom-dex-tile")]
        .find((button) => button.dataset.dexId === id);
      if (tile) {
        tile.click();
        showDetail();
      }
    });
    $("custom-card-menu-close")?.addEventListener("click", () => $("custom-card-menu-dialog").close());
    $("custom-dex-manage")?.addEventListener("click", (event) => {
      if (event.target.closest("button")) $("custom-dex-manage").open = false;
    });
    $("card-picker-dialog")?.addEventListener("close", () => setCardImportMode("search"));
    $("card-picker-dialog")?.querySelector(".custom-import-methods")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-import-mode]");
      if (button) setCardImportMode(button.dataset.importMode, true);
    });
    setCardImportMode("search");

    // Capture the click before custom.js replaces the entire list during renderAll().
    // Delegating from document after replacement loses the #custom-dex-list ancestor.
    const list = $("custom-dex-list");
    list?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      const tile = target?.closest(".custom-dex-tile");
      if (tile && list.contains(tile) && mobile.matches) showDetail();
    }, { capture: true });
    const grid = $("custom-card-grid");
    if (list) new MutationObserver(updateSwitcher).observe(list, { childList: true });
    if (grid) new MutationObserver(() => {
      prepareCards();
      updateHint();
    }).observe(grid, { childList: true });
    updateSwitcher();
    prepareCards();
    updateHint();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
