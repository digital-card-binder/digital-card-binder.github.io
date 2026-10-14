"use strict";

/*
 * Series catalog product group UI.
 * Presentation only: never modifies source sets, card identities, ownership or counts.
 * A code override wins; names and standard expansion codes provide fallback categories.
 */
(function () {
  if (document.body.dataset.catalog !== "series") return;

  const TYPES = Object.freeze([
    { key: "expansion", label: "확장팩 · 강화 확장팩", note: "하이클래스팩 포함" },
    { key: "starter", label: "스타터덱 · 구축덱", note: "스타터·구축 상품" },
    { key: "special", label: "스페셜 · 기획상품", note: "특별 구성 상품" },
    { key: "promo", label: "프로모 카드", note: "프로모 전용 세트" },
    { key: "other", label: "기타 세트", note: "상품 유형 확인 대상" },
  ]);

  // Korean set codes currently requiring explicit grouping.
  // Future exceptions can be added without changing master card data.
  const OVERRIDES = Object.freeze({
    SVM: "starter",
    SVN: "starter",
    SVOD: "special",
    SVOM: "special",
  });

  function classifySeriesProduct(code, name) {
    const key = String(code || "").trim().replace(/\s+/g, "").toUpperCase();
    const title = String(name || "").trim();
    if (Object.prototype.hasOwnProperty.call(OVERRIDES, key)) {
      return OVERRIDES[key];
    }
    if (/^(?:PROMO|PROMONO|[A-Z]{1,3}-P|[A-Z]{1,3}P)$/.test(key) ||
        /프로모\s*카드|프로모션\s*카드/i.test(title)) {
      return "promo";
    }
    if (/스타터|구축\s*덱|구축덱|스타트\s*덱|스타트덱|스타터\s*세트|스타트\s*세트|배틀\s*덱|덱\s*세트|덱\s*빌드|DECK|STARTER/i.test(title)) {
      return "starter";
    }
    if (/스페셜|프리미엄|기념\s*세트|기념\s*박스|기획\s*세트|컬렉션\s*박스|특별\s*세트|BOX|점보\s*카드/i.test(title)) {
      return "special";
    }
    // Official expansion/strengthened/high-class pack product-code families.
    if (/^(?:SV|SM|BW|XY|DP|ADV|BS|CP|S|M)\d/i.test(key) ||
        /(?:강화\s*)?확장팩|하이클래스팩|컨셉팩/i.test(title)) {
      return "expansion";
    }
    if (/세트|컬렉션|기념|스페셜|프리미엄/i.test(title)) {
      return "special";
    }
    return "other";
  }

  // Expose a pure classifier for console diagnostics and non-destructive tests.
  window.DigitalCardBinderSeriesProductTypes = Object.freeze({
    classify: classifySeriesProduct,
    types: TYPES.map((type) => ({ key: type.key, label: type.label })),
  });

  const dashboard = document.getElementById("series-dashboard");
  const chooser = document.getElementById("catalog-select");
  if (!dashboard) return;

  // Per-era accordion choices survive dashboard redraws, without affecting saved cards.
  const openChoices = new Map();
  function eraKey() {
    return document.querySelector("#catalog-era button.is-active")?.dataset.era || "ALL";
  }

  function productTypeOfCard(node) {
    const code = node.querySelector(".series-dashboard-code")?.textContent || node.dataset.group;
    const name = node.querySelector(".series-set-wordmark")?.textContent || "";
    return classifySeriesProduct(code, name);
  }

  function setCounts(nodes) {
    let owned = 0;
    let total = 0;
    for (const node of nodes) {
      const text = node.querySelector(".series-dashboard-metrics strong")?.textContent || "";
      const match = text.match(/([\d,]+)\s*\/\s*([\d,]+)/);
      if (!match) continue;
      owned += Number(match[1].replace(/,/g, ""));
      total += Number(match[2].replace(/,/g, ""));
    }
    return { owned, total };
  }

  function groupDashboard() {
    if (eraKey() === "ALL" || !dashboard.classList.contains("is-set-dashboard")) {
      return;
    }
    // catalog.js redraws with direct cards; grouped cards remain nested.
    const cards = Array.from(dashboard.children).filter((node) =>
      node.classList.contains("series-set-dashboard-card"));
    if (!cards.length) return;

    const era = eraKey();
    const groups = new Map(TYPES.map((type) => [type.key, []]));
    for (const card of cards) {
      groups.get(productTypeOfCard(card)).push(card);
    }
    const fragment = document.createDocumentFragment();

    for (const type of TYPES) {
      const nodes = groups.get(type.key);
      if (!nodes.length) continue;

      const details = document.createElement("details");
      details.className = "series-product-group";
      details.dataset.productType = type.key;

      const choiceKey = era + ":" + type.key;
      const savedChoice = openChoices.get(choiceKey);
      // Only expansion packs start open. Selecting a promo or special set
      // must not automatically expand its category on a fresh page load.
      details.open = savedChoice === undefined
        ? type.key === "expansion"
        : savedChoice;

      const summary = document.createElement("summary");
      summary.className = "series-product-heading";
      const heading = document.createElement("span");
      heading.className = "series-product-title";
      heading.textContent = type.label;

      const meta = document.createElement("span");
      meta.className = "series-product-meta";
      const counts = setCounts(nodes);
      meta.textContent = nodes.length + "세트 · " +
        counts.owned.toLocaleString("ko-KR") + "/" +
        counts.total.toLocaleString("ko-KR") + "장";
      summary.append(heading, meta);

      const grid = document.createElement("div");
      grid.className = "series-product-grid";
      grid.append(...nodes);
      details.append(summary, grid);
      details.addEventListener("toggle", () => {
        openChoices.set(choiceKey, details.open);
      });
      fragment.append(details);
    }
    dashboard.replaceChildren(fragment);
  }

  function groupChooser() {
    if (!chooser || eraKey() === "ALL") return;
    const options = Array.from(chooser.children).filter((node) =>
      node.tagName === "OPTION" && node.value);
    if (!options.length) return;

    const selectedValue = chooser.value;
    const groups = new Map(TYPES.map((type) => [type.key, []]));
    for (const option of options) {
      const code = option.value;
      const title = option.textContent.split(" · ")[0];
      groups.get(classifySeriesProduct(code, title)).push(option);
    }
    const fragment = document.createDocumentFragment();
    for (const type of TYPES) {
      const items = groups.get(type.key);
      if (!items.length) continue;
      const optgroup = document.createElement("optgroup");
      optgroup.label = type.label + " (" + items.length + ")";
      optgroup.append(...items);
      fragment.append(optgroup);
    }
    chooser.replaceChildren(fragment);
    chooser.value = selectedValue;
  }

  new MutationObserver(groupDashboard).observe(dashboard, { childList: true });
  if (chooser) {
    new MutationObserver(groupChooser).observe(chooser, { childList: true });
    chooser.addEventListener("change", () => {
      const code = chooser.value;
      const option = Array.from(chooser.options).find((item) => item.value === code);
      const title = option?.textContent.split(" · ")[0] || "";
      openChoices.set(eraKey() + ":" + classifySeriesProduct(code, title), true);
    }, { capture: true });
  }

  groupDashboard();
  groupChooser();
})();
