import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFiles = [
  path.join(root, "data", "series.json"),
  path.join(root, "data", "series-legacy.json"),
];

const mcMappings = [
  ["mc_1000/742", "mc_767/742", "BS2026001767"],
  ["mc_1001/742", "mc_768/742", "BS2026001768"],
  ["mc_1002/742", "mc_769/742", "BS2026001769"],
  ["mc_1003/742", "mc_770/742", "BS2026001770"],
  ["mc_1004/742", "mc_771/742", "BS2026001771"],
  ["mc_1005/742", "mc_772/742", "BS2026001772"],
  ["mc_1006/742", "mc_773/742", "BS2026001773"],
  ["mc_1007/742", "mc_774/742", "BS2026001774"],
];

const promoAdditions = [
  {
    code: "m-p_GRA",
    legacyCode: "m-p_GRA/M-P",
    name: "기본 풀 에너지",
    image: "https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M-P/M-P_GRA.png",
    source: "https://pokemoncard.co.kr/cards/detail/MP002026001",
  },
  {
    code: "m-p_FIR",
    legacyCode: "m-p_FIR/M-P",
    name: "기본 불꽃 에너지",
    image: "https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M-P/M-P_FIR.png",
    source: "https://pokemoncard.co.kr/cards/detail/MP002026002",
  },
  {
    code: "m-p_WAT",
    legacyCode: "m-p_WAT/M-P",
    name: "기본 물 에너지",
    image: "https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M-P/M-P_WAT.png",
    source: "https://pokemoncard.co.kr/cards/detail/MP002026003",
  },
];

const normalized = (value) => String(value ?? "").trim().toLowerCase();

function fixMc(group) {
  if (normalized(group?.code) !== "mc") return false;
  const cards = Array.isArray(group.cards) ? group.cards : [];
  let changed = false;

  for (const [oldCode, newCode, cardNum] of mcMappings) {
    const oldIndex = cards.findIndex(
      (card) => normalized(card?.code) === normalized(oldCode),
    );
    const newIndex = cards.findIndex(
      (card) => normalized(card?.code) === normalized(newCode),
    );

    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      throw new Error(`MC numbering conflict: both ${oldCode} and ${newCode} exist`);
    }
    if (oldIndex < 0) continue;

    const card = cards[oldIndex];
    const legacyCodes = [
      ...(Array.isArray(card.legacyCodes) ? card.legacyCodes : []),
      oldCode,
    ];
    card.code = newCode;
    card.legacyCodes = [...new Set(legacyCodes.map(String))];
    card.source = `https://pokemoncard.co.kr/cards/detail/${cardNum}`;
    changed = true;
  }

  return changed;
}

function fixMegaPromo(group) {
  if (normalized(group?.code) !== "m-p") return false;
  const cards = Array.isArray(group.cards) ? group.cards : [];
  let changed = false;
  let nextOrder = cards.reduce(
    (max, card) => Math.max(max, Number(card?.order) || 0),
    0,
  ) + 1;

  for (const addition of promoAdditions) {
    const current = cards.find(
      (card) => normalized(card?.code) === normalized(addition.code),
    );
    if (current) {
      current.image = addition.image;
      current.source = addition.source;
      current.name = addition.name;
      current.rarity = current.rarity || "PROMO";
      continue;
    }

    const legacy = cards.find(
      (card) => normalized(card?.code) === normalized(addition.legacyCode),
    );
    if (legacy) {
      legacy.code = addition.code;
      legacy.legacyCodes = [
        ...new Set([
          ...(Array.isArray(legacy.legacyCodes) ? legacy.legacyCodes : []),
          addition.legacyCode,
        ]),
      ];
      legacy.image = addition.image;
      legacy.source = addition.source;
      legacy.name = addition.name;
      legacy.rarity = legacy.rarity || "PROMO";
      changed = true;
      continue;
    }

    cards.push({
      code: addition.code,
      legacyCodes: [addition.legacyCode],
      image: addition.image,
      owned: false,
      status: "구함",
      name: addition.name,
      rarity: "PROMO",
      order: nextOrder++,
      source: addition.source,
    });
    changed = true;
  }

  if (changed) {
    group.cards = cards;
    if (typeof group.title === "string") {
      group.title = group.title.replace(/\(\d+\/M-P\)/i, `(${cards.length}/M-P)`);
    }
  }
  return changed;
}

let changedFiles = 0;
let mcFound = false;
let promoFound = false;

for (const filePath of dataFiles) {
  const raw = await readFile(filePath, "utf8");
  const groups = JSON.parse(raw);
  let changed = false;

  for (const group of groups) {
    if (normalized(group?.code) === "mc") mcFound = true;
    if (normalized(group?.code) === "m-p") promoFound = true;
    changed = fixMc(group) || changed;
    changed = fixMegaPromo(group) || changed;
  }

  if (changed) {
    await writeFile(filePath, `${JSON.stringify(groups)}\n`);
    changedFiles += 1;
  }
}

if (!mcFound) throw new Error("MC catalog group was not found.");
if (!promoFound) throw new Error("M-P catalog group was not found.");

console.log(
  changedFiles
    ? `Updated MEGA master data in ${changedFiles} file(s).`
    : "MEGA master data already normalized.",
);
