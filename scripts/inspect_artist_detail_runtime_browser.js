"use strict";

(async () => {
  const BASE = location.origin;
  const CARD_ID = "BS2026003019";
  if (!/pokemoncard\.co\.kr$/i.test(location.hostname)) {
    alert("포켓몬코리아 카드 검색 페이지(https://pokemoncard.co.kr/cards)에서 실행해주세요.");
    return;
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const downloadJson = (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "artist-detail-runtime-sample.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  console.log("[diagnostic] 카드 1장 상세 런타임을 확인합니다:", CARD_ID);

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = "1280px";
  frame.style.height = "900px";
  frame.src = `${BASE}/cards/detail/${CARD_ID}`;
  document.body.append(frame);

  const loaded = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 15000);
    frame.addEventListener("load", () => {
      clearTimeout(timer);
      resolve(true);
    }, { once: true });
  });

  await wait(5000);

  let result = { cardId: CARD_ID, loaded, generatedAt: new Date().toISOString() };
  try {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    const bodyText = (doc?.body?.innerText || "").replace(/\r/g, "");
    const html = doc?.documentElement?.outerHTML || "";
    const resources = win?.performance?.getEntriesByType?.("resource") || [];
    const resourceUrls = [...new Set(resources.map((e) => String(e.name || "")).filter(Boolean))];
    const interestingResources = resourceUrls.filter((url) => /ajax|api|card|detail|json|v2/i.test(url));
    const scripts = [...(doc?.scripts || [])].map((s) => ({ src: s.src || "", inlineStart: s.src ? "" : (s.textContent || "").slice(0, 500) }));
    const links = [...(doc?.querySelectorAll?.("a[href]") || [])].slice(0, 100).map((a) => ({ text: (a.textContent || "").trim().slice(0, 100), href: a.href }));

    result = {
      ...result,
      location: String(win?.location?.href || ""),
      title: doc?.title || "",
      bodyTextLength: bodyText.length,
      bodyTextStart: bodyText.slice(0, 12000),
      hasIllustratorLabel: /일러스트/.test(bodyText),
      hasArtistName: /Mitsuhiro\s+Arita/i.test(bodyText),
      htmlLength: html.length,
      htmlStart: html.slice(0, 12000),
      interestingResources,
      allResourceUrls: resourceUrls.slice(0, 250),
      scripts: scripts.slice(0, 80),
      links,
    };
  } catch (error) {
    result.error = String(error?.stack || error?.message || error);
  } finally {
    frame.remove();
  }

  console.log("[diagnostic] 완료", result);
  downloadJson(result);
})();
