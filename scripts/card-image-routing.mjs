const OFFICIAL_IMAGE_HOST = "cards.image.pokemonkorea.co.kr";

export const SUPPORTED_IMAGE_HOSTS = Object.freeze([
  OFFICIAL_IMAGE_HOST,
  "static.tcgexchange.kr",
  "tcgbox.co.kr",
  "cdn.collectory.cc",
  "k-tcgpanda.com",
  "cdn6966.templcdn.com",
]);

// Exact Korean card scans, independently checked against physical printed S6H/S6K numbers.
// Both manifest routing and the browser CDN resolver apply the same canonical map.
const KOREAN_VERIFIED_SOURCE_REPLACEMENTS = Object.freeze({
  "https://static.tcgexchange.kr/5eaa1424f187cc9a46736eb754be15f7.jpg": "https://static.tcgexchange.kr/485df004469b074234f8e41677d557ca.png",
  "https://static.tcgexchange.kr/fa7d8a61781dad5ee9c72cd1d8d71a4c.jpg": "https://static.tcgexchange.kr/4416d99c2b1fe8ac33540bd8dbb1ea50.png",
  "https://static.tcgexchange.kr/af37a3a90f242cf68df376be40f0c4b0.jpg": "https://static.tcgexchange.kr/863b283e5fefadd097461c0eebcfdea2.png",
  "https://static.tcgexchange.kr/ac528a39bb48ddc09898b70aa890f065.jpg": "https://static.tcgexchange.kr/8be3bf72a02a8c2258c381d1bf92376e.png",
  "https://static.tcgexchange.kr/93e25afd7bbcf36cc42e1d018ea9f85a.jpg": "https://static.tcgexchange.kr/72a2fac0dc8fd84d622b8ab58150bb15.png",
  "https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/28a6c6a2874e2319.webp": "https://static.tcgexchange.kr/77e9f3ab6a3bf7f1b8db71312ee2469f.png",
  "https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/a74fac37d56d155c.webp": "https://static.tcgexchange.kr/025fa0280c558bb135fa6fd031053dc0.png",
  "https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/e6a8de7da34479cc.webp": "https://static.tcgexchange.kr/d287bba0edf2ba741f0a2cfa0dbfc33e.png",
});

const supportedHosts = new Set(SUPPORTED_IMAGE_HOSTS);
const modernRoots = new Set(["MEGA", "S", "SV"]);
const imageExtension = /\.(?:avif|gif|jpe?g|png|webp)$/i;

export function canonicalizeImageUrl(value) {
  let parsed;
  try {
    const raw = String(value || "").trim();
    parsed = new URL(KOREAN_VERIFIED_SOURCE_REPLACEMENTS[raw] || raw);
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
