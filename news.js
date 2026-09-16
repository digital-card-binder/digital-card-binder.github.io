"use strict";

(function () {
  const NEWS_DATA_URL = "./news.json?v=20260916-4";

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

  function initializeCompactMobileBrand() {
    const brand = document.querySelector(".site-header > .brand");
    const copy = brand?.querySelector(".brand-copy");
    const title = copy?.querySelector("strong");
    if (!brand || !copy || !title) return;

    const mobile = window.matchMedia("(max-width: 760px)");
    const narrow = window.matchMedia("(max-width: 390px)");

    const apply = () => {
      if (!mobile.matches) {
        brand.style.removeProperty("gap");
        brand.style.removeProperty("min-width");
        copy.style.removeProperty("display");
        copy.style.removeProperty("min-width");
        title.style.removeProperty("display");
        title.style.removeProperty("font-size");
        title.style.removeProperty("letter-spacing");
        title.style.removeProperty("line-height");
        title.style.removeProperty("white-space");
        title.style.removeProperty("max-width");
        title.style.removeProperty("overflow");
        title.style.removeProperty("text-overflow");
        return;
      }

      brand.style.gap = "7px";
      brand.style.minWidth = "0";
      copy.style.setProperty("display", "block", "important");
      copy.style.minWidth = "0";
      title.style.setProperty("display", "block", "important");
      title.style.setProperty("font-size", narrow.matches ? "0.55rem" : "0.6rem", "important");
      title.style.setProperty("letter-spacing", "-0.045em", "important");
      title.style.lineHeight = "1.15";
      title.style.whiteSpace = "nowrap";
      title.style.maxWidth = narrow.matches ? "78px" : "88px";
      title.style.overflow = "hidden";
      title.style.textOverflow = "clip";
    };

    apply();
    mobile.addEventListener?.("change", apply);
    narrow.addEventListener?.("change", apply);
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

  function ensureDashboardNewsContainer() {
    const current = document.querySelector("#dashboard-news-strip");
    if (!current) return null;

    if (current.tagName !== "A") {
      let list = current.querySelector("#dashboard-news-preview-list");
      if (!list) {
        list = document.createElement("div");
        list.id = "dashboard-news-preview-list";
        list.className = "dashboard-news-preview-list";
        current.append(list);
      }
      return { container: current, list };
    }

    const container = document.createElement("section");
    container.id = "dashboard-news-strip";
    container.className = "dashboard-news-strip";
    container.hidden = current.hidden;
    container.setAttribute("aria-label", "최신 새소식");

    const label = document.createElement("a");
    label.className = "dashboard-news-label";
    label.href = "./news.html";
    label.textContent = "새소식";
    label.setAttribute("aria-label", "전체 새소식 보기");

    const list = document.createElement("div");
    list.id = "dashboard-news-preview-list";
    list.className = "dashboard-news-preview-list";

    const more = document.createElement("a");
    more.className = "dashboard-news-more";
    more.href = "./news.html";
    more.setAttribute("aria-label", "전체 새소식 보기");
    more.textContent = "›";

    container.append(label, list, more);
    current.replaceWith(container);
    return { container, list };
  }

  function createDashboardNewsLink(item) {
    const link = document.createElement("a");
    link.className = "dashboard-news-row";
    link.href = `./news.html#${encodeURIComponent(item.id)}`;
    link.setAttribute("aria-label", `${item.title} 새소식 보기`);

    const category = document.createElement("span");
    category.className = "dashboard-news-row-category";
    category.textContent = `[${item.category}]`;

    const title = document.createElement("span");
    title.className = "dashboard-news-row-title";
    title.textContent = item.title;

    const date = document.createElement("time");
    date.className = "dashboard-news-row-date";
    date.dateTime = item.date;
    date.textContent = formatDate(item.date);

    link.append(category, title, date);
    return link;
  }

  function renderDashboardLatest(items) {
    if (!items.length) return;
    const dashboardNews = ensureDashboardNewsContainer();
    if (!dashboardNews) return;

    const previewItems = items.slice(0, 2);
    dashboardNews.list.replaceChildren(...previewItems.map(createDashboardNewsLink));
    dashboardNews.container.setAttribute("aria-label", `최신 새소식 ${previewItems.length}건`);
    dashboardNews.container.hidden = false;
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
  initializeCompactMobileBrand();
  initializeAndroidDownloadLabel();
  initializeNews();
})();
