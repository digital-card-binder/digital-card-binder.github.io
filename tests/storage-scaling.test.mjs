import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(file) {
  return readFile(new URL(file, root), "utf8");
}

test("large fixed catalogs use compact per-card Firestore ownership writes", async () => {
  const manager = await source("firebase-page-manager.js");
  const registry = await source("collector-collection-registry.js");

  assert.match(manager, /function usesCompactOwnershipStorage\(\)[\s\S]*?mode === "series" \|\| mode === "ar"/);
  assert.match(manager, /function compactOwnershipOverrides\(/);
  assert.match(manager, /await compactFixedCatalogDocument\(sourceOverrides\)/);
  assert.match(manager, /new firestoreModule[.]FieldPath\("overrides", key\)/);
  assert.match(manager, /firestoreModule[.]deleteField\(\)/);
  assert.match(manager, /firestoreModule[.]updateDoc\(/);
  assert.equal(manager.includes("overrides: nextOverrides"), false);
  assert.match(manager, /if \(usesCompactOwnershipStorage\(\)\) \{\s*return saveCompactOwned\(key, owned\);/);

  // Public projection and legacy readers must continue accepting compact booleans.
  assert.match(registry, /if \(typeof value === "boolean"\) return value;/);
});
