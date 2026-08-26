"use strict";

(function () {
  const account = window.PokemonDexPageAccount;
  if (!account) return;

  async function saveActualCard(activeCard, details = {}) {
    if (!activeCard?.accountKey) {
      throw new Error("저장할 AR 카드 정보를 찾지 못했습니다.");
    }

    return await account.saveOverride(activeCard.accountKey, {
      owned: true,
      setCode: String(details.setCode || activeCard.setCode || "").trim(),
      cardNumber: String(details.cardNumber || activeCard.code || "").trim(),
      cardName: String(details.cardName || activeCard.name || "").trim(),
      imageUrl: String(details.imageUrl || activeCard.image || "").trim(),
    });
  }

  // 기존 실제 보유 카드 저장 기능은 유지하되 account.ready/applyGroups를
  // 덮어쓰지 않는다. AR 페이지 초기화는 ar.js 한 곳에서만 수행한다.
  window.PokemonArActualCardEditor = { saveActualCard };
})();
