"use strict";

const DYNAMIC_ASSET_VERSIONS = {"./custom-public.js":"9c383f048d3a","./custom-granular-sharing.js":"f4614080dd6c","./custom.js":"8fdb0dcf5528","./custom-mobile-actions.js":"0cfe2106afd1","./custom-sync.js":"837a3d666240"};

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
    load("./custom.js?v=20260813-2", () => {
      load("./custom-mobile-actions.js", () => {
        load("./custom-sync.js");
      });
    });
  });
})();
