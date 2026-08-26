import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../ar.html", import.meta.url), "utf8");
const ar = readFileSync(new URL("../ar.js", import.meta.url), "utf8");
const manager = readFileSync(
  new URL("../firebase-page-manager.js", import.meta.url),
  "utf8",
);

assert.match(html, /ar-mega-supplement\.js\?v=20260826-1/);
assert.match(html, /ar\.js\?v=20260826-1/);
assert.match(ar, /const BASE_GROUPS = 32;/);
assert.match(ar, /const BASE_TOTAL = 498;/);
assert.match(ar, /const isCurrentCatalog =/);
assert.match(ar, /const isBaseCatalog =/);
assert.match(ar, /if \(!isCurrentCatalog && !isBaseCatalog\)/);
assert.match(manager, /ar:\s*\{ documentId: "arDex" \}/);

console.log("AR cache compatibility contract passed");
