"use strict";

(function () {
  if (document.body.dataset.catalog !== "series") return;

  const params = new URLSearchParams(window.location.search);
  let activeScope = params.get("scope") === "base" ? "base" : "all";
  const caption = document.querySelector(".catalog-caption");
  const defaultCaption = caption?.textContent || "";
  const scopeHint = () => document.querySelector("#series-scope-hint");

  function syncControl() {
    document.querySelectorAll("#catalog-scope button[data-scope]").forEach((button) => {
      const active = button.dataset.scope === activeScope;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (caption) {
      caption.textContent = activeScope === "base"
        ? "기본 도감은 분모 번호까지 표시하며, RGB 특별 카드와 분모 초과 카드는 제외됩니다."
        : defaultCaption;
    }
    const hint = scopeHint();
    if (hint) hint.textContent = activeScope === "base"
      ? "분모 번호까지만 표시하며 RGB 특별 카드는 제외합니다."
      : "RGB 특별 카드와 분모 초과 카드를 포함한 전체 카드를 표시합니다.";
  }

  function switchScope(nextScope, updateHistory = true) {
    if (nextScope === activeScope) return;
    const next = new URL(window.location.href);
    if (nextScope === "base") next.searchParams.set("scope", "base");
    else next.searchParams.delete("scope");

    if (!window.PokemonDexSeriesScope?.setScope?.(nextScope)) return;
    if (updateHistory) window.history.pushState(null, "", next.href);
    activeScope = nextScope;
    syncControl();
  }

  // 수집 범위는 검색/보유 필터와 달리 항상 바로 선택할 수 있어야 합니다.
  const heading = document.querySelector(".catalog-panel > .catalog-heading");
  if (!heading || document.querySelector("#catalog-scope")) return;

  const control = document.createElement("div");
  control.id = "catalog-scope";
  control.className = "series-scope-switch";
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", "시리즈 도감 수집 범위");
  control.innerHTML = `
    <div class="series-scope-copy">
      <strong>도감 구성</strong>
      <span id="series-scope-hint" aria-live="polite"></span>
    </div>
    <div class="series-scope-options">
      <button type="button" data-scope="all" aria-pressed="false" title="RGB 특별 카드와 분모 초과 카드까지 포함">마스터 도감</button>
      <button type="button" data-scope="base" aria-pressed="false" title="분모 번호까지 표시하되 RGB 특별 카드는 제외">기본 도감</button>
    </div>
  `;
  control.querySelectorAll("button[data-scope]").forEach((button) => {
    button.disabled = true;
    button.addEventListener("click", () => switchScope(button.dataset.scope));
  });
  heading.insertAdjacentElement("afterend", control);

  const style = document.createElement("style");
  style.textContent = [
    ".series-scope-switch{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 14px;padding:10px 12px;border:1px solid #dfe6ed;border-radius:12px;background:#f8fafc;}",
    ".series-scope-copy{display:grid;min-width:0;gap:3px;}",
    ".series-scope-copy strong{color:#263a4e;font-size:.72rem;}",
    ".series-scope-copy span{color:#687b8e;font-size:.61rem;line-height:1.4;}",
    ".series-scope-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;flex:0 0 auto;padding:4px;border:1px solid #dce5ed;border-radius:10px;background:#edf2f6;}",
    ".series-scope-options button{min-width:108px;min-height:36px;padding:7px 12px;border:0;border-radius:8px;background:transparent;color:#526477;font:inherit;font-size:.72rem;font-weight:800;cursor:pointer;touch-action:manipulation;}",
    ".series-scope-options button:hover:not(:disabled){background:#e1e9ef;color:#18364f;}",
    ".series-scope-options button.is-active{background:#173a53;color:#fff;box-shadow:0 2px 8px rgba(23,58,83,.15);}",
    ".series-scope-options button:focus-visible{outline:3px solid #68a2d2;outline-offset:2px;}",
    ".series-scope-options button:disabled{opacity:.65;cursor:wait;}",
    "@media(max-width:690px){.series-scope-switch{display:grid;gap:8px;padding:9px 10px;}.series-scope-copy{gap:2px;}.series-scope-copy strong{font-size:.66rem;}.series-scope-copy span{font-size:.57rem;}.series-scope-options{width:100%;}.series-scope-options button{min-width:0;min-height:40px;padding:8px 5px;font-size:.69rem;}}",
    "@media print{.series-scope-switch{display:none!important;}}",
  ].join("\n");
  document.head.append(style);
  syncControl();

  window.addEventListener("pokemon-dex:catalog-ready", () => {
    control.querySelectorAll("button[data-scope]").forEach((button) => {
      button.disabled = false;
    });
  }, { once: true });

  window.addEventListener("popstate", () => {
    const scope = new URLSearchParams(window.location.search).get("scope") === "base"
      ? "base" : "all";
    switchScope(scope, false);
  });
})();
