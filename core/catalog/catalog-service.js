"use strict";

(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});
  const cache = new Map();

  // <catalog-metrics-generated>
  const CATALOG_METRICS = Object.freeze({
    "national": {
      "itemCount": 1025,
      "groupCount": 9,
      "unit": "종"
    },
    "series": {
      "itemCount": 20243,
      "groupCount": 273,
      "unit": "장"
    },
    "ar": {
      "itemCount": 530,
      "groupCount": 33,
      "unit": "장"
    },
    "pack": {
      "itemCount": 64,
      "groupCount": 3,
      "unit": "팩",
      "promoItemCount": 222,
      "promoPackCount": 36,
      "promoCardCount": 186
    },
    "pokemon": {
      "itemCount": 1333,
      "groupCount": 67,
      "unit": "장"
    },
    "artist": {
      "itemCount": 4873,
      "groupCount": 40,
      "unit": "장"
    },
    "people": {
      "itemCount": 179,
      "groupCount": 9,
      "unit": "명"
    },
    "trainerPokemon": {
      "itemCount": 245,
      "groupCount": 172,
      "unit": "장"
    },
    "fossil": {
      "itemCount": 122,
      "groupCount": 26,
      "unit": "장"
    },
    "world": {
      "itemCount": 108,
      "groupCount": 9,
      "unit": "장"
    }
  });
  // </catalog-metrics-generated>


  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return response.json();
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function asGroups(payload, preferredKey = "") {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    if (preferredKey && Array.isArray(payload[preferredKey])) {
      return payload[preferredKey];
    }
    for (const key of ["groups", "artists"]) {
      if (Array.isArray(payload[key])) return payload[key];
    }
    return [];
  }

  function mergeGroups(baseGroups, supplementGroups, key = "code") {
    const merged = [...asGroups(baseGroups)];
    for (const extra of asGroups(supplementGroups)) {
      const extraKey = clean(extra?.[key]).toLowerCase();
      if (!extraKey) continue;
      const index = merged.findIndex((group) => clean(group?.[key]).toLowerCase() === extraKey);
      if (index >= 0) merged[index] = extra;
      else merged.push(extra);
    }
    return merged;
  }

  function applySeriesImageOverrides(groups, payload) {
    const sets = payload?.sets && typeof payload.sets === "object"
      ? payload.sets
      : {};
    for (const group of asGroups(groups)) {
      const groupKey = clean(group?.code || group?.name).toLowerCase();
      const overrides = sets[groupKey];
      if (!overrides || typeof overrides !== "object") continue;
      for (const card of Array.isArray(group?.cards) ? group.cards : []) {
        const code = clean(card?.code || card?.meta);
        const image = clean(overrides[code] || overrides[code.toLowerCase()]);
        if (!image) continue;
        card.image = image;
        card.originalImage = image;
      }
    }
    return groups;
  }

  function applySearchImageOverrides(payload, overridesPayload) {
    const sets = overridesPayload?.sets && typeof overridesPayload.sets === "object"
      ? overridesPayload.sets
      : {};
    for (const group of Array.isArray(payload?.groups) ? payload.groups : []) {
      const groupKey = clean(group?.[0]).toLowerCase();
      const overrides = sets[groupKey];
      if (!overrides || typeof overrides !== "object") continue;
      for (const entry of Array.isArray(group?.[4]) ? group[4] : []) {
        const code = clean(entry?.[0]);
        const image = clean(overrides[code] || overrides[code.toLowerCase()]);
        if (!image) continue;
        entry[3] = image;
        if (entry.length > 8) entry[8] = image;
      }
    }
    return payload;
  }

  async function json(path) {
    if (!cache.has(path)) cache.set(path, fetchJson(path));
    return cache.get(path);
  }

  async function pokemonCollections() {
    const [base, supplement] = await Promise.all([
      json("./data/pokemon-collections.json"),
      json("./data/pokemon-collections-21-40.json"),
    ]);
    return mergeGroups(base, supplement, "name");
  }

  async function ar() {
    const [base, supplement] = await Promise.all([
      json("./data/ar.json"),
      json("./data/ar-supplement.json"),
    ]);
    return mergeGroups(base, supplement, "code");
  }

  async function series() {
    const [base, legacy, imageOverrides] = await Promise.all([
      json("./data/series.json"),
      json("./data/series-legacy.json").catch(() => []),
      json("./data/series-image-overrides.json").catch(() => ({ sets: {} })),
    ]);
    return applySeriesImageOverrides(
      mergeGroups(base, legacy, "code"),
      imageOverrides,
    );
  }

  async function pokemonSearchIndex() {
    const [payload, imageOverrides] = await Promise.all([
      json("./data/pokemon-search-index.json"),
      json("./data/series-image-overrides.json").catch(() => ({ sets: {} })),
    ]);
    return applySearchImageOverrides(payload, imageOverrides);
  }

  root.catalog = Object.freeze({
    catalogMetrics: CATALOG_METRICS,
    metric(collectionId) {
      return CATALOG_METRICS[clean(collectionId)] || null;
    },
    json,
    asGroups,
    mergeGroups,
    pokemonCollections,
    ar,
    series,
    pokemonSearchIndex,
  });
})();
