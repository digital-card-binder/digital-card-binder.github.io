import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SERIES_URL = new URL("../data/series.json", import.meta.url);
const EVIDENCE_URL = new URL("../data/audits/m4-korean-card-names-20261028.json", import.meta.url);
const DETAIL_ROOT = "https://pokemoncard.co.kr/cards/detail/BS2026003";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function officialCardUrl(number) {
  if (!Number.isInteger(number) || number < 1 || number > 120) throw new Error("Invalid M4 card number");
  return DETAIL_ROOT + String(number).padStart(3, "0");
}
export function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));
}
export function parseOfficialM4(html, number) {
  const expected = String(number).padStart(3, "0") + "/083";
  if (!html.includes("닌자스피너")) return null;
  const num = html.match(/<span[^>]*class=["']p_num["'][^>]*>\s*(\d{3}\/\d{3})/i);
  if (!num || num[1] !== expected) return null;
  const match = html.match(/<span[^>]*class=["']card-hp\s+title["'][^>]*>([\s\S]*?)<\/span>/i);
  if (!match) return null;
  const title = decodeEntities(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  if (!title || title.length > 80 || !/[가-힣]/.test(title)) return null;
  return { number:expected, title };
}
function cardNumber(card) {
  const match = String(card?.code || "").match(/^m4_(\d{3})\/083$/i);
  return match ? Number(match[1]) : 0;
}
export function officialNameConsistent(title, pokemonName) {
  const canonical = String(pokemonName || "").replace(/\s+/g, "");
  const actual = String(title || "").replace(/\s+/g, "");
  // The already reviewed Korean Pokemon name must occur in the official title.
  // Handles "독침붕 ex" and "메가개굴닌자 ex" without guessing suffixes.
  return canonical.length > 0 && actual.includes(canonical);
}
async function fetchOfficialPage(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent":"Mozilla/5.0 (compatible; DigitalCardBinder-KoreanCardAudit/1.0)", "Accept":"text/html" },
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.text();
    } catch (error) {
      if (attempt === 1) throw error;
      await wait(1500);
    }
  }
}
export async function applyVerifiedM4Names({ request = fetchOfficialPage, delayMs = 350 } = {}) {
  const before = await readFile(SERIES_URL, "utf8");
  const groups = JSON.parse(before);
  const m4 = groups.filter((g) => String(g.code).toLowerCase() === "m4");
  if (m4.length !== 1 || !Array.isArray(m4[0].cards) || m4[0].cards.length !== 120)
    throw new Error("M4 source no longer has exactly 120 cards");
  const list = m4[0].cards;
  const keys = list.map((card) => cardNumber(card));
  if (keys.some((n) => n < 1 || n > 120) || new Set(keys).size !== 120)
    throw new Error("M4 card identities are invalid or duplicated");
  const missing = list.filter((card) => !String(card.name || "").trim());
  if (missing.length !== 96) throw new Error("Expected 96 unnamed M4 cards, found " + missing.length);
  const verified = [], held = [];
  for (const card of missing) {
    const n = cardNumber(card);
    const url = officialCardUrl(n);
    try {
      const html = await request(url);
      const official = parseOfficialM4(html, n);
      if (!official) {
        held.push({ number: n, code:card.code, reason:"Official page card number, set or title not verified", url });
      } else if (!officialNameConsistent(official.title, card.pokemonName)) {
        held.push({ number:n,code:card.code, reason:"Official title does not contain existing Korean Pokemon name", title:official.title, priorPokemonName:card.pokemonName, url });
      } else {
        card.name = official.title;
        verified.push({ number:n, code:card.code, name:card.name, pokemonName:card.pokemonName, source:url });
      }
    } catch (error) {
      held.push({ number:n, code:card.code, reason:String(error?.message || error).slice(0,160), url });
    }
    if (delayMs) await wait(delayMs);
  }
  const remaining = list.filter((card) => !String(card.name || "").trim()).length;
  if (remaining !== held.length || verified.length + held.length !== 96)
    throw new Error("M4 review counts do not reconcile");
  const evidence = {
    schemaVersion:1, set:"m4", product:"닌자스피너", verifiedAt:new Date().toISOString(),
    sourceProductUrl:"https://pokemoncard.co.kr/card/887",
    officialCardIdPattern:"BS2026003NNN",
    beforeMissing:96, verifiedCount:verified.length, heldCount:held.length,
    afterMissing:remaining, verified, held,
    policy:"Only exact numbered Pokemon Korea M4 detail pages with expected set and existing Korean Pokemon-name consistency were copied; others held"
  };
  // Write audit evidence even if some pages fail. Never mark unverified names done.
  await writeFile(EVIDENCE_URL, JSON.stringify(evidence,null,2)+"\n");
  if (verified.length) await writeFile(SERIES_URL,JSON.stringify(groups,null,2)+"\n");
  console.log("M4_OFFICIAL_NAME_RECONCILIATION "+JSON.stringify({
    before:96,verified:verified.length,held:held.length,after:remaining,
    heldCodes:held.map(x=>x.code)
  }));
  return evidence;
}
if(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  await applyVerifiedM4Names();
}
