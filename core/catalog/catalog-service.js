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

  function mergeGroups(baseGroups, supplementGroups, key = "code") {
    const merged = Array.isArray(baseGroups) ? [...baseGroups] : [];
    for (const extra of Array.isArray(supplementGroups) ? supplementGroups : []) {
      const extraKey = clean(extra?.[key]).toLowerCase();
      if (!extraKey) continue;
      const index = merged.findIndex(
        (group) => clean(group?.[key]).toLowerCase() === extraKey,
      );
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

  root.catalog = Object.freeze({
    json,
    mergeGroups,
    pokemonCollections,
    ar,
  });
})();
