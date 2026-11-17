import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadKeyFor() {
  const window = { DigitalCardBinder: {}, location: { pathname: "/custom.html" } };
  vm.runInNewContext(fs.readFileSync("core/wish/wishlist.js", "utf8"), { window, document: {}, console, URL, Date, Map, Set, Promise });
  return window.DigitalCardBinder.wishlist.keyFor;
}

test("wish key: official wmimages path is shared across dexes", () => {
  const keyFor = loadKeyFor();
  const image = "https://x.pages.dev/data/wmimages/SV/SV1S/SV1S_001.png";
  assert.equal(keyFor({ image, page: "./a.html", name: "A" }), keyFor({ image, page: "./b.html", name: "A" }));
});

test("wish key: same-name custom cards stay distinct", () => {
  const keyFor = loadKeyFor();
  const base = { name: "피카츄", tag: "", page: "./custom.html?dex=1", image: "" };
  assert.notEqual(keyFor({ ...base, id: "c1" }), keyFor({ ...base, id: "c2" }));
  assert.notEqual(keyFor({ ...base, image: "./assets/cards/a.webp" }), keyFor({ ...base, image: "./assets/cards/b.webp" }));
  assert.equal(keyFor({ ...base, id: "c1" }), keyFor({ ...base, id: "c1" }));
});
