"use strict";

const DEFAULT_TITLE = "디지털 카드 바인더";
const DEFAULT_URL = "/news.html";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = String(payload.title || DEFAULT_TITLE);
  const body = String(payload.body || "새소식이 등록되었습니다.");
  const url = String(payload.url || DEFAULT_URL);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/assets/favicon.svg",
      tag: payload.tag || "digital-card-binder-news",
      renotify: true,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    String(event.notification?.data?.url || DEFAULT_URL),
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("navigate" in client) client.navigate(targetUrl);
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
