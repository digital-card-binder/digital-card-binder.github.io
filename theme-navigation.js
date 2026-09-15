"use strict";

(function () {
  const THEME_PAGES = new Set([
    "theme.html",
    "ar.html",
    "artists.html",
    "trainer-pokemon.html",
    "people.html",
    "world.html",
    "fossil.html",
  ]);

  const NAV_ITEMS = [
    { href: "./", icon: "DB", title: "대시보드", subtitle: "ALL COLLECTIONS", page: "index.html" },
    { href: "./national.html", icon: "01", title: "전국 도감", subtitle: "NATIONAL DEX", page: "national.html" },
    { href: "./series.html", icon: "02", title: "시리즈 도감", subtitle: "SERIES DEX", page: "series.html" },
    { href: "./theme.html", icon: "TH", title: "테마 도감", subtitle: "THEME DEX", page: "theme.html", theme: true },
    { href: "./custom.html", icon: "MY", title: "나만의 도감", subtitle: "MY CUSTOM DEX", page: "custom.html" },
    { href: "./news.html", icon: "NEW", title: "새소식", subtitle: "NEWS & UPDATES", page: "news.html" },
  ];

  function currentPage() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function navLink(item, page) {
    const active = item.theme ? THEME_PAGES.has(page) : item.page === page;
    const link = document.createElement("a");
    link.className = `collection-link${active ? " is-active" : ""}`;
    link.href = item.href;
    if (active) link.setAttribute("aria-current", "page");
    link.innerHTML = `
      <span class="collection-icon${active ? " collection-icon--red" : ""}" aria-hidden="true">${item.icon}</span>
      <span><strong>${item.title}</strong><small>${item.subtitle}</small></span>
    `;
    return link;
  }

  function applyNavigation() {
    const nav = document.querySelector(".collection-nav");
    if (!nav) return false;
    const page = currentPage();
    nav.replaceChildren(...NAV_ITEMS.map((item) => navLink(item, page)));
    const label = nav.closest(".sidebar")?.querySelector(".sidebar-label");
    if (label) label.textContent = "DIGITAL CARD BINDER";
    return true;
  }

  function boot() {
    applyNavigation();
    window.setTimeout(applyNavigation, 0);
    window.setTimeout(applyNavigation, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
