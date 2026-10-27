"use strict";
// Deliberately local-only runtime health data. No error message, stack, URL
// query, account identifier or outbound network call is ever collected.
(function () {
  if (window.__dcbSessionErrorDiagnosticsInstalled) return;
  window.__dcbSessionErrorDiagnosticsInstalled = true;
  const KEY = "dcb-session-error-diagnostics-v1";
  const LIMIT = 20;
  function safePage() {
    const file = (window.location.pathname.split("/").pop() || "index.html");
    return /^[A-Za-z0-9._-]{1,64}$/.test(file) ? file : "page";
  }
  function record(type) {
    try {
      const existing = JSON.parse(window.sessionStorage.getItem(KEY) || "[]");
      const rows = Array.isArray(existing) ? existing.slice(-LIMIT + 1) : [];
      rows.push({ page: safePage(), type, at: new Date().toISOString() });
      window.sessionStorage.setItem(KEY, JSON.stringify(rows));
    } catch { /* Private browsing restrictions must never affect the site. */ }
  }
  window.addEventListener("error", (event) => {
    // Resource 404s can be noisy (image fallback); only script exceptions.
    if (event.target === window) record("script");
  });
  window.addEventListener("unhandledrejection", () => record("promise"));
})();
