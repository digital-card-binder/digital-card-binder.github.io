import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

const projectId = "demo-digital-card-binder-legacy-share";
const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
const uid = "legacy-user";
const publicId = "legacy123abc";
const shareId = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const createdAt = Timestamp.fromMillis(1_000);
let environment;
let db;

function setting(visibility, currentShareId) {
  return {
    schemaVersion: 1,
    collectionId: "custom",
    dashboardVisible: true,
    visibility,
    displayOrder: 8,
    shareId: currentShareId,
    createdAt,
    updatedAt: serverTimestamp(),
  };
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
  db = environment
    .authenticatedContext(uid, { email: "legacy@example.com", name: "Legacy" })
    .firestore();

  await environment.withSecurityRulesDisabled(async (context) => {
    const admin = context.firestore();
    await Promise.all([
      setDoc(doc(admin, "users", uid, "profile", "main"), {
        nickname: "Legacy",
        nicknameNormalized: "legacy",
        publicId,
        bio: "",
        profileCompleted: true,
        createdAt,
        updatedAt: createdAt,
      }),
      setDoc(doc(admin, "users", uid, "collectionSettings", "custom"), {
        ...setting("unlisted", shareId),
        updatedAt: createdAt,
      }),
      setDoc(doc(admin, "collectorShareOwners", shareId), {
        ownerUid: uid,
        collectionId: "custom",
        createdAt,
      }),
      setDoc(doc(admin, "sharedCollections", shareId), {
        schemaVersion: 1,
        publicId,
        collectionId: "custom",
        ownedKeys: [],
        ownedCount: 0,
        totalCount: 0,
        promoOwnedKeys: [],
        promoOwnedCount: 0,
        customDexes: [],
      }),
    ]);
  });
});

after(async () => {
  await environment.cleanup();
});

test("legacy unlisted setting must revoke both share documents in the same batch", async () => {
  const settingRef = doc(db, "users", uid, "collectionSettings", "custom");
  const sharedRef = doc(db, "sharedCollections", shareId);
  const ownerRef = doc(db, "collectorShareOwners", shareId);

  const incomplete = writeBatch(db);
  incomplete.set(settingRef, setting("private", ""));
  await assertFails(incomplete.commit());

  const migration = writeBatch(db);
  migration.set(settingRef, setting("private", ""));
  migration.delete(sharedRef);
  migration.delete(ownerRef);
  await assertSucceeds(migration.commit());

  const saved = await assertSucceeds(getDoc(settingRef));
  assert.equal(saved.data().visibility, "private");
  assert.equal(saved.data().shareId, "");
  assert.equal((await assertSucceeds(getDoc(sharedRef))).exists(), false);

  await environment.withSecurityRulesDisabled(async (context) => {
    const ownerSnapshot = await getDoc(
      doc(context.firestore(), "collectorShareOwners", shareId),
    );
    assert.equal(ownerSnapshot.exists(), false);
  });
});
