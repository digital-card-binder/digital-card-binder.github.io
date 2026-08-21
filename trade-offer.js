"use strict";

const TRADE_DRAFT_KEY = "digitalCardBinderTradeDraftV2";
const PROPOSAL_DRAFT_KEY = "digitalCardBinderProposalDraftV1";

function clean(value, maxLength = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function currentDialog() {
  return document.querySelector("dialog[open]");
}

function cardStateFromDialog(dialog) {
  if (!dialog) return null;
  const status = dialog.querySelector(".status-badge");
  const statusText = clean(status?.textContent, 40);
  const owned = Boolean(
    status?.classList.contains("is-owned") ||
    (!/미보유|미수집|아직/.test(statusText) && /보유|수집완료/.test(statusText)),
  );

  const image = dialog.querySelector("img");
  const heading = dialog.querySelector("h2");
  const number = dialog.querySelector(".number-badge");
  const detailParts = [
    number?.textContent,
    ...Array.from(dialog.querySelectorAll(
      ".dialog-name-en, [id$='dialog-meta'], [id$='dialog-generation'], " +
      "[id$='dialog-group'], [id$='dialog-artist-detail'], [id$='dialog-set'], " +
      "[id$='dialog-rarity'], [id$='dialog-card-number'], [id$='dialog-actual-set'], " +
      "[id$='dialog-actual-number'], [id$='dialog-actual-name'], [id$='dialog-actual-rarity']",
    ), (element) => element.textContent),
  ].map((value) => clean(value, 160)).filter(Boolean);
  const name = clean(heading?.textContent, 100);
  if (!name) return null;

  return {
    owned,
    card: {
      name,
      imageUrl: clean(image?.currentSrc || image?.src, 500),
      detail: clean([...new Set(detailParts)].join(" · "), 160),
      sourcePage: window.location.pathname.split("/").pop() || "",
    },
  };
}

function readDraft(key) {
  try {
    return JSON.parse(window.sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function sameCard(left, right) {
  return left?.name === right?.name &&
    left?.detail === right?.detail &&
    left?.sourcePage === right?.sourcePage;
}

function wantedCardsFromDraft(draft) {
  const cards = Array.isArray(draft?.wantedCards)
    ? draft.wantedCards.filter((item) => item?.name).slice(0, 6)
    : [];
  if (!cards.length && draft?.wantedCard?.name) cards.push(draft.wantedCard);
  return cards;
}

function ensureTradeButton(dialog) {
  const existing = dialog?.querySelector(".trade-offer-shortcut");
  const cardState = cardStateFromDialog(dialog);
  if (!cardState) {
    existing?.remove();
    return;
  }
  const proposalDraft = readDraft(PROPOSAL_DRAFT_KEY);
  const tradeDraft = readDraft(TRADE_DRAFT_KEY);
  const proposalMode = Boolean(proposalDraft?.postId);
  const registrationMode = wantedCardsFromDraft(tradeDraft).length > 0;
  const canSelect = proposalMode
    ? cardState.owned
    : (!cardState.owned || registrationMode);
  if (!canSelect) {
    existing?.remove();
    return;
  }

  const button = existing || document.createElement("button");
  const buttonText = proposalMode
    ? "이 카드로 교환 제안"
    : cardState.owned
      ? "줄 수 있는 카드로 추가"
      : registrationMode
        ? "구하는 카드로 추가"
        : "이 카드를 구해요";
  if (!existing) {
    button.type = "button";
    button.className = "trade-offer-shortcut";
  }
  if (button.textContent !== buttonText) button.textContent = buttonText;
  button.onclick = () => {
    const latest = cardStateFromDialog(dialog);
    if (!latest) return;
    try {
      if (proposalMode) {
        if (!latest.owned) return;
        const cards = Array.isArray(proposalDraft.cards)
          ? proposalDraft.cards.filter((item) => item?.name)
          : [];
        if (!cards.some((item) => sameCard(item, latest.card)) && cards.length < 6) {
          cards.push(latest.card);
        }
        window.sessionStorage.setItem(
          PROPOSAL_DRAFT_KEY,
          JSON.stringify({ ...proposalDraft, cards }),
        );
        window.location.href = "./trades.html?propose=1";
      } else if (latest.owned) {
        if (!registrationMode) return;
        const wantedCards = wantedCardsFromDraft(tradeDraft);
        const offeredCards = Array.isArray(tradeDraft.offeredCards)
          ? tradeDraft.offeredCards.filter((item) => item?.name)
          : [];
        if (!offeredCards.some((item) => sameCard(item, latest.card)) && offeredCards.length < 6) {
          offeredCards.push(latest.card);
        }
        window.sessionStorage.setItem(
          TRADE_DRAFT_KEY,
          JSON.stringify({ wantedCards, offeredCards }),
        );
        window.location.href = "./trades.html?register=1";
      } else {
        const wantedCards = wantedCardsFromDraft(tradeDraft);
        if (!wantedCards.some((item) => sameCard(item, latest.card)) && wantedCards.length < 6) {
          wantedCards.push(latest.card);
        }
        window.sessionStorage.setItem(
          TRADE_DRAFT_KEY,
          JSON.stringify({
            wantedCards,
            offeredCards: registrationMode && Array.isArray(tradeDraft.offeredCards)
              ? tradeDraft.offeredCards.slice(0, 6)
              : [],
          }),
        );
        window.location.href = "./trades.html?register=1";
      }
    } catch (error) {
      console.warn("교환 등록용 카드 정보를 준비하지 못했습니다.", error);
    }
  };

  if (!existing) {
    const target = dialog.querySelector(".dialog-card-copy") || dialog;
    target.append(button);
  }
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
