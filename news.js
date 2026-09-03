"use strict";

(function () {
  const NEWS_DATA_URL = "./news.json?v=20260813-1";

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
    const response = await fetch(NEWS_DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`새소식 응답 오류: ${response.status}`);
    const payload = await response.json();
    return (Array.isArray(payload?.items) ? payload.items : [])
      .map(normalizeNewsItem)
      .filter(Boolean)
      .sort((left, right) => right.date.localeCompare(left.date) || left.index - right.index);
  }

  function renderDashboardLatest(items) {
    const strip = document.querySelector("#dashboard-news-strip");
    if (!strip || !items.length) return;
    const latest = items[0];
    const category = strip.querySelector("#dashboard-news-category");
    const title = strip.querySelector("#dashboard-news-title");
    const date = strip.querySelector("#dashboard-news-date");
    if (category) category.textContent = `[${latest.category}]`;
    if (title) title.textContent = latest.title;
    if (date) {
      date.dateTime = latest.date;
      date.textContent = formatDate(latest.date);
    }
    strip.href = `./news.html#${encodeURIComponent(latest.id)}`;
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
    if (requested?.tagName === "DETAILS") requested.open = true;
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

  initializeAndroidDownloadLabel();
  initializeNews();
})();
