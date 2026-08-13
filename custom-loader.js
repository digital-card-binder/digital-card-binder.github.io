"use strict";

(function () {
  const params = new URLSearchParams(window.location.search);
  const publicRequested = /^[a-z0-9]{12}$/.test(params.get("collector") || "");
  window.CustomDexPublicViewRequested = publicRequested;

  function load(src, onload) {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    if (onload) script.addEventListener("load", onload, { once: true });
    document.head.append(script);
  }

  if (window.CustomDexPublicViewRequested) {
    load("./custom-public.js?v=20260813-2");
    return;
  }

  load("./custom-granular-sharing.js?v=20260813-1", () => {
    load("./custom.js?v=20260813-2", () => {
      load("./custom-sync.js?v=20260813-3");
    });
  });
})();
