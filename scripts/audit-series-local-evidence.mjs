import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const eraIndex = args.indexOf("--era");
const excludeIndex = args.indexOf("--exclude-membership");
const outputIndex = args.indexOf("--output");
if (eraIndex < 0 || outputIndex < 0) {
  console.error(
    "Usage: node scripts/audit-series-local-evidence.mjs --era SV [--exclude-membership file.json] --output file.json",
  );
  process.exit(1);
}

const era = String(args[eraIndex + 1] || "").trim().toUpperCase();
const excludePath =
  excludeIndex >= 0 ? path.resolve(root, args[excludeIndex + 1]) : null;
const outputPath = path.resolve(root, args[outputIndex + 1]);
const clean = (value) => String(value ?? "").trim();
const norm = (value) => clean(value).toLowerCase();

function mergeGroups(base, legacy) {
  const merged = [...base];
  for (const group of legacy) {
    const key = norm(group?.code);
    const index = merged.findIndex((item) => norm(item?.code) === key);
    if (index >= 0) merged[index] = group;
    else merged.push(group);
  }
  return merged;
}

function inferEra(group) {
  const explicit = clean(group?.era).toUpperCase();
  if (explicit) return explicit;
  const code = norm(group?.code);
  if (code.startsWith("sv") || ["clf", "clk", "cll"].includes(code)) return "SV";
  return "";
}

function host(value) {
  try {
    return new URL(clean(value)).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function evidenceTier(card) {
  const image = clean(card?.image);
  const source = clean(card?.source);
  const imageHost = host(image);
  const sourceHost = host(source);

  if (
    imageHost === "cards.image.pokemonkorea.co.kr" ||
    sourceHost === "pokemoncard.co.kr" ||
    sourceHost.endsWith(".pokemoncard.co.kr")
  ) {
    return "first-party";
  }

  if (
    sourceHost === "www.dogam.app" &&
    imageHost === "static.tcgexchange.kr" &&
    clean(card?.name || card?.pokemonName || card?.actualName)
  ) {
    return "korean-secondary";
  }

  if (
    sourceHost === "tcgbox.co.kr" &&
    (imageHost === "tcgbox.co.kr" || imageHost.endsWith(".tcgbox.co.kr"))
  ) {
    return "korean-secondary";
  }

  if (
    sourceHost === "k-tcgpanda.com" &&
    (imageHost === "k-tcgpanda.com" || imageHost.endsWith(".k-tcgpanda.com"))
  ) {
    return "korean-secondary";
  }

  return "unresolved";
}

const [base, legacy] = await Promise.all([
  readFile(path.join(root, "data", "series.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "data", "series-legacy.json"), "utf8").then(JSON.parse),
]);
let excluded = new Set();
if (excludePath) {
  const payload = JSON.parse(await readFile(excludePath, "utf8"));
  excluded = new Set(
    (payload.sets || []).map((item) => norm(item.code)).filter(Boolean),
  );
}

const groups = mergeGroups(base, legacy).filter(
  (group) => inferEra(group) === era && !excluded.has(norm(group.code)),
);
const sets = [];
const unresolved = [];

for (const group of groups) {
  const cards = Array.isArray(group.cards) ? group.cards : [];
  let firstPartyCount = 0;
  let koreanSecondaryCount = 0;
  let unresolvedCount = 0;
  const sourceHosts = {};
  const imageHosts = {};

  cards.forEach((card, index) => {
    const tier = evidenceTier(card);
    if (tier === "first-party") firstPartyCount += 1;
    else if (tier === "korean-secondary") koreanSecondaryCount += 1;
    else {
      unresolvedCount += 1;
      unresolved.push({
        setCode: clean(group.code),
        cardIndex: index,
        code: clean(card.code),
        name: clean(card.name || card.pokemonName || card.actualName),
        image: clean(card.image),
        source: clean(card.source),
      });
    }

    const sourceHost = host(card.source) || "(missing)";
    const imageHost = host(card.image) || "(missing)";
    sourceHosts[sourceHost] = (sourceHosts[sourceHost] || 0) + 1;
    imageHosts[imageHost] = (imageHosts[imageHost] || 0) + 1;
  });

  sets.push({
    code: clean(group.code),
    title: clean(group.title),
    cardCount: cards.length,
    firstPartyCount,
    koreanSecondaryCount,
    unresolvedCount,
    complete: cards.length > 0 && unresolvedCount === 0,
    sourceHosts,
    imageHosts,
  });
}

const output = {
  schemaVersion: 1,
  scope: {
    era,
    market: "KR",
    excludedSetCodes: [...excluded],
  },
  evidencePolicy: {
    firstParty:
      "Pokemon Korea card source or cards.image.pokemonkorea.co.kr image.",
    koreanSecondary:
      "Known Korean card database source paired with its Korean card image host.",
    japaneseReference:
      "Reference-only. Japanese evidence does not satisfy Korean membership.",
  },
  summary: {
    setCount: sets.length,
    cardCount: sets.reduce((sum, set) => sum + set.cardCount, 0),
    completeSetCount: sets.filter((set) => set.complete).length,
    pendingSetCount: sets.filter((set) => !set.complete).length,
    firstPartyCount: sets.reduce((sum, set) => sum + set.firstPartyCount, 0),
    koreanSecondaryCount: sets.reduce(
      (sum, set) => sum + set.koreanSecondaryCount,
      0,
    ),
    unresolvedCount: unresolved.length,
  },
  sets,
  unresolved,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `${era} local evidence: ${output.summary.completeSetCount}/${output.summary.setCount} sets complete; ${output.summary.unresolvedCount} unresolved cards.`,
);
