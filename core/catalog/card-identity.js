"use strict";

(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});

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

  root.cardIdentity = Object.freeze({ groupIdentity, cardIdentity });
})();
