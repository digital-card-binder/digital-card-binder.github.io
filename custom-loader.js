"use strict";

const DYNAMIC_ASSET_VERSIONS = {"./custom-public.js":"2fe8782967e9","./custom-granular-sharing.js":"f4614080dd6c","./custom.js":"9a8cee94317f","./custom-mobile-actions.js":"2cf4a2e9eaf2","./custom-sync.js":"837a3d666240"};

(function () {
  const params = new URLSearchParams(window.location.search);
  const publicRequested = /^[a-z0-9]{12}$/.test(params.get("collector") || "");
  window.CustomDexPublicViewRequested = publicRequested;

  function load(src, onload) {
    const script = document.createElement("script");
    script.src = `${src}?v=${DYNAMIC_ASSET_VERSIONS[src]}`;
    script.async = false;
    if (onload) script.addEventListener("load", onload, { once: true });
    document.head.append(script);
  }

  if (window.CustomDexPublicViewRequested) {
    load("./custom-public.js");
    return;
  }

  load("./custom-granular-sharing.js", () => {
    load("./custom.js", () => {
      load("./custom-mobile-actions.js", () => {
        load("./custom-sync.js");
      });
    });
  });
})();
