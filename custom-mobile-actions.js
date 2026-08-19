"use strict";

(function () {
  const touchQuery = window.matchMedia("(pointer: coarse)");
  let resizeTimer = 0;

  const style = document.createElement("style");
  style.textContent = `
    .custom-card-actions {
      position: relative;
      z-index: 4;
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 7px !important;
      padding: 8px 10px 12px !important;
    }

    .custom-card-actions button {
      min-width: 0;
      min-height: 42px !important;
      border-radius: 11px !important;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    .custom-card-actions .custom-owned-toggle {
      grid-column: 1 / -1;
      min-height: 42px !important;
      padding: 0 10px;
      white-space: nowrap;
      font-size: 13px;
      letter-spacing: -0.01em;
    }

    .custom-card-actions button:not(.custom-owned-toggle) {
      font-size: 18px;
      font-weight: 800;
      line-height: 1;
    }

    .custom-card-actions .custom-remove-card {
      border-color: #f0d5d9 !important;
      background: #fff7f8 !important;
      color: #b93647 !important;
    }

    .custom-card-actions .custom-remove-card:hover {
      background: #fff0f2 !important;
      border-color: #e9bec5 !important;
    }

    @media (pointer: coarse), (max-width: 640px) {
      .custom-card {
        cursor: default !important;
      }

      .custom-card:active {
        cursor: default !important;
      }

      .custom-card-actions {
        gap: 8px !important;
        padding: 9px 10px 12px !important;
      }

      .custom-card-actions button,
      .custom-card-actions .custom-owned-toggle {
        min-height: 46px !important;
      }

      .custom-card-actions button:not(.custom-owned-toggle) {
        font-size: 20px;
      }
    }
  `;
  document.head.appendChild(style);

  function touchMode() {
    return touchQuery.matches || window.innerWidth <= 640;
  }

  function prepareButton(button) {
    if (!(button instanceof HTMLButtonElement) || button.dataset.touchReady === "1") return;
    button.dataset.touchReady = "1";
    button.draggable = false;
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
    button.addEventListener("dragstart", (event) => event.preventDefault());
  }

  function prepareCard(card) {
    if (!(card instanceof HTMLElement)) return;
    card.draggable = !touchMode();
    card.querySelectorAll(".custom-card-actions button").forEach(prepareButton);
  }

  function refresh() {
    document.querySelectorAll(".custom-card").forEach(prepareCard);
    const hint = document.querySelector(".custom-sort-hint");
    if (hint) {
      hint.textContent = touchMode()
        ? "↑ ↓ 버튼으로 카드 순서를 바꿀 수 있습니다."
        : "카드를 드래그하거나 ↑ ↓ 버튼으로 순서를 바꿀 수 있습니다.";
    }
  }

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.(".custom-card")) prepareCard(node);
        node.querySelectorAll?.(".custom-card").forEach(prepareCard);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  function scheduleRefresh() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refresh, 80);
  }

  if (typeof touchQuery.addEventListener === "function") {
    touchQuery.addEventListener("change", refresh);
  }
  window.addEventListener("resize", scheduleRefresh, { passive: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
