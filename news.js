"use strict";

(function () {
  const NEWS_DATA_URL = "./news.json?v=20260916-3";

  function initializePwaBootstrap() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement("link");
      manifest.rel = "manifest";
      manifest.href = "/manifest.webmanifest";
      document.head.append(manifest);
    }

    if (!document.querySelector('link[data-pwa-style="1"]')) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = "/pwa.css?v=20260915-2";
      style.dataset.pwaStyle = "1";
      document.head.append(style);
    }

    if (!document.querySelector('script[data-pwa-script="1"]')) {
      const script = document.createElement("script");
      script.src = "/pwa.js?v=20260915-3";
      script.defer = true;
      script.dataset.pwaScript = "1";
      document.head.append(script);
    }
  }

  function normalizeNewsItem(item, index) {
    const id = String(item?.id || "").trim();
    const date = String(item?.date || "").trim();
    const category = String(item?.category || "업데이트").trim();
    const title = String(item?.title || "").trim();
    const summary = String(item?.summary || "").trim();
    const details = Array.isArray(item?.details)
      ? item.details.map((detail) => String(detail || "").trim()).filter(Boolean)
      : [];
    if (!/^[a-z0-9-]+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) {
      return null;
    }
    return { id, date, category, title, summary, details, index };
  }

  function formatDate(date) {
    return date.replaceAll("-", ".");
  }

  async function loadNewsItems() {
    const response = await fetch(NEWS_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`새소식 응답 오류: ${response.status}`);
    const payload = await response.json();
    return (Array.isArray(payload?.items) ? payload.items : [])
      .map(normalizeNewsItem)
      .filter(Boolean)
      .sort((left, right) => right.date.localeCompare(left.date) || left.index - right.index);
  }

  function applyDashboardNewsLayout(strip, title) {
    const compact = window.matchMedia("(max-width: 690px)").matches;
    strip.style.gridTemplateColumns = "auto minmax(0, 1fr) auto";
    strip.style.alignItems = "center";
    strip.style.minHeight = compact ? "82px" : "86px";
    if (!title) return;
    title.style.display = "grid";
    title.style.minWidth = "0";
    title.style.gap = compact ? "2px" : "3px";
    title.style.overflow = "visible";
    title.style.whiteSpace = "normal";
  }

  function renderDashboardLatest(items) {
    const strip = document.querySelector("#dashboard-news-strip");
    if (!strip || !items.length) return;

    const previewItems = items.slice(0, 3);
    const category = strip.querySelector("#dashboard-news-category");
    const title = strip.querySelector("#dashboard-news-title");
    const date = strip.querySelector("#dashboard-news-date");
    const compact = window.matchMedia("(max-width: 690px)").matches;

    if (category) category.hidden = true;
    if (date) date.hidden = true;
    applyDashboardNewsLayout(strip, title);

    if (title) {
      const rows = previewItems.map((item) => {
        const row = document.createElement("span");
        row.className = "dashboard-news-row";
        row.dataset.newsHref = `./news.html#${encodeURIComponent(item.id)}`;
        row.setAttribute("role", "link");
        row.setAttribute("tabindex", "0");
        row.setAttribute("aria-label", `${item.title} 새소식 보기`);
        row.style.display = "grid";
        row.style.gridTemplateColumns = compact ? "minmax(0, 1fr)" : "66px minmax(0, 1fr) auto";
        row.style.alignItems = "center";
        row.style.gap = compact ? "0" : "10px";
        row.style.minWidth = "0";
        row.style.minHeight = compact ? "20px" : "21px";
        row.style.cursor = "pointer";

        const rowCategory = document.createElement("span");
        rowCategory.className = "dashboard-news-row-category";
        rowCategory.textContent = `[${item.category}]`;
        if (compact) rowCategory.style.display = "none";

        const rowTitle = document.createElement("span");
        rowTitle.className = "dashboard-news-row-title";
        rowTitle.textContent = item.title;
        rowTitle.style.minWidth = "0";
        rowTitle.style.overflow = "hidden";
        rowTitle.style.textOverflow = "ellipsis";
        rowTitle.style.whiteSpace = "nowrap";

        const rowDate = document.createElement("time");
        rowDate.className = "dashboard-news-row-date";
        rowDate.dateTime = item.date;
        rowDate.textContent = formatDate(item.date);
        if (compact) rowDate.style.display = "none";

        row.append(rowCategory, rowTitle, rowDate);
        return row;
      });
      title.replaceChildren(...rows);
    }

    if (strip.dataset.newsRowLinksBound !== "1") {
      const openSelectedRow = (target) => {
        const row = target?.closest?.(".dashboard-news-row");
        if (!row || !strip.contains(row) || !row.dataset.newsHref) return false;
        window.location.href = row.dataset.newsHref;
        return true;
      };

      strip.addEventListener("click", (event) => {
        if (!openSelectedRow(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
      });

      strip.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (!openSelectedRow(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
      });

      strip.dataset.newsRowLinksBound = "1";
    }

    strip.href = "./news.html";
    strip.setAttribute("aria-label", `최신 새소식 ${previewItems.length}건 보기`);
    strip.hidden = false;
  }

  function createNewsItem(item) {
    const details = document.createElement("details");
    details.className = "news-item";
    details.id = item.id;

    const heading = document.createElement("summary");
    heading.className = "news-item-heading";

    const meta = document.createElement("span");
    meta.className = "news-item-meta";
    const category = document.createElement("span");
    category.className = `news-category news-category--${item.category === "공지" ? "notice" : "update"}`;
    category.textContent = item.category;
    const date = document.createElement("time");
    date.dateTime = item.date;
    date.textContent = formatDate(item.date);
    meta.append(category, date);

    const copy = document.createElement("span");
    copy.className = "news-item-copy";
    const title = document.createElement("strong");
    title.textContent = item.title;
    copy.append(title);
    if (item.summary) {
      const summary = document.createElement("span");
      summary.textContent = item.summary;
      copy.append(summary);
    }

    const toggle = document.createElement("span");
    toggle.className = "news-item-toggle";
    toggle.setAttribute("aria-hidden", "true");
    toggle.textContent = "⌄";
    heading.append(meta, copy, toggle);

    const body = document.createElement("div");
    body.className = "news-item-body";
    const list = document.createElement("ul");
    for (const detail of item.details) {
      const row = document.createElement("li");
      row.textContent = detail;
      list.append(row);
    }
    body.append(list);
    details.append(heading, body);
    return details;
  }

  function renderNewsPage(items) {
    const list = document.querySelector("#news-list");
    if (!list) return;
    const loading = document.querySelector("#news-loading");
    const count = document.querySelector("#news-count");
    if (loading) loading.hidden = true;
    if (count) count.textContent = `${items.length}건`;
    list.replaceChildren(...items.map(createNewsItem));
    list.hidden = false;

    const requestedId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!requestedId) return;
    const requested = document.getElementById(requestedId);
    if (requested?.tagName === "DETAILS") {
      requested.open = true;
      requested.scrollIntoView({ block: "center" });
    }
  }

  function showNewsError() {
    const loading = document.querySelector("#news-loading");
    const error = document.querySelector("#news-error");
    if (loading) loading.hidden = true;
    if (error) error.hidden = false;
  }

  function initializeAndroidDownloadLabel() {
    const button = document.querySelector("#android-app-download-button");
    if (button) button.textContent = "앱 다운로드 v0.9";
  }

  async function initializeNews() {
    if (!document.querySelector("#dashboard-news-strip, #news-list")) return;
    try {
      const items = await loadNewsItems();
      renderDashboardLatest(items);
      renderNewsPage(items);
    } catch (error) {
      console.error("새소식을 불러오지 못했습니다.", error);
      showNewsError();
    }
  }

  initializePwaBootstrap();
  initializeAndroidDownloadLabel();
  initializeNews();
})();
