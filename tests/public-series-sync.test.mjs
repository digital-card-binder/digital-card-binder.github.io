import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../collector-public-sync.js", import.meta.url), "utf8");
const manager = await readFile(new URL("../firebase-page-manager.js", import.meta.url), "utf8");

function createSync() {
  const window = {
    POKEMON_DEX_FIREBASE: { userCollection: "collections" },
    CollectorCollectionRegistry: {
      supportedCollectionId: (id) => id === "series",
      COLLECTIONS: { series: { documentId: "seriesDex" } },
      normalizeSetting: (_id, value) => ({ visibility: value?.visibility || "private" }),
    },
    DigitalCardBinder: {
      firebaseAccount: {
        usesOverrideShards: (id) => id === "seriesDex",
        readOverrideShards: () => { throw new Error("cache fallback used"); },
        mergedCollectionData: (value, shards) => ({
          ...value,
          overrides: Object.assign({}, value.overrides, ...shards.map((s) => s.overrides)),
        }),
      },
    },
  };
  vm.runInNewContext(source, { window, console });
  return window.CollectorPublicSync;
}

function makeFirestore({ failDocument = false, failShards = false } = {}) {
  const calls = [];
  const doc = (...parts) => ({ id: parts.at(-1), parts });
  const snapshot = (data) => ({ exists: () => true, data: () => data });
  return {
    calls,
    doc,
    collection: (...parts) => ({ id: parts.at(-1), parts }),
    async getDocFromServer(ref) {
      calls.push("server-doc");
      if (failDocument) throw new Error("server unavailable");
      if (ref.id === "main") return snapshot({ profileCompleted: true, publicId: "abcdefghijkl" });
      if (ref.id === "series") return snapshot({ visibility: "public" });
      return snapshot({ baseMode: "empty", overrides: {} });
    },
    async getDocsFromServer() {
      calls.push("server-shards");
      if (failShards) throw new Error("shards unavailable");
      return { docs: [{ id: "s01", data: () => ({ overrides: { "sv1a:001": { owned: true } } }) }] };
    },
    async getDoc() {
      calls.push("cache-doc");
      throw new Error("cache should not be read");
    },
    async getDocs() {
      calls.push("cache-shards");
      throw new Error("cache shards should not be read");
    },
  };
}

test("public series synchronization requires fresh server documents and shards", async () => {
  const api = createSync();
  const firestore = makeFirestore();
  const result = await api.loadPrivateContext({
    db: {}, firestoreModule: firestore, user: { uid: "person1" },
    collectionId: "series", preferServer: true,
  });
  assert.equal(result.source.overrides["sv1a:001"].owned, true);
  assert.deepEqual(firestore.calls, ["server-doc", "server-doc", "server-doc", "server-shards"]);
});

test("failed server reads cannot overwrite public ownership with cached data", async () => {
  const api = createSync();
  for (const options of [{ failDocument: true }, { failShards: true }]) {
    const firestore = makeFirestore(options);
    await assert.rejects(
      api.loadPrivateContext({
        db: {}, firestoreModule: firestore, user: { uid: "person1" },
        collectionId: "series", preferServer: true,
      }),
    );
    assert.equal(firestore.calls.includes("cache-doc"), false);
    assert.equal(firestore.calls.includes("cache-shards"), false);
  }
});

test("serial per-card publication is replaced with coalesced publication and repair", () => {
  assert.match(manager, /function scheduleLargeCatalogPublicSync\(delay = 750\)/);
  assert.match(manager, /largeCatalogPublicSyncRevision \+= 1/);
  assert.match(manager, /if \(largeCatalogPublicSyncRunning/);
  assert.match(manager, /requestedRevision !== largeCatalogPublicSyncRevision/);
  assert.match(manager, /preferServer: true/);
  assert.match(manager, /publicSyncStore\("dirty", "1"\)/);
  assert.match(manager, /publicSyncStore\("dirty", null\)/);
  assert.match(manager, /repairLargeCatalogPublicSync\(\)/);
  assert.match(manager, /showPublicSyncIssue\(true, error\)/);
  assert.equal(manager.includes("largeCatalogPublicSyncQueue"), false);
});

test("card delta publish updates only confirmed ownership in a public transaction", async () => {
  const api = createSync();
  const calls = [];
  const initial = {
    schemaVersion: 1, publicId: "abcdefghijkl", collectionId: "series",
    ownedKeys: ["sv1a:001", "sv1a:002"], ownedCount: 2,
    totalCount: 20241, promoOwnedKeys: [], promoOwnedCount: 0,
  };
  const doc = (...parts) => ({ id: parts.at(-1), parts });
  const snapshot = (value) => ({ exists: () => true, data: () => value });
  let published;
  const firestore = {
    doc,
    async runTransaction(_db, operation) {
      return operation({
        async get(ref) {
          calls.push(ref.parts.join("/"));
          if (ref.id === "main") return snapshot({ profileCompleted: true, publicId: "abcdefghijkl" });
          if (ref.parts.includes("collectionSettings")) return snapshot({ visibility: "public" });
          return snapshot(initial);
        },
        set(ref, payload) { calls.push("set:" + ref.parts.join("/")); published = payload; },
      });
    },
    async getDocsFromServer() { throw new Error("full shard scan is forbidden on delta"); },
  };
  const result = await api.syncCollectionChanges({
    db: {}, firestoreModule: firestore, user: { uid: "collector1" }, collectionId: "series",
    changes: [{ key: "sv1a:001", owned: false }, { key: "sv1a:003", owned: true }],
  });
  assert.equal(result.synced, true);
  assert.equal(published.ownedCount, 2);
  assert.deepEqual([...published.ownedKeys], ["sv1a:002", "sv1a:003"]);
  assert.equal(published.totalCount, 20241);
  assert.equal(calls.some((call) => call.includes("overrideShards")), false);
  assert.equal(calls.filter((call) => call.startsWith("set:")).length, 1);
});

test("private collections are not accidentally published by card delta", async () => {
  const api = createSync();
  const doc = (...parts) => ({ id: parts.at(-1), parts });
  const snapshot = (value) => ({ exists: () => true, data: () => value });
  let writes = 0;
  const firestore = {
    doc,
    async runTransaction(_db, operation) {
      return operation({
        async get(ref) {
          if (ref.id === "main") return snapshot({ profileCompleted: true, publicId: "abcdefghijkl" });
          if (ref.parts.includes("collectionSettings")) return snapshot({ visibility: "private" });
          throw new Error("must not read public projection for private collections");
        },
        set() { writes++; },
      });
    },
  };
  const result = await api.syncCollectionChanges({
    db: {}, firestoreModule: firestore, user: { uid: "collector1" }, collectionId: "series",
    changes: [{ key: "sv1a:003", owned: true }],
  });
  assert.equal(result.visibility, "private");
  assert.equal(writes, 0);
});

test("coalesced delta sync preserves unsent changes and exposes server failure reasons", () => {
  assert.match(manager, /const largeCatalogPublicSyncChanges = new Map\(\)/);
  assert.match(manager, /changes = \[\.\.\.largeCatalogPublicSyncChanges\]/);
  assert.match(manager, /syncCollectionChangesWithRetry/);
  assert.match(manager, /largeCatalogPublicSyncChanges\.set\(change\.key, change\.owned\)/);
  assert.match(manager, /queueLargeCatalogPublicSync\(\{ key, owned: Boolean\(savedItem\.owned\) \}\)/);
  assert.match(manager, /"permission-denied": "공개 데이터 저장 권한이 거부되었습니다."/);
  assert.match(source, /firestoreModule\.runTransaction\(db, async \(transaction\)/);
});

test("fresh card deltas bypass a previously failed full repair without clearing its checkpoint", () => {
  assert.match(manager, /const useFullSync = !changes\.length \|\| typeof deltaSync !== "function"/);
  assert.doesNotMatch(manager, /const useFullSync = largeCatalogPublicSyncNeedsFull \|\|/);
  assert.match(manager, /if \(useFullSync\) largeCatalogPublicSyncNeedsFull = false/);
  assert.match(manager, /if \(!largeCatalogPublicSyncNeedsFull\) \{\s*publicSyncStore\("dirty", null\)/);
});

test("sync diagnostics distinguish failures in common private source reads", async () => {
  const api = createSync();
  const firestore = makeFirestore({ failDocument: true });
  let caught;
  try {
    await api.syncCollection({
      db: {}, firestoreModule: firestore, user: { uid: "collector1" },
      collectionId: "series", preferServer: true,
    });
  } catch (error) { caught = error; }
  assert.equal(caught?.publicSyncStage, "owner-data");
  const detail = api.publicSyncErrorDetail(caught, "series");
  assert.equal(detail.stage, "owner-data");
  assert.equal(detail.code, "");
  assert.equal(detail.collectionId, "series");
  assert.match(detail.message, /server unavailable/);
});

test("diagnostics remove private identifiers from an unexpected exception", () => {
  const api = createSync();
  const error = new Error(
    "problem at users/sensitiveUser123 and publicProfiles/sensitivePublic123 for collector@example.com",
  );
  error.publicSyncStage = "catalog";
  const detail = api.publicSyncErrorDetail(error, "national");
  assert.equal(detail.stage, "catalog");
  assert.equal(detail.collectionId, "national");
  assert.equal(detail.message.includes("sensitiveUser123"), false);
  assert.equal(detail.message.includes("sensitivePublic123"), false);
  assert.equal(detail.message.includes("collector@example.com"), false);
});

test("common sync modules present actionable causes in all dex pages", async () => {
  const nav = await readFile(new URL("../collector-nav.js", import.meta.url), "utf8");
  const settings = await readFile(new URL("../collector-settings.js", import.meta.url), "utf8");
  assert.match(nav, /const detail = publicSyncFailures.get\(collectionId\)/);
  assert.match(nav, /원인: \$\{detail\.message\}/);
  assert.match(settings, /sync\.publicSyncErrorDetail\?\.\(error,collectionId\)/);
  assert.match(source, /atSyncStage\("owner-data"/);
  assert.match(source, /atSyncStage\("catalog"/);
  assert.match(source, /atSyncStage\("public-write"/);
  assert.match(source, /atSyncStage\("public-transaction"/);
});
