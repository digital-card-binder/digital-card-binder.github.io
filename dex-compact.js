"use strict";

/* 도감 상단 압축.
   기존 컨트롤을 새로 만들지 않고 위치만 옮겨 이벤트 연결을 그대로 유지한다.
   수집 데이터와 저장 로직은 읽거나 바꾸지 않는다. */
(function () {
  const SEARCH = ".search-field, .art-theme-search-field, .fossil-search-field";
  const SURFACES =
    ".filter-panel, .pack-filter-panel, .artist-filter-panel, .people-filter-panel, .fossil-filter-panel, .tp-filter-panel, .art-theme-filter-panel, .catalog-toolbar";
  const SHEET_ITEMS = [
    ".filter-panel > .filter-row",
    ".people-filter-groups",
    ".artist-filter-row",
    ".tp-filter-row",
    ".pack-filter-row",
    ".fossil-filter-panel > .fossil-select-field",
  ].join(",");
  const LAYOUT_GROUPS = ".series-card-layout-options, .card-layout-options";

  let tools, searchSlot, inlineSlot, filterButton, chips, sheet, sheetBody, columnButton, scheduled = false;

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
    filterButton = make("button", "dex-filter-button", "필터");
    filterButton.setAttribute("aria-haspopup", "dialog");
    chips = make("div", "dex-chips");
    inlineSlot = make("div", "dex-inline");
    tools.append(searchSlot, filterButton, inlineSlot, chips);
    (quick.closest(".collector-sticky-selector-stack") || quick).after(tools);

    sheet = make("dialog", "dex-sheet");
    sheet.setAttribute("aria-labelledby", "dex-sheet-title");
    const head = make("div", "dex-sheet-head");
    const title = make("h2", "", "필터와 보기");
    title.id = "dex-sheet-title";
    const close = make("button", "dex-sheet-close", "닫기");
    close.addEventListener("click", () => sheet.close());
    head.append(title, close);
    sheetBody = make("div", "dex-sheet-body");
    const done = make("button", "dex-sheet-done", "카드 보기");
    done.addEventListener("click", () => sheet.close());
    sheet.append(head, sheetBody, done);
    sheet.addEventListener("click", (event) => {
      if (event.target === sheet) sheet.close();
    });
    sheet.addEventListener("close", schedule);
    // 인쇄는 필터 창을 먼저 닫고 기존 버튼 동작을 실행한다.
    sheetBody.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button");
        if (button && (button.textContent.includes("인쇄") || button.dataset.era === "PROMO")) {
          sheet.close();
        }
      },
      true,
    );
    document.querySelector("main").append(sheet);
    filterButton.addEventListener("click", () => sheet.showModal());
  }

  /* 시리즈 첫 화면은 보기 탭이 목록 아래에 있어, 필터를 분류 위에 둔다. */
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
    // 자주 바꾸는 도감 구성·포켓몬만 보기는 필터에 넣지 않고 항상 보여준다.
    const scope = panel.querySelector(".series-scope-switch");
    // 이미 옮긴 노드는 다시 붙이지 않는다(포커스 유실·갱신 반복 방지).
    if (scope && scope.parentNode !== inlineSlot) inlineSlot.append(scope);
    for (const item of panel.querySelectorAll(SHEET_ITEMS)) sheetBody.append(item);
    for (const button of panel.querySelectorAll(".results-bar-actions button, .catalog-actions button")) {
      if (button.textContent.includes("인쇄")) sheetBody.append(button);
    }
    for (const surface of panel.querySelectorAll(SURFACES)) {
      const used = [...surface.children].some(
        (child) =>
          !child.hidden &&
          !child.matches(".collector-status-source, .collector-redundant-filter-row"),
      );
      surface.classList.toggle("dex-emptied", !used);
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

  /* 필터 창 안에서 기본값이 아닌 조건을 찾는다. */
  function activeFilters() {
    const found = [];
    for (const select of sheetBody.querySelectorAll("select")) {
      if (select.selectedIndex > 0) {
        found.push({
          label: select.options[select.selectedIndex].textContent.trim(),
          reset() {
            select.selectedIndex = 0;
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
          },
        });
      }
    }
    const groups = new Set(
      [...sheetBody.querySelectorAll("button")]
        .filter((button) => !button.closest(".collector-status-source"))
        .map((button) => button.parentElement),
    );
    for (const group of groups) {
      const buttons = [...group.children].filter((child) => child.tagName === "BUTTON");
      const index = buttons.findIndex(
        (button) =>
          button.classList.contains("is-active") || button.getAttribute("aria-pressed") === "true",
      );
      if (buttons.length > 1 && index > 0) {
        const label = buttons[index].textContent.trim().replace(/\s+/g, " ");
        const position = () => group.children;
        found.push({ label, reset: () => [...position()].find((c) => c.tagName === "BUTTON")?.click() });
      }
    }
    for (const box of sheetBody.querySelectorAll('input[type="checkbox"]')) {
      if (box.checked) {
        const text = box.closest("label")?.querySelector("strong")?.textContent;
        found.push({
          label: (text || box.getAttribute("aria-label") || "추가 조건").trim(),
          reset: () => box.click(),
        });
      }
    }
    return [...new Map(found.map((filter) => [filter.label, filter])).values()];
  }

  let chipSignature = "";
  function syncFilterState() {
    const hasItems = sheetBody.childElementCount > 0;
    set(filterButton, "hidden", !hasItems);
    const filters = hasItems ? activeFilters() : [];
    set(filterButton, "textContent", filters.length ? `필터 ${filters.length}` : "필터");
    const signature = filters.map((filter) => filter.label).join("|");
    if (signature !== chipSignature) {
      chipSignature = signature;
      chips.replaceChildren(
        ...filters.map((filter) => {
          const chip = make("button", "dex-chip", `${filter.label} ×`);
          chip.setAttribute("aria-label", `${filter.label} 해제`);
          chip.addEventListener("click", () => {
            filter.reset();
            schedule();
          });
          return chip;
        }),
      );
    }
    set(chips, "hidden", filters.length === 0);

    // 검색·필터가 없고 별도 작업 버튼도 없으면 결과 줄을 접는다.
    const results = mainPanel()?.querySelector(".results-bar:not(.promo-results-bar)");
    if (!results) return;
    const searching = Boolean(searchSlot.querySelector("input")?.value.trim());
    const status = document.querySelector(".collector-quick-controls [data-quick-status].is-active");
    const pokemonOnly = Boolean(inlineSlot.querySelector('input[type="checkbox"]')?.checked);
    const narrowed = searching || pokemonOnly || filters.length > 0 || (status && status.dataset.quickStatus !== "all");
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
    syncFilterState();
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
