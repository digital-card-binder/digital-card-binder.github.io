import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("series print variants stay inside one ownership override", async () => {
  const manager = await read("firebase-page-manager.js");

  assert.match(manager, /SERIES_PRINT_VARIANTS = new Set\(\["normal", "holo", "mirror", "other"\]\)/);
  assert.match(manager, /item\.printVariants = normalizePrintVariants\(value\.printVariants, owned\)/);
  assert.match(manager, /card\.printVariants =[\s\S]*?normalizePrintVariants\(override\?\.printVariants, card\.owned\)/);
  assert.match(manager, /printVariants: nextOwned[\s\S]*?normalizePrintVariants\(current\.printVariants, true\)/);
  assert.doesNotMatch(manager, /printVariants.*accountKey/);
});

test("verified print variant metadata keeps canonical card counts unchanged", async () => {
  const metadata = JSON.parse(await read("data/series-print-variants.json"));

  assert.equal(metadata.schemaVersion, 1);
  assert.ok(Object.keys(metadata.slots).length >= 248);
  assert.equal(metadata.coverage.S.variantSlotCount, 222);
  assert.deepEqual(metadata.coverage.S.variantCounts, {
    holo: 0,
    mirror: 222,
    other: 0,
  });
  assert.equal(metadata.coverage.SM.variantSlotCount, 26);
  assert.deepEqual(metadata.coverage.SM.variantCounts, {
    holo: 0,
    mirror: 21,
    other: 5,
  });
  assert.deepEqual(metadata.slots["s9a::s9a::1"], ["mirror"]);
  assert.deepEqual(metadata.slots["smp2::smp2::1"], ["mirror"]);

  if (metadata.coverage.M) {
    assert.equal(metadata.coverage.M.configuredSetCount, 14);
    assert.equal(
      metadata.coverage.M.setCodes.length + metadata.coverage.M.partialSetCodes.length,
      14,
    );
  }
});

test("series dialog prioritizes verified print forms without creating extra cards", async () => {
  const catalog = await read("catalog.js");

  assert.match(catalog, /SERIES_PRINT_VARIANTS_URL = "\.\/data\/series-print-variants\.json"/);
  assert.match(catalog, /\{ id: "normal", label: "기본" \}/);
  assert.match(catalog, /\{ id: "holo", label: "홀로" \}/);
  assert.match(catalog, /\{ id: "mirror", label: "미러" \}/);
  assert.match(catalog, /\{ id: "other", label: "기타" \}/);
  assert.match(catalog, /function applySeriesPrintVariantMetadata\(/);
  assert.match(catalog, /const covered = coveredSets\.has\(groupKey\)/);
  assert.match(catalog, /card\.printVariantAuditCovered = covered/);
  assert.match(catalog, /card\.verifiedPrintVariants = \[\.\.\.new Set\(extras\)\]/);
  assert.match(catalog, /input\.name = "series-print-variant"/);
  assert.match(catalog, /id="series-print-variant-options"/);
  assert.match(catalog, /const printVariants = owned \? seriesEditorPrintVariants\(\) : \[\]/);
  assert.match(catalog, /saveOverride\(activeCard\.accountKey, \{\s*owned,\s*printVariants,/);
});

test("search index remains one record per canonical series card", async () => {
  const searchBuilder = await read("scripts/build-pokemon-search-index.mjs");

  assert.match(searchBuilder, /\(group\?\.cards \|\| \[\]\)\.map\(\(card\) => compactCard\(card, group, metadata\)\)/);
  assert.doesNotMatch(searchBuilder, /printVariants/);
});


test("Diamond & Pearl official audit covers all 598 canonical cards", async () => {
  const audit = JSON.parse(await read("data/audits/series-print-variant-audit-DP.json"));
  const metadata = JSON.parse(await read("data/series-print-variants.json"));

  assert.equal(audit.era, "DP");
  assert.equal(audit.summary.configuredSetCount, 16);
  assert.equal(audit.summary.resolvedProductCount, 16);
  assert.equal(audit.summary.missingProductCount, 0);
  assert.equal(audit.summary.rawRecordCount, 598);
  assert.equal(audit.summary.parsedSlotCount, 598);
  assert.equal(audit.summary.variantSlotCount, 0);
  assert.deepEqual(audit.summary.variantCounts, {
    holo: 0,
    mirror: 0,
    other: 0,
  });

  assert.equal(metadata.coverage.DP.configuredSetCount, 16);
  assert.equal(metadata.coverage.DP.setCodes.length, 16);
  assert.deepEqual(metadata.coverage.DP.partialSetCodes, []);
  assert.equal(metadata.coverage.DP.variantSlotCount, 0);

  for (const set of audit.sets) {
    assert.equal(set.missingProducts.length, 0, set.code);
    assert.equal(set.unresolvedRecordCount, 0, set.code);
    assert.equal(set.parsedSlotCount, set.expectedSlotCount, set.code);
  }
});


test("Black & White official audit keeps shared products from becoming false variants", async () => {
  const audit = JSON.parse(await read("data/audits/series-print-variant-audit-BW.json"));
  const metadata = JSON.parse(await read("data/series-print-variants.json"));

  assert.equal(audit.era, "BW");
  assert.equal(audit.summary.configuredSetCount, 37);
  assert.equal(audit.summary.resolvedProductCount, 39);
  assert.equal(audit.summary.missingProductCount, 0);
  assert.equal(audit.summary.rawRecordCount, 1444);
  assert.equal(audit.summary.parsedSlotCount, 1402);
  assert.equal(audit.summary.variantSlotCount, 0);
  assert.deepEqual(audit.summary.variantCounts, {
    holo: 0,
    mirror: 0,
    other: 0,
  });

  assert.equal(metadata.coverage.BW.configuredSetCount, 37);
  assert.equal(metadata.coverage.BW.setCodes.length, 17);
  assert.equal(metadata.coverage.BW.partialSetCodes.length, 20);
  assert.equal(metadata.coverage.BW.variantSlotCount, 0);

  const bwCodes = new Set(audit.sets.map((set) => set.code.toLowerCase()));
  const bwVariantKeys = Object.keys(metadata.slots).filter((key) =>
    bwCodes.has(key.split("::", 1)[0]),
  );
  assert.deepEqual(bwVariantKeys, []);

  for (const set of audit.sets) {
    assert.equal(set.missingProducts.length, 0, set.code);
    assert.equal(set.unresolvedRecordCount, 0, set.code);
    assert.equal(set.unexpectedOfficialSlotCount, 0, set.code);
  }

  assert.equal(
    audit.sets.find((set) => set.code === "MG-Bg")?.ignoredNoncanonicalRecordCount,
    17,
  );
  assert.equal(
    audit.sets.find((set) => set.code === "MG-Bm")?.ignoredNoncanonicalRecordCount,
    17,
  );
});
