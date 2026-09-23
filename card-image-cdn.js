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

  function canonicalize(value) {
    let parsed;
    try {
      parsed = new URL(String(value || "").trim());
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
    if (!enabled) return String(value || "");
    return destinationFor(value) || String(value || "");
  }

  const sourceDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  const nativeSetAttribute = Element.prototype.setAttribute;
  const originalSources = new WeakMap();
  const fallbackAttempts = new WeakSet();

  function sourceFor(image, value) {
    const original = String(value || "");
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
    if (sourceDescriptor?.set) {
      sourceDescriptor.set.call(image, original);
    } else {
      nativeSetAttribute.call(image, "src", original);
    }
    return true;
  }

  window.DigitalCardBinderImageCdn = Object.freeze({
    version: "2026-09-23.2",
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
