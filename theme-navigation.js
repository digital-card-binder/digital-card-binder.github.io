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
    { href: "./collectors.html", icon: "PB", title: "도감 갤러리", subtitle: "PUBLIC BOARD", page: "collectors.html" },
    { href: "./national.html", icon: "01", title: "전국 도감", subtitle: "NATIONAL DEX", page: "national.html" },
    { href: "./packs.html", icon: "PK", title: "팩 도감", subtitle: "PACK DEX", page: "packs.html" },
    { href: "./series.html", icon: "02", title: "시리즈 도감", subtitle: "SERIES DEX", page: "series.html" },
    { href: "./theme.html", icon: "TH", title: "테마 도감", subtitle: "THEME DEX", page: "theme.html", theme: true },
    { href: "./custom.html", icon: "MY", title: "나만의 도감", subtitle: "MY CUSTOM DEX", page: "custom.html" },
    { href: "./news.html", icon: "NEW", title: "새소식", subtitle: "NEWS & UPDATES", page: "news.html" },
  ];

  const mobileBrandMedia = typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 760px)")
    : null;
  const narrowBrandMedia = typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 390px)")
    : null;

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

  function applyMobileBrandTitle() {
    const brand = document.querySelector(".site-header > .brand");
    if (!brand) return;

    let copy = brand.querySelector(".brand-copy");
    if (!copy) {
      copy = document.createElement("span");
      copy.className = "brand-copy";
      brand.append(copy);
    }

    let title = copy.querySelector("strong");
    if (!title) {
      title = document.createElement("strong");
      copy.append(title);
    }
    title.textContent = "디지털 카드 바인더";

    if (!mobileBrandMedia?.matches) {
      brand.style.removeProperty("gap");
      brand.style.removeProperty("min-width");
      copy.style.removeProperty("display");
      copy.style.removeProperty("visibility");
      copy.style.removeProperty("opacity");
      copy.style.removeProperty("min-width");
      title.style.removeProperty("display");
      title.style.removeProperty("visibility");
      title.style.removeProperty("opacity");
      title.style.removeProperty("font-size");
      title.style.removeProperty("font-weight");
      title.style.removeProperty("letter-spacing");
      title.style.removeProperty("line-height");
      title.style.removeProperty("white-space");
      title.style.removeProperty("max-width");
      title.style.removeProperty("overflow");
      title.style.removeProperty("text-overflow");
      return;
    }

    brand.style.gap = "8px";
    brand.style.minWidth = "0";
    copy.style.setProperty("display", "block", "important");
    copy.style.setProperty("visibility", "visible", "important");
    copy.style.setProperty("opacity", "1", "important");
    copy.style.minWidth = "0";
    title.style.setProperty("display", "block", "important");
    title.style.setProperty("visibility", "visible", "important");
    title.style.setProperty("opacity", "1", "important");
    title.style.setProperty("font-size", narrowBrandMedia?.matches ? "0.75rem" : "0.82rem", "important");
    title.style.setProperty("font-weight", "800", "important");
    title.style.setProperty("letter-spacing", "-0.045em", "important");
    title.style.lineHeight = "1.1";
    title.style.whiteSpace = "nowrap";
    title.style.maxWidth = narrowBrandMedia?.matches ? "110px" : "126px";
    title.style.overflow = "hidden";
    title.style.textOverflow = "clip";
  }

  function boot() {
    applyNavigation();
    applyMobileBrandTitle();
    window.setTimeout(() => {
      applyNavigation();
      applyMobileBrandTitle();
    }, 0);
    window.setTimeout(() => {
      applyNavigation();
      applyMobileBrandTitle();
    }, 350);
    window.setTimeout(applyMobileBrandTitle, 900);

    mobileBrandMedia?.addEventListener?.("change", applyMobileBrandTitle);
    narrowBrandMedia?.addEventListener?.("change", applyMobileBrandTitle);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
