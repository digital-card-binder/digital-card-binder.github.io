import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("Korean master DB baseline covers the entire series catalog", async () => {
  const [audit, inventory, variants] = await Promise.all([
    read("data/master-card-db-audit.json").then(JSON.parse),
    read("data/series-inventory-audit.json").then(JSON.parse),
    read("data/series-print-variants.json").then(JSON.parse),
  ]);

  assert.equal(audit.scope.koreanReleaseOnly, true);
  assert.equal(audit.scope.market, "KR");
  assert.equal(audit.scope.japaneseReferencePolicy, "reference-only");
  assert.equal(audit.summary.setCount, inventory.summary.setCount);
  assert.equal(audit.summary.cardCount, inventory.summary.cardCount);
  assert.equal(audit.summary.duplicateSetCodeCount, 0);
  assert.equal(audit.summary.duplicateCardIdentityCount, 0);
  assert.equal(
    audit.summary.officialVariantVerifiedSlotCount,
    Object.keys(variants.slots).length,
  );
  assert.equal(
    audit.summary.officialVariantVerifiedSetCount +
      audit.summary.officialVariantPendingSetCount,
    audit.summary.setCount,
  );
  assert.deepEqual(
    Object.keys(audit.eras),
    ["ORIGIN", "ADV", "DP", "BW", "XY", "SM", "S", "SV", "M"],
  );
});

test("print variants never inflate canonical Korean card counts", async () => {
  const audit = JSON.parse(await read("data/master-card-db-audit.json"));

  assert.equal(audit.canonicalPolicy.basePrint, "normal");
  assert.deepEqual(audit.canonicalPolicy.printVariants, [
    "holo",
    "mirror",
    "other",
  ]);
  assert.match(audit.canonicalPolicy.variantRule, /별도 카드 슬롯으로 늘리지 않고/);
  assert.match(audit.canonicalPolicy.reprintRule, /다른 세트 또는 다른 카드번호/);
});

test("master DB audit exposes an explicit official-review queue for every era", async () => {
  const audit = JSON.parse(await read("data/master-card-db-audit.json"));

  for (const era of Object.values(audit.eras)) {
    const review = era.officialVariantAudit;
    assert.equal(review.verifiedSetCount + review.pendingSetCount, era.setCount);
    assert.equal(review.pendingSetCodes.length, review.pendingSetCount);
    assert.equal(review.verifiedSetCodes.length, review.verifiedSetCount);
    assert.ok(["complete", "partial", "pending"].includes(review.status));
  }
});


test("MEGA Korean membership audit closes all currently evidenced Korean slots", async () => {
  const [audit, membership] = await Promise.all([
    read("data/master-card-db-audit.json").then(JSON.parse),
    read("data/audits/mega-korean-membership-audit.json").then(JSON.parse),
  ]);

  assert.equal(membership.summary.setCount, 14);
  assert.equal(membership.summary.completeSetCount, 14);
  assert.equal(membership.summary.pendingSetCount, 0);
  assert.equal(membership.summary.unresolvedGapCount, 0);
  assert.equal(
    membership.summary.productSearchSlotCount +
      membership.summary.firstPartyVerifiedGapCount +
      membership.summary.koreanSecondaryVerifiedGapCount,
    membership.summary.expectedSlotCount,
  );

  const mega = audit.eras.M.koreanMembershipAudit;
  assert.equal(mega.status, "complete");
  assert.equal(mega.verifiedSetCount, 14);
  assert.equal(mega.pendingSetCount, 0);
  assert.equal(mega.unresolvedGapCount, 0);
  assert.equal(audit.summary.koreanMembershipVerifiedSetCount, 14);
  assert.equal(audit.summary.koreanMembershipPendingSetCount, 0);
});
