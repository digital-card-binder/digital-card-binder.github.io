import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("regular pack catalog stays at 64 packs in the expected MEGA order", async () => {
  const javascript = await source("packs.js");
  const catalogBlock = javascript.match(/const packs = \[([\s\S]*?)\n\][.]map/);

  assert.ok(catalogBlock, "packs catalog block should be present");
  const codes = [...catalogBlock[1].matchAll(/\["(?:S|SV|M)","[^"]+","([^"]+)"/g)]
    .map((match) => match[1]);

  assert.equal(codes.length, 64);
  assert.deepEqual(codes.slice(-3), ["m5", "m6", "m6a"]);
});

test("m6 and m6a use optimized official individual pack images", async () => {
  const [javascript, css, html, m6, m6a] = await Promise.all([
    source("packs.js"),
    source("packs.css"),
    source("packs.html"),
    readFile(new URL("assets/packs/m6.webp", root)),
    readFile(new URL("assets/packs/m6a.webp", root)),
  ]);

  assert.match(javascript, /\["m6", "[.]\/assets\/packs\/m6[.]webp\?v=[0-9a-f]{12}"\]/);
  assert.match(javascript, /\["m6a", "[.]\/assets\/packs\/m6a[.]webp\?v=[0-9a-f]{12}"\]/);
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
