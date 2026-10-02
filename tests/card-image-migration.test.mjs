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
    WeakMap,
    WeakSet,
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
    assert.equal(manifest.counts.external, 5498);

    // The catalog's non-existent M1L 093 entry must not create an image destination.
    assert.equal(manifest.counts.total, 21295);
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
    // M6a base set 001-103 must always resolve to the Korean official image archive.
    for (let number = 1; number <= 103; number += 1) {
      const token = String(number).padStart(3, "0");
      const asset = manifest.assets.find(
        (entry) => entry.relativePath === `data/wmimages/MEGA/M6a/M6a_${token}.webp`,
      );
      assert.ok(asset, `M6a_${token} is missing`);
      assert.equal(asset.project, "modern");
      assert.ok(
        asset.sourceUrls.includes(
          `https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6a/M6a_${token}.png`,
        ),
        `M6a_${token} is not using the Korean official source`,
      );
    }

    const megaPromoEnergyAssets = {
      "M-P_GRA": "https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M-P/M-P_GRA.png",
      "M-P_FIR": "https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M-P/M-P_FIR.png",
      "M-P_WAT": "https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M-P/M-P_WAT.png",
    };
    for (const [token, sourceUrl] of Object.entries(megaPromoEnergyAssets)) {
      const asset = manifest.assets.find(
        (entry) => entry.relativePath === `data/wmimages/MEGA/M-P/${token}.webp`,
      );
      assert.ok(asset, `${token} is missing from the archive manifest`);
      assert.equal(asset.project, "modern");
      assert.ok(asset.sourceUrls.includes(sourceUrl), `${token} lost its official source URL`);
    }
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("browser routing is enabled after cutover and routes supported images to Pages", () => {
  const official =
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/SV/SV1V/SV1V_001.png?w=400";
  const expected =
    "https://dcb-card-images-modern-2026.pages.dev/data/wmimages/SV/SV1V/SV1V_001.webp";

  const active = loadBrowserRouter();
  assert.equal(active.window.DigitalCardBinderImageCdn.enabled, true);
  assert.equal(active.window.DigitalCardBinderImageCdn.destinationFor(official), expected);
  assert.equal(active.window.DigitalCardBinderImageCdn.resolve(official), expected);

  const propertyImage = new active.HTMLImageElement();
  propertyImage.src = official;
  assert.equal(propertyImage.src, expected);

  const attributeImage = new active.HTMLImageElement();
  attributeImage.setAttribute("src", official);
  assert.equal(attributeImage.attributes.get("src"), expected);

  const preview = loadBrowserRouter("?card-image-cdn-preview=1");
  assert.equal(preview.window.DigitalCardBinderImageCdn.enabled, true);
  assert.equal(preview.window.DigitalCardBinderImageCdn.resolve(official), expected);

  const ownedOverride =
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/SM/SM9B/SM9b_009.png?w=512";
  const ownedOverrideCdn =
    "https://dcb-card-images-legacy-2026.pages.dev/data/wmimages/SM/SM9B/SM9b_009.webp";
  const fallbackImage = new active.HTMLImageElement();
  fallbackImage.src = ownedOverride;
  assert.equal(fallbackImage.src, ownedOverrideCdn);
  assert.equal(active.window.DigitalCardBinderImageCdn.restoreOriginal(fallbackImage), true);
  assert.equal(fallbackImage.src, ownedOverride);
  assert.equal(active.window.DigitalCardBinderImageCdn.restoreOriginal(fallbackImage), false);

  const unsupported = "https://example.com/card.png";
  propertyImage.src = unsupported;
  assert.equal(propertyImage.src, unsupported);
});

test("card pages load the image router before application scripts", () => {
  const cardPages = [
    "ar.html",
    "artists.html",
    "custom.html",
    "fossil.html",
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
    assert.match(
      source,
      /card-image-cdn[.]js[?]v=[0-9a-f]{12}/,
      `${filename} must load the current card image router version`,
    );
    assert.ok(routerIndex < applicationIndex, `${filename} loads the card image router too late`);
  }

  const routerSource = fs.readFileSync(browserRouterPath, "utf8");
  assert.match(routerSource, /active:\s*true/);
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

test("broken representative paths resolve to the same catalog cards and preserve a valid fallback", () => {
  const { window, HTMLImageElement } = loadBrowserRouter();
  const router = window.DigitalCardBinderImageCdn;
  const series = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "data/series-legacy.json"), "utf8"));
  const cases = [
    ["XY/XY5/XY5_003.jpg", "xy5-bg_003/070"],
    ["XY/XY5/XY5_017.jpg", "xy5-bg_017/070"],
    ["XY/XY5/XY5_012.jpg", "xy5-bt_012/070"],
    ["XY/PROMO/XYpromo_190.jpg", "xyp_190"],
    ["XY/PROMO/XYpromo_189.jpg", "xyp_189"],
    ["BW/PROMO/BWpromo_015.jpg", "bwp_015/BW"],
    ["XY/CP3/CP3_018.jpg", "cp3_018/032"],
  ];
  for (const [imagePath, code] of cases) {
    const original = `https://cards.image.pokemonkorea.co.kr/data/wmimages/${imagePath}?w=512`;
    const card = series.flatMap(group => group.cards).find(card => card.code === code);
    assert.ok(card, code);
    assert.equal(router.repairSource(original), card.image);
    assert.equal(router.resolve(original), router.resolve(card.image));
    const image = new HTMLImageElement(); image.src = original;
    assert.equal(image.src, router.resolve(card.image));
    assert.equal(router.restoreOriginal(image), true);
    assert.equal(image.src, card.image);
  }
});


test("MEGA promo energy sources route to stable modern archive paths", () => {
  const { window } = loadBrowserRouter();
  for (const token of ["GRA", "FIR", "WAT"]) {
    const source =
      `https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M-P/M-P_${token}.png`;
    const route = routeCardImage(source);
    assert.equal(route?.project, "modern");
    assert.equal(route?.relativePath, `data/wmimages/MEGA/M-P/M-P_${token}.webp`);
    assert.equal(
      window.DigitalCardBinderImageCdn.destinationFor(source),
      `https://dcb-card-images-modern-2026.pages.dev/data/wmimages/MEGA/M-P/M-P_${token}.webp`,
    );
  }
});

test("card image deployment follows catalog changes and verifies MEGA promo energies", () => {
  const workflow = fs.readFileSync(
    path.join(repositoryRoot, ".github/workflows/deploy-card-images.yml"),
    "utf8",
  );
  assert.match(workflow, /- 'data\/\*\.json'/);
  for (const token of ["GRA", "FIR", "WAT"]) {
    assert.ok(
      workflow.includes(`data/wmimages/MEGA/M-P/M-P_${token}.webp`),
      `post-deploy verification is missing M-P_${token}`,
    );
  }
});
