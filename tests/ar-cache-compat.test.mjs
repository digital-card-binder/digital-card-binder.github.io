import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../ar.html", import.meta.url), "utf8");
const ar = readFileSync(new URL("../ar.js", import.meta.url), "utf8");
const supplement = readFileSync(
  new URL("../ar-mega-supplement.js", import.meta.url),
  "utf8",
);
const supplementData = JSON.parse(
  readFileSync(new URL("../data/ar-supplement.json", import.meta.url), "utf8"),
);
const manager = readFileSync(
  new URL("../firebase-page-manager.js", import.meta.url),
  "utf8",
);

assert.match(html, /ar-mega-supplement\.js\?v=20260826-3/);
assert.match(html, /ar\.js\?v=20260826-1/);
assert.match(ar, /const BASE_GROUPS = 32;/);
assert.match(ar, /const BASE_TOTAL = 498;/);
assert.match(ar, /const isCurrentCatalog =/);
assert.match(ar, /const isBaseCatalog =/);
assert.match(ar, /if \(!isCurrentCatalog && !isBaseCatalog\)/);
assert.doesNotMatch(supplement, /response\.json\s*=/);
assert.doesNotMatch(supplement, /new Response\(/);
assert.doesNotMatch(supplement, /new Headers\(/);
assert.equal(supplementData.length, 2);
assert.equal(
  supplementData.reduce((total, group) => total + group.cards.length, 0),
  24,
);
assert.match(manager, /ar:\s*\{ documentId: "arDex" \}/);

const baseGroups = [{ code: "base", title: "base", cards: [] }];
const nativeArResponse = Object.freeze({
  ok: true,
  status: 200,
  statusText: "OK",
  headers: Object.freeze({}),
  url: "https://digital-card-binder.github.io/data/ar.json",
  json: async () => baseGroups,
});
const context = {
  URL,
  console,
  window: {
    location: { href: "https://digital-card-binder.github.io/ar.html" },
    fetch: async (input) => {
      const value = String(input);
      if (value.includes("ar-supplement.json")) {
        return { ok: true, json: async () => supplementData };
      }
      if (value.includes("ar.json")) return nativeArResponse;
      return { ok: false, status: 404, json: async () => ({}) };
    },
  },
};
vm.createContext(context);
vm.runInContext(supplement, context);
const wrapped = await context.window.fetch("./data/ar.json", { cache: "no-store" });
const merged = await wrapped.json();
assert.equal(merged.length, 3);
assert.equal(merged.at(-2).code, "m5");
assert.equal(merged.at(-1).code, "m6");
assert.equal(nativeArResponse.json, nativeArResponse.json, "native Response remains untouched");

console.log("AR mobile cache compatibility contract passed");
