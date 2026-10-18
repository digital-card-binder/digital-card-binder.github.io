#!/usr/bin/env node
/** Confirm each repaired Korean image is genuinely present on the public owned CDN.
 * Read-only: no images or catalog data written. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { routeCardImage } from "./card-image-routing.mjs";

const pairs = [
  ["S6H_088", "https://static.tcgexchange.kr/5eaa1424f187cc9a46736eb754be15f7.jpg", "https://static.tcgexchange.kr/485df004469b074234f8e41677d557ca.png"],
  ["S6H_089", "https://static.tcgexchange.kr/fa7d8a61781dad5ee9c72cd1d8d71a4c.jpg", "https://static.tcgexchange.kr/4416d99c2b1fe8ac33540bd8dbb1ea50.png"],
  ["S6H_091", "https://static.tcgexchange.kr/af37a3a90f242cf68df376be40f0c4b0.jpg", "https://static.tcgexchange.kr/863b283e5fefadd097461c0eebcfdea2.png"],
  ["S6H_092", "https://static.tcgexchange.kr/ac528a39bb48ddc09898b70aa890f065.jpg", "https://static.tcgexchange.kr/8be3bf72a02a8c2258c381d1bf92376e.png"],
  ["S6H_093", "https://static.tcgexchange.kr/93e25afd7bbcf36cc42e1d018ea9f85a.jpg", "https://static.tcgexchange.kr/72a2fac0dc8fd84d622b8ab58150bb15.png"],
  ["S6K_089", "https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/28a6c6a2874e2319.webp", "https://static.tcgexchange.kr/77e9f3ab6a3bf7f1b8db71312ee2469f.png"],
  ["S6K_090", "https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/a74fac37d56d155c.webp", "https://static.tcgexchange.kr/025fa0280c558bb135fa6fd031053dc0.png"],
  ["S6K_092", "https://dcb-card-images-legacy-2026.pages.dev/external/static.tcgexchange.kr/e6a8de7da34479cc.webp", "https://static.tcgexchange.kr/d287bba0edf2ba741f0a2cfa0dbfc33e.png"],
];
const seen = new Set();
const results = [];
for (const [slot, previous, verified] of pairs) {
  const route = routeCardImage(previous);
  assert.equal(route?.project, "legacy", slot + " must route to own legacy archive");
  assert.equal(route.canonicalUrl, verified, slot + " must use verified Korean source");
  const url = "https://dcb-card-images-legacy-2026.pages.dev/" + route.relativePath;
  assert.ok(!seen.has(url), slot + " must be an independent image");
  seen.add(url);
  let error;
  let success;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const contentType = response.headers.get("content-type") || "";
      if (!/image\/webp/i.test(contentType)) throw new Error("Unexpected content type " + contentType);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 5000) throw new Error("Unexpectedly small image " + bytes.length);
      if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP")
        throw new Error("Invalid WebP signature");
      success = { slot, url, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
      break;
    } catch(e) { error = String(e); if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); }
  }
  if (!success) throw new Error(slot + " live CDN check failed: " + error);
  results.push(success);
  console.log("OK", JSON.stringify(success));
}
assert.equal(new Set(results.map(x => x.sha256)).size, 8, "All Korean card images must be distinct");
console.log(JSON.stringify({status:"pass",verified:results.length,total:8,pathsDistinct:true,imagesDistinct:true}));
