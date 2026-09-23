import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeImageUrl, routeCardImage } from "./card-image-routing.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const defaultOutput = path.join(repositoryRoot, "tmp", "card-images", "manifest.json");

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function sourceRank(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".png")) return 0;
  if (pathname.endsWith(".webp")) return 1;
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return 2;
  return 3;
}

function collectJsonStrings(value, callback, pointer = "$") {
  if (typeof value === "string") {
    callback(value, pointer);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectJsonStrings(item, callback, `${pointer}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, item]) => {
    collectJsonStrings(item, callback, `${pointer}.${key}`);
  });
}

function buildManifest() {
  const records = new Map();

  function add(value, reference) {
    const route = routeCardImage(value);
    if (!route) return;
    const destinationKey = `${route.project}:${route.relativePath}`;
    let record = records.get(destinationKey);
    if (!record) {
      record = {
        project: route.project,
        relativePath: route.relativePath,
        official: route.official,
        root: route.root,
        sourceUrls: new Set(),
        referencedBy: new Set(),
        occurrences: 0,
      };
      records.set(destinationKey, record);
    }
    record.sourceUrls.add(route.canonicalUrl);
    record.referencedBy.add(reference);
    record.occurrences += 1;
  }

  const dataDirectory = path.join(repositoryRoot, "data");
  const dataFiles = fs.readdirSync(dataDirectory)
    .filter((filename) => filename.endsWith(".json"))
    .sort();

  for (const filename of dataFiles) {
    const absolutePath = path.join(dataDirectory, filename);
    const payload = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    collectJsonStrings(payload, (value, pointer) => add(value, `data/${filename}:${pointer}`));
  }

  // M6 is merged into the live catalog at runtime, so include the complete set here.
  for (let number = 1; number <= 113; number += 1) {
    const token = String(number).padStart(3, "0");
    add(
      `https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6/M6_${token}.png`,
      "mega-latest.js:M6 runtime supplement",
    );
  }

  const assets = [...records.values()]
    .map((record) => ({
      project: record.project,
      relativePath: record.relativePath,
      official: record.official,
      root: record.root,
      sourceUrls: [...record.sourceUrls].sort((left, right) => {
        return sourceRank(left) - sourceRank(right) || left.localeCompare(right);
      }),
      referencedBy: [...record.referencedBy].sort(),
      occurrences: record.occurrences,
    }))
    .sort((left, right) => {
      return left.project.localeCompare(right.project) || left.relativePath.localeCompare(right.relativePath);
    });

  // Repair source addresses without changing the public destination or collection IDs.
  const repairFile = path.join(scriptDirectory, "card-image-source-repairs.json");
  const repairs = JSON.parse(fs.readFileSync(repairFile, "utf8"));
  const byDestination = new Map(assets.map((asset) => [`${asset.project}:${asset.relativePath}`, asset]));
  const repaired = new Set();
  for (const repair of repairs.repairs) {
    const key = `${repair.project}:${repair.relativePath}`;
    if (repaired.has(key)) throw new Error(`Duplicate image repair: ${key}`);
    repaired.add(key);
    const asset = byDestination.get(key);
    if (!asset) throw new Error(`Image repair has no manifest destination: ${key}`);
    if (!repair.sourceUrls?.length || repair.sourceUrls.some((url) => canonicalizeImageUrl(url) !== url)) {
      throw new Error(`Image repair requires canonical, supported sources: ${key}`);
    }
    asset.originalSourceUrls = asset.sourceUrls;
    asset.sourceUrls = [...new Set([...repair.sourceUrls, ...asset.sourceUrls])];
    if (repair.reuse) {
      const source = byDestination.get(`${repair.reuse.project}:${repair.reuse.relativePath}`);
      if (!source || source === asset || !source.sourceUrls.some((url) => repair.sourceUrls.includes(url))) {
        throw new Error(`Image repair has an invalid cached source: ${key}`);
      }
      asset.reuse = repair.reuse;
    }
  }

  const counts = {
    total: assets.length,
    modern: assets.filter((asset) => asset.project === "modern").length,
    legacy: assets.filter((asset) => asset.project === "legacy").length,
    official: assets.filter((asset) => asset.official).length,
    external: assets.filter((asset) => !asset.official).length,
    byHost: {},
    byRoot: {},
  };

  for (const asset of assets) {
    const host = new URL(asset.sourceUrls[0]).hostname;
    counts.byHost[host] = (counts.byHost[host] || 0) + 1;
    counts.byRoot[asset.root] = (counts.byRoot[asset.root] || 0) + 1;
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    settings: {
      outputWidth: 420,
      outputFormat: "webp",
      outputQuality: 76,
      watermarkPolicy: "preserve-source-pixels",
    },
    counts,
    assets,
  };
}

const outputPath = path.resolve(option("output", defaultOutput));
const manifest = buildManifest();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Card image manifest: ${outputPath}`);
console.log(JSON.stringify(manifest.counts, null, 2));
