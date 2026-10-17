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

for (const item of refresh) {
  if (typeof item !== "string" || !/^data\/wmimages\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.webp$/.test(item)) {
    throw new Error("Unsafe image refresh path: " + String(item));
  }
  if (seen.has(item)) throw new Error("Duplicate refresh path: " + item);
  seen.add(item);
  const asset = known.get("modern:" + item);
  if (!asset || !asset.official || !asset.sourceUrls.some(url => url.startsWith("https://cards.image.pokemonkorea.co.kr/"))) {
    throw new Error("Refresh path is not an official modern image in manifest: " + item);
  }
  const destination = path.resolve(archiveRoot, "modern", item);
  const modernRoot = path.join(archiveRoot, "modern") + path.sep;
  if (!destination.startsWith(modernRoot)) throw new Error("Image refresh escaped archive: " + item);
  fs.rmSync(destination, { force: true });
  console.log("Official Korean image scheduled for fresh download: " + item);
}
console.log("Requested image refreshes: " + seen.size);
