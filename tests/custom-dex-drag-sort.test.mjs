import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../custom.js", import.meta.url), "utf8");
const mobileSource = readFileSync(new URL("../custom-mobile-actions.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../custom.css", import.meta.url), "utf8");

function extract(start, end) {
  const from = source.indexOf("  " + start);
  const to = source.indexOf("  " + end, from + 3);
  assert.ok(from >= 0 && to > from, "could not extract drag helper: " + start);
  return source.slice(from, to);
}

const helperSource = extract("function selectedDragKeys", "function clearDropMarker")
  + extract("async function dropDragKeys", "function finishSortingDrag");

function scenario(keys, fail = false) {
  const state = { bulkOrderMode: true, bulkOrderKeys: new Set(keys), bulkSaving: false };
  const errors = [];
  let saves = 0;
  const api = new Function("state", "renderAll", "saveDexes", "alert",
    helperSource + "; return { selectedDragKeys, dropDragKeys };")(
    state, () => {}, async () => {
      saves += 1;
      if (fail) throw new Error("Simulated save failure");
    }, (error) => errors.push(error),
  );
  return { state, api, errors, get saves() { return saves; } };
}

function dex(keys) {
  return {
    cards: keys.map((key) => ({ key, owned: key === "B" })),
    updatedAt: "original",
  };
}

test("a single card can be dragged before or after another card", async () => {
  const s = scenario([]);
  const a = dex(["A", "B", "C", "D"]);
  assert.deepEqual(s.api.selectedDragKeys(a, "A"), ["A"]);
  await s.api.dropDragKeys(a, ["A"], { key: "C", after: true });
  assert.deepEqual(a.cards.map((x) => x.key), ["B", "C", "A", "D"]);
  assert.equal(s.saves, 1);
});

test("non-adjacent checked cards move together in their prior relative order", async () => {
  const s = scenario(["B", "D"]);
  const a = dex(["A", "B", "C", "D", "E"]);
  assert.deepEqual(s.api.selectedDragKeys(a, "D"), ["B", "D"]);
  await s.api.dropDragKeys(a, ["B", "D"], { key: "E", after: true });
  assert.deepEqual(a.cards.map((x) => x.key), ["A", "C", "E", "B", "D"]);
  assert.equal(a.cards.find((x) => x.key === "B").owned, true);
});

test("reorder is not written if it does not change the card order", async () => {
  const s = scenario(["B", "C"]);
  const a = dex(["A", "B", "C", "D"]);
  await s.api.dropDragKeys(a, ["B", "C"], { key: "A", after: true });
  assert.equal(s.saves, 0);
  assert.deepEqual(a.cards.map((x) => x.key), ["A", "B", "C", "D"]);
});

test("failed saves restore the original order and timestamp", async () => {
  const s = scenario(["A"], true);
  const a = dex(["A", "B", "C"]);
  await s.api.dropDragKeys(a, ["A"], { key: "C", after: true });
  assert.deepEqual(a.cards.map((x) => x.key), ["A", "B", "C"]);
  assert.equal(a.updatedAt, "original");
  assert.equal(s.state.bulkSaving, false);
  assert.equal(s.errors.length, 1);
});

test("mobile sorting uses a touch-only grip with on-card visual targets", () => {
  assert.match(source, /grip\.addEventListener\("pointerdown"/);
  assert.match(source, /grip\.addEventListener\("pointerup"/);
  assert.match(source, /document\.elementFromPoint\(active\.x, active\.y\)/);
  assert.match(source, /event\.dataTransfer\.setData/);
  assert.match(css, /custom-drag-handle[\s\S]*?touch-action:none/);
  assert.match(mobileSource, /card\.draggable = !touchMode\(\)/);
});
