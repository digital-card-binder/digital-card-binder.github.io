import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../", import.meta.url);
const original = await readFile(new URL("packs.js", root), "utf8");
const source = original.replace(/\nvoid bootstrapPackDex\(\);\s*$/, "");

function createHarness(firestoreModule) {
  const events = [];
  const window = {
    POKEMON_DEX_FIREBASE: { ownerEmail: "owner@example.com" },
    dispatchEvent: (event) => events.push(event),
  };
  const context = vm.createContext({
    window,
    document: {},
    CustomEvent: class { constructor(name, options) { this.name = name; this.detail = options?.detail; } },
    console: { warn() {}, error() {} },
  });
  vm.runInContext(source, context, { filename: "packs.js" });
  vm.runInContext(`
    drawSummary = () => {};
    render = () => {};
    renderPromo = () => {};
    updatePackAuthControls = () => {};
    packFirebase = window.__firebase;
  `, context);
  // The sandbox is intentionally DOM-free: only ownership behavior is exercised.
  window.__firebase = { db: {}, firestoreModule };
  vm.runInContext("packFirebase = window.__firebase;", context);
  return {
    context,
    events,
    get: (expression) => vm.runInContext(expression, context),
    run: (user) => vm.runInContext("applyPackUserState", context)(user),
  };
}

const user = { uid: "test-user", email: "user@example.com", displayName: "Test" };

test("pack ownership never becomes editable after a failed Firestore read", async () => {
  let writes = 0;
  const harness = createHarness({
    doc: () => ({}),
    getDoc: async () => { throw new Error("unavailable"); },
    setDoc: async () => { writes += 1; },
  });
  await harness.run(user);
  assert.equal(harness.get("canEditPackCollection()"), false);
  assert.equal(harness.get("packDocumentReady"), false);
  assert.equal(writes, 0);
});

test("pack records refresh live and preserve unrelated codes on writes", async () => {
  const writes = [];
  let listener = null;
  let unsubscriptions = 0;
  const harness = createHarness({
    doc: () => ({}),
    getDoc: async () => ({
      exists: () => true,
      data: () => ({ ownedCodes: ["sv1S"], ownedPromoPackIds: [] }),
    }),
    setDoc: async (_ref, fields) => { writes.push(fields); },
    onSnapshot: (_ref, callback) => {
      listener = callback;
      return () => { unsubscriptions += 1; };
    },
    serverTimestamp: () => null,
  });

  await harness.run(user);
  assert.equal(harness.get("canEditPackCollection()"), true);
  assert.equal(harness.get('packs.find(p => p.code === "sv1S").owned'), true);
  listener({
    exists: () => true,
    data: () => ({ ownedCodes: ["m2", "BS1"], ownedPromoPackIds: [] }),
  });
  assert.equal(harness.get('packs.find(p => p.code === "sv1S").owned'), false);
  assert.equal(harness.get('packs.find(p => p.code === "m2").owned'), true);
  assert.equal(harness.get('packs.find(p => p.code === "BS1").owned'), true);

  await harness.get('persistPackOwned')(harness.get('packs.find(p => p.code === "m6")'), true);
  const codes = writes.at(-1).ownedCodes;
  assert.ok(codes.includes("m6"));
  assert.ok(codes.includes("BS1"));
  assert.ok(codes.includes("m2"));

  await harness.run(null);
  assert.equal(unsubscriptions, 1);
  assert.equal(harness.get("canEditPackCollection()"), false);
});
