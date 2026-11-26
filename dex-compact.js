"use strict";

/* 도감 상단 압축.
   기존 컨트롤을 새로 만들지 않고 위치만 옮겨 이벤트 연결을 그대로 유지한다.
   수집 데이터와 저장 로직은 읽거나 바꾸지 않는다. */
(function () {
  const SEARCH = ".search-field, .art-theme-search-field, .fossil-search-field";
  const SURFACES =
    ".filter-panel, .pack-filter-panel, .artist-filter-panel, .people-filter-panel, .fossil-filter-panel, .tp-filter-panel, .art-theme-filter-panel, .catalog-toolbar";
  const MENU_ITEMS = [
    ".series-scope-switch",
    "#ar-rarity-chips",
    ".filter-panel > .filter-row",
    ".people-filter-groups",
    ".artist-filter-row",
    ".tp-filter-row",
    ".pack-filter-row",
    ".fossil-filter-panel > .fossil-select-field",
  ].join(",");
  const LAYOUT_GROUPS = ".series-card-layout-options, .card-layout-options";

  let tools, searchSlot, menus, columnButton, scheduled = false;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    if (tag === "button") node.type = "button";
    return node;
  };
  const set = (node, key, value) => {
    if (node[key] !== value) node[key] = value;
  };
  const mainPanel = () => document.querySelector(".catalog-panel:not(.promo-catalog-panel)");

  function buildHero(hero) {
    if (hero.querySelector(".dex-progress")) return;
    const bar = make("div", "dex-progress");
    bar.setAttribute("aria-hidden", "true");
    bar.append(make("i"));
    hero.append(bar);
    const copy = hero.querySelector(".hero-progress-copy");
    if (copy) copy.append(make("em", "dex-rate"));
  }

  function syncHero() {
    const hero = document.querySelector(".collector-collection-hero");
    const source = hero?.querySelector(".progress-ring strong");
    if (!source) return;
    const text = source.textContent.trim();
    const number = parseFloat(text);
    const percent = Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
    const fill = hero.querySelector(".dex-progress i");
    if (fill) set(fill.style, "width", `${percent}%`);
    const label = hero.querySelector(".dex-rate");
    if (label) set(label, "textContent", Number.isFinite(number) ? `${number}%` : "—");
  }

  function buildTools(quick) {
    tools = make("div", "dex-tools");
    searchSlot = make("div", "dex-search");
    menus = make("div", "dex-menus");
    tools.append(searchSlot, menus);
    (quick.closest(".collector-sticky-selector-stack") || quick).after(tools);
  }

  /* 시리즈 첫 화면은 보기 탭이 목록 아래에 있어, 메뉴를 시리즈 분류 위에 둔다. */
  function placeTools(quick) {
    const era = document.querySelector(".catalog-era-filter");
    const overview = document.body.classList.contains("series-dashboard-mode");
    if (overview && era) {
      if (era.previousElementSibling !== tools) era.before(tools);
      return;
    }
    const anchor = quick.closest(".collector-sticky-selector-stack") || quick;
    if (anchor.nextElementSibling !== tools) anchor.after(tools);
  }

  function relocate() {
    const panel = mainPanel();
    if (!panel) return;
    if (!searchSlot.firstElementChild) {
      for (const surface of panel.querySelectorAll(SURFACES)) {
        const field = surface.matches(SEARCH) ? surface : surface.querySelector(SEARCH);
        if (field) {
          searchSlot.append(field);
          break;
        }
      }
    }
    // 모든 도감의 보기 메뉴는 창 안에 숨기지 않고 검색창 아래에 항상 보여준다.
    // 이미 옮긴 노드는 다시 붙이지 않는다(포커스 유실·갱신 반복 방지).
    for (const item of panel.querySelectorAll(MENU_ITEMS)) {
      if (!menus.contains(item)) menus.append(item);
    }
    for (const button of panel.querySelectorAll(".results-bar-actions button, .catalog-actions button")) {
      if (button.textContent.includes("인쇄") && !menus.contains(button)) menus.append(button);
    }
    labelChoiceGroups();
    for (const surface of panel.querySelectorAll(SURFACES)) {
      const used = [...surface.children].some(
        (child) =>
          !child.hidden &&
          !child.matches(".collector-status-source, .collector-redundant-filter-row"),
      );
      surface.classList.toggle("dex-emptied", !used);
    }
  }

  /* 버튼 묶음에는 어느 도감에서나 같은 방식의 이름표를 붙인다. */
  function labelChoiceGroups() {
    for (const group of menus.querySelectorAll(".pill-group:not(.collector-status-source)")) {
      if (group.parentElement.querySelector(":scope > .filter-label")) continue;
      const box = make("div", "filter-group");
      group.before(box);
      const name = (group.getAttribute("aria-label") || "").replace(/\s*선택$/, "").replace(/^팩\s*/, "");
      box.append(make("span", "filter-label", name || "분류"), group);
    }
  }

  function layoutChoices() {
    const group = mainPanel()?.querySelector(LAYOUT_GROUPS);
    if (!group) return [];
    return [...group.querySelectorAll("button[data-columns]")].filter(
      (button) => !button.hidden && button.style.display !== "none",
    );
  }

  function nextLayoutChoice() {
    const choices = layoutChoices();
    if (choices.length < 2) return null;
    const current = document.documentElement.dataset.cardColumns;
    let index = choices.findIndex((button) => button.dataset.columns === current);
    if (index < 0) index = choices.findIndex((button) => button.getAttribute("aria-pressed") === "true");
    return choices[(index + 1) % choices.length];
  }

  function syncColumnButton(quick) {
    const next = nextLayoutChoice();
    if (!next) return;
    if (!columnButton) {
      columnButton = make("button", "dex-columns-button");
      columnButton.addEventListener("click", () => {
        nextLayoutChoice()?.click();
        schedule();
      });
      quick.append(columnButton);
      document.body.classList.add("dex-has-column-button");
    }
    const label = `${next.dataset.columns}열`;
    set(columnButton, "textContent", label);
    columnButton.setAttribute("aria-label", `${label}로 보기`);
  }

  /* 메뉴에서 기본값이 아닌 조건이 선택돼 있는지 확인한다. */
  function hasActiveChoice() {
    if ([...menus.querySelectorAll("select")].some((select) => select.selectedIndex > 0)) return true;
    if (menus.querySelector('input[type="checkbox"]:checked')) return true;
    const groups = new Set(
      [...menus.querySelectorAll("button")]
        .filter((button) => !button.closest(".collector-status-source"))
        .map((button) => button.parentElement),
    );
    return [...groups].some((group) => {
      const buttons = [...group.children].filter((child) => child.tagName === "BUTTON");
      return buttons.findIndex(
        (button) =>
          button.classList.contains("is-active") || button.getAttribute("aria-pressed") === "true",
      ) > 0;
    });
  }

  function syncResultsBar() {
    // 검색·필터가 없고 별도 작업 버튼도 없으면 결과 줄을 접는다.
    const results = mainPanel()?.querySelector(".results-bar:not(.promo-results-bar)");
    if (!results) return;
    const searching = Boolean(searchSlot.querySelector("input")?.value.trim());
    const status = document.querySelector(".collector-quick-controls [data-quick-status].is-active");
    const narrowed = searching || hasActiveChoice() || (status && status.dataset.quickStatus !== "all");
    const hasAction = [...results.querySelectorAll(".results-bar-actions > *")].some(
      (node) => !node.matches(LAYOUT_GROUPS) && !node.hidden && getComputedStyle(node).display !== "none",
    );
    results.classList.toggle("dex-idle", !narrowed && !hasAction);
    results.classList.toggle("dex-quiet", !narrowed);
  }

  function refresh() {
    scheduled = false;
    const quick = document.querySelector(".collector-quick-controls");
    if (!quick || !document.body.classList.contains("collector-simple-dex")) return;
    const hero = document.querySelector(".collector-collection-hero");
    if (!hero) return;
    document.body.classList.add("dex-compact");
    buildHero(hero);
    syncHero();
    syncColumnButton(quick);
    if (!mainPanel()?.querySelector(".results-bar")) return;
    if (!tools) buildTools(quick);
    relocate();
    placeTools(quick);
    syncResultsBar();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(refresh);
  }

  function start() {
    const main = document.querySelector("main");
    if (!main) return;
    new MutationObserver(schedule).observe(main, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-pressed"],
    });
    for (const type of ["input", "change", "click"]) document.addEventListener(type, schedule);
    window.addEventListener("resize", schedule);
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
