import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const catalog = readFileSync(new URL("../catalog.js", import.meta.url), "utf8");
const section = (from, to) => {
  const start = catalog.indexOf(from);
  const end = catalog.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `source section: ${from}`);
  return catalog.slice(start, end);
};
const saveHelpers = section(
  "function captureCatalogSavePosition(card) {",
  "async function toggleCatalogCompletion(card, button) {",
);
const render = section("function render() {", "function seriesCardNumber(card) {");

function cardNode(card) {
  const classes = new Set(["catalog-card", "is-missing"]);
  const badge = { className: "status-badge is-missing", textContent: "미보유" };
  const completion = { disabled: false, textContent: "수집완료" };
  const image = { src: "old.png", getAttribute: () => "old.png" };
  const parts = {
    ".card-topline .status-badge": badge,
    ".collection-complete-button": completion,
    ".card-name-ko": { textContent: card.name },
    ".card-meta": { textContent: card.code },
    ".card-image": image,
  };
  return {
    badge,
    completion,
    classList: {
      contains: (value) => classes.has(value),
      toggle(value, enabled) {
        if (enabled) classes.add(value);
        else classes.delete(value);
      },
    },
    querySelector: (selector) => parts[selector] || null,
    getBoundingClientRect: () => ({ top: 225 }),
  };
}

function harness() {
  const cards = [
    { code: "m4_001", name: "첫 번째", owned: false },
    { code: "m4_002", name: "두 번째", owned: false },
    { code: "m4_003", name: "세 번째", owned: false },
  ];
  const byCard = new Map(cards.map((card) => [card, cardNode(card)]));
  const grid = {
    children: [],
    replaceChildren(...nodes) { this.children = nodes; },
  };
  const empty = { hidden: true, querySelector: () => ({ textContent: "" }) };
  const calls = { scroll: 0, renders: 0, stableRefreshes: [] };
  const context = vm.createContext({
    cards, mode: "series", selected: { code: "m4", name: "닌자스피너" },
    activeEra: "M", seriesBaseOnly: false,
    status: "missing", query: "", renderedCards: [],
    quickCollectMode: true,
    quickCollectPinnedCards: new WeakSet(),
    quickCollectPendingCards: new WeakSet(),
    quickCollectViewKey: "",
    window: { scrollY: 2000, scrollTo() { calls.scroll += 1; } },
    $: (name) => name === "catalog-grid" ? grid : name === "catalog-empty" ? empty : null,
    groupName: () => "닌자스피너",
    makeCard: (card) => byCard.get(card),
    setText: (id, value) => { if (id === "result-count") calls.count = value; },
    refreshCounts(stable) { calls.stableRefreshes.push(stable); },
    updateCompletionButton(button, card) {
      button.textContent = card.owned ? "✓ 수집완료" : "수집완료";
    },
    displayName: (card) => card.name,
    actualCardCode: (card) => card.code,
    imageFor: () => "old.png",
  });
  vm.runInContext(saveHelpers + "\n" + render, context);
  const run = (code) => vm.runInContext(code, context);
  return { cards, byCard, grid, calls, run };
}

test("quick collecting in missing view updates the card without rebuilding or scrolling", () => {
  const h = harness();
  h.run("render()");
  const firstNode = h.grid.children[0];
  const secondNode = h.grid.children[1];

  h.run("quickCollectPendingCards.add(cards[0]); cards[0].owned = true; refreshCatalogAfterOwnershipSave(cards[0])");
  assert.equal(h.grid.children[0], firstNode);
  assert.equal(h.grid.children[1], secondNode);
  assert.equal(firstNode.badge.textContent, "보유");
  assert.equal(firstNode.completion.textContent, "✓ 수집완료");
  assert.deepEqual(h.calls.stableRefreshes, [true]);
  assert.equal(h.calls.scroll, 0, "quick saving must not call scrollTo");
  assert.equal(h.calls.count, 3, "visible cards stay in this view until the filter changes");
  h.run("render()");
  assert.equal(h.grid.children.length, 3, "even a subsequent render keeps the quick-saved card");
});

test("overlapping quick saves retain all cards; changing filters applies actual ownership", () => {
  const h = harness();
  h.run("render()");
  h.run("quickCollectPendingCards.add(cards[0]); quickCollectPendingCards.add(cards[1])");
  h.run("cards[1].owned = true; refreshCatalogAfterOwnershipSave(cards[1])");
  h.run("cards[0].owned = true; refreshCatalogAfterOwnershipSave(cards[0])");
  assert.equal(h.calls.scroll, 0);
  assert.deepEqual(h.calls.stableRefreshes, [true, true]);
  assert.equal(h.grid.children.length, 3);
  h.run('status = "all"; render(); status = "missing"; render()');
  assert.equal(h.grid.children.length, 1, "changing filter resets temporary pinned membership");
  assert.equal(h.grid.children[0], h.byCard.get(h.cards[2]));
});

test("quick saves patch dashboard text instead of replacing DOM above the grid", () => {
  const fn = section(
    "function updateSeriesDashboardCountsInPlace() {",
    "function populateCatalogSelect() {",
  );
  assert.match(fn, /[.]querySelectorAll[(]"[.]series-set-dashboard-card"[)]/);
  assert.match(fn, /button[.]querySelector[(]"[.]series-dashboard-progress > span"[)]/);
  assert.doesNotMatch(fn, /replaceChildren|scrollTo/);
  assert.match(catalog, /if [(]stableQuickSave[)] updateSeriesDashboardCountsInPlace[(][)]/);
  assert.match(catalog, /if [(]position[)] restoreCatalogSavePosition[(]position[)]/);
  assert.match(catalog, /await account[.]saveOwned[(]card[.]accountKey, nextOwned[)]/);
});
