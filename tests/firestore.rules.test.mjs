import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

const projectId = "demo-digital-card-binder";
const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
let environment;
let alice;
let bob;
let guest;
let owner;

const ALICE_UID = "alice-user";
const BOB_UID = "bob-user";
const OWNER_UID = "owner-user";
const PUBLIC_ID = "alice123test";
const SHARE_ID = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const NEXT_SHARE_ID = "ZyXwVuTsRqPoNmLkJiHgFeDcBa543210";

function userDb(uid, email) {
  return environment
    .authenticatedContext(uid, { email, name: uid })
    .firestore();
}

function profileFields() {
  return {
    nickname: "Alice 84",
    nicknameNormalized: "alice84",
    publicId: PUBLIC_ID,
    bio: "Korean card collector",
    profileCompleted: true,
  };
}

function publicProfileFields() {
  return {
    nickname: "Alice 84",
    bio: "Korean card collector",
    profileCompleted: true,
  };
}

function publicDirectoryFields() {
  return {
    publicId: PUBLIC_ID,
    updatedAt: serverTimestamp(),
  };
}

function projection(collectionId = "national") {
  return {
    schemaVersion: 1,
    publicId: PUBLIC_ID,
    collectionId,
    ownedKeys: ["1", "25"],
    ownedCount: 2,
    totalCount: collectionId === "people" ? 179 : 1025,
    promoOwnedKeys: [],
    promoOwnedCount: 0,
  };
}

async function createAliceProfile() {
  const batch = writeBatch(alice);
  const createdAt = serverTimestamp();
  batch.set(doc(alice, "collectorNicknames", "alice84"), {
    claimed: true,
  });
  batch.set(doc(alice, "collectorNicknameOwners", "alice84"), {
    ownerUid: ALICE_UID,
    createdAt,
  });
  batch.set(doc(alice, "collectorPublicIdOwners", PUBLIC_ID), {
    ownerUid: ALICE_UID,
    createdAt,
  });
  batch.set(doc(alice, "users", ALICE_UID, "profile", "main"), {
    ...profileFields(),
    createdAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(alice, "publicProfiles", PUBLIC_ID), {
    ...publicProfileFields(),
  });
  await assertSucceeds(batch.commit());
}

async function savePrivateSetting() {
  await assertSucceeds(
    setDoc(doc(alice, "users", ALICE_UID, "collectionSettings", "national"), {
      schemaVersion: 1,
      collectionId: "national",
      dashboardVisible: true,
      visibility: "private",
      displayOrder: 0,
      shareId: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
  alice = userDb(ALICE_UID, "alice@example.com");
  bob = userDb(BOB_UID, "bob@example.com");
  owner = userDb(OWNER_UID, "onesmemory@gmail.com");
  guest = environment.unauthenticatedContext().firestore();
});

after(async () => {
  await environment.cleanup();
});

test("existing collection documents remain owner-only and retain baseMode", async () => {
  const reference = doc(alice, "users", ALICE_UID, "collections", "nationalDex");
  await assertSucceeds(
    setDoc(reference, {
      baseMode: "empty",
      email: "alice@example.com",
      displayName: "Alice",
      overrides: {},
    }),
  );
  await assertSucceeds(getDoc(reference));
  await assertFails(
    getDoc(doc(bob, "users", ALICE_UID, "collections", "nationalDex")),
  );
  await assertFails(
    setDoc(doc(bob, "users", ALICE_UID, "collections", "nationalDex"), {
      baseMode: "empty",
      email: "bob@example.com",
      overrides: {},
    }),
  );
  await assertFails(
    setDoc(
      reference,
      {
        baseMode: "legacy",
        email: "alice@example.com",
      },
      { merge: true },
    ),
  );
});

test("trade posts are public, isolated, card-only records owned by the author", async () => {
  const tradeUser = userDb("trade-user", "trade@example.com");
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "users", "trade-user", "profile", "main"),
      {
        nickname: "교환컬렉터",
        profileCompleted: true,
      },
    );
  });

  const offeredCard = {
    name: "피카츄",
    imageUrl: "https://cards.example/pikachu.png",
    detail: "sv2a · 173/165",
    sourcePage: "series.html",
  };
  const wantedCard = {
    name: "라이츄",
    imageUrl: "https://cards.example/raichu.png",
    detail: "AR · 074/071",
    sourcePage: "series.html",
  };
  const validPost = {
    schemaVersion: 2,
    authorUid: "trade-user",
    authorNickname: "교환컬렉터",
    wantedCard,
    offeredCards: [offeredCard],
    acceptOffers: true,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await assertSucceeds(
    addDoc(collection(tradeUser, "tradePosts"), validPost),
  );
  await assertSucceeds(getDocs(collection(guest, "tradePosts")));

  await assertFails(
    addDoc(collection(bob, "tradePosts"), {
      ...validPost,
      authorUid: BOB_UID,
      authorNickname: "교환컬렉터",
    }),
  );
  await assertFails(
    addDoc(collection(tradeUser, "tradePosts"), {
      ...validPost,
      cashPrice: 10000,
    }),
  );
  await assertFails(
    addDoc(collection(tradeUser, "tradePosts"), {
      ...validPost,
      status: "closed",
    }),
  );
  await assertFails(
    addDoc(collection(tradeUser, "tradePosts"), {
      ...validPost,
      wantedCard: "라이츄 AR",
    }),
  );
  await assertFails(
    addDoc(collection(tradeUser, "tradePosts"), {
      ...validPost,
      offeredCards: [],
    }),
  );
});

test("trade proposals, accepted messages, unread updates, blocks, reports, and deletion enforce participants", async () => {
  const authorUid = "trade-author";
  const proposerUid = "trade-proposer";
  const strangerUid = "trade-stranger";
  const authorDb = userDb(authorUid, "author@example.com");
  const proposerDb = userDb(proposerUid, "proposer@example.com");
  const strangerDb = userDb(strangerUid, "stranger@example.com");
  const authorNationalRef = doc(authorDb, "users", authorUid, "collections", "nationalDex");
  await environment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await Promise.all([
      setDoc(doc(adminDb, "users", authorUid, "profile", "main"), {
        nickname: "글작성자",
        profileCompleted: true,
      }),
      setDoc(doc(adminDb, "users", proposerUid, "profile", "main"), {
        nickname: "제안자",
        profileCompleted: true,
      }),
      setDoc(doc(adminDb, "users", strangerUid, "profile", "main"), {
        nickname: "제삼자",
        profileCompleted: true,
      }),
      setDoc(doc(adminDb, "users", authorUid, "collections", "nationalDex"), {
        baseMode: "empty",
        email: "author@example.com",
        overrides: { 25: { owned: true } },
        updatedAt: "before-trade-completion",
      }),
    ]);
  });
  const nationalBeforeCompletion = (await assertSucceeds(getDoc(authorNationalRef))).data();

  const card = {
    name: "피카츄",
    imageUrl: "https://cards.example/pikachu.png",
    detail: "sv2a · 173/165",
    sourcePage: "series.html",
  };
  const postFields = {
    schemaVersion: 2,
    authorUid,
    authorNickname: "글작성자",
    wantedCard: { ...card, name: "라이츄", imageUrl: "https://cards.example/raichu.png" },
    offeredCards: [card],
    acceptOffers: true,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const postRef = await assertSucceeds(
    addDoc(collection(authorDb, "tradePosts"), postFields),
  );
  const proposalFields = {
    schemaVersion: 1,
    postId: postRef.id,
    postAuthorUid: authorUid,
    proposerUid,
    proposerNickname: "제안자",
    offeredCards: [{ ...card, name: "라이츄" }],
    message: "이 카드와 교환을 제안합니다.",
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const proposalRef = await assertSucceeds(
    addDoc(collection(proposerDb, "tradeProposals"), proposalFields),
  );
  await assertFails(
    addDoc(collection(proposerDb, "tradeProposals"), {
      ...proposalFields,
      cashAmount: 10000,
    }),
  );

  await assertFails(getDoc(doc(strangerDb, "tradeProposals", proposalRef.id)));
  await assertFails(getDocs(collection(guest, "tradeProposals")));
  await assertFails(
    updateDoc(doc(proposerDb, "tradeProposals", proposalRef.id), {
      status: "accepted",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    addDoc(collection(proposerDb, "tradeMessages"), {
      schemaVersion: 1,
      proposalId: proposalRef.id,
      senderUid: proposerUid,
      recipientUid: authorUid,
      text: "수락 전 메시지",
      createdAt: serverTimestamp(),
      readAt: null,
    }),
  );

  const acceptBatch = writeBatch(authorDb);
  acceptBatch.update(doc(authorDb, "tradeProposals", proposalRef.id), {
    status: "accepted",
    updatedAt: serverTimestamp(),
  });
  acceptBatch.update(doc(authorDb, "tradePosts", postRef.id), {
    status: "completed",
    acceptedProposalId: proposalRef.id,
    updatedAt: serverTimestamp(),
  });
  acceptBatch.set(doc(authorDb, "tradeConversations", proposalRef.id), {
    schemaVersion: 1,
    proposalId: proposalRef.id,
    postId: postRef.id,
    participantUids: [authorUid, proposerUid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(acceptBatch.commit());
  assert.equal((await getDoc(doc(guest, "tradePosts", postRef.id))).data().status, "completed");
  assert.deepEqual(
    (await assertSucceeds(getDoc(authorNationalRef))).data(),
    nationalBeforeCompletion,
  );
  await assertFails(deleteDoc(doc(authorDb, "tradePosts", postRef.id)));

  const messageRef = await assertSucceeds(
    addDoc(collection(proposerDb, "tradeMessages"), {
      schemaVersion: 1,
      proposalId: proposalRef.id,
      senderUid: proposerUid,
      recipientUid: authorUid,
      text: "수락 후 보내는 쪽지",
      createdAt: serverTimestamp(),
      readAt: null,
    }),
  );
  await assertSucceeds(
    getDocs(query(
      collection(authorDb, "tradeMessages"),
      where("proposalId", "==", proposalRef.id),
    )),
  );
  await assertFails(getDoc(doc(strangerDb, "tradeMessages", messageRef.id)));
  await assertFails(
    updateDoc(doc(proposerDb, "tradeMessages", messageRef.id), {
      readAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(authorDb, "tradeMessages", messageRef.id), {
      readAt: serverTimestamp(),
    }),
  );

  const blockId = `${authorUid}__${proposerUid}`;
  await assertSucceeds(
    setDoc(doc(authorDb, "tradeBlocks", blockId), {
      blockerUid: authorUid,
      blockedUid: proposerUid,
      createdAt: serverTimestamp(),
    }),
  );
  await assertFails(
    addDoc(collection(proposerDb, "tradeMessages"), {
      schemaVersion: 1,
      proposalId: proposalRef.id,
      senderUid: proposerUid,
      recipientUid: authorUid,
      text: "차단 후 메시지",
      createdAt: serverTimestamp(),
      readAt: null,
    }),
  );
  await assertSucceeds(
    addDoc(collection(proposerDb, "tradeReports"), {
      schemaVersion: 1,
      proposalId: proposalRef.id,
      reporterUid: proposerUid,
      targetUid: authorUid,
      reason: "부적절한 교환 응대",
      status: "new",
      createdAt: serverTimestamp(),
    }),
  );
  await assertFails(
    addDoc(collection(strangerDb, "tradeReports"), {
      schemaVersion: 1,
      proposalId: proposalRef.id,
      reporterUid: strangerUid,
      targetUid: authorUid,
      reason: "관계없는 신고",
      status: "new",
      createdAt: serverTimestamp(),
    }),
  );

  const deletablePost = await assertSucceeds(
    addDoc(collection(authorDb, "tradePosts"), postFields),
  );
  const rejectedProposal = await assertSucceeds(
    addDoc(collection(proposerDb, "tradeProposals"), {
      ...proposalFields,
      postId: deletablePost.id,
    }),
  );
  await assertSucceeds(
    updateDoc(doc(authorDb, "tradeProposals", rejectedProposal.id), {
      status: "rejected",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(proposerDb, "tradePosts", deletablePost.id)));
  await assertSucceeds(deleteDoc(doc(authorDb, "tradePosts", deletablePost.id)));
});

test("owner Sheets sync can repair a legacy document without baseMode", async () => {
  const reference = doc(owner, "users", OWNER_UID, "collections", "packDex");
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "users", OWNER_UID, "collections", "packDex"),
      {
        ownedCodes: ["sv1S"],
        updatedAt: "legacy-document",
      },
    );
  });

  await assertSucceeds(
    setDoc(
      reference,
      {
        baseMode: "legacy",
        email: "onesmemory@gmail.com",
        displayName: "Owner",
        ownedCodes: ["sv1S", "m1S"],
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  );
  const repaired = await getDoc(reference);
  assert.equal(repaired.data().baseMode, "legacy");
  assert.deepEqual(repaired.data().ownedCodes, ["sv1S", "m1S"]);
});

test("profile creation atomically claims nickname and publicId without exposing UID", async () => {
  await createAliceProfile();
  const publicSnapshot = await assertSucceeds(
    getDoc(doc(guest, "publicProfiles", PUBLIC_ID)),
  );
  assert.equal(publicSnapshot.data().nickname, "Alice 84");
  assert.equal("ownerUid" in publicSnapshot.data(), false);
  assert.equal("email" in publicSnapshot.data(), false);
  assert.equal("nicknameNormalized" in publicSnapshot.data(), false);
  const nicknameSnapshot = await assertSucceeds(
    getDoc(doc(guest, "collectorNicknames", "alice84")),
  );
  assert.deepEqual(nicknameSnapshot.data(), { claimed: true });
  await assertFails(getDocs(collection(guest, "collectorNicknames")));
  await assertSucceeds(
    getDoc(doc(alice, "collectorNicknameOwners", "alice84")),
  );
  await assertFails(
    getDoc(doc(bob, "collectorNicknameOwners", "alice84")),
  );
  await assertFails(
    getDoc(doc(guest, "collectorNicknameOwners", "alice84")),
  );
  await assertFails(getDocs(collection(guest, "publicProfiles")));
  await assertFails(
    getDoc(doc(bob, "users", ALICE_UID, "profile", "main")),
  );
});

test("a concurrent user cannot overwrite an existing nickname claim", async () => {
  const batch = writeBatch(bob);
  const createdAt = serverTimestamp();
  batch.set(doc(bob, "collectorNicknames", "alice84"), {
    claimed: true,
  });
  batch.set(doc(bob, "collectorNicknameOwners", "alice84"), {
    ownerUid: BOB_UID,
    createdAt,
  });
  batch.set(doc(bob, "collectorPublicIdOwners", "bob12345test"), {
    ownerUid: BOB_UID,
    createdAt,
  });
  batch.set(doc(bob, "users", BOB_UID, "profile", "main"), {
    nickname: "Alice84",
    nicknameNormalized: "alice84",
    publicId: "bob12345test",
    bio: "",
    profileCompleted: true,
    createdAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(bob, "publicProfiles", "bob12345test"), {
    nickname: "Alice84",
    bio: "",
    profileCompleted: true,
  });
  await assertFails(batch.commit());
});

test("direct profile writes cannot bypass normalized nickname spacing", async () => {
  const batch = writeBatch(bob);
  const createdAt = serverTimestamp();
  batch.set(doc(bob, "collectorNicknames", "bob84"), {
    claimed: true,
  });
  batch.set(doc(bob, "collectorNicknameOwners", "bob84"), {
    ownerUid: BOB_UID,
    createdAt,
  });
  batch.set(doc(bob, "collectorPublicIdOwners", "bob12345test"), {
    ownerUid: BOB_UID,
    createdAt,
  });
  batch.set(doc(bob, "users", BOB_UID, "profile", "main"), {
    nickname: "Bob  84",
    nicknameNormalized: "bob84",
    publicId: "bob12345test",
    bio: "",
    profileCompleted: true,
    createdAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(bob, "publicProfiles", "bob12345test"), {
    nickname: "Bob  84",
    bio: "",
    profileCompleted: true,
  });
  await assertFails(batch.commit());
});

test("nickname rename releases the old claim and keeps the publicId stable", async () => {
  const privateRef = doc(alice, "users", ALICE_UID, "profile", "main");
  const publicRef = doc(alice, "publicProfiles", PUBLIC_ID);
  const privateProfile = (await getDoc(privateRef)).data();
  const publicProfile = (await getDoc(publicRef)).data();

  const incompleteRename = writeBatch(alice);
  incompleteRename.set(doc(alice, "collectorNicknames", "aliceheld"), {
    claimed: true,
  });
  incompleteRename.set(doc(alice, "collectorNicknameOwners", "aliceheld"), {
    ownerUid: ALICE_UID,
    createdAt: serverTimestamp(),
  });
  incompleteRename.set(privateRef, {
    ...privateProfile,
    nickname: "Alice Held",
    nicknameNormalized: "aliceheld",
    updatedAt: serverTimestamp(),
  });
  incompleteRename.set(publicRef, {
    ...publicProfile,
    nickname: "Alice Held",
  });
  await assertFails(incompleteRename.commit());

  const batch = writeBatch(alice);
  const createdAt = serverTimestamp();

  batch.set(doc(alice, "collectorNicknames", "alicenew"), {
    claimed: true,
  });
  batch.set(doc(alice, "collectorNicknameOwners", "alicenew"), {
    ownerUid: ALICE_UID,
    createdAt,
  });
  batch.delete(doc(alice, "collectorNicknames", "alice84"));
  batch.delete(doc(alice, "collectorNicknameOwners", "alice84"));
  batch.set(privateRef, {
    ...privateProfile,
    nickname: "Alice New",
    nicknameNormalized: "alicenew",
    updatedAt: serverTimestamp(),
  });
  batch.set(publicRef, {
    ...publicProfile,
    nickname: "Alice New",
  });

  await assertSucceeds(batch.commit());
  const renamed = await getDoc(privateRef);
  assert.equal(renamed.data().publicId, PUBLIC_ID);
  assert.equal(renamed.data().nicknameNormalized, "alicenew");
  assert.equal(
    (await getDoc(doc(guest, "collectorNicknames", "alice84"))).exists(),
    false,
  );
  assert.equal(
    (await getDoc(doc(guest, "collectorNicknames", "alicenew"))).exists(),
    true,
  );
});

test("profile schemas reject removed file and image URL fields", async () => {
  const privateRef = doc(alice, "users", ALICE_UID, "profile", "main");
  const publicRef = doc(alice, "publicProfiles", PUBLIC_ID);
  const privateProfile = (await getDoc(privateRef)).data();
  const publicProfile = (await getDoc(publicRef)).data();

  const privateExtraField = writeBatch(alice);
  privateExtraField.set(privateRef, {
    ...privateProfile,
    profileImageUrl: "https://example.com/tracker.webp",
    updatedAt: serverTimestamp(),
  });
  privateExtraField.set(publicRef, publicProfile);
  await assertFails(privateExtraField.commit());

  const publicExtraField = writeBatch(alice);
  publicExtraField.set(privateRef, {
    ...privateProfile,
    updatedAt: serverTimestamp(),
  });
  publicExtraField.set(publicRef, {
    ...publicProfile,
    profileImageUrl: "https://example.com/tracker.webp",
  });
  await assertFails(publicExtraField.commit());
});

test("private profile changes cannot leave the public mirror stale", async () => {
  const privateRef = doc(alice, "users", ALICE_UID, "profile", "main");
  const privateProfile = (await getDoc(privateRef)).data();
  await assertFails(
    setDoc(privateRef, {
      ...privateProfile,
      bio: "private-only update",
      updatedAt: serverTimestamp(),
    }),
  );
});

test("a profile without a PUBLIC collection cannot enter the public directory", async () => {
  await assertFails(
    setDoc(
      doc(alice, "publicCollectorDirectory", PUBLIC_ID),
      publicDirectoryFields(),
    ),
  );
  await assertFails(
    setDoc(
      doc(guest, "publicCollectorDirectory", PUBLIC_ID),
      publicDirectoryFields(),
    ),
  );
});

test("public projection is readable but private source and extra fields stay blocked", async () => {
  await savePrivateSetting();
  const settingRef = doc(
    alice,
    "users",
    ALICE_UID,
    "collectionSettings",
    "national",
  );
  const createdAt = (await getDoc(settingRef)).data().createdAt;
  const publicRef = doc(
    alice,
    "publicProfiles",
    PUBLIC_ID,
    "collections",
    "national",
  );
  const batch = writeBatch(alice);
  batch.set(settingRef, {
    schemaVersion: 1,
    collectionId: "national",
    dashboardVisible: true,
    visibility: "public",
    displayOrder: 0,
    shareId: "",
    createdAt,
    updatedAt: serverTimestamp(),
  });
  batch.set(publicRef, projection());
  await assertSucceeds(batch.commit());

  const publicRead = await assertSucceeds(
    getDoc(
      doc(
        guest,
        "publicProfiles",
        PUBLIC_ID,
        "collections",
        "national",
      ),
    ),
  );
  assert.deepEqual(publicRead.data().ownedKeys, ["1", "25"]);
  await assertFails(
    getDoc(doc(guest, "users", ALICE_UID, "collections", "nationalDex")),
  );
  await assertFails(
    setDoc(
      doc(
        bob,
        "publicProfiles",
        PUBLIC_ID,
        "collections",
        "national",
      ),
      projection(),
    ),
  );
  await assertFails(
    setDoc(publicRef, { ...projection(), note: "must never be public" }),
  );
  await assertFails(deleteDoc(publicRef));
  const publicList = await assertSucceeds(
    getDocs(collection(guest, "publicProfiles", PUBLIC_ID, "collections")),
  );
  assert.equal(publicList.size, 1);
});

test("large series projections can exceed the former 10,000-card limit", async () => {
  const settingRef = doc(
    alice,
    "users",
    ALICE_UID,
    "collectionSettings",
    "series",
  );
  const publicRef = doc(
    alice,
    "publicProfiles",
    PUBLIC_ID,
    "collections",
    "series",
  );
  const ownedKeys = Array.from({ length: 10001 }, (_, index) => `k${index}`);
  const publish = writeBatch(alice);

  publish.set(settingRef, {
    schemaVersion: 1,
    collectionId: "series",
    dashboardVisible: true,
    visibility: "public",
    displayOrder: 3,
    shareId: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  publish.set(publicRef, {
    ...projection("series"),
    ownedKeys,
    ownedCount: ownedKeys.length,
    totalCount: 10321,
  });
  await assertSucceeds(publish.commit());
  await assertFails(
    setDoc(publicRef, {
      ...projection("series"),
      totalCount: 20001,
    }),
  );

  const setting = (await getDoc(settingRef)).data();
  const revoke = writeBatch(alice);
  revoke.set(settingRef, {
    ...setting,
    visibility: "private",
    updatedAt: serverTimestamp(),
  });
  revoke.delete(publicRef);
  await assertSucceeds(revoke.commit());
});

test("a PUBLIC collector can enter the list without exposing UID or email", async () => {
  const directoryRef = doc(alice, "publicCollectorDirectory", PUBLIC_ID);
  await assertSucceeds(setDoc(directoryRef, publicDirectoryFields()));

  const publicList = await assertSucceeds(
    getDocs(collection(guest, "publicCollectorDirectory")),
  );
  assert.equal(publicList.size, 1);
  assert.deepEqual(
    Object.keys(publicList.docs[0].data()).sort(),
    ["publicId", "updatedAt"],
  );
  assert.equal(publicList.docs[0].data().publicId, PUBLIC_ID);

  await assertFails(
    setDoc(directoryRef, {
      ...publicDirectoryFields(),
      ownerUid: ALICE_UID,
    }),
  );
  await assertFails(
    setDoc(
      doc(bob, "publicCollectorDirectory", PUBLIC_ID),
      publicDirectoryFields(),
    ),
  );
});

test("private transition atomically revokes the old public link", async () => {
  const settingRef = doc(
    alice,
    "users",
    ALICE_UID,
    "collectionSettings",
    "national",
  );
  const publicRef = doc(
    alice,
    "publicProfiles",
    PUBLIC_ID,
    "collections",
    "national",
  );
  const setting = (await getDoc(settingRef)).data();
  await assertFails(
    setDoc(settingRef, {
      ...setting,
      visibility: "private",
      updatedAt: serverTimestamp(),
    }),
  );

  const batch = writeBatch(alice);
  batch.set(settingRef, {
    ...setting,
    visibility: "private",
    updatedAt: serverTimestamp(),
  });
  batch.delete(publicRef);
  batch.delete(doc(alice, "publicCollectorDirectory", PUBLIC_ID));
  await assertSucceeds(batch.commit());
  const revoked = await assertSucceeds(
    getDoc(
      doc(
        guest,
        "publicProfiles",
        PUBLIC_ID,
        "collections",
        "national",
      ),
    ),
  );
  assert.equal(revoked.exists(), false);
  assert.equal(
    (await getDocs(collection(guest, "publicCollectorDirectory"))).size,
    0,
  );
});

test("unlisted token supports exact get, blocks list, and is revoked by private", async () => {
  const settingRef = doc(
    alice,
    "users",
    ALICE_UID,
    "collectionSettings",
    "national",
  );
  const setting = (await getDoc(settingRef)).data();
  const sharedRef = doc(alice, "sharedCollections", SHARE_ID);
  const batch = writeBatch(alice);
  batch.set(settingRef, {
    ...setting,
    visibility: "unlisted",
    shareId: SHARE_ID,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(alice, "collectorShareOwners", SHARE_ID), {
    ownerUid: ALICE_UID,
    collectionId: "national",
    createdAt: serverTimestamp(),
  });
  batch.set(sharedRef, projection());
  await assertSucceeds(batch.commit());

  await assertSucceeds(getDoc(doc(guest, "sharedCollections", SHARE_ID)));
  await assertFails(getDocs(collection(guest, "sharedCollections")));
  await assertFails(
    setDoc(doc(bob, "sharedCollections", SHARE_ID), projection()),
  );
  await assertFails(deleteDoc(sharedRef));

  const incompleteRotation = writeBatch(alice);
  incompleteRotation.set(settingRef, {
    ...(await getDoc(settingRef)).data(),
    shareId: NEXT_SHARE_ID,
    updatedAt: serverTimestamp(),
  });
  incompleteRotation.set(doc(alice, "collectorShareOwners", NEXT_SHARE_ID), {
    ownerUid: ALICE_UID,
    collectionId: "national",
    createdAt: serverTimestamp(),
  });
  incompleteRotation.set(
    doc(alice, "sharedCollections", NEXT_SHARE_ID),
    projection(),
  );
  await assertFails(incompleteRotation.commit());

  const incompleteRevocation = writeBatch(alice);
  incompleteRevocation.set(settingRef, {
    ...(await getDoc(settingRef)).data(),
    visibility: "private",
    shareId: "",
    updatedAt: serverTimestamp(),
  });
  incompleteRevocation.delete(sharedRef);
  await assertFails(incompleteRevocation.commit());

  const privateBatch = writeBatch(alice);
  privateBatch.set(settingRef, {
    ...(await getDoc(settingRef)).data(),
    visibility: "private",
    shareId: "",
    updatedAt: serverTimestamp(),
  });
  privateBatch.delete(sharedRef);
  privateBatch.delete(doc(alice, "collectorShareOwners", SHARE_ID));
  await assertSucceeds(privateBatch.commit());
  const revoked = await assertSucceeds(
    getDoc(doc(guest, "sharedCollections", SHARE_ID)),
  );
  assert.equal(revoked.exists(), false);
});

test("collector settings never allow a private state while projection remains", async () => {
  const settingRef = doc(
    alice,
    "users",
    ALICE_UID,
    "collectionSettings",
    "national",
  );
  const current = (await getDoc(settingRef)).data();
  await assertSucceeds(
    setDoc(settingRef, {
      ...current,
      visibility: "private",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    deleteDoc(doc(bob, "users", ALICE_UID, "collectionSettings", "national")),
  );
  await assertFails(
    setDoc(doc(bob, "users", ALICE_UID, "collectionSettings", "national"), {
      ...current,
      dashboardVisible: false,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(guest, "sharedCollections", SHARE_ID), projection()),
  );
});
