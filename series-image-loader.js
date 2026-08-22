"use strict";

(function () {
  const SERIES_DATA_PATH = "/data/series.json";
  const MAX_IMAGE_RETRIES = 3;
  const RETRY_DELAYS = [800, 2200, 5000];
  const nativeFetch = window.fetch.bind(window);

  // series.json is a large static file. Reuse the browser cache instead of
  // forcing a full download on every visit while still allowing normal HTTP
  // revalidation when the deployed file changes.
  window.fetch = function seriesAwareFetch(input, init) {
    let url = "";
    try {
      url = typeof input === "string" ? input : input?.url || "";
      const parsed = new URL(url, window.location.href);
      if (parsed.pathname.endsWith(SERIES_DATA_PATH)) {
        return nativeFetch(input, { ...(init || {}), cache: "default" });
      }
    } catch {
      // Fall through to the native fetch unchanged.
    }
    return nativeFetch(input, init);
  };

  function cardContainer(image) {
    return image.closest(".catalog-card") || image.closest(".dialog-card-image");
  }

  function clearImageError(image) {
    cardContainer(image)?.classList.remove("has-image-error");
  }

  function retryImage(image) {
    if (!(image instanceof HTMLImageElement)) return;
    if (!image.matches(".card-image, #catalog-dialog-image")) return;

    const source = image.dataset.originalImageSrc || image.getAttribute("src") || "";
    if (!source) return;
    if (!image.dataset.originalImageSrc) image.dataset.originalImageSrc = source;
    if (image.dataset.imageRetryPending === "1") return;

    const previousAttempts = Number(image.dataset.imageRetryAttempts || 0);
    if (previousAttempts >= MAX_IMAGE_RETRIES) return;

    const attempt = previousAttempts + 1;
    image.dataset.imageRetryAttempts = String(attempt);
    image.dataset.imageRetryPending = "1";

    window.setTimeout(() => {
      image.dataset.imageRetryPending = "0";
      if (!image.isConnected) return;
      clearImageError(image);

      // Re-assigning after a short blank state gives transient network/server
      // failures another chance without permanently replacing a valid URL.
      image.removeAttribute("src");
      window.requestAnimationFrame(() => {
        if (!image.isConnected) return;
        image.src = source;
      });
    }, RETRY_DELAYS[attempt - 1]);
  }

  document.addEventListener(
    "error",
    (event) => {
      retryImage(event.target);
    },
    true,
  );

  document.addEventListener(
    "load",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      if (!image.matches(".card-image, #catalog-dialog-image")) return;
      image.dataset.imageRetryAttempts = "0";
      image.dataset.imageRetryPending = "0";
      clearImageError(image);
    },
    true,
  );
})();
