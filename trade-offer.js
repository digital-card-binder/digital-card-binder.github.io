"use strict";

const TRADE_DRAFT_KEY = "digitalCardBinderTradeDraftV1";
const PROPOSAL_DRAFT_KEY = "digitalCardBinderProposalDraftV1";

function clean(value, maxLength = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function currentDialog() {
  return document.querySelector("dialog[open]");
}

function ownedCardFromDialog(dialog) {
  if (!dialog) return null;
  const status = dialog.querySelector(".status-badge");
  const imageWrap = dialog.querySelector(
    ".dialog-card-image, .dialog-image-wrap, [id$='dialog-image-wrap'], [id$='dialog-visual']",
  );
  const statusText = clean(status?.textContent, 40);
  const owned = Boolean(
    status?.classList.contains("is-owned") ||
    (!/미보유|미수집|아직/.test(statusText) && /보유|수집완료/.test(statusText)),
  ) && !imageWrap?.classList.contains("is-missing");
  if (!owned) return null;

  const image = dialog.querySelector("img");
  const heading = dialog.querySelector("h2");
  const number = dialog.querySelector(".number-badge");
  const detail = dialog.querySelector(
    ".dialog-name-en, [id$='dialog-meta'], [id$='dialog-actual-card']",
  );
  const name = clean(heading?.textContent, 100);
  if (!name) return null;

  return {
    name,
    imageUrl: clean(image?.currentSrc || image?.src, 500),
    detail: clean(
      [number?.textContent, detail?.textContent].filter(Boolean).join(" · "),
      160,
    ),
    sourcePage: window.location.pathname.split("/").pop() || "",
  };
}

function ensureTradeButton(dialog) {
  const existing = dialog?.querySelector(".trade-offer-shortcut");
  const card = ownedCardFromDialog(dialog);
  if (!card) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "trade-offer-shortcut";
  let proposalDraft = null;
  try {
    proposalDraft = JSON.parse(window.sessionStorage.getItem(PROPOSAL_DRAFT_KEY) || "null");
  } catch {
    proposalDraft = null;
  }
  const proposalMode = Boolean(proposalDraft?.postId);
  button.textContent = proposalMode ? "이 카드로 교환 제안" : "교환에 내놓기";
  button.addEventListener("click", () => {
    const latest = ownedCardFromDialog(dialog);
    if (!latest) return;
    try {
      if (proposalMode) {
        const cards = Array.isArray(proposalDraft.cards)
          ? proposalDraft.cards.filter((item) => item?.name)
          : [];
        const duplicate = cards.some((item) =>
          item.name === latest.name &&
          item.detail === latest.detail &&
          item.sourcePage === latest.sourcePage
        );
        if (!duplicate && cards.length < 6) cards.push(latest);
        window.sessionStorage.setItem(
          PROPOSAL_DRAFT_KEY,
          JSON.stringify({ ...proposalDraft, cards }),
        );
        window.location.href = "./trades.html?propose=1";
      } else {
        window.sessionStorage.setItem(TRADE_DRAFT_KEY, JSON.stringify(latest));
        window.location.href = "./trades.html?register=1";
      }
    } catch (error) {
      console.warn("교환 등록용 카드 정보를 준비하지 못했습니다.", error);
    }
  });

  const target = dialog.querySelector(".dialog-card-copy") || dialog;
  target.append(button);
}

function refresh() {
  const dialog = currentDialog();
  if (dialog) ensureTradeButton(dialog);
}

document.addEventListener("click", () => window.setTimeout(refresh, 0));
document.addEventListener("change", () => window.setTimeout(refresh, 0));
new MutationObserver(refresh).observe(document.body, {
  attributes: true,
  attributeFilter: ["open", "class"],
  childList: true,
  subtree: true,
});
