import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("card dialogs expose one shared add-to-binder bridge", async () => {
  const bridge = await read("binder-bridge.js");
  const pages = [
    "national.html",
    "series.html",
    "ar.html",
    "pokemon-collections.html",
    "artists.html",
    "trainer-pokemon.html",
    "fossil.html",
    "world.html",
    "art-themes.html",
    "pokemon-search.html",
    "people.html",
  ];

  assert.match(bridge, /dcb:binder-add-card:v1/);
  assert.match(bridge, /바인더에 넣기/);
  assert.match(bridge, /보유 상태는 변경하지 않습니다/);
  assert.match(bridge, /sessionStorage\.setItem/);
  assert.doesNotMatch(bridge, /saveOwned|saveOverride|saveCollection|owned\s*:/);

  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /binder-bridge[.]js[?]v=[0-9a-f]{12}/, page);
  }
});

test("Binder Studio receives a transferred card and chooses binder page and slot", async () => {
  const html = await read("studio.html");
  const client = await read("studio-custom.js");

  assert.match(html, /id="studio-card-add-dialog"/);
  assert.match(html, /id="studio-card-add-binder"/);
  assert.match(html, /id="studio-card-add-page"/);
  assert.match(html, /id="studio-card-add-slot"/);
  assert.match(client, /function readPendingCardTransfer\(/);
  assert.match(client, /function resolvePendingCardTransfer\(/);
  assert.match(client, /function renderCardAddBinderOptions\(/);
  assert.match(client, /function renderCardAddPageOptions\(/);
  assert.match(client, /function renderCardAddSlotOptions\(/);
  assert.match(client, /await loadSavedBinder\(target\)/);
  assert.match(client, /replaceSlotWithCard\(state[.]pendingResolvedCard, slotIndex\)/);
  assert.match(client, /await saveCurrentBinder\(\)/);
});

test("Binder placement keeps source provenance without touching ownership state", async () => {
  const html = await read("studio.html");
  const client = await read("studio-custom.js");

  assert.match(html, /id="studio-quick-source"/);
  assert.match(client, /sourceUrl: clean\(card[.]sourceUrl\)/);
  assert.match(client, /sourceLabel: clean\(card[.]sourceLabel\)/);
  assert.match(client, /sourceUrl: clean\(entry[.]card[.]sourceUrl\)/);
  assert.match(client, /sourceUrl: clean\(entry[?][.]sourceUrl\)/);
  assert.match(client, /window[.]open\(url, "_blank", "noopener"\)/);

  const directAddBlock = client.slice(
    client.indexOf("function readPendingCardTransfer"),
    client.indexOf("function updateArtUi"),
  );
  assert.doesNotMatch(directAddBlock, /saveOwned|saveOverride|printVariants\s*=|owned\s*=/);
});


test("People archive cards expose per-card binder actions without changing ownership", async () => {
  const bridge = await read("binder-bridge.js");
  const people = await read("people.html");

  assert.match(people, /binder-bridge[.]js[?]v=[0-9a-f]{12}/);
  assert.match(bridge, /function installPeopleArchiveCards\(/);
  assert.match(bridge, /className = "binder-archive-add"/);
  assert.match(bridge, /sourceLabel: "인물도감"/);
  assert.match(bridge, /observePeopleArchive\(\)/);

  const peopleBridgeBlock = bridge.slice(
    bridge.indexOf("function peopleArchivePayload"),
    bridge.indexOf("function installAll"),
  );
  assert.doesNotMatch(peopleBridgeBlock, /saveOwned|saveOverride|saveCollection|owned\s*:/);
});

test("National Dex representative cards expose the shared binder action", async () => {
  const bridge = await read("binder-bridge.js");
  const national = await read("national.html");

  assert.match(national, /binder-bridge[.]js[?]v=[0-9a-f]{12}/);
  assert.match(bridge, /dialog: "#card-dialog"/);
  assert.match(bridge, /name: "#dialog-name-ko"/);
  assert.match(bridge, /image: "#dialog-image"/);
  assert.match(bridge, /label: "전국도감"/);
});
