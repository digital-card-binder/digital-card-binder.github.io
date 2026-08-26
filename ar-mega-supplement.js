"use strict";

(function () {
  const nativeFetch = window.fetch.bind(window);
  const supplementPromise = nativeFetch("./data/ar-supplement.json", {
    cache: "no-store",
  })
    .then((response) => (response.ok ? response.json() : []))
    .catch((error) => {
      console.warn("M5/M6 AR 보충 데이터를 불러오지 못했습니다.", error);
      return [];
    });

  function mergeArGroups(baseGroups, supplementGroups) {
    const merged = Array.isArray(baseGroups) ? [...baseGroups] : [];
    (Array.isArray(supplementGroups) ? supplementGroups : []).forEach((extra) => {
      const extraCode = String(extra?.code || "").toLowerCase();
      const index = merged.findIndex(
        (group) => String(group?.code || "").toLowerCase() === extraCode,
      );
      if (index >= 0) merged[index] = extra;
      else merged.push(extra);
    });
    return merged;
  }

  window.fetch = async function arMegaSupplementFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    let isArData = false;
    try {
      const parsed = new URL(url, window.location.href);
      isArData = parsed.pathname.endsWith("/data/ar.json");
    } catch {
      isArData = false;
    }

    const response = await nativeFetch(input, init);
    if (!isArData || !response.ok) return response;

    // 모바일 브라우저의 네이티브 Response 객체는 절대 수정하지 않는다.
    // AR 페이지에서 실제 사용하는 최소 응답 인터페이스만 별도 객체로 제공한다.
    const baseJson = response.json.bind(response);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      url: response.url,
      async json() {
        const baseGroups = await baseJson();
        const supplementGroups = await supplementPromise;
        return mergeArGroups(baseGroups, supplementGroups);
      },
    };
  };
})();
