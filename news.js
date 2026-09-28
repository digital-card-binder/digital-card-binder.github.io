"use strict";

(function () {
  const NEWS_DATA_URL = "./news.json?v=20260921-2";

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
    const separator = NEWS_DATA_URL.includes("?") ? "&" : "?";
    const response = await fetch(`${NEWS_DATA_URL}${separator}t=${Date.now()}`, { cache: "no-store" });
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

  let newsRefreshInFlight = null;
  let lastNewsRefreshAt = 0;

  async function initializeNews(force = false) {
    if (!document.querySelector("#dashboard-news-strip, #news-list")) return;
    const now = Date.now();
    if (!force && now - lastNewsRefreshAt < 2000) return;
    if (newsRefreshInFlight) return newsRefreshInFlight;

    newsRefreshInFlight = (async () => {
      try {
        const items = await loadNewsItems();
        lastNewsRefreshAt = Date.now();
        const error = document.querySelector("#news-error");
        if (error) error.hidden = true;
        renderDashboardLatest(items);
        renderNewsPage(items);
      } catch (error) {
        console.error("새소식을 불러오지 못했습니다.", error);
        showNewsError();
      } finally {
        newsRefreshInFlight = null;
      }
    })();

    return newsRefreshInFlight;
  }

  function refreshNewsWhenAppReturns() {
    if (document.visibilityState === "hidden") return;
    initializeNews(true);
  }

  initializeNews(true);

  window.addEventListener("pageshow", refreshNewsWhenAppReturns);
  window.addEventListener("focus", refreshNewsWhenAppReturns);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshNewsWhenAppReturns();
  });
})();
