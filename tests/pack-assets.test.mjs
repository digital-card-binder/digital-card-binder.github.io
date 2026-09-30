import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("regular pack catalog covers the full Korean booster history and keeps MEGA order", async () => {
  const javascript = await source("packs.js");
  const catalogBlock = javascript.match(/const packs = \[([\s\S]*?)\n\][.]map/);

  assert.ok(catalogBlock, "packs catalog block should be present");
  const entries = [...catalogBlock[1].matchAll(/\["([^"]+)","([^"]+)","([^"]+)",([01])\]/g)]
    .map((match) => ({ era: match[1], name: match[2], code: match[3] }));
  const codes = entries.map((entry) => entry.code);
  const eras = new Set(entries.map((entry) => entry.era));

  assert.equal(entries.length, 151);
  assert.deepEqual([...eras], ["S", "SV", "M", "ORIGIN", "ADV", "DP", "BW", "XY", "SM"]);
  assert.deepEqual(codes.slice(61, 64), ["m5", "m6", "m6a"]);
  assert.ok(codes.includes("BASE"));
  assert.ok(codes.includes("ADV1"));
  assert.ok(codes.includes("BS10"));
  assert.ok(codes.includes("EBB"));
  assert.ok(codes.includes("XY"));
  assert.ok(codes.includes("sm12a"));
});

test("m6 and m6a use optimized official individual pack images", async () => {
  const [javascript, css, html, m6, m6a] = await Promise.all([
    source("packs.js"),
    source("packs.css"),
    source("packs.html"),
    readFile(new URL("assets/packs/m6.webp", root)),
    readFile(new URL("assets/packs/m6a.webp", root)),
  ]);

  assert.match(javascript, /\["m6", "[.]\/assets\/packs\/m6[.]webp\?v=20260918-1"\]/);
  assert.match(javascript, /\["m6a", "[.]\/assets\/packs\/m6a[.]webp\?v=20260918-1"\]/);
  assert.match(javascript, /has-individual-pack-image/);
  assert.doesNotMatch(javascript, /generatedPackArt|is-generated-pack-art/);

  assert.match(css, /[.]pack-image[.]has-individual-pack-image/);
  assert.match(css, /[.]pack-dialog-image[.]has-individual-pack-image/);
  assert.match(css, /[.]pack-card[.]is-missing [.]pack-image/);
  assert.match(css, /[.]pack-dialog-image-wrap[.]is-missing [.]pack-dialog-image/);
  assert.doesNotMatch(css, /is-generated-pack-art/);

  assert.match(html, /packs[.]css\?v=[0-9a-f]{12}/);
  assert.match(html, /packs[.]js\?v=[0-9a-f]{12}/);

  for (const image of [m6, m6a]) {
    assert.ok(image.length > 10_000, "optimized image should contain real artwork");
    assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP");
  }
});


test("legacy regular packs stay aligned with the canonical series inventory", async () => {
  const [javascript, auditSource] = await Promise.all([
    source("packs.js"),
    source("data/series-inventory-audit.json"),
  ]);
  const audit = JSON.parse(auditSource);
  const setMap = new Map(
    audit.sets.map((set) => [String(set.code).toLowerCase(), set]),
  );
  const entries = [...javascript.matchAll(/\["([^"]+)","([^"]+)","([^"]+)",([01])\]/g)]
    .map((match) => ({ era: match[1], name: match[2], code: match[3] }))
    .filter((entry) => !["S", "SV", "M"].includes(entry.era));

  assert.equal(entries.length, 87);
  for (const entry of entries) {
    const set = setMap.get(entry.code.toLowerCase());
    assert.ok(set, `missing series set for pack ${entry.code}`);
    assert.equal(set.era, entry.era, entry.code);
    assert.equal(set.displayName, entry.name, entry.code);
  }
});

test("legacy packs without local artwork use an explicit non-misleading placeholder", async () => {
  const [javascript, css] = await Promise.all([
    source("packs.js"),
    source("packs.css"),
  ]);
  assert.match(javascript, /SPRITE_BACKED_PACK_COUNT = 62/);
  assert.match(javascript, /image[.]classList[.]toggle\("is-pack-placeholder", placeholder\)/);
  assert.match(javascript, /팩 이미지 준비 중/);
  assert.match(css, /[.]pack-image[.]is-pack-placeholder/);
});
