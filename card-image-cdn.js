"use strict";

(function () {
  if (window.DigitalCardBinderImageCdn?.version) return;

  const CONFIG = Object.freeze({
    // Cloudflare Pages archives were fully uploaded and verified before cutover.
    active: true,
    modernBase: "https://dcb-card-images-modern-2026.pages.dev",
    legacyBase: "https://dcb-card-images-legacy-2026.pages.dev",
    previewParameter: "card-image-cdn-preview",
  });
  const OFFICIAL_HOST = "cards.image.pokemonkorea.co.kr";
  const SUPPORTED_HOSTS = new Set([
    OFFICIAL_HOST,
    "static.tcgexchange.kr",
    "tcgbox.co.kr",
    "cdn.collectory.cc",
    "k-tcgpanda.com",
    "cdn6966.templcdn.com",
  ]);
  const MODERN_ROOTS = new Set(["MEGA", "S", "SV"]);
  const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)$/i;
  const FALLBACK_IMAGE = "/assets/card-image-unavailable.svg";

  // Same set/card numbers already present in the existing series catalog.
  const SOURCE_IMAGE_REPAIRS = Object.freeze({
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XY5/XY5_003.jpg": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XY5/XY5_GV_003.jpg",
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XY5/XY5_017.jpg": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XY5/XY5_GV_017.jpg",
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XY5/XY5_012.jpg": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/XY5/XY5_TS_012.jpg",
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/PROMO/XYpromo_190.jpg": "https://static.tcgexchange.kr/756dee0af5bdc4ce6b2a5442fb8728c7.png",
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/PROMO/XYpromo_189.jpg": "https://static.tcgexchange.kr/7297e828bbb5000fbf9e1b754366d1fa.png",
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/BW/PROMO/BWpromo_015.jpg": "https://cards.image.pokemonkorea.co.kr/data/wmimages/BW/BW1/bw1_tooni_promo_015.jpg",
    "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP3/CP3_018.jpg": "https://cards.image.pokemonkorea.co.kr/data/wmimages/XY/CP3/CP3_018.png"
});

  function repairSource(value) {
    const original = String(value || "").trim();
    try {
      const parsed = new URL(original);
      return SOURCE_IMAGE_REPAIRS[`${parsed.protocol}//${parsed.host}${parsed.pathname}`] || original;
    } catch { return original; }
  }

  function canonicalize(value) {
    let parsed;
    try {
      parsed = new URL(repairSource(value));
    } catch {
      return null;
    }
    if (!/^https?:$/.test(parsed.protocol) || !SUPPORTED_HOSTS.has(parsed.hostname)) return null;
    if (!IMAGE_EXTENSION.test(parsed.pathname)) return null;
    return {
      parsed,
      canonicalUrl: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
    };
  }

  function fnv1a64(value) {
    let hash = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= BigInt(value.charCodeAt(index));
      hash = BigInt.asUintN(64, hash * prime);
    }
    return hash.toString(16).padStart(16, "0");
  }

  function route(value) {
    const normalized = canonicalize(value);
    if (!normalized) return null;
    const { parsed, canonicalUrl } = normalized;

    if (parsed.hostname === OFFICIAL_HOST) {
      const match = parsed.pathname.match(
        /^\/data\/wmimages\/([^/]+)\/(.+)\.(?:avif|gif|jpe?g|png|webp)$/i,
      );
      if (!match) return null;
      const root = match[1].toUpperCase();
      return {
        project: MODERN_ROOTS.has(root) ? "modern" : "legacy",
        relativePath: parsed.pathname.replace(/^\/+/, "").replace(IMAGE_EXTENSION, ".webp"),
      };
    }

    return {
      project: "legacy",
      relativePath: `external/${parsed.hostname}/${fnv1a64(canonicalUrl)}.webp`,
    };
  }

  function destinationFor(value) {
    const target = route(value);
    if (!target) return "";
    const base = String(CONFIG[`${target.project}Base`] || "").replace(/\/+$/, "");
    return base ? `${base}/${target.relativePath}` : FALLBACK_IMAGE;
  }

  const previewEnabled = new URLSearchParams(window.location.search).get(
    CONFIG.previewParameter,
  ) === "1";
  const enabled = CONFIG.active || previewEnabled;

  function resolve(value) {
    const source = repairSource(value);
    if (!enabled) return source;
    return destinationFor(source) || source;
  }

  const sourceDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  const nativeSetAttribute = Element.prototype.setAttribute;
  const originalSources = new WeakMap();
  const fallbackAttempts = new WeakSet();

  function sourceFor(image, value) {
    const original = repairSource(value);
    const destination = resolve(original);
    if (enabled && destination && destination !== original) {
      originalSources.set(image, original);
      fallbackAttempts.delete(image);
      return destination;
    }
    originalSources.delete(image);
    fallbackAttempts.delete(image);
    return original;
  }

  function restoreOriginal(image) {
    if (!(image instanceof HTMLImageElement)) return false;
    const original = originalSources.get(image);
    if (!original || fallbackAttempts.has(image)) return false;
    fallbackAttempts.add(image);

    // Never fall back to the third-party source at runtime.
    // If our self-hosted archive misses an image, keep all traffic on our site.
    if (sourceDescriptor?.set) {
      sourceDescriptor.set.call(image, FALLBACK_IMAGE);
    } else {
      nativeSetAttribute.call(image, "src", FALLBACK_IMAGE);
    }
    originalSources.delete(image);
    return true;
  }

  window.DigitalCardBinderImageCdn = Object.freeze({
    version: "2026-10-06.1",
    repairSource,
    enabled,
    resolve,
    destinationFor,
    restoreOriginal,
  });

  if (!enabled) return;

  if (sourceDescriptor?.get && sourceDescriptor?.set && sourceDescriptor.configurable) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...sourceDescriptor,
      set(value) {
        sourceDescriptor.set.call(this, sourceFor(this, value));
      },
    });
  }

  HTMLImageElement.prototype.setAttribute = function imageCdnSetAttribute(name, value) {
    const nextValue =
      String(name).toLowerCase() === "src"
        ? sourceFor(this, value)
        : value;
    return nativeSetAttribute.call(this, name, nextValue);
  };

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener(
      "error",
      (event) => {
        if (!(event.target instanceof HTMLImageElement)) return;
        if (!restoreOriginal(event.target)) return;
        event.stopImmediatePropagation?.();
        event.stopPropagation?.();
      },
      true,
    );
  }
})();
