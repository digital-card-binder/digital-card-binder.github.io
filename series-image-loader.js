"use strict";

(function () {
  const SERIES_DATA_PATH = "/data/series.json";
  const MAX_IMAGE_RETRIES = 3;
  const RETRY_DELAYS = [800, 2200, 5000];
  const nativeFetch = window.fetch.bind(window);

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

  const corrections = new Map([
    ["sv5m_033/071", "에리본"],
    ["sv5m_034/071", "날개치는머리"],
  ]);

  function correctNames(root = document) {
    for (const [code, name] of corrections) {
      const number = Array.from(root.querySelectorAll(".number-badge"))
        .find((element) => element.textContent.trim() === code);
      if (!number) continue;

      const card = number.closest(".catalog-card");
      const nameElement = card?.querySelector(".card-name-ko");
      if (nameElement && nameElement.textContent !== name) nameElement.textContent = name;

      const image = card?.querySelector("img.card-image");
      if (image && image.alt !== `${name} 카드`) image.alt = `${name} 카드`;
    }

    const dialogCode = document.querySelector("#dialog-code")?.textContent.trim();
    const dialogName = corrections.get(dialogCode);
    if (dialogName) {
      const dialogTitle = document.querySelector("#dialog-name");
      if (dialogTitle && dialogTitle.textContent !== dialogName) dialogTitle.textContent = dialogName;
      const dialogImage = document.querySelector("#catalog-dialog-image");
      if (dialogImage && dialogImage.alt !== `${dialogName} 카드`) dialogImage.alt = `${dialogName} 카드`;
    }
  }

  const observer = new MutationObserver(() => correctNames());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  correctNames();
})();
