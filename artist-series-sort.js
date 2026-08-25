"use strict";

(function () {
  const SERIES_DATA_URL = "./data/series.json";
  const SORT_STORAGE_KEY = "pokemonDexArtistSortV1";
  const ERA_ORDER = Object.freeze({ SM: 0, S: 1, SV: 2, M: 3 });
  const VALID_SORTS = new Set(["order", "name", "series"]);

  const seriesOrder = new Map();
  let seriesOrderReady = false;
  let restored = false;

  const normalizeCode = (value) => String(value || "").trim().toLowerCase();

  function inferEra(value) {
    const code = normalizeCode(value);
    if (code.startsWith("sm")) return "SM";
    if (code.startsWith("sv")) return "SV";
    if (code.startsWith("m")) return "M";
    if (code.startsWith("s")) return "S";
    return "";
  }

  function eraRank(value) {
    const era = inferEra(value);
    return Object.prototype.hasOwnProperty.call(ERA_ORDER, era)
      ? ERA_ORDER[era]
      : 99;
  }

  function compareNatural(left, right) {
    return String(left || "").localeCompare(String(right || ""), "en", {
      numeric: true,
      sensitivity: "base",
    });
  }

  function seriesKey(setCode) {
    const normalized = normalizeCode(setCode);
    const known = seriesOrder.get(normalized);
    if (known) return known;

    return {
      era: eraRank(normalized),
      index: Number.MAX_SAFE_INTEGER,
      code: normalized,
    };
  }

  function cardParts(article) {
    return {
      setCode: article.querySelector(".number-badge")?.textContent?.trim() || "",
      cardNumber: article.querySelector(".card-number")?.textContent?.trim() || "",
    };
  }

  function compareCards(leftArticle, rightArticle) {
    const left = cardParts(leftArticle);
    const right = cardParts(rightArticle);
    const leftSeries = seriesKey(left.setCode);
    const rightSeries = seriesKey(right.setCode);

    return (
      leftSeries.era - rightSeries.era ||
      leftSeries.index - rightSeries.index ||
      compareNatural(leftSeries.code, rightSeries.code) ||
      compareNatural(left.cardNumber, right.cardNumber)
    );
  }

  function currentSortMode() {
    return document.getElementById("artist-sort")?.value || "order";
  }

  function applySeriesSort() {
    if (currentSortMode() !== "series") return;

    const grid = document.getElementById("artist-card-grid");
    if (!grid) return;

    const cards = [...grid.querySelectorAll(":scope > .artist-card")];
    if (cards.length < 2) return;

    const sorted = [...cards].sort(compareCards);
    const alreadySorted = sorted.every((card, index) => card === cards[index]);
    if (!alreadySorted) grid.append(...sorted);
  }

  function saveSortMode(value) {
    if (!VALID_SORTS.has(value)) return;
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch {
      // 저장소 접근이 제한되어도 현재 페이지의 정렬은 정상 동작합니다.
    }
  }

  function readSortMode() {
    try {
      const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
      return VALID_SORTS.has(stored) ? stored : "order";
    } catch {
      return "order";
    }
  }

  function prepareSortControl() {
    const select = document.getElementById("artist-sort");
    if (!select) return false;

    const setOption = select.querySelector('option[value="set"]');
    if (setOption) {
      setOption.value = "series";
      setOption.textContent = "시리즈순";
    } else if (!select.querySelector('option[value="series"]')) {
      const option = document.createElement("option");
      option.value = "series";
      option.textContent = "시리즈순";
      select.append(option);
    }

    select.addEventListener("change", () => {
      saveSortMode(select.value);
      window.requestAnimationFrame(applySeriesSort);
    });
    return true;
  }

  async function loadSeriesOrder() {
    try {
      const response = await fetch(SERIES_DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const groups = await response.json();
      const counters = new Map();

      groups.forEach((group) => {
        const code = normalizeCode(group?.code || group?.name);
        if (!code) return;

        const era = String(group?.era || inferEra(code)).toUpperCase();
        const rank = Object.prototype.hasOwnProperty.call(ERA_ORDER, era)
          ? ERA_ORDER[era]
          : 99;
        const count = counters.get(rank) || 0;
        counters.set(rank, count + 1);
        seriesOrder.set(code, { era: rank, index: count, code });
      });
      seriesOrderReady = true;
      applySeriesSort();
    } catch (error) {
      console.warn("작가도감 시리즈 순서 데이터를 불러오지 못했습니다.", error);
    }
  }

  function restoreAfterArtistRender() {
    if (restored) return;
    const select = document.getElementById("artist-sort");
    const grid = document.getElementById("artist-card-grid");
    if (!select || !grid || !grid.children.length) return;

    restored = true;
    const stored = readSortMode();
    select.value = stored;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    if (stored === "series") window.requestAnimationFrame(applySeriesSort);
  }

  function observeArtistGrid() {
    const grid = document.getElementById("artist-card-grid");
    if (!grid) return false;

    const observer = new MutationObserver(() => {
      restoreAfterArtistRender();
      if (currentSortMode() === "series") applySeriesSort();
    });
    observer.observe(grid, { childList: true });
    restoreAfterArtistRender();
    return true;
  }

  function init() {
    if (!prepareSortControl()) return;
    if (!observeArtistGrid()) return;
    void loadSeriesOrder();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
