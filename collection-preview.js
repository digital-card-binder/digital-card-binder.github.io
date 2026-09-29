"use strict";

(function () {
  const header = document.querySelector(".site-header");
  const sidebar = document.querySelector(".sidebar");
  if (!header || !sidebar || document.querySelector(".collection-mobile-tabs")) return;

  if (!sidebar.id) sidebar.id = "collection-mobile-menu";

  const headerButton = document.createElement("button");
  headerButton.type = "button";
  headerButton.className = "collection-mobile-menu-button";
  headerButton.setAttribute("aria-controls", sidebar.id);
  headerButton.setAttribute("aria-expanded", "false");
  headerButton.setAttribute("aria-label", "도감 메뉴 열기");
  headerButton.innerHTML = '<span aria-hidden="true">☰</span><span>메뉴</span>';
  header.append(headerButton);

  const tabs = document.createElement("nav");
  tabs.className = "collection-mobile-tabs";
  tabs.setAttribute("aria-label", "모바일 주요 메뉴");
  tabs.innerHTML = `
    <a href="./" data-mobile-page="index.html"><span aria-hidden="true">◆</span><small>홈</small></a>
    <a href="./pokemon-search.html" data-mobile-page="pokemon-search.html"><span aria-hidden="true">⌕</span><small>검색</small></a>
    <a href="./series.html" data-mobile-page="series.html"><span aria-hidden="true">▣</span><small>도감</small></a>
    <a href="./custom.html" data-mobile-page="custom.html"><span aria-hidden="true">▤</span><small>나의 수집</small></a>
    <button type="button" data-mobile-menu><span aria-hidden="true">☰</span><small>메뉴</small></button>
  `;
  document.body.append(tabs);

  const menuButtons = [headerButton, tabs.querySelector("[data-mobile-menu]")];

  function setOpen(open) {
    document.body.classList.toggle("collection-mobile-nav-open", open);
    sidebar.classList.toggle("is-mobile-open", open);
    menuButtons.forEach((button) => {
      button?.setAttribute("aria-expanded", String(open));
      button?.setAttribute("aria-label", open ? "도감 메뉴 닫기" : "도감 메뉴 열기");
    });
  }

  menuButtons.forEach((button) => {
    button?.addEventListener("click", () => {
      setOpen(!sidebar.classList.contains("is-mobile-open"));
    });
  });

  sidebar.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const activePage = currentPage === "collector-settings.html" ? "custom.html" : currentPage;
  tabs.querySelectorAll("a").forEach((link) => {
    const active = link.dataset.mobilePage === activePage;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
  });

  const mobileMedia = window.matchMedia?.("(max-width: 690px)");
  mobileMedia?.addEventListener?.("change", (event) => {
    if (!event.matches) setOpen(false);
  });
})();
