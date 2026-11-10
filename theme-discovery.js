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

    // A lightweight manifest lets supplemental themes appear without editing the
    // main landing page. The same index is loaded by the art-theme card viewer.
    async function loadSupplementalThemes() {
      try {
        const response = await fetch("./data/art-theme-supplements.json", { cache:"no-store" });
        if (!response.ok) return;
        const manifest = await response.json();
        if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.feeds)) return;
        for (const feed of manifest.feeds.slice(0, 24)) {
          const code = String(feed?.code || "");
          const path = String(feed?.path || "");
          if (!/^[a-z0-9-]{2,40}$/.test(code) ||
              !/^\.\/data\/art-themes-[a-z0-9-]+\.json$/.test(path)) continue;
          const href = "./art-themes.html?theme=" + encodeURIComponent(code);
          if (entries.some((entry) => entry.card.getAttribute("href") === href)) continue;
          try {
            const extra = await fetch(path, { cache:"no-store" });
            if (!extra.ok) continue;
            const data = await extra.json();
            const group = data?.group;
            if (group?.code !== code || !Array.isArray(group.cards) || !group.cards.length) continue;
            const card = document.createElement("a");
            card.className = "theme-card theme-card--art";
            card.href = href;
            const top = document.createElement("div");
            top.className = "theme-card-top";
            const symbol = document.createElement("span");
            symbol.className = "theme-card-symbol";
            symbol.setAttribute("aria-hidden", "true");
            symbol.textContent = String(group.icon || "✦").slice(0, 4);
            const badge = document.createElement("span");
            badge.className = "theme-card-badge";
            badge.textContent = String(group.badge || "NEW THEME").slice(0, 45);
            top.append(symbol, badge);
            const title = document.createElement("h3");
            title.textContent = String(group.name || code);
            const description = document.createElement("p");
            description.textContent = String(group.description || "새로운 카드 테마 도감입니다.").slice(0, 180);
            const footer = document.createElement("div");
            footer.className = "theme-card-footer";
            const action = document.createElement("span");
            action.textContent = "테마 열기 · " + group.cards.length + "장";
            const arrow = document.createElement("span");
            arrow.className = "theme-card-arrow";
            arrow.setAttribute("aria-hidden", "true");
            arrow.textContent = "→";
            footer.append(action, arrow);
            card.append(top, title, description, footer);
            grid.insertBefore(card, grid.querySelector(".theme-card--art"));
            entries.push({
              card, category: "story",
              text: card.textContent.toLocaleLowerCase("ko-KR").replace(/\s+/g, "")
            });
          } catch (error) {
            console.warn("추가 테마 도감 항목을 불러오지 못했습니다.", code, error);
          }
        }
        render();
      } catch (error) {
        console.warn("추가 테마 목록을 불러오지 못했습니다.", error);
      }
    }

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
    void loadSupplementalThemes();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else init();
})();
