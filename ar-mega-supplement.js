"use strict";

(function () {
  const nativeFetch = window.fetch.bind(window);

  const groups = [
    {
      code: "m5",
      title: "어비스아이",
      cards: [
        [82, "짜랑랑"],
        [83, "카디나르마"],
        [84, "콘치"],
        [85, "누리레느"],
        [86, "썬더볼트"],
        [87, "야도란"],
        [88, "타타륜"],
        [89, "폭슬라이"],
        [90, "자루도"],
        [91, "바리톱스"],
        [92, "왕큰부리"],
        [93, "실버디"],
      ].map(([number, name]) => ({
        code: `m5_${String(number).padStart(3, "0")}/081 AR`,
        number,
        denominator: "081",
        name,
        image: `https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M5/M5_${String(number).padStart(3, "0")}.png?w=400`,
        owned: false,
      })),
    },
    {
      code: "m6",
      title: "스톰에메랄다",
      cards: [
        [77, "비나방"],
        [78, "가디"],
        [79, "마그마번"],
        [80, "가이오가"],
        [81, "에레키블"],
        [82, "찌르성게"],
        [83, "러브로스"],
        [84, "그란돈"],
        [85, "오케이징"],
        [86, "루리리"],
        [87, "파비코리"],
        [88, "켈리몬"],
      ].map(([number, name]) => ({
        code: `m6_${String(number).padStart(3, "0")}/076 AR`,
        number,
        denominator: "076",
        name,
        image: `https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6/M6_${String(number).padStart(3, "0")}.png?w=400`,
        owned: false,
      })),
    },
  ];

  function mergeArGroups(baseGroups) {
    const merged = Array.isArray(baseGroups) ? [...baseGroups] : [];
    groups.forEach((extra) => {
      const index = merged.findIndex(
        (group) => String(group?.code || "").toLowerCase() === extra.code,
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

    try {
      const merged = mergeArGroups(await response.clone().json());
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(merged), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.warn("M5/M6 AR 데이터를 합치지 못했습니다.", error);
      return response;
    }
  };
})();
