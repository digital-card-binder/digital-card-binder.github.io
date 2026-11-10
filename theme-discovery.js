"use strict";
// Presentation-only filtering: does not modify theme links, card records or membership.
(function () {
  function init() {
    const input = document.getElementById("theme-discovery-search");
    const grid = document.querySelector(".theme-card-grid");
    const controls = document.querySelector(".theme-discovery-tabs");
    const count = document.getElementById("theme-discovery-count");
    const empty = document.getElementById("theme-discovery-empty");
    if (!input || !grid || !controls || !count || !empty) return;

    const cards = [...grid.querySelectorAll(".theme-card")];
    const scopeFor = (card) => {
      const href = card.getAttribute("href") || "";
      if (href.startsWith("./art-themes.html")) return "story";
      if (/\/(?:eevee|trainer-pokemon|people|fossil)[.]html/.test(href)) return "pokemon";
      return "special";
    };
    const entries = cards.map((card) => ({
      card,
      category: scopeFor(card),
      text: (card.textContent || "").toLocaleLowerCase("ko-KR").replace(/\s+/g, "")
    }));
    let scope = "all";

    function render() {
      const query = input.value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "").trim();
      let visible = 0;
      for (const entry of entries) {
        const match = (scope === "all" || scope === entry.category) && (!query || entry.text.includes(query));
        entry.card.hidden = !match;
        if (match) visible++;
      }
      count.textContent = "테마 " + visible + "개" + (query || scope !== "all" ? " 검색 결과" : " 둘러보기");
      empty.hidden = visible !== 0;
    }
    controls.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-theme-scope]");
      if (!button || !controls.contains(button)) return;
      scope = button.dataset.themeScope;
      for (const item of controls.querySelectorAll("button[data-theme-scope]")) {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      }
      render();
    });
    input.addEventListener("input", render);
    render();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else init();
})();
