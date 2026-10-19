"use strict";

(() => {
  const TARGET_SERIES = "sv1S";
  const PRICE_DATA_URL = "./data/prices-sv1s.json";
  let priceData = null;
  let refreshQueued = false;

  const formatKrw = (value) =>
    `₩${Math.round(Number(value) || 0).toLocaleString("ko-KR")}`;

  const currentSeriesCode = () => {
    try {
      return selected?.code || "";
    } catch {
      return "";
    }
  };

  const currentCards = () => {
    try {
      return Array.isArray(cards) ? cards : [];
    } catch {
      return [];
    }
  };

  function priceEntryForCode(code) {
    const entry = priceData?.prices?.[code];
    return Number.isFinite(Number(entry?.price)) && Number(entry.price) > 0
      ? entry
      : null;
  }

  function ensureBinderValuePanel() {
    let panel = document.getElementById("selected-market-value");
    if (panel) return panel;

    const summary = document.querySelector(".catalog-summary");
    if (!summary) return null;

    panel = document.createElement("section");
    panel.id = "selected-market-value";
    panel.className = "binder-market-value";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="binder-market-value__main">
        <span>내 바인더 예상 시세</span>
        <strong id="selected-market-total">—</strong>
      </div>
      <div class="binder-market-value__meta">
        <span id="selected-market-coverage">—</span>
        <small>번개장터 공개 매물 기반 참고시세</small>
      </div>
    `;
    summary.after(panel);
    return panel;
  }

  function updateBinderValue() {
    const panel = ensureBinderValuePanel();
    if (!panel) return;

    const active = currentSeriesCode() === TARGET_SERIES && priceData;
    panel.hidden = !active;
    if (!active) return;

    const allCards = currentCards();
    const ownedCards = allCards.filter((card) => Boolean(card.owned));
    let total = 0;
    let pricedOwned = 0;

    ownedCards.forEach((card) => {
      const entry = priceEntryForCode(card.code || card.meta || "");
      if (!entry) return;
      total += Number(entry.price);
      pricedOwned += 1;
    });

    const totalPriceCoverage = allCards.filter((card) =>
      Boolean(priceEntryForCode(card.code || card.meta || "")),
    ).length;

    const totalEl = document.getElementById("selected-market-total");
    const coverageEl = document.getElementById("selected-market-coverage");
    if (totalEl) totalEl.textContent = formatKrw(total);
    if (coverageEl) {
      coverageEl.textContent = `보유 ${ownedCards.length}장 중 시세 확인 ${pricedOwned}장 · 전체 ${totalPriceCoverage}/${allCards.length}장 시세 확인`;
    }
  }

  function decorateVisibleCards() {
    const active = currentSeriesCode() === TARGET_SERIES && priceData;
    document.querySelectorAll("#catalog-grid .catalog-card").forEach((article) => {
      let priceEl = article.querySelector(".card-market-price");
      if (!active) {
        priceEl?.remove();
        return;
      }

      const code = article.querySelector(".card-meta")?.textContent?.trim() || "";
      const entry = priceEntryForCode(code);
      const body = article.querySelector(".card-body");
      if (!body) return;

      if (!priceEl) {
        priceEl = document.createElement("span");
        priceEl.className = "card-market-price";
        body.append(priceEl);
      }

      const nextText = entry
        ? `참고시세 ${formatKrw(entry.price)}`
        : "시세 정보 없음";
      if (priceEl.textContent !== nextText) priceEl.textContent = nextText;
      priceEl.classList.toggle("is-unavailable", !entry);
      priceEl.title = entry
        ? `${priceData.sourceLabel} · ${priceData.updatedAt}`
        : "확인 가능한 번개장터 단품 매물이 부족합니다.";
    });
  }

  function updateDialogPrice() {
    const dialog = document.getElementById("catalog-dialog");
    const details = dialog?.querySelector(".dialog-details");
    if (!details) return;

    let row = document.getElementById("dialog-market-price-row");
    const active = currentSeriesCode() === TARGET_SERIES && priceData;
    if (!active) {
      row?.remove();
      return;
    }

    const code = document.getElementById("dialog-meta")?.textContent?.trim() || "";
    const entry = priceEntryForCode(code);
    if (!row) {
      row = document.createElement("div");
      row.id = "dialog-market-price-row";
      row.innerHTML = "<dt>참고시세</dt><dd id=\"dialog-market-price\"></dd>";
      details.append(row);
    }
    const value = document.getElementById("dialog-market-price");
    if (value) {
      value.textContent = entry ? formatKrw(entry.price) : "시세 정보 없음";
      value.classList.toggle("is-unavailable", !entry);
    }
  }

  function refreshMarketUi() {
    refreshQueued = false;
    decorateVisibleCards();
    updateBinderValue();
    updateDialogPrice();
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(refreshMarketUi);
  }

  async function loadPriceData() {
    try {
      const response = await fetch(PRICE_DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`price data: ${response.status}`);
      const data = await response.json();
      if (data?.series !== TARGET_SERIES || data?.source !== "bunjang") {
        throw new Error("Unexpected Scarlet ex price data source");
      }
      priceData = data;
      scheduleRefresh();
    } catch (error) {
      console.warn("Scarlet ex market price data unavailable", error);
    }
  }

  function startObservers() {
    const grid = document.getElementById("catalog-grid");
    const selectedProgress = document.getElementById("selected-progress");
    if (grid) {
      new MutationObserver(scheduleRefresh).observe(grid, {
        childList: true,
        subtree: true,
      });
      grid.addEventListener("click", () => setTimeout(scheduleRefresh, 0));
    }
    if (selectedProgress) {
      new MutationObserver(scheduleRefresh).observe(selectedProgress, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  }

  startObservers();
  void loadPriceData();
})();
