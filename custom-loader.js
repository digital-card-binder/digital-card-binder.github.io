"use strict";

const DYNAMIC_ASSET_VERSIONS = {"./custom.js":"0dddd1fa5333","./custom-public.js":"2fe8782967e9","./custom-mobile-actions.js":"5aa58509b7ce","./custom-granular-sharing.js":"f4614080dd6c","./custom-sync.js":"837a3d666240"};

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
