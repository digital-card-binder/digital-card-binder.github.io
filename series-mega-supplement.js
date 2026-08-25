"use strict";

(function () {
  const supplement = window.PokemonDexMegaLatest;
  if (!supplement) return;

  const nativeFetch = window.fetch.bind(window);

  const normalizeCode = (value) => String(value || "").trim().toLowerCase();

  function cardNumber(card) {
    const match = String(card?.code || card?.meta || "").match(/_(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function patchM5(group) {
    if (normalizeCode(group?.code) !== "m5") return group;
    const overrides = supplement.m5NameOverrides || {};
    (group.cards || []).forEach((card) => {
      const number = cardNumber(card);
      if (number != null && overrides[number]) {
        card.name = overrides[number];
      } else if (!String(card.name || "").trim() && String(card.pokemonName || "").trim()) {
        card.name = card.pokemonName;
      }
    });
    return group;
  }

  function mergeGroups(baseGroups) {
    const groups = Array.isArray(baseGroups) ? baseGroups.map(patchM5) : [];

    (supplement.groups || []).forEach((extra) => {
      const code = normalizeCode(extra?.code);
      if (!code) return;

      const existingIndex = groups.findIndex(
        (group) => normalizeCode(group?.code || group?.name) === code,
      );
      if (existingIndex >= 0) {
        groups[existingIndex] = extra;
        return;
      }

      let insertAt = groups.length;
      for (let index = groups.length - 1; index >= 0; index -= 1) {
        const group = groups[index];
        const era = String(group?.era || "").toUpperCase();
        const groupCode = normalizeCode(group?.code || group?.name);
        if (era === "M" || (/^m\d/.test(groupCode) && !groupCode.startsWith("sm"))) {
          insertAt = index + 1;
          break;
        }
      }
      groups.splice(insertAt, 0, extra);
    });

    return groups;
  }

  window.fetch = async function megaSeriesFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    let isSeriesData = false;
    try {
      const parsed = new URL(url, window.location.href);
      isSeriesData = parsed.pathname.endsWith("/data/series.json");
    } catch {
      isSeriesData = false;
    }

    const response = await nativeFetch(input, init);
    if (!isSeriesData || !response.ok) return response;

    try {
      const groups = mergeGroups(await response.json());
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(groups), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.warn("최신 MEGA 시리즈 데이터를 합치지 못했습니다.", error);
      return response;
    }
  };
})();
