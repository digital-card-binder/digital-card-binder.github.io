import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const catalog = fs.readFileSync(new URL("../catalog.js", import.meta.url), "utf8");
const from = catalog.indexOf("function captureCatalogSavePosition(card) {");
const to = catalog.indexOf("async function toggleCatalogCompletion(card, button) {", from);
assert.ok(from > 0 && to > from, "Position-preserving collection save helpers must exist");
const implementation = catalog.slice(from, to);

function cardNode(top) {
  const classes = new Set(["catalog-card", "is-missing"]);
  const badge = { className: "status-badge is-missing", textContent: "미보유" };
  const complete = { disabled: false, textContent: "수집완료" };
  const name = { textContent: "" };
  const meta = { textContent: "" };
  const image = { src: "old.png", alt: "", getAttribute(key) { return key === "src" ? this.src : null; } };
  const parts = {
    ".card-topline .status-badge": badge,
    ".collection-complete-button": complete,
    ".card-name-ko": name,
    ".card-meta": meta,
    ".card-image": image,
  };
  return {
    top, badge, complete, name, meta, image,
    classList: {
      contains(key) { return classes.has(key); },
      toggle(key, force) { if (force) classes.add(key); else classes.delete(key); },
    },
    querySelector(selector) { return parts[selector] || null; },
    getBoundingClientRect() { return { top: this.top }; },
    hasClass(key) { return classes.has(key); },
  };
}

function harness({ status = "all", cards = null, tops = null } = {}) {
  const data = cards || [
    { owned: false, code: "S1_001" }, { owned: false, code: "S1_002" },
    { owned: false, code: "S1_003" },
  ];
  const nodes = (tops || [200, 420, 640]).map(cardNode);
  const grid = { children: [...nodes] };
  const calls = { render: 0, refreshCounts: 0, scrollTo: [] };
  const win = {
    scrollY: 1600,
    scrollTo({ top, behavior }) {
      const previous = this.scrollY;
      this.scrollY = top;
      for (const node of nodes) node.top -= top - previous;
      calls.scrollTo.push({ top, behavior });
    },
  };
  const context = vm.createContext({
    window: win,
    status,
    renderedCards: data,
    $: (name) => name === "catalog-grid" ? grid : null,
    refreshCounts() { calls.refreshCounts += 1; },
    render() { calls.render += 1; },
    updateCompletionButton(button, card) {
      button.disabled = false;
      button.textContent = card.owned ? "✓ 수집완료" : "수집완료";
    },
    displayName: (card) => card.name || "카드",
    actualCardCode: (card) => card.code,
    imageFor: () => "original.png",
  });
  vm.runInContext(implementation, context);
  return { context, cards: data, nodes, grid, calls, win };
}

test("all-filter ownership updates the clicked card only; focused button and scroll are preserved", () => {
  const h = harness();
  h.cards[1].owned = true;
  h.context.refreshCatalogAfterOwnershipSave(h.cards[1]);
  assert.equal(h.calls.refreshCounts, 1);
  assert.equal(h.calls.render, 0, "do not detach the entire card grid");
  assert.equal(h.grid.children[1], h.nodes[1], "keep the clicked card and button DOM identity");
  assert.equal(h.nodes[1].hasClass("is-missing"), false);
  assert.equal(h.nodes[1].badge.textContent, "보유");
  assert.equal(h.nodes[1].complete.textContent, "✓ 수집완료");
  assert.equal(h.nodes[1].image.src, "original.png");
  assert.equal(h.win.scrollY, 1600);
});

test("series-dashboard height changes retain the clicked card viewport position", () => {
  const h = harness();
  const before = h.nodes[1].getBoundingClientRect().top;
  h.context.refreshCounts = () => {
    h.calls.refreshCounts += 1;
    h.nodes.forEach(node => { node.top += 145; });
  };
  h.cards[1].owned = true;
  h.context.refreshCatalogAfterOwnershipSave(h.cards[1]);
  assert.equal(h.win.scrollY, 1745);
  assert.equal(h.nodes[1].getBoundingClientRect().top, before);
  assert.equal(h.calls.scrollTo[0].behavior, "instant");
  assert.equal(h.calls.render, 0);
});

test("status-filter save re-renders and keeps the next visible card aligned instead of jumping to top", () => {
  const h = harness({ status: "missing" });
  const afterTop = h.nodes[2].top;
  h.context.render = () => {
    h.calls.render += 1;
    h.context.renderedCards = [h.cards[0], h.cards[2]];
    h.grid.children = [h.nodes[0], h.nodes[2]];
    h.nodes[2].top -= 100;
  };
  h.cards[1].owned = true;
  h.context.refreshCatalogAfterOwnershipSave(h.cards[1]);
  assert.equal(h.calls.render, 1, "ownership status filter must remove changed card");
  assert.equal(h.nodes[2].top, afterTop, "next card should keep its viewport offset");
  assert.equal(h.win.scrollY, 1500);
});

test("all three save paths use position-preserving updates without changing Firestore write APIs", () => {
  assert.match(catalog, /await account\.saveOwned\(card\.accountKey, nextOwned\)/);
  assert.match(catalog, /await account\.saveOverride\(card\.accountKey, \{/);
  assert.match(catalog, /function refreshCatalogAfterOwnershipSave\(card\)/);
  const saveUses = catalog.match(/refreshCatalogAfterOwnershipSave\((?:card|activeCard)\)/g) || [];
  assert.equal(saveUses.length, 4, "function definition and three save paths");
  assert.doesNotMatch(catalog, /location\.reload\(/);
});
