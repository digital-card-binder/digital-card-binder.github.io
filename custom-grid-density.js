"use strict";

// Layout-only preference for the personal dex card grid.
// This never modifies saved collection cards or ownership data.
(function () {
  const STORAGE_KEY = "dcb-custom-dex-mobile-columns";
  const valid = new Set(["2", "4"]);
  let columns = "2";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (valid.has(stored)) columns = stored;
  } catch (_) {
    // Private browsing or disabled storage: use the 2-column mobile default.
  }

  function applyColumns(next) {
    if (!valid.has(next)) return;
    columns = next;
    document.body.dataset.customGridColumns = next;
    document.querySelectorAll("#custom-grid-density button[data-columns]").forEach((button) => {
      const selected = button.dataset.columns === next;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function init() {
    applyColumns(columns);
    document.getElementById("custom-grid-density")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-columns]");
      if (!button) return;
      const next = button.dataset.columns;
      if (!valid.has(next)) return;
      applyColumns(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) { /* Layout still changes. */ }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else init();
})();
