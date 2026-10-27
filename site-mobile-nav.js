"use strict";
// Same core destinations as the home page, without adding a second nav there.
(function () {
  const NAV_ITEMS = [
    { href: "./", label: "홈", icon: "⌂", name: "home" },
    { href: "./pokemon-search.html", label: "검색", icon: "⌕", name: "search" },
    { href: "./series.html", label: "도감", icon: "▦", name: "series" },
    { href: "./custom.html", label: "내 도감", icon: "▤", name: "custom" },
    { href: "./#home-menu", label: "메뉴", icon: "☰", name: "menu" },
  ];

  function currentSection() {
    const page = window.location.pathname.split("/").pop() || "index.html";
    if (page === "index.html") return "home";
    if (page === "pokemon-search.html") return "search";
    if (page === "series.html") return "series";
    if (page === "custom.html") return "custom";
    return "";
  }

  function openRequestedMenu() {
    if (window.location.hash !== "#home-menu") return;
    const menu = document.getElementById("home-menu");
    if (menu && menu.tagName === "DETAILS") menu.open = true;
  }

  function enableLocalErrorDiagnostics() {
    if (window.__dcbDiagnosticsLoaderRequested) return;
    window.__dcbDiagnosticsLoaderRequested = true;
    const script = document.createElement("script");
    script.src = "./site-error-diagnostics.js";
    script.async = true;
    document.head.append(script);
  }

  function init() {
    enableLocalErrorDiagnostics();
    openRequestedMenu();
    window.addEventListener("hashchange", openRequestedMenu);
    if (document.querySelector(".home-mobile-tabbar, .dcb-mobile-nav")) return;
    if (!document.querySelector("main")) return;
    const nav = document.createElement("nav");
    nav.className = "dcb-mobile-nav";
    nav.setAttribute("aria-label", "모바일 주요 메뉴");
    const selected = currentSection();
    for (const item of NAV_ITEMS) {
      const link = document.createElement("a");
      link.href = item.href;
      link.setAttribute("aria-label", item.label + " 이동");
      if (item.name === selected) {
        link.className = "is-active";
        link.setAttribute("aria-current", "page");
      }
      const icon = document.createElement("span");
      icon.textContent = item.icon;
      icon.setAttribute("aria-hidden", "true");
      const label = document.createElement("strong");
      label.textContent = item.label;
      link.append(icon, label);
      nav.append(link);
    }
    document.body.append(nav);
    document.body.classList.add("dcb-has-mobile-nav");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else init();
})();
