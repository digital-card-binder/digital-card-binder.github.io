"use strict";

(function () {
  const COMPACT_QUERY = "(max-width: 920px)";
  const MOBILE_QUERY = "(max-width: 690px)";
  const compactMedia = window.matchMedia(COMPACT_QUERY);
  const mobileMedia = window.matchMedia(MOBILE_QUERY);

  const MODE_CONFIG = {
    desktop: {
      columns: ["3", "4"],
      defaultColumns: "4",
      storageKey: "pokemonDexSeriesDesktopColumnsV1",
      legacyStorageKey: "pokemonDexCardColumnsV1",
    },
    compact: {
      columns: ["2", "3", "4"],
      defaultColumns: "2",
      storageKey: "pokemonDexSeriesCompactColumnsV1",
      legacyStorageKey: "pokemonDexCompactCardColumnsV1",
    },
    mobile: {
      columns: ["2", "3", "4"],
      defaultColumns: "2",
      storageKey: "pokemonDexSeriesMobileColumnsV1",
      legacyStorageKey: "pokemonDexMobileCardColumnsV1",
    },
  };

  const style = document.createElement("style");
  style.textContent = `
    .series-card-layout-options {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-height: 32px;
      border: 1px solid #dfe3ec;
      border-radius: 10px;
      background: #f5f7fa;
      padding: 3px;
    }

    .series-card-layout-options button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 28px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--ink-soft);
      cursor: pointer;
      font-size: .63rem;
      font-weight: 800;
      padding: 5px 8px;
      white-space: nowrap;
      transition: background .18s ease, color .18s ease, box-shadow .18s ease;
    }

    .series-card-layout-options button:hover {
      color: var(--navy);
    }

    .series-card-layout-options button:focus-visible {
      outline: 3px solid rgba(42, 117, 187, .24);
      outline-offset: 2px;
    }

    .series-card-layout-options button[aria-pressed="true"] {
      background: #fff;
      color: var(--blue);
      box-shadow: 0 2px 7px rgba(23, 35, 63, .12);
    }

    @media (max-width: 920px) {
      html[data-card-columns="3"] .card-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 690px) {
      .series-card-layout-options {
        min-height: 44px;
        gap: 2px;
        padding: 3px;
      }

      .series-card-layout-options button {
        min-width: 38px;
        min-height: 36px;
        padding: 5px 6px;
        font-size: .61rem;
        touch-action: manipulation;
      }

      html[data-card-columns="3"] .card-grid {
        gap: 8px;
      }

      html[data-card-columns="3"] .pokemon-card-button {
        border-radius: 11px;
      }

      html[data-card-columns="3"] .card-image-wrap {
        padding: 6px;
      }

      html[data-card-columns="3"] .card-body,
      html[data-card-columns="3"] .catalog-card .card-body {
        min-height: 106px;
        padding: 8px;
      }

      html[data-card-columns="3"] .pokemon-card.has-completion-action .card-body {
        padding-bottom: 45px;
      }

      html[data-card-columns="3"] .card-topline {
        display: grid;
        justify-content: stretch;
        gap: 4px;
      }

      html[data-card-columns="3"] .number-badge,
      html[data-card-columns="3"] .card-meta {
        overflow: hidden;
        font-size: .55rem;
        text-overflow: ellipsis;
      }

      html[data-card-columns="3"] .status-badge {
        width: max-content;
        max-width: 100%;
        padding: 3px 5px;
        overflow: hidden;
        font-size: .54rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      html[data-card-columns="3"] .card-name-ko {
        margin-top: 6px;
        font-size: .74rem;
      }

      html[data-card-columns="3"] .card-name-en {
        font-size: .54rem;
      }

      html[data-card-columns="3"] .collection-complete-button {
        right: 5px;
        bottom: 5px;
        left: 5px;
        min-height: 32px;
        padding: 4px 3px;
        border-radius: 7px;
        font-size: .55rem;
      }
    }

    @media print {
      .series-card-layout-options {
        display: none !important;
      }
    }
  `;
  document.head.append(style);

  let optionGroup = null;

  function currentModeName() {
    if (mobileMedia.matches) return "mobile";
    if (compactMedia.matches) return "compact";
    return "desktop";
  }

  function readStoredColumns(modeName) {
    const config = MODE_CONFIG[modeName];
    try {
      const stored = window.localStorage.getItem(config.storageKey);
      if (config.columns.includes(stored)) return stored;

      const legacy = window.localStorage.getItem(config.legacyStorageKey);
      if (config.columns.includes(legacy)) return legacy;
    } catch {
      // 저장소 접근이 제한되어도 기본 배열로 정상 표시합니다.
    }
    return config.defaultColumns;
  }

  function saveColumns(modeName, columns) {
    try {
      window.localStorage.setItem(MODE_CONFIG[modeName].storageKey, columns);
    } catch {
      // 저장소 접근이 제한되어도 현재 화면의 배열 변경은 유지합니다.
    }
  }

  function syncButtons(columns, modeName) {
    if (!optionGroup) return;
    const allowed = MODE_CONFIG[modeName].columns;
    optionGroup.querySelectorAll("button[data-columns]").forEach((button) => {
      const visible = allowed.includes(button.dataset.columns);
      button.hidden = !visible;
      button.setAttribute(
        "aria-pressed",
        String(visible && button.dataset.columns === columns),
      );
    });
  }

  function applyColumns(columns, modeName = currentModeName()) {
    const config = MODE_CONFIG[modeName];
    const normalized = config.columns.includes(columns)
      ? columns
      : config.defaultColumns;
    document.documentElement.dataset.cardColumns = normalized;
    syncButtons(normalized, modeName);
  }

  function restoreForViewport() {
    // 공통 도감 레이아웃의 viewport 변경 처리 이후 시리즈 전용 설정을 다시 적용합니다.
    window.requestAnimationFrame(() => {
      const modeName = currentModeName();
      applyColumns(readStoredColumns(modeName), modeName);
    });
  }

  function buildLayoutOptions() {
    const resultsBar = document.querySelector(".catalog-panel .results-bar");
    if (!resultsBar) return false;

    let actions = resultsBar.querySelector(".results-bar-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "results-bar-actions";
      resultsBar.append(actions);
    }

    actions.querySelector(".card-layout-toggle")?.remove();
    actions.querySelector(".series-card-layout-options")?.remove();

    optionGroup = document.createElement("div");
    optionGroup.className = "series-card-layout-options";
    optionGroup.setAttribute("role", "group");
    optionGroup.setAttribute("aria-label", "카드 배열 선택");

    ["2", "3", "4"].forEach((columns) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.columns = columns;
      button.textContent = `${columns}열`;
      button.title = `카드를 한 줄에 ${columns}개씩 표시합니다.`;
      button.setAttribute("aria-label", `${columns}열로 보기`);
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        const modeName = currentModeName();
        if (!MODE_CONFIG[modeName].columns.includes(columns)) return;
        applyColumns(columns, modeName);
        saveColumns(modeName, columns);
      });
      optionGroup.append(button);
    });

    actions.append(optionGroup);
    restoreForViewport();
    return true;
  }

  function init() {
    if (buildLayoutOptions()) return;

    const observer = new MutationObserver(() => {
      if (!buildLayoutOptions()) return;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (typeof compactMedia.addEventListener === "function") {
    compactMedia.addEventListener("change", restoreForViewport);
    mobileMedia.addEventListener("change", restoreForViewport);
  } else {
    compactMedia.addListener(restoreForViewport);
    mobileMedia.addListener(restoreForViewport);
  }

  init();
})();
