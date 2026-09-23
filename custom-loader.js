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
    load("./custom-public.js?v=1bd6444ed94a");
    return;
  }

  load("./custom-granular-sharing.js?v=f4614080dd6c", () => {
    load("./custom.js?v=1efa6473adf9", () => {
      load("./custom-mobile-actions.js?v=0cfe2106afd1", () => {
        load("./custom-sync.js?v=837a3d666240");
      });
    });
  });
})();
