"use strict";

(function () {
  if (document.body.dataset.catalog !== "series") return;

  const params = new URLSearchParams(window.location.search);
  let activeScope = params.get("scope") === "base" ? "base" : "all";
  const caption = document.querySelector(".catalog-caption");
  const defaultCaption = caption?.textContent || "";

  function syncControl() {
    document.querySelectorAll("#catalog-scope button[data-scope]").forEach((button) => {
      const active = button.dataset.scope === activeScope;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (caption) {
      caption.textContent = activeScope === "base"
        ? "기본 수록은 각 세트의 분모 번호까지 표시하며, 분모를 초과하는 AR·SR·SAR 등은 제외됩니다."
        : defaultCaption;
    }
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

  const row = document.querySelector(".catalog-filter-row");
  if (!row || document.querySelector("#catalog-scope")) return;

  const control = document.createElement("div");
  control.id = "catalog-scope";
  control.className = "segmented-control";
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", "수록 구분");
  control.innerHTML = `
    <button type="button" data-scope="all">전체</button>
    <button type="button" data-scope="base">기본 수록</button>
  `;
  control.querySelectorAll("button[data-scope]").forEach((button) => {
    button.disabled = true;
    button.addEventListener("click", () => switchScope(button.dataset.scope));
  });
  row.prepend(control);
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
