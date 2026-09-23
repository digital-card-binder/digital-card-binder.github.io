import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import {
  canonicalizeImageUrl,
  routeCardImage,
} from "../scripts/card-image-routing.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const browserRouterPath = path.join(repositoryRoot, "card-image-cdn.js");

function loadBrowserRouter(search = "") {
  class Element {
    constructor() {
      this.attributes = new Map();
    }

    setAttribute(name, value) {
      this.attributes.set(String(name), String(value));
    }
  }

  class HTMLImageElement extends Element {
    constructor() {
      super();
      this.source = "";
    }
  }

  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get() {
      return this.source;
    },
    set(value) {
      this.source = String(value);
    },
  });

  const window = { location: { search } };
  vm.runInNewContext(fs.readFileSync(browserRouterPath, "utf8"), {
    window,
    URL,
    URLSearchParams,
    Set,
    Object,
    String,
    BigInt,
    Element,
    HTMLImageElement,
  });
  return { window, HTMLImageElement };
}

test("official card images are split into deterministic Pages paths", () => {
  assert.deepEqual(
    routeCardImage(
      "https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV1V/SV1V_001.png?w=400",
    ),
    {
      canonicalUrl:
        "https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV1V/SV1V_001.png",
      host: "cards.image.pokemonkorea.co.kr",
      official: true,
      project: "modern",
      relativePath: "data/wmimages/SV/SV1V/SV1V_001.webp",
      root: "SV",
    },
  );

  const legacy = routeCardImage(
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM1S/SM1S_001.jpg",
  );
  assert.equal(legacy.project, "legacy");
  assert.equal(legacy.relativePath, "data/wmimages/SM/SM1S/SM1S_001.webp");
});

test("external image routes are stable and discard cache-only query strings", () => {
  const first = routeCardImage("https://cdn.collectory.cc/cards/kr/M-P/040_M-P.webp?v=t");
  const second = routeCardImage("https://cdn.collectory.cc/cards/kr/M-P/040_M-P.webp?v=other");
  assert.equal(first.project, "legacy");
  assert.equal(first.relativePath, second.relativePath);
  assert.match(first.relativePath, /^external\/cdn\.collectory\.cc\/[0-9a-f]{16}\.webp$/);
  assert.equal(canonicalizeImageUrl("https://example.com/card.png"), "");
});

test("migration manifest covers runtime M6 images and stays inside Free limits", () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dcb-card-images-"));
  const outputPath = path.join(temporaryDirectory, "manifest.json");
  try {
    execFileSync(
      process.execPath,
      [path.join(repositoryRoot, "scripts", "build-card-image-manifest.mjs"), `--output=${outputPath}`],
      { cwd: repositoryRoot, stdio: "pipe" },
    );
    const manifest = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(manifest.counts.modern + manifest.counts.legacy, manifest.counts.total);
    assert.equal(manifest.counts.official + manifest.counts.external, manifest.counts.total);
    assert.ok(manifest.counts.total > 16_000);
    assert.ok(manifest.counts.modern + 3 < 20_000);
    assert.ok(manifest.counts.legacy + 3 < 20_000);
    assert.equal(manifest.counts.external, 969);

    // The catalog's non-existent M1L 093 entry must not create an image destination.
    assert.equal(manifest.counts.total, 16661);
    assert.ok(!manifest.assets.some((asset) => asset.relativePath === "data/wmimages/MEGA/M1L/M1L_093.webp"));
    const repaired = manifest.assets.find((asset) => asset.relativePath === "data/wmimages/MEGA/M2/M2_116.webp");
    assert.equal(repaired.project, "modern");
    assert.match(repaired.sourceUrls[0], /^https:\/\/static[.]tcgexchange[.]kr\//);
    assert.ok(repaired.originalSourceUrls.includes("https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M2/M2_116.png"));
    const aliased = manifest.assets.find((asset) => asset.relativePath === "data/wmimages/SM/SM7b/SM7b_012.webp");
    assert.deepEqual(aliased.reuse, { project: "legacy", relativePath: "data/wmimages/SM/SM7B/SM7B_012.webp" });

    const paths = manifest.assets.map((asset) => `${asset.project}:${asset.relativePath}`);
    assert.equal(new Set(paths).size, paths.length);
    for (const token of ["001", "103", "113"]) {
      assert.ok(
        manifest.assets.some(
          (asset) => asset.relativePath === `data/wmimages/MEGA/M6/M6_${token}.webp`,
        ),
        `M6_${token} is missing`,
      );
    }
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("browser routing remains disabled until cutover and supports isolated preview", () => {
  const official =
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV1V/SV1V_001.png?w=400";

  const inactive = loadBrowserRouter();
  assert.equal(inactive.window.DigitalCardBinderImageCdn.enabled, false);
  assert.equal(inactive.window.DigitalCardBinderImageCdn.resolve(official), official);
  const inactiveImage = new inactive.HTMLImageElement();
  inactiveImage.src = official;
  assert.equal(inactiveImage.src, official);

  const preview = loadBrowserRouter("?card-image-cdn-preview=1");
  assert.equal(preview.window.DigitalCardBinderImageCdn.enabled, true);
  const expected =
    "https://dcb-card-images-modern-2026.pages.dev/data/wmimages/SV/SV1V/SV1V_001.webp";
  assert.equal(preview.window.DigitalCardBinderImageCdn.destinationFor(official), expected);

  const propertyImage = new preview.HTMLImageElement();
  propertyImage.src = official;
  assert.equal(propertyImage.src, expected);

  const attributeImage = new preview.HTMLImageElement();
  attributeImage.setAttribute("src", official);
  assert.equal(attributeImage.attributes.get("src"), expected);

  const unsupported = "https://example.com/card.png";
  propertyImage.src = unsupported;
  assert.equal(propertyImage.src, unsupported);
});

test("card pages load the inactive router before application scripts", () => {
  const cardPages = [
    "ar.html",
    "artists.html",
    "custom.html",
    "fossil.html",
    "index.html",
    "national.html",
    "packs.html",
    "people.html",
    "pokemon-collections.html",
    "pokemon-search.html",
    "series.html",
    "trades.html",
    "trainer-pokemon.html",
    "world.html",
  ];

  for (const filename of cardPages) {
    const source = fs.readFileSync(path.join(repositoryRoot, filename), "utf8");
    const routerIndex = source.indexOf("card-image-cdn.js");
    const applicationIndex = source.indexOf("firebase-config.js");
    assert.ok(routerIndex >= 0, `${filename} does not load the card image router`);
    assert.ok(routerIndex < applicationIndex, `${filename} loads the card image router too late`);
  }

  const routerSource = fs.readFileSync(browserRouterPath, "utf8");
  assert.match(routerSource, /active:\s*false/);
});

test("public pages expose no clickable Pokemon Korea links", () => {
  const htmlFiles = fs.readdirSync(repositoryRoot).filter((filename) => filename.endsWith(".html"));
  for (const filename of htmlFiles) {
    const source = fs.readFileSync(path.join(repositoryRoot, filename), "utf8");
    assert.doesNotMatch(
      source,
      /href\s*=\s*["']https?:\/\/(?:www\.)?pokemoncard[.]co[.]kr/i,
      filename,
    );
  }
});
