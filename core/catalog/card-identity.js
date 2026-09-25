"use strict";

(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});

  function cleanPart(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function normalizedPart(value) {
    return cleanPart(value).toLowerCase();
  }

  function groupIdentity(group, groupIndex) {
    return String(group?.code || group?.name || group?.title || groupIndex);
  }

  function cardIdentity(collectionId, group, card, groupIndex, cardIndex) {
    const groupId = groupIdentity(group, groupIndex);
    const accountIndex = Number.isInteger(card?.accountIndex)
      ? card.accountIndex
      : cardIndex;

    if (collectionId === "trainerPokemon") {
      return [
        "trainerPokemon",
        groupId,
        card?.meta || card?.code || card?.name || cardIndex,
        accountIndex,
      ].join("::");
    }

    if (collectionId === "artist") {
      return [
        groupId,
        card?.set || "",
        card?.cardNumber || "",
        card?.order ?? cardIndex,
      ].join("::");
    }

    if (collectionId === "series") {
      return [
        groupId,
        card?.code || card?.meta || cardIndex,
        accountIndex,
      ].join("::");
    }

    return [
      groupId,
      card?.meta || card?.code || card?.name || cardIndex,
      accountIndex,
    ].join("::");
  }

  function artistSetAliases(card) {
    const aliases = new Set();
    const directSet = cleanPart(card?.set);
    if (directSet) aliases.add(directSet);

    for (const source of [card?.image, card?.originalImage]) {
      const value = cleanPart(source);
      if (!value) continue;
      const pathname = value.split(/[?#]/, 1)[0];
      const filename = pathname.split("/").pop() || "";
      const match = filename.match(/^([^_]+)_\d+/i);
      if (match?.[1]) aliases.add(match[1]);
    }

    return [...aliases];
  }

  function cardCompatibilityKeys(collectionId, group, card, groupIndex, cardIndex) {
    const groupId = normalizedPart(groupIdentity(group, groupIndex));

    if (collectionId === "series") {
      const code = normalizedPart(card?.code || card?.meta || cardIndex);
      return code ? [`series::${groupId}::${code}`] : [];
    }

    if (collectionId === "artist") {
      const number = normalizedPart(card?.cardNumber || "");
      if (!number) return [];
      return artistSetAliases(card)
        .map((setCode) => normalizedPart(setCode))
        .filter(Boolean)
        .map((setCode) => `artist::${groupId}::${setCode}::${number}`);
    }

    return [];
  }

  function storedCompatibilityKey(collectionId, key) {
    const parts = cleanPart(key).split("::").map(cleanPart);

    if (collectionId === "series" && parts.length === 3) {
      const groupId = normalizedPart(parts[0]);
      const code = normalizedPart(parts[1]);
      return groupId && code ? `series::${groupId}::${code}` : "";
    }

    if (collectionId === "artist" && parts.length === 4) {
      const artist = normalizedPart(parts[0]);
      const setCode = normalizedPart(parts[1]);
      const number = normalizedPart(parts[2]);
      return artist && setCode && number
        ? `artist::${artist}::${setCode}::${number}`
        : "";
    }

    return "";
  }

  root.cardIdentity = Object.freeze({
    groupIdentity,
    cardIdentity,
    cardCompatibilityKeys,
    storedCompatibilityKey,
  });
})();
