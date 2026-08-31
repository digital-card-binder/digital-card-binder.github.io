"use strict";

(function () {
  function ensureStormEmeraldaPack() {
    if (typeof packs === "undefined" || !Array.isArray(packs)) return;
    if (packs.some((pack) => String(pack?.code || "").toLowerCase() === "m6")) return;

    packs.push({
      era: "M",
      name: "스톰에메랄다",
      code: "m6",
      displayCode: "m6",
      legacyOwned: false,
      owned: false,
      i: packs.length,
    });

    if (typeof drawSummary === "function") drawSummary();
    if (typeof render === "function") render();
  }

  function addStyles() {
    if (document.getElementById("promo-quick-search-style")) return;
    const style = document.createElement("style");
    style.id = "promo-quick-search-style";
    style.textContent = `
      .promo-search-help {
        grid-column: 1 / -1;
        margin: -4px 0 0;
        color: #6f7b90;
        font-size: .74rem;
        line-height: 1.55;
      }
      .promo-search-help strong { color: #263550; }
      .promo-quick-suggestions {
        grid-column: 1 / -1;
        display: grid;
        gap: 8px;
        margin-top: -4px;
      }
      .promo-quick-suggestions[hidden] { display: none; }
      .promo-quick-suggestion {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px 14px;
        width: 100%;
        padding: 11px 13px;
        border: 1px solid #d9e0eb;
        border-radius: 12px;
        background: #fff;
        color: #263550;
        cursor: pointer;
        text-align: left;
      }
      .promo-quick-suggestion:hover,
      .promo-quick-suggestion:focus-visible {
        border-color: #9eabc0;
        background: #f8faff;
        outline: none;
      }
      .promo-quick-suggestion strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: .82rem;
      }
      .promo-quick-suggestion span {
        color: #758096;
        font-size: .68rem;
      }
      .promo-quick-suggestion b {
        align-self: center;
        grid-row: 1 / span 2;
        grid-column: 2;
        padding: 4px 8px;
        border-radius: 999px;
        background: #edf2f8;
        color: #4f5d75;
        font-size: .65rem;
        white-space: nowrap;
      }
      @media (max-width: 690px) {
        .promo-quick-suggestion { grid-template-columns: minmax(0, 1fr); }
        .promo-quick-suggestion b { grid-row: auto; grid-column: auto; justify-self: start; }
      }
    `;
    document.head.append(style);
  }

  function addPromoShortcut() {
    const host = document.getElementById("era-filters");
    const promoPanel = document.querySelector(".promo-catalog-panel");
    if (!host || !promoPanel || host.querySelector('[data-era="PROMO"]')) return;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "PROMO";
    button.dataset.era = "PROMO";
    button.setAttribute("aria-label", "프로모 컬렉션으로 이동");
    button.addEventListener("click", () => {
      host.querySelectorAll("button").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      promoPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => document.getElementById("promo-search")?.focus({ preventScroll: true }), 450);
    });
    host.append(button);
  }

  function searchText(pack) {
    return normalizeSearch([
      pack.name,
      pack.cardNumber,
      pack.era,
      promoEraLabels?.[pack.era],
      pack.year,
      pack.description,
      ...(pack.keywords || []),
    ].filter(Boolean).join(" "));
  }

  function candidateScore(pack, query) {
    const name = normalizeSearch(pack.name);
    const number = normalizeSearch(pack.cardNumber);
    if (number && number === query) return 0;
    if (name === query) return 1;
    if (number && number.startsWith(query)) return 2;
    if (name.startsWith(query)) return 3;
    return 4;
  }

  function addQuickSearch() {
    const input = document.getElementById("promo-search");
    const panel = document.querySelector(".promo-search-panel");
    if (!input || !panel || document.getElementById("promo-quick-suggestions")) return;

    input.placeholder = "포켓몬 이름 또는 카드번호 입력 (예: 피카츄, 173/SV-P)";

    const help = document.createElement("p");
    help.className = "promo-search-help";
    help.innerHTML = "<strong>프로모 유형을 몰라도 괜찮습니다.</strong> 포켓몬 이름이나 카드번호만 입력하면 전체 프로모 DB에서 후보를 찾아드립니다.";

    const suggestions = document.createElement("div");
    suggestions.id = "promo-quick-suggestions";
    suggestions.className = "promo-quick-suggestions";
    suggestions.hidden = true;
    suggestions.setAttribute("aria-label", "프로모 후보 목록");

    panel.append(help, suggestions);

    function renderSuggestions() {
      const query = normalizeSearch(input.value);
      suggestions.replaceChildren();
      if (!query || typeof allPromoPacks !== "function") {
        suggestions.hidden = true;
        return;
      }

      const matches = allPromoPacks()
        .filter((pack) => searchText(pack).includes(query))
        .sort((a, b) => candidateScore(a, query) - candidateScore(b, query)
          || (b.year || 0) - (a.year || 0)
          || a.name.localeCompare(b.name, "ko"))
        .slice(0, 8);

      if (!matches.length) {
        suggestions.hidden = true;
        return;
      }

      matches.forEach((pack) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "promo-quick-suggestion";

        const title = document.createElement("strong");
        title.textContent = pack.name;
        const meta = document.createElement("span");
        meta.textContent = [pack.cardNumber, promoEraLabels?.[pack.era], pack.year]
          .filter(Boolean)
          .join(" · ") || "번호 미확인";
        const type = document.createElement("b");
        type.textContent = promoTypeLabels?.[pack.type] || "유형 미확인";
        option.append(title, meta, type);

        option.addEventListener("click", () => {
          const eraSelect = document.getElementById("promo-era-filter");
          const typeSelect = document.getElementById("promo-type-filter");
          if (eraSelect) {
            eraSelect.value = "all";
            eraSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }
          if (typeSelect) {
            typeSelect.value = "all";
            typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }

          input.value = pack.cardNumber || pack.name;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          suggestions.hidden = true;
          window.setTimeout(() => {
            document.getElementById("promo-results")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
          }, 30);
        });
        suggestions.append(option);
      });
      suggestions.hidden = false;
    }

    input.addEventListener("input", renderSuggestions);
    input.addEventListener("focus", renderSuggestions);
    document.addEventListener("click", (event) => {
      if (!panel.contains(event.target)) suggestions.hidden = true;
    });
  }

  function init() {
    ensureStormEmeraldaPack();
    addStyles();
    addPromoShortcut();
    addQuickSearch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
