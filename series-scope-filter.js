"use strict";

(function () {
  if (document.body.dataset.catalog !== "series") return;

  const params = new URLSearchParams(window.location.search);
  let activeScope = params.get("scope") === "base" ? "base" : "all";
  let activePokemonOnly = params.get("pokemon") === "1";
  const caption = document.querySelector(".catalog-caption");
  const defaultCaption = caption?.textContent || "";
  const scopeHint = () => document.querySelector("#series-scope-hint");

  function syncControl() {
    const state = window.PokemonDexSeriesScope?.getState?.();
    if (state) {
      activeScope = state.scope;
      activePokemonOnly = state.pokemonOnly;
    }
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
    const toggle = document.querySelector("#series-pokemon-only");
    if (toggle) {
      toggle.checked = activePokemonOnly;
      toggle.disabled = !state?.pokemonAvailable;
      toggle.setAttribute("aria-checked", String(activePokemonOnly));
    }
    const help = document.querySelector("#series-pokemon-hint");
    if (help) help.textContent = state && !state.pokemonAvailable
      ? "포켓몬 목록을 불러오지 못했습니다. 새로고침 후 이용해 주세요."
      : "트레이너스·에너지 제외 · 보유 기록 유지";
  }

  function switchFilters(nextScope, nextPokemonOnly, updateHistory = true) {
    if (nextScope === activeScope && nextPokemonOnly === activePokemonOnly) return;
    const next = new URL(window.location.href);
    if (nextScope === "base") next.searchParams.set("scope", "base");
    else next.searchParams.delete("scope");
    if (nextPokemonOnly) next.searchParams.set("pokemon", "1");
    else next.searchParams.delete("pokemon");

    if (!window.PokemonDexSeriesScope?.setFilters?.(nextScope, nextPokemonOnly)) {
      syncControl();
      return;
    }
    if (updateHistory) window.history.pushState(null, "", next.href);
    activeScope = nextScope;
    activePokemonOnly = nextPokemonOnly;
    syncControl();
  }

  function switchScope(nextScope, updateHistory = true) {
    switchFilters(nextScope, activePokemonOnly, updateHistory);
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
    <div class="series-scope-main">
    <div class="series-scope-copy">
      <strong>도감 구성</strong>
      <span id="series-scope-hint" aria-live="polite"></span>
    </div>
    <div class="series-scope-options">
      <button type="button" data-scope="all" aria-pressed="false" title="RGB 특별 카드와 분모 초과 카드까지 포함">마스터 도감</button>
      <button type="button" data-scope="base" aria-pressed="false" title="분모 번호까지 표시하되 RGB 특별 카드는 제외">기본 도감</button>
    </div>
    </div>
    <label class="series-pokemon-toggle" for="series-pokemon-only">
      <span class="series-pokemon-copy">
        <strong>포켓몬 카드만 보기</strong>
        <small id="series-pokemon-hint">트레이너스·에너지 제외 · 보유 기록 유지</small>
      </span>
      <input id="series-pokemon-only" type="checkbox" role="switch" aria-checked="false" disabled>
      <span class="series-toggle-track" aria-hidden="true"></span>
    </label>
  `;
  control.querySelectorAll("button[data-scope]").forEach((button) => {
    button.disabled = true;
    button.addEventListener("click", () => switchScope(button.dataset.scope));
  });
  control.querySelector("#series-pokemon-only").addEventListener("change", (event) => {
    switchFilters(activeScope, event.target.checked);
  });
  heading.insertAdjacentElement("afterend", control);

  const style = document.createElement("style");
  style.textContent = [
    ".series-scope-switch{display:grid;gap:0;margin:12px 0 14px;padding:10px 12px;border:1px solid #dfe6ed;border-radius:12px;background:#f8fafc;}",
    ".series-scope-main{display:flex;align-items:center;justify-content:space-between;gap:12px;}",
    ".series-scope-copy{display:grid;min-width:0;gap:3px;}",
    ".series-scope-copy strong{color:#263a4e;font-size:.72rem;}",
    ".series-scope-copy span{color:#687b8e;font-size:.61rem;line-height:1.4;}",
    ".series-scope-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;flex:0 0 auto;padding:4px;border:1px solid #dce5ed;border-radius:10px;background:#edf2f6;}",
    ".series-scope-options button{min-width:108px;min-height:36px;padding:7px 12px;border:0;border-radius:8px;background:transparent;color:#526477;font:inherit;font-size:.72rem;font-weight:800;cursor:pointer;touch-action:manipulation;}",
    ".series-scope-options button:hover:not(:disabled){background:#e1e9ef;color:#18364f;}",
    ".series-scope-options button.is-active{background:#173a53;color:#fff;box-shadow:0 2px 8px rgba(23,58,83,.15);}",
    ".series-scope-options button:focus-visible{outline:3px solid #68a2d2;outline-offset:2px;}",
    ".series-scope-options button:disabled{opacity:.65;cursor:wait;}",
    ".series-pokemon-toggle{position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px;padding-top:10px;margin-top:10px;border-top:1px solid #e1e7ed;cursor:pointer;}",
    ".series-pokemon-copy{display:grid;gap:3px;min-width:0;}",
    ".series-pokemon-copy strong{color:#263a4e;font-size:.73rem;}",
    ".series-pokemon-copy small{color:#687b8e;font-size:.61rem;line-height:1.4;}",
    ".series-pokemon-toggle input{position:absolute;width:1px;height:1px;opacity:0;}",
    ".series-toggle-track{position:relative;flex:0 0 42px;width:42px;height:24px;border-radius:999px;background:#b9c5d0;transition:background .15s;}",
    ".series-toggle-track:after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;box-shadow:0 1px 3px #0002;transition:transform .15s;}",
    ".series-pokemon-toggle input:checked + .series-toggle-track{background:#173a53;}",
    ".series-pokemon-toggle input:checked + .series-toggle-track:after{transform:translateX(18px);}",
    ".series-pokemon-toggle input:focus-visible + .series-toggle-track{outline:3px solid #68a2d2;outline-offset:3px;}",
    ".series-pokemon-toggle:has(input:disabled){opacity:.65;cursor:wait;}",
    "@media(max-width:690px){.series-scope-switch{padding:9px 10px;}.series-scope-main{display:grid;gap:8px;}.series-scope-copy{gap:2px;}.series-scope-copy strong{font-size:.66rem;}.series-scope-copy span{font-size:.57rem;}.series-scope-options{width:100%;}.series-scope-options button{min-width:0;min-height:40px;padding:8px 5px;font-size:.69rem;}.series-pokemon-toggle{margin-top:9px;padding-top:10px;min-height:43px;}}",
    "@media print{.series-scope-switch{display:none!important;}}",
  ].join("\n");
  document.head.append(style);
  syncControl();

  window.addEventListener("pokemon-dex:catalog-ready", () => {
    control.querySelectorAll("button[data-scope]").forEach((button) => {
      button.disabled = false;
    });
    syncControl();
  }, { once: true });

  window.addEventListener("popstate", () => {
    const scope = new URLSearchParams(window.location.search).get("scope") === "base"
      ? "base" : "all";
    const pokemonOnly = new URLSearchParams(window.location.search).get("pokemon") === "1";
    switchFilters(scope, pokemonOnly, false);
  });
})();
