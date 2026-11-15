"use strict";

/**
 * Shared previous/next navigation for Dex detail dialogs that do not yet
 * expose their own card-navigation controls. Navigation follows the live
 * card-grid DOM, so active search/status/set filters are preserved.
 */
(() => {
  const configs = [
    { grid: "#fossil-card-grid", dialog: "#fossil-dialog", trigger: ".pokemon-card-button", name: "화석 도감" },
    { grid: "#tp-card-grid", dialog: "#tp-dialog", trigger: ".pokemon-card-button", name: "트레이너 × 포켓몬 도감" },
    { grid: "#pokemon-search-grid", dialog: "#pokemon-search-dialog", trigger: ".pokemon-card-button", name: "카드 검색" },
    { grid: "#artist-card-grid", dialog: "#artist-dialog", trigger: ".artist-card-button", name: "작가 도감" },
    { grid: "#art-theme-card-grid", dialog: "#art-theme-dialog", trigger: ".art-theme-card-open", name: "일러스트 테마 도감" },
    { grid: "#people-grid", dialog: "#people-dialog", trigger: ".pokemon-card-button", name: "인물 도감" },
    { grid: "#world-binder-content", dialog: "#world-card-dialog", trigger: ".world-card-open", name: "월드탐험 도감" },
  ];
  const style = document.createElement("style");
  style.textContent = `
    .detail-card-navigation{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;margin-top:16px}
    .detail-card-navigation button{min-width:88px;min-height:42px;padding:8px 16px;border:1px solid rgba(100,116,139,.28);border-radius:12px;background:#f8fafc;color:#17233f;font:inherit;font-weight:700}
    .detail-card-navigation button:disabled{opacity:.35;cursor:not-allowed}
    .detail-card-navigation span{font-size:12px;color:#64748b}
    @media(max-width:690px){.detail-card-navigation button{min-width:76px;min-height:44px}.detail-card-navigation{margin-top:12px}}
  `;
  document.head.append(style);

  let active = null;
  let pendingButton = null;
  let touchStart = null;

  const cardsInGrid = (grid, config) => [...(grid?.querySelectorAll("article") || [])]
    .filter((node) => node.querySelector(config.trigger || "button"));

  function sync(config) {
    const dialog = document.querySelector(config.dialog);
    const grid = document.querySelector(config.grid);
    const items = cardsInGrid(grid, config);
    const current = active?.button?.closest("article");
    const index = items.indexOf(current);
    const nav = dialog?.querySelector(".detail-card-navigation");
    if (!nav) return;
    nav.querySelector("[data-detail-prev]").disabled = index <= 0;
    nav.querySelector("[data-detail-next]").disabled = index < 0 || index >= items.length - 1;
    nav.querySelector("[data-detail-count]").textContent =
      index < 0 ? "목록이 변경됨" : `${index + 1} / ${items.length}`;
  }

  function move(direction) {
    if (!active) return;
    const grid = document.querySelector(active.config.grid);
    const dialog = document.querySelector(active.config.dialog);
    const items = cardsInGrid(grid, active.config);
    const index = items.indexOf(active.button.closest("article"));
    const next = items[index + direction];
    const nextButton = next?.querySelector(active.config.trigger || "button");
    if (!nextButton || index < 0) return;
    pendingButton = nextButton;
    if (dialog?.open && typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog?.removeAttribute("open");
      const target = pendingButton;
      pendingButton = null;
      requestAnimationFrame(() => target?.click());
    }
  }

  function install(config) {
    const dialog = document.querySelector(config.dialog);
    if (!dialog) return;
    if (!dialog.querySelector(".detail-card-navigation")) {
      const nav = document.createElement("nav");
      nav.className = "detail-card-navigation";
      nav.setAttribute("aria-label", "상세 카드 이동");
      nav.innerHTML = `
        <button type="button" data-detail-prev aria-label="이전 카드">← 이전</button>
        <span data-detail-count aria-live="polite"></span>
        <button type="button" data-detail-next aria-label="다음 카드">다음 →</button>
      `;
      dialog.append(nav);
      nav.querySelector("[data-detail-prev]").addEventListener("click", () => move(-1));
      nav.querySelector("[data-detail-next]").addEventListener("click", () => move(1));
    }
    dialog.addEventListener("close", () => {
      if (!pendingButton) return;
      const target = pendingButton;
      pendingButton = null;
      requestAnimationFrame(() => target.click());
    });
    dialog.addEventListener("touchstart", (event) => {
      if (event.touches.length !== 1) return;
      const target = event.target;
      if (target.closest("button,a,input,select,textarea,.detail-card-navigation")) return;
      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    dialog.addEventListener("touchend", (event) => {
      if (!touchStart) return;
      const touch = event.changedTouches?.[0];
      const start = touchStart;
      touchStart = null;
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      move(dx < 0 ? 1 : -1);
    }, { passive: true });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) return;
      sync(config);
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    for (const config of configs) {
      const grid = document.querySelector(config.grid);
      if (!grid?.contains(button)) continue;
      const trigger = button.closest(config.trigger || "button");
      if (!trigger) continue;
      const article = trigger.closest("article");
      if (!article) return;
      active = { config, button: trigger };
      requestAnimationFrame(() => sync(config));
      return;
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!active) return;
    const dialog = document.querySelector(active.config.dialog);
    if (!dialog?.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest("input,textarea,select,[contenteditable='true']")) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
  });

  configs.forEach(install);
})();
