"use strict";

(function () {
  const CARD_NUMBER_PATTERN = /\b\d{1,4}\s*\/\s*\d{1,4}\b/;
  const SET_CODE_PATTERN = /\/wmimages\/(?:SV|SM|S|MEGA|XY|BW)\/([^/]+)\//i;

  function inferSetCodeFromImage(imageUrl) {
    return String(imageUrl || "").match(SET_CODE_PATTERN)?.[1] || "";
  }

  function normalizeCardNumber(value) {
    return String(value || "").match(CARD_NUMBER_PATTERN)?.[0]?.replace(/\s+/g, "") || "";
  }

  function updateCardMeta(card) {
    const image = card.querySelector(".card-image");
    const meta = card.querySelector(".world-card-meta");
    if (!image || !meta) return;

    const setCode = inferSetCodeFromImage(image.currentSrc || image.src);
    const cardNumber = normalizeCardNumber(meta.textContent);
    if (!setCode || !cardNumber) return;

    const compactLabel = `${setCode} ${cardNumber}`;
    if (meta.textContent !== compactLabel) {
      meta.textContent = compactLabel;
      meta.title = compactLabel;
    }
  }

  function updateAll(root) {
    if (!(root instanceof Element || root instanceof Document)) return;
    if (root.matches?.(".world-slot")) updateCardMeta(root);
    root.querySelectorAll?.(".world-slot").forEach(updateCardMeta);
  }

  function init() {
    const binder = document.getElementById("world-binder-content");
    if (!binder) return;

    updateAll(binder);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) updateAll(node);
        });
      }
      updateAll(binder);
    });

    observer.observe(binder, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
