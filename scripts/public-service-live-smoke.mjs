#!/usr/bin/env node
// Read-only production smoke: public static pages and anonymous Firestore projections.
// No authentication, private user documents, raw profile IDs, names or ownership data.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, collection, doc, query, limit, getDocsFromServer, getDocFromServer, terminate } from "firebase/firestore";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://digital-card-binder.github.io/";
const reportPath = path.join(root, "reports", "public-service-smoke.json");
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  target: "public website and anonymous community read-only query",
  checks: [],
  publicDirectory: { status: "not-checked", sampledProfiles: 0, checkedPublicCollections: 0, profilesWithPublishedItems: 0 },
  privateDocumentsRead: false,
  privateDocumentsWritten: false,
  errors: 0,
};
const logStatus = (name, ok, detail = "") => {
  report.checks.push({ name, status: ok ? "ok" : "failed", ...(detail ? { detail } : {}) });
  if (!ok) report.errors++;
  console.log(JSON.stringify({ check: name, ok, ...(detail ? { detail } : {}) }));
};
const safeError = (error) => {
  const code = String(error?.code || "");
  if (/^[a-z-]{2,48}$/.test(code)) return code;
  const name = String(error?.name || "Error");
  return /^[A-Za-z]+Error$/.test(name) ? name : "request-error";
};
async function withDeadline(work, timeoutMs = 18000) {
  let timer;
  try {
    return await Promise.race([
      work(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("request timeout"), { code: "deadline-exceeded" })), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function readPublic(relative) {
  if (!/^[a-z0-9./-]+$/.test(relative) || relative.includes("..")) throw new Error("invalid relative path");
  const response = await fetch(new URL(relative, base), {
    signal: AbortSignal.timeout(15000),
    headers: { "Accept": relative.endsWith(".json") ? "application/json" : "text/html,*/*" },
    cache: "no-store",
  });
  if (!response.ok) throw Object.assign(new Error("static response error"), { code: "http-" + response.status });
  return response.text();
}
async function checkStatic() {
  const versionText = await readPublic("site-version.json");
  const version = JSON.parse(versionText);
  logStatus("published-site-version", /^b-[a-f0-9]{12}$/.test(String(version.version || "")) && typeof version.assets === "object");
  const pages = [
    ["index.html", /id="main-content"/],
    ["collectors.html", /id="collector-directory-grid"/],
    ["collector.html", /id="main-content"/],
    ["collector-settings.html", /id="main-content"/],
    ["operations.html", /id="operations-backup"/],
    ["series.html", /id="main-content"/],
  ];
  for (const [page, marker] of pages) {
    try {
      const html = await readPublic(page);
      logStatus("public-page:" + page, marker.test(html) && /<html[\s>]/i.test(html));
    } catch (error) {
      logStatus("public-page:" + page, false, safeError(error));
    }
  }
  for (const asset of ["collector-directory.js", "collector.js", "collector-public-sync.js", "operations.js"]) {
    try {
      const response = await fetch(new URL(asset, base), { signal: AbortSignal.timeout(15000), cache: "no-store" });
      const content = response.ok ? await response.text() : "";
      logStatus("public-asset:" + asset, response.ok && content.length > 200);
    } catch (error) {
      logStatus("public-asset:" + asset, false, safeError(error));
    }
  }
}
function firebaseConfig() {
  const source = fs.readFileSync(path.join(root, "firebase-config.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const config = context.window.POKEMON_DEX_FIREBASE;
  if (!config?.enabled || !config.config?.projectId || !config.config?.apiKey) throw new Error("firebase-config-unavailable");
  return config.config;
}
async function checkPublicDirectory() {
  let app;
  let db;
  try {
    app = initializeApp(firebaseConfig(), "dcb-public-read-only-smoke");
    db = getFirestore(app);
    const snapshot = await withDeadline(() => getDocsFromServer(query(
      collection(db, "publicCollectorDirectory"), limit(4),
    )));
    const entries = snapshot.docs.filter((entry) => /^[a-z0-9]{12}$/.test(entry.id));
    report.publicDirectory.sampledProfiles = entries.length;
    if (!entries.length) {
      report.publicDirectory.status = "empty-directory";
      logStatus("anonymous-public-directory-read", false, "no-published-entries-in-sample");
      return;
    }
    let collectionsChecked = 0;
    let published = 0;
    let invalid = 0;
    for (const entry of entries) {
      const publicId = entry.id;
      if (entry.data()?.publicId !== publicId) { invalid++; continue; }
      const [profile, collectionSnapshots, binderSnapshots] = await withDeadline(() => Promise.all([
        getDocFromServer(doc(db, "publicProfiles", publicId)),
        getDocsFromServer(query(collection(db, "publicProfiles", publicId, "collections"), limit(16))),
        getDocsFromServer(query(collection(db, "publicProfiles", publicId, "binders"), limit(16))),
      ]));
      if (!profile.exists() || profile.data()?.profileCompleted !== true) { invalid++; continue; }
      let visibleCount = 0;
      for (const projection of collectionSnapshots.docs) {
        const data = projection.data() || {};
        if (data.schemaVersion === 1 && data.publicId === publicId &&
            data.collectionId === projection.id) visibleCount++;
      }
      for (const binder of binderSnapshots.docs) {
        const data = binder.data() || {};
        if (data.schemaVersion === 1 && data.publicId === publicId &&
            data.binderId === binder.id) visibleCount++;
      }
      collectionsChecked += visibleCount;
      if (visibleCount > 0) published++;
      else invalid++;
    }
    report.publicDirectory.checkedPublicCollections = collectionsChecked;
    report.publicDirectory.profilesWithPublishedItems = published;
    report.publicDirectory.status = invalid === 0 ? "ok" : "inconsistent";
    logStatus("anonymous-public-directory-read", invalid === 0 && published > 0,
      invalid ? "invalid-public-projection:" + invalid : "");
  } catch (error) {
    report.publicDirectory.status = "error";
    logStatus("anonymous-public-directory-read", false, safeError(error));
  } finally {
    if (db) {
      try { await withDeadline(() => terminate(db), 5000); } catch { /* only cleanup */ }
    }
    if (app) {
      try { await deleteApp(app); } catch { /* only cleanup */ }
    }
  }
}
try {
  await checkStatic();
} catch (error) {
  logStatus("public-static-bootstrap", false, safeError(error));
}
await checkPublicDirectory();
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({
  totalChecks: report.checks.length,
  errors: report.errors,
  publicDirectory: report.publicDirectory,
  note: "Only anonymous public reads; no private member data or collection writes.",
}));
if (report.errors) process.exitCode = 1;
