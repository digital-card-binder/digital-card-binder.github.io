import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
function context() {
  const node = { value: "series", textContent: "", disabled: false, dataset: {}, addEventListener() {} };
  const ctx = vm.createContext({
    URL, URLSearchParams, TextEncoder, crypto: webcrypto, console: { warn() {}, error() {}, log() {} },
    document: { readyState: "loading", body: { dataset: {} }, addEventListener() {}, querySelector: () => node, querySelectorAll: () => [], getElementById: () => node },
    fetch: async (path) => ({ ok: true, json: async () => JSON.parse(read(String(path).replace(/^\.\//, ""))) }),
    localStorage: { getItem: () => null, setItem() {} },
    window: { location: { href: "https://digital-card-binder.github.io/", search: "", hash: "", pathname: "/" } },
  });
  for (const path of ["core/catalog/card-identity.js", "core/catalog/catalog-service.js", "core/account/firebase-account.js", "collector-collection-registry.js"]) vm.runInContext(read(path), ctx);
  return ctx;
}
function expose(ctx, file, expression, removeInit = false) {
  let source = read(file);
  if (removeInit) source = source.replace(/^  (?:void )?initialize\(\);$/m, "");
  const end = source.lastIndexOf("})();");
  source = source.slice(0, end) + `window.testApi = ${expression};\n` + source.slice(end);
  vm.runInContext(source, ctx, { filename: file });
  return ctx.window.testApi;
}
function storage(ctx, initial) {
  const records = new Map(Object.entries(initial));
  let writes = 0;
  ctx.localStorage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => { writes++; records.set(key, value); } };
  return { records, get writes() { return writes; } };
}

// Old M6a indices from the pre-sort catalog, without changing a saved user document.
test("M6a's eleven old ownership keys count equally in the real dashboard and registry", async () => {
  const ctx = context();
  const registry = ctx.window.CollectorCollectionRegistry;
  const catalog = await registry.loadCatalog("series");
  const keys = [
    ...Array.from({ length: 8 }, (_, i) => `M6a::m6a_${169 + i}/103::${165 + i}`),
    "M6a::m6a_R/RGB::173", "M6a::m6a_G/RGB::174", "M6a::m6a_B/RGB::175",
  ];
  const source = { baseMode: "empty", overrides: Object.fromEntries(keys.map((key) => [key, { owned: true }])) };
  const original = JSON.stringify(source);
  const expected = await registry.ownershipFor("series", source);
  const api = expose(ctx, "dashboard.js", `{
    count(catalog, source) {
      currentUser = { uid: "mock-owner" };
      catalogs = { series: cloneRegistryCatalog("series", catalog) };
      documents.series = source; applyOwnership("series");
      return catalogs.series.items.filter(item => item.owned).length;
    }
  }`, true);
  assert.equal(expected.ownedKeys.length, 11);
  assert.equal(api.count(catalog, source), 11);
  assert.equal(JSON.stringify(source), original);
});

test("50,000 full ownership entries fit bounded shards while legacy values survive a merged read", async () => {
  const ctx = context();
  const core = ctx.window.DigitalCardBinder.firebaseAccount;
  const catalog = await ctx.window.CollectorCollectionRegistry.loadCatalog("series");
  const keys = [...catalog.items.map((item) => item.key), ...Array.from({ length: 50000 - catalog.items.length }, (_, i) => `future::card_${i}::${i}`)];
  const shards = new Map();
  const value = { owned: true, setCode: "", cardNumber: "", cardName: "", imageUrl: "", updatedAt: "2026-10-01T01:00:00.000Z", updatedBy: "audit@example.com", printVariants: ["normal"] };
  for (const key of keys) {
    const id = core.overrideShardId(key);
    if (!shards.has(id)) shards.set(id, { overrides: {} });
    shards.get(id).overrides[key] = value;
  }
  assert.equal(shards.size, 128);
  const max = Math.max(...[...shards.values()].map((shard) => Buffer.byteLength(JSON.stringify(shard))));
  assert.ok(max < 250000, `largest shard ${max} bytes`);
  const old = { baseMode: "empty", overrides: { untouched: false, [keys[0]]: { owned: false, updatedAt: "2026-10-01T02:00:00.000Z" } } };
  const original = JSON.stringify(old);
  const merged = core.mergedCollectionData(old, [...shards.values()]);
  assert.equal(Object.keys(merged.overrides).length, 50001);
  assert.equal(merged.overrides.untouched, false);
  assert.equal(merged.overrides[keys[0]].owned, false, "later writes from old tabs must win");
  assert.equal(merged.overrides[keys[1]].owned, true);
  assert.equal(JSON.stringify(old), original);
});

test("a shard write addresses only one card and never writes or deletes the legacy document", async () => {
  const ctx = context();
  const calls = [];
  const fs = {
    doc: (ref, ...parts) => ({ id: parts.at(-1), path: `${ref.path}/${parts.join("/")}` }),
    FieldPath: class { constructor(...parts) { this.parts = parts; } },
    serverTimestamp: () => "SERVER_TIME",
    setDoc: async (...args) => calls.push(args),
  };
  const ref = { id: "seriesDex", path: "users/alice/collections/seriesDex" };
  const key = "M6a::m6a_R/RGB::165";
  await ctx.window.DigitalCardBinder.firebaseAccount.writeOverrideEntry(fs, ref, key, { owned: false, printVariants: [] });
  assert.equal(calls.length, 1);
  assert.match(calls[0][0].path, /^users\/alice\/collections\/seriesDex\/overrideShards\/s[0-7][0-9a-f]$/);
  assert.deepEqual(plain(calls[0][1].overrides), { [key]: { owned: false, printVariants: [] } });
  assert.deepEqual(plain(calls[0][2].mergeFields[1].parts), ["overrides", key]);
});

test("live ownership waits for both sources, reacts to shard unchecks, and unsubscribes both", () => {
  const ctx = context(); const core = ctx.window.DigitalCardBinder.firebaseAccount;
  const handlers = []; const stopped = []; const seen = [];
  const fs = { collection: (ref, child) => ({ path: `${ref.id}/${child}` }), onSnapshot: (ref, changed) => { handlers.push(changed); return () => stopped.push(ref); } };
  const stop = core.subscribeCollection(fs, { id: "seriesDex" }, (snapshot) => seen.push(snapshot.data()), assert.fail);
  handlers[0]({ exists: () => true, data: () => ({ overrides: { a: true, old: true } }) });
  assert.equal(seen.length, 0);
  handlers[1]({ docs: [{ data: () => ({ overrides: { a: { owned: false } } }) }] });
  assert.equal(seen[0].overrides.a.owned, false); assert.equal(seen[0].overrides.old, true);
  stop(); assert.equal(stopped.length, 2);
});

function worldScenario({ publicView = false, user = "alice", fail = false } = {}) {
  const ctx = context();
  ctx.window.DigitalCardBinder.cardLookup = {};
  const ownedKey = "digitalCardBinderWorldExplorationOwnedV1";
  const overrideKey = "digitalCardBinderWorldExplorationCardOverridesV1";
  const store = storage(ctx, { [ownedKey]: '["mine"]', [overrideKey]: '{"mine":{"image":"private-image"}}' });
  let saved = 0;
  const account = {
    ready: Promise.resolve(), currentUser: { uid: user }, readOnly: publicView,
    canEdit: () => !publicView,
    applyGroups: (groups) => groups.forEach((group) => group.cards.forEach((card) => { card.accountKey = card.slotId; card.owned = publicView && card.slotId === "theirs"; })),
    saveOwned: async () => { saved++; if (fail) throw new Error("network"); return { owned: true }; },
  };
  ctx.window.PokemonDexPageAccount = account;
  ctx.window.CollectorPublicView = { requested: publicView };
  const api = expose(ctx, "world.js", "{ state, loadOwned, loadCardOverrides, applyAccountOwnership, applyCardOverride, resetCardOverride, resolvedSlot, populateCardDialog }");
  api.state.data = { generations: [{ generation: 1 }] };
  api.state.groups = [{ code: "generation-1", cards: [{ slotId: "mine", image: "base" }, { slotId: "theirs", image: "public" }] }];
  api.loadOwned(); api.loadCardOverrides();
  return { ctx, api, account, store, ownedKey, overrideKey, get saved() { return saved; } };
}

test("world failure retains guest and pending records, retries, and marks only that UID after success", async () => {
  const scene = worldScenario({ fail: true });
  await scene.api.applyAccountOwnership();
  assert.equal(scene.store.records.get(scene.ownedKey), '["mine"]');
  assert.equal(scene.store.records.get("digitalCardBinderWorldExplorationOwnedMigratedV2:alice"), undefined);
  assert.ok(scene.api.state.owned.has("mine"));
  assert.equal(scene.api.resolvedSlot({ id: "mine", title: "Mine", card: { image: "base" } }).image, "private-image");
  scene.account.saveOwned = async () => ({ owned: true });
  await scene.api.applyAccountOwnership();
  assert.equal(scene.store.records.get("digitalCardBinderWorldExplorationOwnedMigratedV2:alice"), "done");
  assert.equal(scene.store.records.get(scene.ownedKey), '["mine"]');
  scene.account.currentUser = { uid: "bob" };
  scene.account.saveOwned = async () => assert.fail("must not copy Alice's records to Bob");
  await scene.api.applyAccountOwnership();
  assert.equal(scene.api.state.owned.size, 0);
  assert.equal(scene.api.resolvedSlot({ id: "mine", title: "Mine", card: { image: "base" } }).image, "base");

  const explicit = worldScenario();
  explicit.account.applyGroups = groups => groups.forEach(group => group.cards.forEach(card => {
    card.accountKey = card.slotId; card.owned = false; card.hasAccountOverride = true;
  }));
  explicit.account.saveOwned = async () => assert.fail("existing explicit unowned state must win over guest ownership");
  await explicit.api.applyAccountOwnership();
  assert.equal(explicit.api.state.owned.size, 0);
  assert.equal(explicit.store.records.get(explicit.ownedKey), '["mine"]');
});

test("public world viewing and forced edit handlers leave all visitor storage and remote writes untouched", async () => {
  const scene = worldScenario({ publicView: true });
  const before = JSON.stringify([...scene.store.records]);
  await scene.api.applyAccountOwnership();
  assert.ok(scene.api.state.owned.has("theirs"));
  assert.equal(scene.api.resolvedSlot({ id: "mine", title: "Test", card: { image: "base" } }).image, "base");
  await scene.api.applyCardOverride(); await scene.api.resetCardOverride();
  assert.equal(scene.store.writes, 0); assert.equal(scene.saved, 0);
  assert.equal(JSON.stringify([...scene.store.records]), before);
});

test("Studio supplies every available world image and keeps the two explicitly unconfirmed people slots", async () => {
  const ctx = context(); const catalogService = ctx.window.DigitalCardBinder.catalog;
  const groups = await catalogService.worldGroups();
  assert.equal(groups.length, 9);
  for (const group of groups) { assert.equal(group.cards.length, 22); assert.ok(group.cards.every((card) => card.name)); }
  const catalog = await ctx.window.CollectorCollectionRegistry.loadCatalog("world");
  const api = expose(ctx, "studio.js", "{ buildVisualCatalog }", true);
  const visuals = await api.buildVisualCatalog("world", catalog);
  assert.equal(visuals.length, 198); assert.equal(visuals.filter((card) => card.image).length, 196);
  assert.deepEqual(plain(groups.flatMap(group => group.cards.filter(card => !card.image).map(card => card.slotId))), ["world-person-silver", "world-person-may"]);
  assert.ok(visuals.some((card) => card.name === "피카츄")); assert.ok(visuals.some((card) => card.name === "레드"));
  const series = await catalogService.series();
  for (const [slotId, cardCode] of [["kanto-pokemon-center", "bw3-bh_051/052"], ["kanto-pokestop", "s10b_071/071"]]) {
    const source = series.flatMap((group) => group.cards).find((card) => card.code === cardCode);
    const card = groups.flatMap((group) => group.cards).find((item) => item.slotId === slotId);
    assert.equal(card.image, source.image);
    assert.equal(card.slot.card.image, source.image);
  }
  assert.deepEqual(visuals.map((item) => item.key), catalog.items.map((item) => item.key));
});

test("world search reads account ownership for place, Pokemon and person, ignoring the guest cache", async () => {
  const ctx = context(); const service = ctx.window.DigitalCardBinder.catalog;
  const groups = await service.worldGroups();
  const group = groups[0];
  const registry = ctx.window.CollectorCollectionRegistry;
  const selected = [0, 12, 18];
  const source = { baseMode: "empty", overrides: Object.fromEntries(selected.map((i) => [registry.cardIdentity("world", group, group.cards[i], 0, i), { owned: true }])) };
  ctx.window.PokemonDexPageAccount = { currentUser: { uid: "alice" } };
  const store = storage(ctx, { digitalCardBinderWorldExplorationOwnedV1: '["unrelated"]' });
  const api = expose(ctx, "pokemon-search.js", "{ addWorldOwnership }");
  const index = new Map();
  await api.addWorldOwnership(index, source);
  assert.equal(index.size, 3);
  for (const labels of index.values()) assert.ok(labels.has("월드탐험도감"));
  assert.equal(store.writes, 0);
  source.overrides[registry.cardIdentity("world", group, group.cards[12], 0, 12)] = { owned: false };
  const next = new Map(); await api.addWorldOwnership(next, source); assert.equal(next.size, 2);
});

test("reviewed SV5M names agree between search and series without rewriting source files", async () => {
  const ctx = context(); const service = ctx.window.DigitalCardBinder.catalog;
  const original = read("data/series.json");
  const page = read("catalog.js");
  ctx.mode = "series";
  ctx.SERIES_PRINT_VARIANTS_URL = "data/series-print-variants.json";
  ctx.fetchJson = async (path) => JSON.parse(read(path));
  vm.runInContext(page.slice(page.indexOf("const SERIES_PRINT_VARIANTS ="), page.indexOf("function applySeriesImageOverrides(")), ctx);
  vm.runInContext(page.slice(page.indexOf("async function loadCatalogGroups()"), page.indexOf("async function init()")), ctx);
  const series = (await ctx.loadCatalogGroups()).find((group) => group.code.toLowerCase() === "sv5m");
  const search = (await service.pokemonSearchIndex()).groups.find((group) => group[0].toLowerCase() === "sv5m");
  for (const [code, name] of [["sv5m_033/071", "에블리"], ["sv5m_034/071", "에리본"]]) {
    assert.equal(series.cards.find((card) => card.code === code).name, name);
    const entry = search[4].find((card) => card[0] === code);
    assert.equal(entry[1], name); assert.equal(entry[2], name);
  }
  assert.equal(read("data/series.json"), original);
});

function backupContext(failStage = false) {
  const ctx = context(); const logs = []; let sequence = 0;
  const fs = {
    doc: (base, ...parts) => ({ id: parts.at(-1), path: [base.path || "", ...parts].join("/") }),
    getDoc: async () => ({ exists: () => true, data: () => ({ createdAt: "existing" }) }),
    serverTimestamp: () => "SERVER_TIME", FieldPath: class { constructor(...parts) { this.parts = parts; } },
    Bytes: { fromBase64String(value) { if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("invalid base64"); return { toUint8Array: () => Buffer.from(value, "base64") }; } },
    writeBatch() {
      const id = sequence++; const writes = [];
      return { set: (...entry) => writes.push(entry), async commit() { logs.push({ id, writes }); if (failStage && id > 0) throw new Error("upload failure"); } };
    },
  };
  ctx.confirm = () => true;
  const api = expose(ctx, "operations.js", "{ state, validateBackup, restoreDocumentWrites, restoreBackup }");
  api.state.firebase = { firestoreModule: fs, db: { path: "" } }; api.state.user = { uid: "owner", email: "owner@example.com" };
  return { ctx, api, logs };
}
function binder(id = "binder_001") {
  return {
    id,
    metadata: { title: "Test", grid: { cols: 3, rows: 3, slotCount: 9, cardWidthMm: 63, cardHeightMm: 88, canvasWidthMm: 189, canvasHeightMm: 264 }, background: { name: "test.webp", type: "image/webp", size: 4, chunkCount: 1, chunkSet: "blob_00001", width: 100, height: 100 }, cards: [] },
    chunks: [{ id: "blob_00001_000", chunkSet: "blob_00001", index: 0, size: 4, dataBase64: "AQIDBA==" }],
  };
}
function backup(customBinders) { return { format: "digital-card-binder-backup-v2", schemaVersion: 2, documents: { worldDex: { baseMode: "empty", overrides: { mine: true } } }, customBinders }; }

test("a corrupt later binder is rejected before any collections or chunks are written", async () => {
  const scene = backupContext(); const bad = binder("binder_002"); bad.chunks[0].size = 3;
  scene.api.state.restorePayload = backup([binder(), bad]);
  assert.throws(() => scene.api.validateBackup(scene.api.state.restorePayload), /크기/);
  await scene.api.restoreBackup(); assert.equal(scene.logs.length, 0);
});

test("restore stages new chunk sets then atomically publishes metadata and collections without deletes", async () => {
  const scene = backupContext(); scene.api.state.restorePayload = backup([binder()]);
  await scene.api.restoreBackup();
  assert.equal(scene.logs.length, 2); assert.equal(scene.logs[0].id, 1); assert.equal(scene.logs[1].id, 0);
  assert.match(scene.logs[0].writes[0][0].path, /chunks\/restore_/);
  const published = scene.logs[1].writes;
  assert.ok(published.some(([ref]) => ref.path.endsWith("worldDex")));
  assert.ok(published.some(([ref, data]) => ref.path.includes("customBinders") && data.background.chunkSet.startsWith("restore_")));
});

test("interrupted chunk staging never commits active metadata or collection changes", async () => {
  const scene = backupContext(true); scene.api.state.restorePayload = backup([binder()]);
  await scene.api.restoreBackup();
  assert.equal(scene.logs.length, 1); assert.equal(scene.logs[0].id, 1);
});

test("large legacy backups restore overrides through bounded shards instead of a giant root map", () => {
  const scene = backupContext(); const payload = backup([]);
  payload.documents.seriesDex = { baseMode: "empty", overrides: Object.fromEntries(Array.from({ length: 50000 }, (_, i) => [`test::card_${i}::${i}`, { owned: true }])) };
  const plan = scene.api.restoreDocumentWrites(payload);
  assert.equal(plan.filter((entry) => entry.shardId).length, 128);
  const root = plan.find((entry) => entry.documentId === "seriesDex" && !entry.shardId);
  assert.equal("overrides" in root.data, false);
  assert.equal(plan.filter((entry) => entry.shardId).reduce((n, entry) => n + Object.keys(entry.data.overrides).length, 0), 50000);
});

test("Studio and custom print refuse pending or failed images instead of printing blank cards", async () => {
  for (const [file, expression, functionName] of [
    ["studio.js", "{ elements, waitForPrintImages }", "waitForPrintImages"],
    ["studio-custom.js", "{ waitForCustomPrintImages }", "waitForCustomPrintImages"],
  ]) {
    const ctx = context(); let images = [];
    const node = ctx.document.querySelector();
    node.querySelectorAll = () => images;
    ctx.window.setTimeout = (fn) => { fn(); return 1; };
    ctx.window.clearTimeout = () => {};
    let api;
    if (file === "studio-custom.js") {
      ctx.printRoot = node;
      const source = read(file);
      vm.runInContext(source.slice(source.indexOf("  async function waitForCustomPrintImages()"), source.indexOf("  async function startCustomPrint()")), ctx);
      api = { waitForCustomPrintImages: ctx.waitForCustomPrintImages };
    } else { api = expose(ctx, file, expression, true); }
    images = [{ complete: true, naturalWidth: 400 }];
    await api[functionName]();
    images = [{ complete: true, naturalWidth: 0 }];
    await assert.rejects(api[functionName](), /일부 카드 이미지를 준비하지 못했습니다/);
    images = [{ complete: false, naturalWidth: 0, addEventListener() {}, removeEventListener() {} }];
    await assert.rejects(api[functionName](), /일부 카드 이미지를 준비하지 못했습니다/);
  }
});
