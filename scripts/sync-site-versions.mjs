import { createHash } from "node:crypto";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const manifestPath = path.join(root, "site-version.json");
const navPath = path.join(root, "collector-nav.js");
const pwaPath = path.join(root, "pwa.js");
const swPath = path.join(root, "sw.js");
const webManifestPath = path.join(root, "manifest.webmanifest");
const LOCAL_ASSET_RE = /((?:src|href)=["']\.\/)([^"'?#]+\.(?:js|css|webmanifest))(?:\?v=[^"']*)?(["'])/g;
const NAV_BUILD_RE = /const SITE_BUILD_VERSION = "[^"]*";/;
const SW_URL_RE = /const SERVICE_WORKER_URL = "\/sw[.]js(?:\?v=[^"]+)?";/;
const MANIFEST_URL_RE = /const MANIFEST_URL = "\/manifest[.]webmanifest(?:\?v=[^"]+)?";/;
const MANIFEST_ICON_RE = /("src"\s*:\s*"\/)(assets\/brand\/[^"?]+\.(?:png|webp))(?:\?v=[^"]*)?(")/g;
const DYNAMIC_MODULES = {
  "custom-loader.js": { marker: "DYNAMIC_ASSET_VERSIONS", assets: ["custom-public.js", "custom-granular-sharing.js", "custom.js", "custom-mobile-actions.js", "custom-sync.js"] },
  "print.js": { marker: "PRINT_ASSET_VERSIONS", assets: ["packs-promo-helper.js"] },
};
const EXTRA_ASSETS = Object.freeze([...Object.values(DYNAMIC_MODULES).flatMap((item) => item.assets)]);

function hashText(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex").slice(0, 12);
}

function gitBlobVersion(content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content.replace(/\r\n/g, "\n"), "utf8");
  return createHash("sha1")
    .update(Buffer.from(`blob ${body.length}\0`, "utf8"))
    .update(body)
    .digest("hex")
    .slice(0, 12);
}

function normalizePage(html) {
  return html.replace(
    LOCAL_ASSET_RE,
    (_match, prefix, asset, quote) => `${prefix}${asset}?v=__AUTO__${quote}`,
  );
}

function normalizeNav(source) {
  if (!NAV_BUILD_RE.test(source)) {
    throw new Error("collector-nav.js: SITE_BUILD_VERSION marker missing");
  }
  return source.replace(
    NAV_BUILD_RE,
    'const SITE_BUILD_VERSION = "__AUTO_BUILD__";',
  );
}

function rewritePage(html, versions) {
  return html.replace(
    LOCAL_ASSET_RE,
    (_match, prefix, asset, quote) => {
      const version = versions[asset];
      if (!version) throw new Error(`Missing generated version for ${asset}`);
      return `${prefix}${asset}?v=${version}${quote}`;
    },
  );
}

async function readable(relativePath) {
  await access(path.join(root, relativePath), constants.R_OK);
}

async function rewriteWebManifest(source) {
  const versions = new Map();
  for (const match of source.matchAll(MANIFEST_ICON_RE)) {
    const asset = match[2];
    if (versions.has(asset)) continue;
    await readable(asset);
    versions.set(asset, gitBlobVersion(await readFile(path.join(root, asset))));
  }
  MANIFEST_ICON_RE.lastIndex = 0;
  return source.replace(
    MANIFEST_ICON_RE,
    (_match, prefix, asset, quote) =>
      `${prefix}${asset}?v=${versions.get(asset)}${quote}`,
  );
}

async function main() {
  const htmlFiles = (await readdir(root))
    .filter((name) => name.endsWith(".html"))
    .sort();

  const htmlSources = new Map();
  const assets = new Set();

  for (const page of htmlFiles) {
    const source = await readFile(path.join(root, page), "utf8");
    htmlSources.set(page, source);
    for (const match of source.matchAll(LOCAL_ASSET_RE)) assets.add(match[2]);
  }

  for (const asset of EXTRA_ASSETS) assets.add(asset);

  const dynamicSources = new Map();
  for (const [owner, config] of Object.entries(DYNAMIC_MODULES)) {
    const raw = await readFile(path.join(root, owner), "utf8");
    const tokens = {};
    for (const asset of config.assets) tokens[`./${asset}`] = gitBlobVersion(await readFile(path.join(root, asset)));
    const marker = new RegExp(`const ${config.marker} = \\{[^;]*\\};`);
    if (!marker.test(raw)) throw new Error(`Missing dynamic asset marker: ${owner}`);
    const expected = raw.replace(marker, `const ${config.marker} = ${JSON.stringify(tokens)};`);
    dynamicSources.set(owner, { raw, expected });
  }

  const swSource = await readFile(swPath, "utf8");
  const swVersion = gitBlobVersion(swSource);

  const rawWebManifest = await readFile(webManifestPath, "utf8");
  const expectedWebManifest = await rewriteWebManifest(rawWebManifest);
  const webManifestVersion = gitBlobVersion(expectedWebManifest);

  const rawPwa = await readFile(pwaPath, "utf8");
  if (!SW_URL_RE.test(rawPwa)) {
    throw new Error("pwa.js: SERVICE_WORKER_URL marker missing");
  }
  if (!MANIFEST_URL_RE.test(rawPwa)) {
    throw new Error("pwa.js: MANIFEST_URL marker missing");
  }
  const expectedPwa = rawPwa
    .replace(
      SW_URL_RE,
      `const SERVICE_WORKER_URL = "/sw.js?v=${swVersion}";`,
    )
    .replace(
      MANIFEST_URL_RE,
      `const MANIFEST_URL = "/manifest.webmanifest?v=${webManifestVersion}";`,
    );

  const rawNav = await readFile(navPath, "utf8");
  const normalizedNav = normalizeNav(rawNav);

  const buildBasisAssets = {};
  const assetSources = new Map();
  for (const asset of [...assets].sort()) {
    await readable(asset);
    let source = asset === "manifest.webmanifest"
      ? expectedWebManifest
      : await readFile(path.join(root, asset), "utf8");
    if (asset === "pwa.js") source = expectedPwa;
    if (dynamicSources.has(asset)) source = dynamicSources.get(asset).expected;
    assetSources.set(asset, source);
    buildBasisAssets[asset] = asset === "collector-nav.js"
      ? gitBlobVersion(normalizedNav)
      : gitBlobVersion(source);
  }
  buildBasisAssets["sw.js"] = swVersion;

  const pages = {};
  for (const [page, source] of htmlSources) {
    pages[page] = hashText(normalizePage(source));
  }

  const buildPayload = JSON.stringify({
    assets: Object.entries(buildBasisAssets).sort(([a], [b]) => a.localeCompare(b)),
    pages: Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)),
  });
  const buildVersion = `b-${hashText(buildPayload)}`;

  const expectedNav = rawNav.replace(
    NAV_BUILD_RE,
    `const SITE_BUILD_VERSION = "${buildVersion}";`,
  );
  assetSources.set("collector-nav.js", expectedNav);

  const versions = {};
  for (const asset of [...assets].sort()) {
    versions[asset] = gitBlobVersion(assetSources.get(asset));
  }
  versions["sw.js"] = swVersion;

  const expectedPages = new Map();
  for (const [page, source] of htmlSources) {
    expectedPages.set(page, rewritePage(source, versions));
  }

  const manifest = {
    version: buildVersion,
    algorithm: "git-blob-sha1-12",
    assets: versions,
    pages,
  };
  const expectedManifest = `${JSON.stringify(manifest, null, 2)}\n`;

  const stale = [];
  for (const [owner, { raw, expected }] of dynamicSources) if (raw !== expected) stale.push(owner);
  if (rawNav !== expectedNav) stale.push("collector-nav.js");
  if (rawPwa !== expectedPwa) stale.push("pwa.js");
  if (rawWebManifest !== expectedWebManifest) stale.push("manifest.webmanifest");

  for (const [page, expected] of expectedPages) {
    if (htmlSources.get(page) !== expected) stale.push(page);
  }

  let currentManifest = "";
  try {
    currentManifest = await readFile(manifestPath, "utf8");
  } catch {}
  if (currentManifest !== expectedManifest) stale.push("site-version.json");

  if (checkOnly) {
    if (stale.length) {
      console.error(`Site versions are out of sync: ${stale.join(", ")}`);
      console.error("Run: npm run versions:sync");
      process.exit(1);
    }
    console.log(`Site versions are synchronized (${buildVersion}).`);
    return;
  }

  if (!stale.length) {
    console.log(`Site versions already synchronized (${buildVersion}).`);
    return;
  }

  for (const [owner, { raw, expected }] of dynamicSources) if (raw !== expected) await writeFile(path.join(root, owner), expected);
  if (rawNav !== expectedNav) await writeFile(navPath, expectedNav);
  if (rawPwa !== expectedPwa) await writeFile(pwaPath, expectedPwa);
  if (rawWebManifest !== expectedWebManifest) {
    await writeFile(webManifestPath, expectedWebManifest);
  }
  for (const [page, expected] of expectedPages) {
    if (htmlSources.get(page) !== expected) {
      await writeFile(path.join(root, page), expected);
    }
  }
  await writeFile(manifestPath, expectedManifest);
  console.log(`Synchronized ${stale.length} files for build ${buildVersion}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
