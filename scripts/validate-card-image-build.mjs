import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

const project = option("project");
if (!new Set(["modern", "legacy"]).has(project)) {
  throw new Error("Use --project=modern or --project=legacy");
}

const manifestPath = path.resolve(
  option("manifest", path.join(repositoryRoot, "tmp", "card-images", "manifest.json")),
);
const outputRoot = path.resolve(
  option("output-root", path.join(repositoryRoot, "tmp", "card-images", "build")),
);
const allowMissing = process.argv.includes("--allow-missing");
const maxFileBytes = 25 * 1024 * 1024;
const maxProjectFiles = 20_000;

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const assets = manifest.assets.filter((asset) => asset.project === project);
const projectRoot = path.join(outputRoot, project);
const missing = [];
let largest = { bytes: 0, path: "" };

for (const asset of assets) {
  if (!asset.relativePath.endsWith(".webp")) {
    throw new Error(`Non-WebP destination in manifest: ${asset.relativePath}`);
  }
  if (asset.relativePath.includes("..") || path.isAbsolute(asset.relativePath)) {
    throw new Error(`Unsafe destination path: ${asset.relativePath}`);
  }
  const absolutePath = path.join(projectRoot, asset.relativePath);
  if (!fs.existsSync(absolutePath)) {
    missing.push(asset.relativePath);
    continue;
  }
  const bytes = fs.statSync(absolutePath).size;
  if (bytes > maxFileBytes) {
    throw new Error(`Cloudflare 25 MiB file limit exceeded: ${asset.relativePath}`);
  }
  if (bytes > largest.bytes) largest = { bytes, path: asset.relativePath };
}

const metadataFiles = ["index.html", "_headers", "asset-sources.json"];
for (const filename of metadataFiles) {
  if (!fs.existsSync(path.join(projectRoot, filename))) missing.push(filename);
}

const expectedFileCount = assets.length + metadataFiles.length;
if (expectedFileCount > maxProjectFiles) {
  throw new Error(
    `${project} needs ${expectedFileCount} files, above the Cloudflare Free limit of ${maxProjectFiles}`,
  );
}
if (missing.length && !allowMissing) {
  throw new Error(`${project} build is missing ${missing.length} files; first: ${missing.slice(0, 10).join(", ")}`);
}

console.log(JSON.stringify({
  project,
  expectedAssets: assets.length,
  expectedFileCount,
  missing: missing.length,
  largest,
  cloudflareFreeFileLimit: maxProjectFiles,
  cloudflareSingleFileLimitBytes: maxFileBytes,
}, null, 2));
