"use strict";

(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});
  const cache = new Map();

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
    const [base, legacy] = await Promise.all([
      json("./data/series.json"),
      json("./data/series-legacy.json").catch(() => []),
    ]);
    return mergeGroups(base, legacy, "code");
  }

  root.catalog = Object.freeze({
    json,
    asGroups,
    mergeGroups,
    pokemonCollections,
    ar,
    series,
  });
})();
