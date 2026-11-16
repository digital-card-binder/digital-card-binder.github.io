"use strict";

// 공개 프로필에서 이브이 도감 허브로 들어온 경우, 하위 도감 링크와 돌아가기 링크에
// 컬렉터 정보를 이어 붙여 읽기 전용 공개 보기를 유지한다.
(function () {
  const publicId = new URLSearchParams(window.location.search).get("collector") || "";
  if (!/^[a-z0-9]{12}$/.test(publicId)) return;

  document.querySelectorAll('.theme-card-grid a.theme-card[href^="./art-themes.html"]').forEach((link) => {
    const url = new URL(link.getAttribute("href"), window.location.href);
    url.searchParams.set("collector", publicId);
    link.setAttribute("href", `./art-themes.html${url.search}`);
  });

  const back = document.querySelector(".eevee-back-link");
  if (back) {
    back.setAttribute("href", `./collector.html?id=${publicId}`);
    back.replaceChildren();
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "←";
    back.append(arrow, document.createTextNode(" 컬렉터 프로필"));
  }
})();
