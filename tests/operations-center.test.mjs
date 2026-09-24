import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("operations center is owner-only and exposes health, update watch, backup and restore", () => {
  const page = read("operations.html");
  const client = read("operations.js");
  assert.match(page, /신규 카드 업데이트 감시/);
  assert.match(page, /도감 건강검진/);
  assert.match(page, /도감 데이터 백업/);
  assert.match(page, /백업 복구/);
  assert.match(client, /accountCore[.]isOwner\(CONFIG, state[.]user\)/);
  assert.match(client, /digital-card-binder-backup-v1/);
  assert.match(client, /writeBatch/);
  assert.match(client, /update-watch[.]json/);
});

test("backup covers all existing account collection documents without touching profile identity", () => {
  const client = read("operations.js");
  for (const id of [
    "nationalDex", "packDex", "artistDex", "seriesDex",
    "pokemonCollectionsDex", "arDex", "trainerPokemonDex",
  ]) {
    assert.match(client, new RegExp(`"${id}"`));
  }
  assert.doesNotMatch(client, /collectorNicknames/);
  assert.doesNotMatch(client, /publicProfiles/);
  assert.doesNotMatch(client, /profile\/main/);
});

test("official update watch performs one low-frequency product-page fetch and only writes its report", () => {
  const script = read("scripts/check-official-card-updates.mjs");
  const workflow = read(".github/workflows/watch-official-card-updates.yml");
  const report = JSON.parse(read("data/update-watch.json"));

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.officialUrl, "https://pokemoncard.co.kr/card");
  assert.equal((script.match(/await fetch\(/g) || []).length, 1);
  assert.match(script, /data\/update-watch[.]json/);
  assert.doesNotMatch(script, /writeFile\([^\n]*(?:series|ar|artists)/);
  assert.match(workflow, /cron: "30 21 \* \* \*"/);
  assert.match(workflow, /git diff --quiet -- data\/update-watch[.]json/);
  assert.match(workflow, /git add data\/update-watch[.]json/);
});
