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
  assert.match(html, /id="trade-wanted-cards"/);
  assert.match(html, /id="trade-offered-cards"/);
  assert.match(html, /미보유 카드에서 선택/);
  assert.match(html, /내가 구하는 미보유 카드/);
  assert.match(html, /내가 줄 수 있는 보유 카드/);
  assert.match(html, /id="trade-register-add-wanted-card"/);
  assert.match(html, /없어도 등록 가능/);
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
  assert.match(rules, /request\.resource\.data\.schemaVersion == 3/);
  assert.match(rules, /validTradeCardList\(request\.resource\.data\.wantedCards\)/);
  assert.match(rules, /validOptionalTradeCardList\(request\.resource\.data\.offeredCards\)/);
  assert.match(rules, /request\.resource\.data\.status == "open"/);
});

test("missing cards start registration and owned cards can be added as offers", async () => {
  const integration = await read("trade-offer.js");
  assert.match(integration, /status\?\.classList\.contains\("is-owned"\)/);
  assert.match(integration, /이 카드를 구해요/);
  assert.match(integration, /구하는 카드로 추가/);
  assert.match(integration, /줄 수 있는 카드로 추가/);
  assert.match(integration, /wantedCards\.push\(latest\.card\)/);
  assert.match(integration, /offeredCards\.push\(latest\.card\)/);
  assert.doesNotMatch(integration, /교환에 내놓기/);
  assert.match(integration, /이 카드로 교환 제안/);
});

test("proposal inbox, outbox, statuses, and owned-card selection are present", async () => {
  const [html, client] = await Promise.all([read("trades.html"), read("trades.js")]);
  assert.match(html, /id="trade-received-panel"/);
  assert.match(html, /id="trade-sent-panel"/);
  assert.match(html, /id="trade-proposal-cards"/);
  assert.match(client, /status: "pending"/);
  assert.match(client, /status: "accepted"/);
  assert.match(client, /status: "rejected"/);
  assert.match(client, /offeredCards: state\.proposalDraft\.cards/);
});

test("messages are limited to accepted proposals and stored as individual documents", async () => {
  const [html, client, rules] = await Promise.all([
    read("trades.html"), read("trades.js"), read("firestore.rules"),
  ]);
  assert.match(html, /id="trade-unread-count"/);
  assert.match(html, /id="trade-message-dialog"/);
  assert.match(client, /collection\(db, "tradeMessages"\)/);
  assert.match(client, /proposal\.status !== "accepted"/);
  assert.match(rules, /match \/tradeMessages\/\{messageId\}/);
  assert.match(rules, /acceptedTradeProposal\(resource\.data\.proposalId\)/);
  assert.match(rules, /tradeMessageAllowed/);
});

test("completion, deletion, blocking, and reporting have explicit guarded paths", async () => {
  const [html, client, rules] = await Promise.all([
    read("trades.html"), read("trades.js"), read("firestore.rules"),
  ]);
  assert.match(client, /acceptedProposalId: proposalId/);
  assert.match(client, /deleteDoc\(firestoreModule\.doc\(db, "tradePosts"/);
  assert.match(html, /id="trade-block-user"/);
  assert.match(html, /id="trade-report-user"/);
  assert.match(rules, /match \/tradeBlocks\/\{blockId\}/);
  assert.match(rules, /match \/tradeReports\/\{reportId\}/);
  assert.doesNotMatch(html, /type="number"|id="[^"]*(price|cash|amount)[^"]*"/i);
});

test("trade code never writes existing collection or dashboard settings", async () => {
  const sources = `${await read("trades.js")}\n${await read("trade-offer.js")}`;
  assert.doesNotMatch(sources, /"collections"|collectionSettings|publicProfiles|sharedCollections/);
  assert.match(sources, /batch\.update\(firestoreModule\.doc\(db, "tradePosts"/);
  assert.doesNotMatch(sources, /batch\.(update|set)\(firestoreModule\.doc\(db, "users"/);
});

test("trade posts may omit offered cards while proposals still require one", async () => {
  const [client, rules] = await Promise.all([read("trades.js"), read("firestore.rules")]);
  assert.match(client, /state\.draft\.offeredCards\.length === 0 \|\|/);
  assert.match(rules, /function validOptionalTradeCardList\(cards\)/);
  assert.match(rules, /function validTradeCardList\(cards\)[\s\S]*cards\.size\(\) >= 1/);
});

test("trade posts support up to six wanted and offered cards with legacy display compatibility", async () => {
  const [client, integration, rules] = await Promise.all([
    read("trades.js"), read("trade-offer.js"), read("firestore.rules"),
  ]);
  assert.match(client, /schemaVersion: 3/);
  assert.match(client, /wantedCards: state\.draft\.wantedCards/);
  assert.match(client, /sanitizeCards\(post\?\.wantedCards\)/);
  assert.match(client, /sanitizeCard\(post\?\.wantedCard\)/);
  assert.match(integration, /wantedCards\.length < 6/);
  assert.match(rules, /validTradeCardList\(request\.resource\.data\.wantedCards\)/);
  assert.match(rules, /request\.resource\.data\.schemaVersion == 2/);
});
