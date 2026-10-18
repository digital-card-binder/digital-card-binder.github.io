#!/usr/bin/env node
/**
 * Force a narrowly scoped refresh of selected self-hosted card images.
 * Only paths already present in the generated manifest may be removed.
 * The existing missing-only downloader then re-fetches their official sources.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const request = JSON.parse(fs.readFileSync(path.join(root, ".github/card-image-deploy-request.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "tmp/card-images/manifest.json"), "utf8"));
const refresh = request.refreshCardImages ?? [];
if (!Array.isArray(refresh) || refresh.length > 150) {
  throw new Error("refreshCardImages must be an array of at most 150 image paths.");
}
const known = new Map((manifest.assets || []).map(asset => [asset.project + ":" + asset.relativePath, asset]));
const archiveRoot = path.resolve(root, "tmp/card-images/build");
const seen = new Set();

// An S6K 089 Korean-source scan reuses a historic external archive name.
// Permit one exact verified destination+source combination and request ID only.
const verifiedLegacyRefresh = Object.freeze({
  "external/static.tcgexchange.kr/28a6c6a2874e2319.webp": {
    source: "https://static.tcgexchange.kr/77e9f3ab6a3bf7f1b8db71312ee2469f.png",
    requestId: "s6k089-verified-korean-image-force-cache-replacement-20261018-1",
  },
});

for (const item of refresh) {
  const officialPattern = /^data\\/wmimages\\/[A-Za-z0-9_-]+\\/[A-Za-z0-9_+-]+\\/[A-Za-z0-9_.-]+\\.webp$/;
  const isOfficialPath = typeof item === "string" && officialPattern.test(item);
  const approvedLegacy = typeof item === "string" ? verifiedLegacyRefresh[item] : undefined;
  if (!isOfficialPath && !approvedLegacy) {
    throw new Error("Unsafe image refresh path: " + String(item));
  }
  if (seen.has(item)) throw new Error("Duplicate refresh path: " + item);
  seen.add(item);
  const asset = known.get("modern:" + item) || known.get("legacy:" + item);
  const authorizedOfficial = isOfficialPath && asset?.official &&
    asset.sourceUrls.some(url => url.startsWith("https://cards.image.pokemonkorea.co.kr/"));
  const authorizedLegacy = approvedLegacy && request.mode === "repair_only" &&
    request.requestId === approvedLegacy.requestId && asset?.project === "legacy" &&
    asset.official === false && asset.sourceUrls.includes(approvedLegacy.source);
  if (!asset || !["modern", "legacy"].includes(asset.project) ||
      !(authorizedOfficial || authorizedLegacy)) {
    throw new Error("Refresh path is not approved in current manifest: " + item);
  }
  const destination = path.resolve(archiveRoot, asset.project, item);
  const projectRoot = path.join(archiveRoot, asset.project) + path.sep;
  if (!destination.startsWith(projectRoot)) throw new Error("Image refresh escaped archive: " + item);
  fs.rmSync(destination, { force: true });
  console.log("Approved Korean source scheduled for fresh download: " + asset.project + ":" + item);
}
console.log("Requested image refreshes: " + seen.size);
