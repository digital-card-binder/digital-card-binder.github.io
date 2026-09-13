"use strict";

// Permanent UI correction for the two Cyber Judge entries whose Korean names
// were reversed in the generated catalog data. The original card images and
// card numbers remain unchanged.
(function applySeriesNameCorrections() {
  if (document.body?.dataset.catalog !== "series") return;

  const corrections = new Map([
    ["sv5m_033/071", "에리본"],
    ["sv5m_034/071", "날개치는머리"],
  ]);

  function correctCard(root) {
    if (!root) return;

    for (const [code, name] of corrections) {
      const number = Array.from(root.querySelectorAll(".number-badge"))
        .find((element) => element.textContent.trim() === code);
      if (!number) continue;

      const card = number.closest("article") || number.closest(".pokemon-card") || number.parentElement?.parentElement;
      const nameElement = card?.querySelector(".card-name-ko");
      if (nameElement) nameElement.textContent = name;

      const image = card?.querySelector("img.card-image");
      if (image) image.alt = `${name} 카드`;
    }

    const dialogCode = document.querySelector("#dialog-code")?.textContent.trim();
    const dialogName = corrections.get(dialogCode);
    if (dialogName) {
      const dialogTitle = document.querySelector("#dialog-name");
      if (dialogTitle) dialogTitle.textContent = dialogName;
      const dialogImage = document.querySelector("#catalog-dialog-image");
      if (dialogImage) dialogImage.alt = `${dialogName} 카드`;
    }
  }

  const observer = new MutationObserver(() => correctCard(document));
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  correctCard(document);
})();
