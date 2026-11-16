"use strict";

// 모든 도감 카드에 ♡ 버튼을 붙이고 위시 저장소와 상태를 맞춘다.
(function () {
  const CARD_SELECTOR = "article.pokemon-card, article.art-theme-card";
  const wishlist = () => window.DigitalCardBinder?.wishlist;
  let toastTimer = 0;

  function showToast(message) {
    let toast = document.getElementById("wish-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "wish-toast";
      toast.className = "wish-toast";
      toast.setAttribute("role", "status");
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function pageRef() {
    const file = window.location.pathname.split("/").pop() || "index.html";
    return `./${file}${window.location.search || ""}`;
  }

  function infoFrom(card) {
    const image = card.querySelector("img.card-image, .art-theme-card-image img, img");
    const nameEl = card.querySelector(".card-name-ko, h3, strong");
    const tagEl = card.querySelector(".card-tag, .art-theme-card-badges span");
    const src = image?.currentSrc || image?.getAttribute("src") || image?.dataset?.src || "";
    return {
      name: nameEl?.textContent || "",
      tag: tagEl?.textContent || "",
      image: src,
      page: pageRef(),
    };
  }

  function paint(button, info) {
    const wished = Boolean(wishlist()?.has(info));
    button.classList.toggle("is-wished", wished);
    button.setAttribute("aria-pressed", wished ? "true" : "false");
    button.textContent = wished ? "♥" : "♡";
    button.setAttribute("aria-label", `${info.name || "카드"} ${wished ? "위시에서 빼기" : "위시에 담기"}`);
  }

  function attach(card) {
    if (card.querySelector(":scope > .wish-heart")) return;
    if (!card.querySelector("img")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wish-heart";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const info = infoFrom(card);
      if (!info.name) return;
      const result = await wishlist()?.toggle(info);
      if (result === "signed-out") showToast("로그인하면 위시카드를 저장할 수 있어요.");
      else if (result === "full") showToast(`위시카드는 최대 ${wishlist().MAX_ITEMS}장까지 담을 수 있어요.`);
      else if (result === "error") showToast("위시카드를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      else if (result === "added") showToast("위시에 담았어요.");
      else if (result === "removed") showToast("위시에서 뺐어요.");
      paint(button, infoFrom(card));
    });
    card.append(button);
    paint(button, infoFrom(card));
    // 이미지가 늦게 채워지는 카드도 올바른 키로 다시 표시한다.
    card.querySelector("img")?.addEventListener("load", () => paint(button, infoFrom(card)), { once: true });
  }

  function scan(root) {
    if (!(root instanceof Element)) return;
    if (root.matches?.(CARD_SELECTOR)) attach(root);
    root.querySelectorAll?.(CARD_SELECTOR).forEach(attach);
  }

  function repaintAll() {
    document.querySelectorAll(`${CARD_SELECTOR}`).forEach((card) => {
      const button = card.querySelector(":scope > .wish-heart");
      if (button) paint(button, infoFrom(card));
    });
  }

  function start() {
    if (!document.querySelector(CARD_SELECTOR) && !document.querySelector("main")) return;
    scan(document.body);
    let queued = false;
    const pending = new Set();
    new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach((node) => pending.add(node));
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        for (const node of pending) scan(node);
        pending.clear();
      });
    }).observe(document.body, { childList: true, subtree: true });
    wishlist()?.subscribe(repaintAll);
    // 로그인 상태가 확인되면 이미 담긴 카드를 ♥로 표시한다.
    wishlist()?.ready().then(repaintAll);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
