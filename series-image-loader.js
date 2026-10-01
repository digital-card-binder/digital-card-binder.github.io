"use strict";

(function () {
  const MAX_IMAGE_RETRIES = 3;
  const RETRY_DELAYS = [800, 2200, 5000];

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
      image.removeAttribute("src");
      window.requestAnimationFrame(() => {
        if (!image.isConnected) return;
        image.src = source;
      });
    }, RETRY_DELAYS[attempt - 1]);
  }

  document.addEventListener("error", (event) => {
    retryImage(event.target);
  }, true);

  document.addEventListener("load", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (!image.matches(".card-image, #catalog-dialog-image")) return;
    image.dataset.imageRetryAttempts = "0";
    image.dataset.imageRetryPending = "0";
    clearImageError(image);
  }, true);

})();
