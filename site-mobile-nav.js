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
    if (window.__dcbDiagnosticsLoaderRequested || !document.head?.append) return;
    window.__dcbDiagnosticsLoaderRequested = true;
    const script = document.createElement("script");
    script.src = "./site-error-diagnostics.js";
    script.async = true;
    document.head.append(script);
  }

  // Keep navigation on the current page. The destination list is presentation only.
  function openLocalMenu(event, trigger) {
    event.preventDefault();
    let dialog = document.getElementById("dcb-site-menu-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "dcb-site-menu-dialog";
      dialog.className = "dcb-site-menu-dialog";
      dialog.setAttribute("aria-labelledby", "dcb-site-menu-title");
      const panel = document.createElement("div");
      panel.className = "dcb-site-menu-panel";
      const header = document.createElement("div");
      header.className = "dcb-site-menu-header";
      const title = document.createElement("h2");
      title.id = "dcb-site-menu-title";
      title.textContent = "바로 이동";
      const close = document.createElement("button");
      close.type = "button";
      close.className = "dcb-site-menu-close";
      close.setAttribute("aria-label", "메뉴 닫기");
      close.textContent = "닫기 ×";
      close.addEventListener("click", () => dialog.close());
      header.append(title, close);
      panel.append(header);
      const groups = [
        { title: "도감", links: [
          ["시리즈 도감", "./series.html"], ["전국도감", "./national.html"],
          ["테마 도감", "./theme.html"], ["AR 도감", "./ar.html"],
          ["팩 도감", "./packs.html"], ["포켓몬 컬렉션", "./pokemon-collections.html"],
          ["작가 도감", "./artists.html"], ["인물 도감", "./people.html"]
        ] },
        { title: "나의 수집 · 도구", links: [
          ["내 도감", "./custom.html"], ["바인더 스튜디오", "./studio.html"],
          ["카드 레이더", "./card-radar.html"], ["커뮤니티", "./collectors.html"],
          ["새소식", "./news.html"], ["내 설정", "./collector-settings.html"]
        ] }
      ];
      for (const group of groups) {
        const section = document.createElement("section");
        section.className = "dcb-site-menu-group";
        const label = document.createElement("h3");
        label.textContent = group.title;
        const links = document.createElement("nav");
        links.setAttribute("aria-label", group.title);
        for (const [name, href] of group.links) {
          const link = document.createElement("a");
          link.href = href;
          link.textContent = name;
          links.append(link);
        }
        section.append(label, links);
        panel.append(section);
      }
      dialog.append(panel);
      dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
      document.body.append(dialog);
    }
    trigger.setAttribute("aria-expanded", "true");
    dialog.addEventListener("close", () => {
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus?.();
    }, { once: true });
    if (!dialog.open) dialog.showModal();
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
      if (item.name === "menu") {
        link.setAttribute("role", "button");
        link.setAttribute("aria-haspopup", "dialog");
        link.setAttribute("aria-expanded", "false");
        // Assigned lazily so existing navigation setup and non-browser mocks remain safe.
        link.onclick = (event) => openLocalMenu(event, link);
      }
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
