import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clean = (value) => String(value ?? "").trim();
const normalizeSet = (value) =>
  clean(value).toLowerCase().replace(/[^a-z0-9+]+/g, "");

function printedNumber(value) {
  const text = clean(value);
  const match =
    text.match(/(?:^|_)0*(\d{1,4})(?=\/|\s|$)/i) ||
    text.match(/0*(\d{1,4})(?=\/|\s|$)/);
  return match ? String(Number(match[1])) : "";
}

function imageKey(value) {
  return clean(value)
    .split("?", 1)[0]
    .split("/")
    .at(-1)
    ?.toLowerCase()
    .replace(/\.(png|webp|jpe?g)$/i, "") || "";
}

function addIndex(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function candidateSignature(item) {
  return `${clean(item.artist)}|||${clean(item.rarity)}`;
}

function uniqueCandidate(candidates) {
  const bySignature = new Map();
  for (const candidate of candidates || []) {
    bySignature.set(candidateSignature(candidate), candidate);
  }
  if (bySignature.size !== 1) return null;
  return [...bySignature.values()][0];
}

function buildArtistIndexes(payload) {
  const groups = Array.isArray(payload) ? payload : payload?.artists || [];
  const byImage = new Map();
  const bySetNumber = new Map();
  let cardCount = 0;

  for (const group of groups) {
    const artist = clean(group?.name || group?.title);
    for (const card of group?.cards || []) {
      cardCount += 1;
      const item = {
        artist,
        rarity: clean(card?.rarity),
        set: normalizeSet(card?.set || card?.setCode || card?.seriesCode),
        number: printedNumber(card?.cardNumber || card?.number || card?.code),
        image: imageKey(card?.image),
      };
      addIndex(byImage, item.image, item);
      if (item.set && item.number) {
        addIndex(bySetNumber, `${item.set}::${item.number}`, item);
      }
    }
  }

  return { groups, cardCount, byImage, bySetNumber };
}

function enrichGroups(groups, indexes, sourceFile) {
  const summary = {
    sourceFile,
    groupCount: groups.length,
    cardCount: 0,
    matchedByImage: 0,
    matchedBySetNumber: 0,
    uniqueMatches: 0,
    conflictsSkipped: 0,
    illustratorFilled: 0,
    rarityFilled: 0,
    unchangedMatches: 0,
    eras: {},
  };

  for (const group of groups) {
    const era = clean(group?.era || "UNKNOWN").toUpperCase() || "UNKNOWN";
    const eraSummary =
      summary.eras[era] ||
      (summary.eras[era] = {
        groupCount: 0,
        cardCount: 0,
        uniqueMatches: 0,
        illustratorFilled: 0,
        rarityFilled: 0,
        conflictsSkipped: 0,
      });
    eraSummary.groupCount += 1;

    const setKey = normalizeSet(group?.code);
    for (const card of group?.cards || []) {
      summary.cardCount += 1;
      eraSummary.cardCount += 1;

      let candidates = [];
      const img = imageKey(card?.image);
      if (img) {
        candidates = indexes.byImage.get(img) || [];
        if (candidates.length) summary.matchedByImage += 1;
      }

      if (!candidates.length) {
        const number = printedNumber(
          card?.code || card?.number || card?.cardNumber,
        );
        if (setKey && number) {
          candidates = indexes.bySetNumber.get(`${setKey}::${number}`) || [];
          if (candidates.length) summary.matchedBySetNumber += 1;
        }
      }

      const match = uniqueCandidate(candidates);
      if (!match) {
        if (candidates.length) {
          summary.conflictsSkipped += 1;
          eraSummary.conflictsSkipped += 1;
        }
        continue;
      }

      summary.uniqueMatches += 1;
      eraSummary.uniqueMatches += 1;
      let changed = false;

      if (!clean(card?.illustrator) && clean(match.artist)) {
        card.illustrator = clean(match.artist);
        summary.illustratorFilled += 1;
        eraSummary.illustratorFilled += 1;
        changed = true;
      }
      if (!clean(card?.rarity) && clean(match.rarity)) {
        card.rarity = clean(match.rarity);
        summary.rarityFilled += 1;
        eraSummary.rarityFilled += 1;
        changed = true;
      }
      if (!changed) summary.unchangedMatches += 1;
    }
  }

  return summary;
}

const seriesPath = path.join(root, "data", "series.json");
const legacyPath = path.join(root, "data", "series-legacy.json");
const artistsPath = path.join(root, "data", "artists.json");
const auditPath = path.join(
  root,
  "data",
  "audits",
  "series-artist-metadata-sync.json",
);

const [seriesText, legacyText, artistsText] = await Promise.all([
  readFile(seriesPath, "utf8"),
  readFile(legacyPath, "utf8"),
  readFile(artistsPath, "utf8"),
]);

const series = JSON.parse(seriesText);
const legacy = JSON.parse(legacyText);
const artists = JSON.parse(artistsText);
const indexes = buildArtistIndexes(artists);

const baseSummary = enrichGroups(series, indexes, "data/series.json");
const legacySummary = enrichGroups(
  legacy,
  indexes,
  "data/series-legacy.json",
);

const audit = {
  schemaVersion: 1,
  source: "data/artists.json",
  policy:
    "Fill only missing series rarity/illustrator metadata when artist-dex evidence resolves to exactly one artist+rarity signature by image, or by normalized set+printed-number fallback. Existing metadata is never overwritten and ambiguous matches are skipped.",
  artistGroupCount: indexes.groups.length,
  artistCardCount: indexes.cardCount,
  files: [baseSummary, legacySummary],
  totals: {
    cardCount: baseSummary.cardCount + legacySummary.cardCount,
    uniqueMatches: baseSummary.uniqueMatches + legacySummary.uniqueMatches,
    conflictsSkipped:
      baseSummary.conflictsSkipped + legacySummary.conflictsSkipped,
    illustratorFilled:
      baseSummary.illustratorFilled + legacySummary.illustratorFilled,
    rarityFilled: baseSummary.rarityFilled + legacySummary.rarityFilled,
  },
};

await Promise.all([
  writeFile(seriesPath, JSON.stringify(series), "utf8"),
  writeFile(legacyPath, `${JSON.stringify(legacy, null, 2)}\n`, "utf8"),
  writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8"),
]);

console.log(
  [
    `Artist metadata sync: ${audit.totals.uniqueMatches} unique matches`,
    `${audit.totals.illustratorFilled} illustrator fields filled`,
    `${audit.totals.rarityFilled} rarity fields filled`,
    `${audit.totals.conflictsSkipped} ambiguous matches skipped`,
  ].join(" / "),
);
