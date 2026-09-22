const OFFICIAL_IMAGE_HOST = "cards.image.pokemonkorea.co.kr";

export const SUPPORTED_IMAGE_HOSTS = Object.freeze([
  OFFICIAL_IMAGE_HOST,
  "static.tcgexchange.kr",
  "tcgbox.co.kr",
  "cdn.collectory.cc",
  "k-tcgpanda.com",
  "cdn6966.templcdn.com",
]);

const supportedHosts = new Set(SUPPORTED_IMAGE_HOSTS);
const modernRoots = new Set(["MEGA", "S", "SV"]);
const imageExtension = /\.(?:avif|gif|jpe?g|png|webp)$/i;

export function canonicalizeImageUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    return "";
  }

  if (!/^https?:$/.test(parsed.protocol) || !supportedHosts.has(parsed.hostname)) return "";
  if (!imageExtension.test(parsed.pathname)) return "";
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

export function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

export function routeCardImage(value) {
  const canonicalUrl = canonicalizeImageUrl(value);
  if (!canonicalUrl) return null;

  const parsed = new URL(canonicalUrl);
  if (parsed.hostname === OFFICIAL_IMAGE_HOST) {
    const match = parsed.pathname.match(
      /^\/data\/wmimages\/([^/]+)\/(.+)\.(?:avif|gif|jpe?g|png|webp)$/i,
    );
    if (!match) return null;

    const root = match[1].toUpperCase();
    const relativePath = parsed.pathname
      .replace(/^\/+/, "")
      .replace(imageExtension, ".webp");
    return {
      canonicalUrl,
      host: parsed.hostname,
      official: true,
      project: modernRoots.has(root) ? "modern" : "legacy",
      relativePath,
      root,
    };
  }

  return {
    canonicalUrl,
    host: parsed.hostname,
    official: false,
    project: "legacy",
    relativePath: `external/${parsed.hostname}/${fnv1a64(canonicalUrl)}.webp`,
    root: "EXTERNAL",
  };
}

export function cardImagePublicUrl(value, bases) {
  const route = routeCardImage(value);
  if (!route) return String(value || "");
  const base = String(bases?.[route.project] || "").replace(/\/+$/, "");
  return base ? `${base}/${route.relativePath}` : "";
}
