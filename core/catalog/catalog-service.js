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
      "itemCount": 151,
      "groupCount": 9,
      "unit": "팩",
      "promoItemCount": 222,
      "promoPackCount": 36,
      "promoCardCount": 186
    },
    "pokemon": {
      "itemCount": 14988,
      "groupCount": 1025,
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
      "itemCount": 198,
      "groupCount": 9,
      "unit": "개"
    },
    "artThemes": {
      "itemCount": 13538,
      "groupCount": 12,
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

  // Verified image labels. Stored catalog records and ownership identities stay intact.
  const REVIEWED_CARD_NAMES = Object.freeze({
    "sv5m_033/071": "에블리",
    "sv5m_034/071": "에리본",
  });
  function reviewedCardName(code, fallback) {
    return REVIEWED_CARD_NAMES[clean(code).toLowerCase()] || fallback;
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
    for (const group of asGroups(groups)) {
      for (const card of group.cards || []) card.name = reviewedCardName(card.code, card.name);
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
    for (const group of payload?.groups || []) {
      for (const entry of group[4] || []) {
        const name = REVIEWED_CARD_NAMES[clean(entry[0]).toLowerCase()];
        if (name) { entry[1] = name; entry[2] = name; }
      }
    }
    return payload;
  }

  async function json(path) {
    if (!cache.has(path)) cache.set(path, fetchJson(path));
    return cache.get(path);
  }

  // Preserve curated collection entries and their existing ownership identities.
  // The Korean master index supplies cards for all previously empty species.
  let pokemonCollectionsPromise = null;

  function pokemonCollectionSpecies(rawName, nameSet) {
    let name = clean(rawName).normalize("NFKC").replace(/\s+/g, " ");
    const aliases = { "모래털가죽": "모래털가족" };
    const suffix = /(?:\s*(?:ex|gx|vmax|vstar|v-union|v|break|lv\.?x|legend|☆|★|프라임|δ|x))+$/i;
    const prefix = /^(?:알로라|가라르|히스이|팔데아|빛나는|찬란한|다크|메가|M|일격|연격)\s*/i;
    for (let i = 0; i < 4 && name; i += 1) {
      if (nameSet.has(name)) return name;
      if (nameSet.has(aliases[name])) return aliases[name];
      const shortened = name
        .replace(suffix, "")
        .replace(prefix, "")
        .replace(/^[^\s]{1,20}의\s+/, "")
        .trim();
      if (shortened === name) break;
      name = shortened;
    }
    return nameSet.has(name) ? name : aliases[name] || "";
  }

  async function buildPokemonCollections() {
    const [base, supplement, pokedex, index] = await Promise.all([
      json("./data/pokemon-collections.json"),
      json("./data/pokemon-collections-21-40.json"),
      json("./data/pokedex.json"),
      pokemonSearchIndex(),
    ]);
    const records = Array.isArray(pokedex?.records) ? pokedex.records : [];
    if (records.length !== 1025 || index?.version !== 2) {
      throw new Error("포켓몬 컬렉션 원본 데이터의 구조가 올바르지 않습니다.");
    }

    const curated = mergeGroups(base, supplement, "name");
    const curatedByName = new Map(curated.map((group) => [clean(group.name), group]));
    const allNames = new Set(records.map((record) => clean(record.nameKo)));
    const additional = new Map(
      records.filter((record) => !curatedByName.has(clean(record.nameKo)))
        .map((record) => [clean(record.nameKo), {
          name: record.nameKo,
          ...(record.number === 989 ? { code: "모래털가족" } : {}),
          dexNumber: record.number,
          cards: [],
        }]),
    );
    const knownCards = new Map([...additional.keys()].map((name) => [name, new Set()]));

    for (const group of Array.isArray(index.groups) ? index.groups : []) {
      for (const entry of Array.isArray(group?.[4]) ? group[4] : []) {
        const species = pokemonCollectionSpecies(entry?.[1], allNames)
          || pokemonCollectionSpecies(entry?.[2], allNames);
        const target = additional.get(species);
        if (!target) continue;
        const code = clean(entry?.[0]);
        const encodedImage = clean(entry?.[3]);
        if (!code || !encodedImage) continue;
        const identity = code.toLowerCase();
        if (knownCards.get(species).has(identity)) continue;
        knownCards.get(species).add(identity);
        const image = encodedImage.startsWith("@/")
          ? index.imageBase + encodedImage.slice(1)
          : encodedImage;
        target.cards.push({
          name: clean(entry?.[1]) || species,
          code,
          meta: code,
          image,
          owned: false,
          accountIndex: 0,
        });
      }
    }

    return records.map((record) => {
      const name = clean(record.nameKo);
      const existing = curatedByName.get(name);
      return existing
        ? { ...existing, dexNumber: record.number }
        : additional.get(name);
    });
  }

  async function pokemonCollections() {
    if (!pokemonCollectionsPromise) {
      pokemonCollectionsPromise = buildPokemonCollections().catch((error) => {
        pokemonCollectionsPromise = null;
        throw error;
      });
    }
    return pokemonCollectionsPromise;
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

  // Existing series records provide the same cards at their correct image paths.
  // Keep world JSON, slot numbers and ownership identities unchanged.
  const REVIEWED_WORLD_IMAGES = Object.freeze({
    "kanto-pokemon-center": "https://cards.image.pokemonkorea.co.kr/data/wmimages/BW/BGR/bw3_hb_051.jpg",
    "kanto-pokestop": "https://dcb-card-images-modern-2026.pages.dev/data/wmimages/S/S10b/S10b_071.webp",
  });

  // Reference metadata only: each world item keeps its independent worldDex key.
  async function worldGroups() {
    const [world, pokedex, people] = await Promise.all([
      json("./data/world-exploration.json"),
      json("./data/pokedex.json"),
      json("./data/people.json"),
    ]);
    const pokemonMap = new Map((pokedex.records || []).map((item) => [Number(item.number), item]));
    const personMap = new Map((people.people || []).map((item) => [item.id, item]));
    return (world.generations || []).map((generation) => {
      const slots = [
        ...(generation.slots || []).map((slot, accountIndex) => ({
          ...slot, accountIndex,
          card: { ...slot.card, image: REVIEWED_WORLD_IMAGES[slot.id] || slot.card?.image || "" },
        })),
        ...(generation.pokemonRefs || []).map((number, index) => {
          const source = pokemonMap.get(Number(number)) || {};
          return {
            id: `world-pokemon-${String(Number(number)).padStart(4, "0")}`,
            worldType: "pokemon",
            title: source.nameKo || source.nameEn || `포켓몬 #${number}`,
            subtitle: `#${String(Number(number)).padStart(4, "0")} · ${source.nameEn || ""}`,
            accountIndex: 12 + index,
            card: { image: window.DigitalCardBinderImageCdn?.repairSource?.(source.imageUrl) || source.imageUrl || "", name: source.nameKo || source.nameEn || "" },
          };
        }),
        ...(generation.peopleRefs || []).map((id, index) => {
          const source = personMap.get(id) || {};
          const card = source.cards?.[0] || {};
          return {
            id: `world-person-${id}`,
            worldType: "person",
            title: source.nameKo || source.nameEn || id,
            subtitle: source.role || source.affiliation || source.nameEn || "",
            accountIndex: 18 + index,
            card: { ...card, image: card.imageLarge || card.image || source.imageLarge || source.image || "" },
          };
        }),
      ];
      return {
        code: `generation-${generation.generation}`,
        name: `${generation.generation}세대 ${generation.region || ""}`.trim(),
        cards: slots.map((slot) => ({
          code: slot.id, slotId: slot.id, name: slot.title,
          image: slot.card?.image || "", owned: false,
          accountIndex: slot.accountIndex, slot,
        })),
      };
    });
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
    worldGroups,
  });
})();
