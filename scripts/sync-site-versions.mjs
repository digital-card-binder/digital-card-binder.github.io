import { createHash } from "node:crypto";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const manifestPath = path.join(root, "site-version.json");
const navPath = path.join(root, "collector-nav.js");
const LOCAL_ASSET_RE = /((?:src|href)=["']\.\/)([^"'?#]+\.(?:js|css))(?:\?v=[^"']*)?(["'])/g;
const RUNTIME_REF_RE = /(["'`])((?:\.\/|\/)[^"'`?#]+\.(?:js|css|json|webp|svg|webmanifest))\?v=([A-Za-z0-9._-]+)\1/g;
const NAV_BUILD_RE = /const SITE_BUILD_VERSION = "[^"]*";/;

function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

function gitBlobVersion(value) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
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

function normalizeRuntimeRefs(source) {
  return source.replace(
    RUNTIME_REF_RE,
    (_match, quote, target) => `${quote}${target}?v=__AUTO__${quote}`,
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

function targetPathFromUrl(url) {
  return url.startsWith("./") ? url.slice(2) : url.slice(1);
}

async function readable(relativePath) {
  await access(path.join(root, relativePath), constants.R_OK);
}

async function main() {
  const rootFiles = await readdir(root);
  const htmlFiles = rootFiles.filter((name) => name.endsWith(".html")).sort();
  const rootJsFiles = rootFiles.filter((name) => name.endsWith(".js")).sort();

  const htmlSources = new Map();
  const htmlAssets = new Set();
  for (const page of htmlFiles) {
    const source = await readFile(path.join(root, page), "utf8");
    htmlSources.set(page, source);
    for (const match of source.matchAll(LOCAL_ASSET_RE)) htmlAssets.add(match[2]);
  }

  const rawJs = new Map();
  for (const file of rootJsFiles) {
    rawJs.set(file, await readFile(path.join(root, file), "utf8"));
  }

  const runtimeTargets = new Set();
  for (const source of rawJs.values()) {
    for (const match of source.matchAll(RUNTIME_REF_RE)) {
      runtimeTargets.add(targetPathFromUrl(match[2]));
    }
  }

  const binaryTargetCache = new Map();
  async function targetVersion(target, jsState) {
    if (jsState.has(target)) return gitBlobVersion(jsState.get(target));
    if (!binaryTargetCache.has(target)) {
      await readable(target);
      binaryTargetCache.set(target, await readFile(path.join(root, target)));
    }
    return gitBlobVersion(binaryTargetCache.get(target));
  }

  let expectedJs = new Map(rawJs);
  let converged = false;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const next = new Map();
    let changed = false;

    for (const [file, rawSource] of rawJs) {
      const rewritten = await replaceRuntimeRefs(rawSource, async (target) =>
        targetVersion(target, expectedJs),
      );
      next.set(file, rewritten);
      if (rewritten !== expectedJs.get(file)) changed = true;
    }

    expectedJs = next;
    if (!changed) {
      converged = true;
      break;
    }
  }
  if (!converged) {
    throw new Error("Runtime asset version dependencies did not converge.");
  }

  const normalizedNav = normalizeNav(normalizeRuntimeRefs(expectedJs.get("collector-nav.js")));

  const buildBasisAssets = {};
  for (const asset of [...htmlAssets].sort()) {
    await readable(asset);
    if (expectedJs.has(asset)) {
      const source = asset === "collector-nav.js"
        ? normalizedNav
        : expectedJs.get(asset);
      buildBasisAssets[asset] = gitBlobVersion(source);
    } else {
      buildBasisAssets[asset] = gitBlobVersion(await readFile(path.join(root, asset)));
    }
  }

  const runtimeVersions = {};
  for (const target of [...runtimeTargets].sort()) {
    runtimeVersions[target] = await targetVersion(target, expectedJs);
  }

  const pages = {};
  for (const [page, source] of htmlSources) {
    pages[page] = hashText(normalizePage(source));
  }

  const runtimeParents = {};
  for (const [file, source] of expectedJs) {
    if (RUNTIME_REF_RE.test(rawJs.get(file))) {
      RUNTIME_REF_RE.lastIndex = 0;
      runtimeParents[file] = hashText(normalizeRuntimeRefs(source));
    } else {
      RUNTIME_REF_RE.lastIndex = 0;
    }
  }

  const buildPayload = JSON.stringify({
    assets: Object.entries(buildBasisAssets).sort(([a], [b]) => a.localeCompare(b)),
    runtimeTargets: Object.entries(runtimeVersions).sort(([a], [b]) => a.localeCompare(b)),
    runtimeParents: Object.entries(runtimeParents).sort(([a], [b]) => a.localeCompare(b)),
    pages: Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)),
  });
  const buildVersion = `b-${hashText(buildPayload)}`;

  const navWithRuntimeVersions = expectedJs.get("collector-nav.js");
  const expectedNav = navWithRuntimeVersions.replace(
    NAV_BUILD_RE,
    `const SITE_BUILD_VERSION = "${buildVersion}";`,
  );
  expectedJs.set("collector-nav.js", expectedNav);

  const versions = { ...runtimeVersions };
  for (const asset of [...htmlAssets].sort()) {
    if (expectedJs.has(asset)) {
      versions[asset] = gitBlobVersion(expectedJs.get(asset));
    } else {
      versions[asset] = gitBlobVersion(await readFile(path.join(root, asset)));
    }
  }

  const expectedPages = new Map();
  for (const [page, source] of htmlSources) {
    expectedPages.set(page, rewritePage(source, versions));
  }

  const manifest = {
    version: buildVersion,
    algorithm: "git-blob-sha1-12",
    assets: Object.fromEntries(Object.entries(versions).sort(([a], [b]) => a.localeCompare(b))),
    pages,
  };
  const expectedManifest = `${JSON.stringify(manifest, null, 2)}\n`;

  const stale = [];
  for (const [file, expected] of expectedJs) {
    if (rawJs.get(file) !== expected) stale.push(file);
  }
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

  for (const [file, expected] of expectedJs) {
    if (rawJs.get(file) !== expected) await writeFile(path.join(root, file), expected);
  }
  for (const [page, expected] of expectedPages) {
    if (htmlSources.get(page) !== expected) await writeFile(path.join(root, page), expected);
  }
  await writeFile(manifestPath, expectedManifest);
  console.log(`Synchronized ${stale.length} files for build ${buildVersion}.`);
}

async function replaceRuntimeRefs(source, resolveVersion) {
  const matches = [...source.matchAll(RUNTIME_REF_RE)];
  if (!matches.length) return source;

  let output = "";
  let cursor = 0;
  for (const match of matches) {
    const [full, quote, url] = match;
    const start = match.index;
    const target = targetPathFromUrl(url);
    const version = await resolveVersion(target);
    output += source.slice(cursor, start);
    output += `${quote}${url}?v=${version}${quote}`;
    cursor = start + full.length;
  }
  output += source.slice(cursor);
  return output;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
