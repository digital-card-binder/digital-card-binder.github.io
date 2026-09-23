"use strict";

(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});
  const seriesCatalogPromises = new Map();

  function normalizeSetCode(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9-]/gi, "")
      .toUpperCase();
  }

  function normalizedCardNumber(value) {
    const numerator = String(value || "")
      .split("/")[0]
      .match(/\d{1,4}/)?.[0];
    return numerator ? numerator.padStart(3, "0") : "";
  }

  function normalizeCardName(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("ko-KR")
      .replace(/[\s·._()\-]+/g, "");
  }

  function namesAreCompatible(inputName, catalogName) {
    const input = normalizeCardName(inputName);
    const catalog = normalizeCardName(catalogName);
    return (
      !input ||
      !catalog ||
      input === catalog ||
      input.includes(catalog) ||
      catalog.includes(input)
    );
  }

  function catalogCardNumber(card) {
    const value = String(card?.cardNumber || card?.code || card?.meta || "");
    const separator = value.lastIndexOf("_");
    return separator >= 0 ? value.slice(separator + 1) : value;
  }

  function fetchJson(fetcher, path) {
    return fetcher(path, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error(`${path} ${response.status}`);
      return response.json();
    });
  }

  async function loadSeriesCatalog(options = {}) {
    const includeLegacy = options.includeLegacy !== false;
    const fetcher = options.fetcher || window.fetch.bind(window);
    const key = includeLegacy ? "with-legacy" : "modern-only";
    if (!seriesCatalogPromises.has(key)) {
      const promise = Promise.all([
        fetchJson(fetcher, "./data/series.json"),
        includeLegacy
          ? fetchJson(fetcher, "./data/series-legacy.json").catch(() => [])
          : Promise.resolve([]),
      ])
        .then(([baseGroups, legacyGroups]) => {
          const merged = new Map();
          [...(baseGroups || []), ...(legacyGroups || [])].forEach((group) => {
            const code = normalizeSetCode(group?.code || group?.name);
            if (code) merged.set(code, group);
          });
          return [...merged.values()];
        })
        .catch((error) => {
          seriesCatalogPromises.delete(key);
          throw error;
        });
      seriesCatalogPromises.set(key, promise);
    }
    return seriesCatalogPromises.get(key);
  }

  async function lookupSeriesCard(setCode, cardNumber, cardName, options = {}) {
    const normalizedSet = normalizeSetCode(setCode);
    const normalizedNumber = normalizedCardNumber(cardNumber);
    if (!normalizedSet || !normalizedNumber) return null;

    const groups = await loadSeriesCatalog(options);
    const group = groups.find(
      (candidate) =>
        normalizeSetCode(candidate?.code || candidate?.name) === normalizedSet,
    );
    if (!group) return null;

    const numberMatches = (group.cards || []).filter((card) => {
      const code = String(card?.code || card?.meta || "");
      const codeSet = code.includes("_") ? code.split("_")[0] : group.code;
      return (
        normalizeSetCode(codeSet) === normalizedSet &&
        normalizedCardNumber(catalogCardNumber(card)) === normalizedNumber
      );
    });
    if (!numberMatches.length) return null;

    const matched =
      numberMatches.find((card) => namesAreCompatible(cardName, card.name)) ||
      numberMatches[0];

    if (matched.name && cardName && !namesAreCompatible(cardName, matched.name)) {
      throw new Error(
        `입력한 카드명(${cardName})과 검색된 카드명(${matched.name})이 다릅니다. 카드번호를 확인해주세요.`,
      );
    }

    return {
      imageUrl: matched.originalImage || matched.image || "",
      cardName: matched.name || cardName,
      setName: group.name || group.title || setCode,
    };
  }

  function officialImageCandidates(setCode, cardNumber) {
    const code = normalizeSetCode(setCode);
    const number = normalizedCardNumber(cardNumber);
    if (!code || !number) return [];

    const typedCode = String(setCode || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9-]/gi, "");
    const canonicalCode = typedCode
      .replace(/^adv/i, "ADV")
      .replace(/^sv/i, "SV")
      .replace(/^sm/i, "SM")
      .replace(/^xy/i, "XY")
      .replace(/^bw/i, "BW")
      .replace(/^m/i, "M")
      .replace(/^s/i, "S");
    const codeVariants = [canonicalCode, code].filter(
      (value, index, values) => value && values.indexOf(value) === index,
    );

    let primaryRoot = "";
    if (code.startsWith("ADV")) primaryRoot = "ADV";
    else if (code.startsWith("SV")) primaryRoot = "SV";
    else if (code.startsWith("SM")) primaryRoot = "SM";
    else if (code.startsWith("XY")) primaryRoot = "XY";
    else if (code.startsWith("BW")) primaryRoot = "BW";
    else if (/^M\d/.test(code)) primaryRoot = "MEGA";
    else if (code.startsWith("S")) primaryRoot = "S";

    const roots = [
      primaryRoot,
      "SV",
      "S",
      "MEGA",
      "SM",
      "XY",
      "BW",
      "ADV",
    ].filter((value, index, values) => value && values.indexOf(value) === index);
    const base = "https://cards.image.pokemonkorea.co.kr/data/wmimages";

    return roots.flatMap((imageRoot) =>
      codeVariants.flatMap((candidateCode) => [
        `${base}/${imageRoot}/${candidateCode}/${candidateCode}_${number}.png`,
        `${base}/${imageRoot}/${candidateCode}/${candidateCode}_${number}.jpg`,
      ]),
    );
  }

  function imageLoads(url, options = {}) {
    const timeout = Number(options.timeout) || 5000;
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }

      let parsed;
      try {
        parsed = new URL(url, window.location.href);
      } catch {
        resolve(false);
        return;
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        resolve(false);
        return;
      }

      const image = new Image();
      let settled = false;
      const finish = (success) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        resolve(success);
      };
      const timer = window.setTimeout(() => finish(false), timeout);
      image.onload = () => finish(image.naturalWidth > 0);
      image.onerror = () => {
        if (window.DigitalCardBinderImageCdn?.restoreOriginal?.(image)) return;
        finish(false);
      };
      image.src = parsed.href;
    });
  }

  async function findRepresentativeCard(
    setCode,
    cardNumber,
    cardName,
    options = {},
  ) {
    const catalogMatch = await lookupSeriesCard(
      setCode,
      cardNumber,
      cardName,
      options,
    );
    if (
      catalogMatch?.imageUrl &&
      (await imageLoads(catalogMatch.imageUrl, options))
    ) {
      return catalogMatch;
    }

    const candidates = officialImageCandidates(setCode, cardNumber);
    const results = await Promise.all(
      candidates.map(async (imageUrl) => ({
        imageUrl,
        loaded: await imageLoads(imageUrl, options),
      })),
    );
    const match = results.find((result) => result.loaded);
    return match
      ? { imageUrl: match.imageUrl, cardName, setName: setCode }
      : null;
  }

  root.cardLookup = Object.freeze({
    normalizeSetCode,
    normalizedCardNumber,
    normalizeCardName,
    namesAreCompatible,
    catalogCardNumber,
    loadSeriesCatalog,
    lookupSeriesCard,
    officialImageCandidates,
    imageLoads,
    findRepresentativeCard,
  });
})();
