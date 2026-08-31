"use strict";

(function () {
  const supplement = window.PokemonDexMegaLatest;
  if (!supplement) return;

  const nativeFetch = window.fetch.bind(window);
  const normalizeCode = (value) => String(value || "").trim().toLowerCase();

  const M6_ARTIST_CARDS = Object.freeze([
    { artist: "Jerky", number: 8, name: "꼬시레", rarity: "C" },
    { artist: "kodama", number: 17, name: "만타인", rarity: "C" },
    { artist: "Yukihiro Tada", number: 27, name: "찌리비", rarity: "C" },
    { artist: "OKACHEKE", number: 28, name: "찌리비크", rarity: "U" },
    { artist: "Shinji Kanda", number: 46, name: "깜까미", rarity: "C" },
    { artist: "kawayoo", number: 47, name: "오케이징", rarity: "C" },
    { artist: "AKIRA EGAWA", number: 49, name: "크리만", rarity: "U" },
    { artist: "Mitsuhiro Arita", number: 52, name: "짜랑고우거", rarity: "R" },
    { artist: "Saboteri", number: 53, name: "모토마", rarity: "C" },
    { artist: "Tetsu Kayama", number: 82, name: "찌르성게", rarity: "AR" },
    { artist: "Narumi Sato", number: 86, name: "루리리", rarity: "AR" },
    { artist: "kodama", number: 87, name: "파비코리", rarity: "AR" },
    { artist: "Tomokazu Komiya", number: 88, name: "켈리몬", rarity: "AR" },
  ]);

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

  function m6CardNumber(card) {
    if (normalizeCode(card?.set) !== "m6") return null;
    const match = String(card?.cardNumber || "").match(/^(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function buildArtistCard(extra, order) {
    const token = String(extra.number).padStart(3, "0");
    return {
      order,
      name: extra.name,
      owned: false,
      set: "M6",
      rarity: extra.rarity,
      image: `https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6/M6_${token}.png?w=400`,
      imageBw: "",
      source: `https://pokemoncard.co.kr/cards/detail/BS2026005${token}`,
      cardNumber: `${token}/076 ${extra.rarity}`,
    };
  }

  function mergeArtistM6(payload) {
    if (!payload || !Array.isArray(payload.artists)) return payload;

    const extrasByArtist = new Map();
    M6_ARTIST_CARDS.forEach((extra) => {
      const list = extrasByArtist.get(extra.artist) || [];
      list.push(extra);
      extrasByArtist.set(extra.artist, list);
    });

    payload.artists.forEach((artist) => {
      const extras = extrasByArtist.get(artist?.name);
      if (!extras?.length || !Array.isArray(artist.cards)) return;

      const existingNumbers = new Set(
        artist.cards.map(m6CardNumber).filter((number) => Number.isFinite(number)),
      );
      const missing = extras
        .filter((extra) => !existingNumbers.has(extra.number))
        .sort((left, right) => left.number - right.number);
      if (!missing.length) return;

      const numericOrders = artist.cards
        .map((card) => Number(card?.order))
        .filter((value) => Number.isFinite(value));
      const firstOrder = numericOrders.length ? Math.min(...numericOrders) : 1;
      const baseOrder = firstOrder - 1000;
      missing.forEach((extra, index) => {
        artist.cards.push(buildArtistCard(extra, baseOrder + index));
      });
    });

    payload.cardCount = payload.artists.reduce(
      (total, artist) => total + (Array.isArray(artist.cards) ? artist.cards.length : 0),
      0,
    );
    payload.ownedCount = payload.artists.reduce(
      (total, artist) => total + (Array.isArray(artist.cards)
        ? artist.cards.filter((card) => Boolean(card?.owned)).length
        : 0),
      0,
    );
    return payload;
  }

  function jsonResponse(response, payload) {
    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  window.fetch = async function megaCatalogFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    let isSeriesData = false;
    let isArtistData = false;
    try {
      const parsed = new URL(url, window.location.href);
      isSeriesData = parsed.pathname.endsWith("/data/series.json");
      isArtistData = parsed.pathname.endsWith("/data/artists.json");
    } catch {
      isSeriesData = false;
      isArtistData = false;
    }

    const response = await nativeFetch(input, init);
    if ((!isSeriesData && !isArtistData) || !response.ok) return response;

    try {
      const payload = await response.clone().json();
      if (isSeriesData) return jsonResponse(response, mergeGroups(payload));
      if (isArtistData) return jsonResponse(response, mergeArtistM6(payload));
      return response;
    } catch (error) {
      console.warn("최신 MEGA 도감 데이터를 합치지 못했습니다.", error);
      return response;
    }
  };
})();
