"use strict";

(function () {
  const root = (window.DigitalCardBinder = window.DigitalCardBinder || {});

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function configured(config, options = {}) {
    const firebaseConfig = config?.config || {};
    const requireOwnerEmail = Boolean(options.requireOwnerEmail);
    return Boolean(
      config?.enabled &&
        firebaseConfig.apiKey &&
        firebaseConfig.authDomain &&
        firebaseConfig.projectId &&
        (!requireOwnerEmail || normalizeEmail(config?.ownerEmail)),
    );
  }

  function isOwner(config, user) {
    const ownerEmail = normalizeEmail(config?.ownerEmail);
    return Boolean(
      user &&
        ownerEmail &&
        normalizeEmail(user.email) === ownerEmail,
    );
  }

  function baseMode(config, user) {
    return isOwner(config, user) ? "legacy" : "empty";
  }

  function firstAuthUser(auth, authModule) {
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = authModule.onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user || null);
        },
        reject,
      );
    });
  }

  function documentRef(firestoreModule, db, user, config, documentId) {
    return firestoreModule.doc(
      db,
      "users",
      user.uid,
      config?.userCollection || "collections",
      documentId,
    );
  }

  root.firebaseAccount = Object.freeze({
    normalizeEmail,
    configured,
    isOwner,
    baseMode,
    firstAuthUser,
    documentRef,
  });
})();
