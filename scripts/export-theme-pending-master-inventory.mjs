import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeCardImage } from "./card-image-routing.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"));
const [series, state] = await Promise.all([
  json("data/series.json"), json("data/audits/theme-series-review-status.json")
]);
const keys = ["SVM", "SVN", "SVOD", "SVOM"];
const out = {
  schemaVersion: 1,
  recordedAt: "2026-10-13",
  purpose: "Read-only export of existing Korean catalog identities and image routes for evidence review; not proof that source image matches Korean print.",
  source: "data/series.json",
  sets: {}
};
for (const code of keys) {
  const set = series.find((value) => String(value.code).toUpperCase() === code);
  if (!set || !Array.isArray(set.cards)) throw new Error("Missing Korean master set: " + code);
  const review = state?.reviews?.[code] ?? null;
  const list = code === "SVM"
    ? set.cards.map((card, i) => [card, i + 1]).filter(([, n]) => n >= 131 || [79, 122, 123, 126, 127, 128, 129, 130].includes(n))
    : set.cards.map((card, i) => [card, i + 1]);
  const cards = list.map(([card, n]) => {
    const existing = card.sourceImage || card.image || "";
    const route = routeCardImage(existing);
    const host = route?.project === "modern" ? "dcb-card-images-modern-2026.pages.dev" : "dcb-card-images-legacy-2026.pages.dev";
    return {
      canonicalOrder: n, code: card.code || "", name: card.name || "",
      cardNumber: card.number || card.cardNumber || "",
      rarity: card.rarity || "", image: card.image || "",
      sourceImage: card.sourceImage || "",
      existingCdnUrl: route ? "https://" + host + "/" + route.relativePath : "",
      imageRoute: route ? { official: route.official, root: route.root, project: route.project } : null
    };
  });
  out.sets[code] = {
    masterCanonicalCount: set.cards.length,
    reviewStatus: review?.status || "unknown",
    reviewedCardCount: review?.reviewedCardCount || 0,
    heldCards: review?.heldCards || [],
    cards
  };
}
const output="data/audits/theme-next-batches-master-inventory.json";
await writeFile(path.join(root, output), JSON.stringify(out, null, 2) + "\n");
console.log("Exported " + keys.map((code) => code + "=" + out.sets[code].cards.length).join(", "));
