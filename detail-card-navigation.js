"use strict";

/**
 * Shared previous/next navigation for Dex detail dialogs that do not yet
 * expose their own card-navigation controls. Navigation follows the live
 * card-grid DOM, so active search/status/set filters are preserved.
 */
(() => {
  const configs = [
    { grid: "#fossil-card-grid", dialog: "#fossil-dialog", trigger: ".fossil-card-button", name: "화석 도감" },
    { grid: "#tp-card-grid", dialog: "#tp-dialog", trigger: ".pokemon-card-button", name: "트레이너 × 포켓몬 도감" },
    { grid: "#pokemon-search-grid", more: "#pokemon-search-load-more", total: "#pokemon-search-result-count", dialog: "#pokemon-search-dialog", trigger: ".pokemon-card-button", name: "카드 검색" },
    { grid: "#artist-card-grid", dialog: "#artist-dialog", trigger: ".artist-card-button", name: "작가 도감" },
    { grid: "#art-theme-card-grid", dialog: "#art-theme-dialog", trigger: ".art-theme-card-open", name: "일러스트 테마 도감" },
    { grid: "#people-grid", more: "#people-load-more", total: "#people-result-count", dialog: "#people-dialog", trigger: ".pokemon-card-button", name: "인물 도감" },
    { grid: "#world-binder-content", dialog: "#world-card-dialog", trigger: ".world-card-open", name: "월드탐험 도감" },
    { grid: "#card-grid", more: "#load-more", total: "#result-count", dialog: "#card-dialog", trigger: ".pokemon-card-button", name: "전국도감" },
    { grid: "#catalog-grid", dialog: "#catalog-dialog", trigger: ".pokemon-card-button", name: "통합 카탈로그 도감", hideNavigationOnMobile: true },
    { grid: "#pack-groups", dialog: "#pack-dialog", trigger: ".pack-card-detail", name: "팩 전종수집" },
  ];
  const style = document.createElement("style");
  style.textContent = `
    .detail-card-navigation{display:flex!important;visibility:visible!important;opacity:1!important;position:relative;z-index:30;justify-content:space-between;align-items:center;gap:12px;width:100%;min-height:48px;margin-top:16px;clear:both}
    .detail-card-navigation button{display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center;justify-content:center;flex:0 0 auto;min-width:88px;min-height:44px;padding:8px 16px;border:1px solid #cbd5e1;border-radius:12px;background:#17233f;color:#fff;font:inherit;font-weight:800;line-height:1;cursor:pointer}
    .detail-card-navigation button:disabled{background:#e2e8f0;color:#64748b;opacity:1;cursor:not-allowed}
    .detail-card-navigation span{display:block;visibility:visible!important;opacity:1!important;flex:1;text-align:center;font-size:12px;color:#475569;font-weight:700}
    .detail-card-navigation button:disabled{opacity:.35;cursor:not-allowed}
    .detail-card-navigation span{font-size:12px;color:#64748b}
    @media(max-width:690px){.detail-card-navigation button{min-width:76px;min-height:44px}.detail-card-navigation{margin-top:12px}.detail-card-navigation.is-duplicate-mobile{display:none!important}}
    /* Theme dex uses a custom two-column dialog. Keep its controls visibly anchored
       to the bottom of the details pane on desktop and mobile. */
    #art-theme-dialog .detail-card-navigation{display:flex!important;position:sticky;bottom:0;z-index:20;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:58px;margin:18px 0 0;padding:10px 0;background:#fff;visibility:visible!important;opacity:1!important}
    #art-theme-dialog .detail-card-navigation button{display:inline-flex!important;align-items:center;justify-content:center;flex:0 0 auto;min-width:92px;min-height:44px;padding:8px 14px;border:1px solid #cbd5e1;border-radius:12px;background:#17233f;color:#fff;font-size:14px;font-weight:800;line-height:1;visibility:visible!important;opacity:1!important}
    #art-theme-dialog .detail-card-navigation button:disabled{background:#e2e8f0;color:#64748b;opacity:1!important}
    #art-theme-dialog .detail-card-navigation span{display:block;flex:1;text-align:center;color:#475569;font-size:12px;font-weight:700}
    @media(max-width:620px){#art-theme-dialog .detail-card-navigation{position:sticky;bottom:0;min-height:62px;margin:12px 0 0;padding:10px 0 calc(10px + env(safe-area-inset-bottom));background:linear-gradient(to bottom,rgba(255,255,255,.94),#fff 24%)}#art-theme-dialog .detail-card-navigation button{min-width:86px;min-height:46px;font-size:14px}}
  `;
  document.head.append(style);

  let active = null;
  let pendingButton = null;
  let touchStart = null;

  // 페이지가 자기 목록 상태를 직접 관리하는 경우(시리즈·AR 도감) 어댑터를 등록한다.
  // 어댑터가 있으면 이동·위치·버튼 상태는 모두 그 어댑터 하나만 기준으로 삼아
  // 하단 이동 막대와 모바일 시트 화살표가 서로 어긋나지 않게 한다.
  const adapterFor = (config) => (window.DetailCardNavigationAdapters || {})[config.dialog] || null;

  const cardsInGrid = (grid, config) => [...(grid?.querySelectorAll("article") || [])]
    .filter((node) => node.querySelector(config.trigger || "button"));

  // 목록을 나눠 불러오는 화면은 아직 불러오지 않은 카드도 이동 범위에 포함한다.
  const moreButtonFor = (config) => {
    const button = config.more ? document.querySelector(config.more) : null;
    return button && !button.disabled && !button.closest("[hidden]") ? button : null;
  };

  const totalFor = (config, loaded) => {
    if (!moreButtonFor(config)) return loaded;
    const digits = document.querySelector(config.total)?.textContent.replace(/\D/g, "");
    return Math.max(Number(digits) || 0, loaded);
  };

  function sync(config) {
    const dialog = document.querySelector(config.dialog);
    const adapter = adapterFor(config);
    if (adapter) {
      const nav = dialog?.querySelector(".detail-card-navigation");
      const position = adapter.state();
      if (!nav || !position) return;
      nav.querySelector("[data-detail-prev]").disabled = position.index <= 0;
      nav.querySelector("[data-detail-next]").disabled = position.index < 0 || position.index >= position.total - 1;
      nav.querySelector("[data-detail-count]").textContent =
        position.index < 0 ? "목록이 변경됨" : `${position.index + 1} / ${position.total}`;
      return;
    }
    const grid = document.querySelector(config.grid);
    const items = cardsInGrid(grid, config);
    const current = active?.button?.closest("article");
    const index = items.indexOf(current);
    const nav = dialog?.querySelector(".detail-card-navigation");
    if (!nav) return;
    nav.querySelector("[data-detail-prev]").disabled = index <= 0;
    nav.querySelector("[data-detail-next]").disabled =
      index < 0 || (index >= items.length - 1 && !moreButtonFor(config));
    nav.querySelector("[data-detail-count]").textContent =
      index < 0 ? "목록이 변경됨" : `${index + 1} / ${totalFor(config, items.length)}`;
  }

  function move(direction) {
    if (!active) return;
    const adapter = adapterFor(active.config);
    if (adapter) {
      adapter.step(direction);
      sync(active.config);
      return;
    }
    const grid = document.querySelector(active.config.grid);
    const dialog = document.querySelector(active.config.dialog);
    let items = cardsInGrid(grid, active.config);
    const index = items.indexOf(active.button.closest("article"));
    if (index >= 0 && direction > 0 && !items[index + direction]) {
      // 마지막으로 불러온 카드라면 다음 묶음을 먼저 불러온 뒤 이어서 이동한다.
      const more = moreButtonFor(active.config);
      if (more) {
        more.click();
        items = cardsInGrid(grid, active.config);
      }
    }
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

  function ensureNavigation(config, dialog) {
    const content = dialog.querySelector(".dialog-card-copy, .art-theme-dialog-copy");
    if (!content || content.querySelector(".detail-card-navigation")) return;
    const nav = document.createElement("nav");
    nav.className = `detail-card-navigation${config.hideNavigationOnMobile ? " is-duplicate-mobile" : ""}`;
    nav.setAttribute("aria-label", "상세 카드 이동");
    nav.innerHTML = `
      <button type="button" data-detail-prev aria-label="이전 카드">← 이전</button>
      <span data-detail-count aria-live="polite"></span>
      <button type="button" data-detail-next aria-label="다음 카드">다음 →</button>
    `;
    content.append(nav);
    nav.querySelector("[data-detail-prev]").addEventListener("click", () => move(-1));
    nav.querySelector("[data-detail-next]").addEventListener("click", () => move(1));
    requestAnimationFrame(() => sync(config));
  }

  function install(config) {
    const dialog = document.querySelector(config.dialog);
    if (!dialog) return;
    ensureNavigation(config, dialog);
    // Detail renderers replace the copy pane's innerHTML when a card opens.
    // Reattach the controls after each render so they cannot disappear.
    const observer = new MutationObserver(() => ensureNavigation(config, dialog));
    observer.observe(dialog, { childList: true, subtree: true });
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

  window.DetailCardNavigation = { sync: (dialogSelector) => {
    const config = configs.find((item) => item.dialog === dialogSelector);
    if (config) sync(config);
  } };

  function installAll() {
    configs.forEach(install);
  }

  // Several pages load this shared script from the head without defer.
  // Wait until their dialogs and grids exist before installing controls.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installAll, { once: true });
  } else {
    installAll();
  }
})();
