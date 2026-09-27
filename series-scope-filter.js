"use strict";

(function () {
  if (document.body.dataset.catalog !== "series") return;

  const params = new URLSearchParams(window.location.search);
  const activeScope = params.get("scope") === "base" ? "base" : "all";
  const nativeFetch = window.fetch.bind(window);
  const RESTORE_KEY = "pokemonDexSeriesScopeRestoreV1";

  function cardRange(card) {
    const raw = String(card?.code || card?.meta || "");
    const match = raw.match(/_(\d+)\/(\d+)/);
    if (!match) return null;
    return { number: Number(match[1]), denominator: Number(match[2]) };
  }

  function isBaseCard(card) {
    const range = cardRange(card);
    return !range || range.number <= range.denominator;
  }

  function filterBaseGroups(groups) {
    if (!Array.isArray(groups) || activeScope !== "base") return groups;
    return groups.map((group) => ({
      ...group,
      cards: (group.cards || []).filter(isBaseCard),
    }));
  }

  window.fetch = async function seriesScopeFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    let isSeriesData = false;
    try {
      isSeriesData = new URL(url, window.location.href).pathname.endsWith("/data/series.json");
    } catch {
      isSeriesData = false;
    }

    const response = await nativeFetch(input, init);
    if (!isSeriesData || !response.ok || activeScope !== "base") return response;

    try {
      const scoped = filterBaseGroups(await response.clone().json());
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(scoped), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.warn("기본 수록 필터를 적용하지 못했습니다.", error);
      return response;
    }
  };

  function rememberView() {
    try {
      const era = document.querySelector("#catalog-era button.is-active")?.dataset.era || "";
      const group = document.querySelector("#catalog-select")?.value || "";
      const status = document.querySelector("#catalog-status button.is-active")?.dataset.status || "all";
      const query = document.querySelector("#catalog-search")?.value || "";
      sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ era, group, status, query }));
    } catch {
      // 저장소가 제한되어도 필터 전환은 계속 동작합니다.
    }
  }

  function switchScope(nextScope) {
    if (nextScope === activeScope) return;
    rememberView();
    const next = new URL(window.location.href);
    if (nextScope === "base") next.searchParams.set("scope", "base");
    else next.searchParams.delete("scope");
    window.location.assign(next.href);
  }

  function addScopeControl() {
    const row = document.querySelector(".catalog-filter-row");
    if (!row || document.querySelector("#catalog-scope")) return;

    const control = document.createElement("div");
    control.id = "catalog-scope";
    control.className = "segmented-control";
    control.setAttribute("role", "group");
    control.setAttribute("aria-label", "수록 구분");
    control.innerHTML = `
      <button type="button" data-scope="all" class="${activeScope === "all" ? "is-active" : ""}">전체</button>
      <button type="button" data-scope="base" class="${activeScope === "base" ? "is-active" : ""}">기본 수록</button>
    `;
    control.querySelectorAll("button[data-scope]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.scope === activeScope));
      button.addEventListener("click", () => switchScope(button.dataset.scope));
    });
    row.prepend(control);

    if (activeScope === "base") {
      const caption = document.querySelector(".catalog-caption");
      if (caption) {
        caption.textContent = "기본 수록은 각 세트의 분모 번호까지 표시하며, 분모를 초과하는 AR·SR·SAR 등은 제외됩니다.";
      }
    }
  }

  function restoreView() {
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(RESTORE_KEY) || "null");
      sessionStorage.removeItem(RESTORE_KEY);
    } catch {
      saved = null;
    }
    if (!saved) return;

    let attempts = 0;
    const restore = () => {
      attempts += 1;
      const select = document.querySelector("#catalog-select");
      if (!select?.options?.length) {
        if (attempts < 40) window.setTimeout(restore, 50);
        return;
      }

      if (saved.era) {
        const eraButton = document.querySelector(`#catalog-era button[data-era="${saved.era}"]`);
        if (eraButton && !eraButton.classList.contains("is-active")) eraButton.click();
      }

      window.setTimeout(() => {
        const currentSelect = document.querySelector("#catalog-select");
        if (saved.group && currentSelect && [...currentSelect.options].some((option) => option.value === saved.group)) {
          currentSelect.value = saved.group;
          currentSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (saved.status) {
          document.querySelector(`#catalog-status button[data-status="${saved.status}"]`)?.click();
        }
        const search = document.querySelector("#catalog-search");
        if (search && saved.query) {
          search.value = saved.query;
          search.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, 0);
    };
    restore();
  }

  addScopeControl();
  window.addEventListener("load", restoreView, { once: true });
})();

window.addEventListener(
  "DOMContentLoaded",
  () => {
    if (document.body.dataset.catalog !== "series") return;

    if (!document.querySelector('link[data-series-market-price]')) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = "./series-market-price.css?v=20260831-1";
      style.dataset.seriesMarketPrice = "";
      document.head.append(style);
    }

    if (!document.querySelector('script[data-series-market-price]')) {
      const script = document.createElement("script");
      script.src = "./series-market-price.js?v=20260831-1";
      script.dataset.seriesMarketPrice = "";
      document.head.append(script);
    }
  },
  { once: true },
);
