import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("card trade is the third desktop and mobile navigation item", async () => {
  const [html, navigation] = await Promise.all([
    read("trades.html"),
    read("collector-nav.js"),
  ]);
  const dashboard = html.indexOf('href="./"');
  const gallery = html.indexOf('href="./collectors.html"');
  const trades = html.indexOf('href="./trades.html"');
  const national = html.indexOf('href="./national.html"');
  assert.ok(dashboard < gallery && gallery < trades && trades < national);
  assert.match(navigation, /dashboard\.after\(directory\);\s*directory\.after\(trades\);/);
});

test("trade registration contains card-only fields and no money input", async () => {
  const html = await read("trades.html");
  assert.match(html, /id="trade-offered-card"/);
  assert.match(html, /id="trade-wanted-card"/);
  assert.match(html, /id="trade-accept-offers"/);
  assert.doesNotMatch(html, /type="number"|id="[^"]*(price|cash|amount)[^"]*"/i);
});

test("trade posts use an isolated Firestore collection and fixed schema", async () => {
  const [client, rules] = await Promise.all([
    read("trades.js"),
    read("firestore.rules"),
  ]);
  assert.match(client, /collection\(db, "tradePosts"\)/);
  assert.doesNotMatch(client, /"users",\s*state\.user\.uid,\s*"collections"/);
  assert.match(rules, /match \/tradePosts\/\{tradePostId\}/);
  assert.match(rules, /keys\(\)\.hasOnly\(\[/);
  assert.match(rules, /request\.resource\.data\.status == "open"/);
});

test("only owned catalog cards expose the trade shortcut", async () => {
  const integration = await read("trade-offer.js");
  assert.match(integration, /status\?\.classList\.contains\("is-owned"\)/);
  assert.match(integration, /if \(!owned\) return null;/);
  assert.match(integration, /교환에 내놓기/);
});
