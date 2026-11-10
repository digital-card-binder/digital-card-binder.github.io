import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = name => fs.readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("public production monitor uses anonymous published data only", () => {
  const source = read("scripts/public-service-live-smoke.mjs");
  assert.match(source, /https:\/\/digital-card-binder[.]github[.]io\//);
  assert.match(source, /publicCollectorDirectory/);
  assert.match(source, /publicProfiles/);
  assert.match(source, /getDocsFromServer/);
  assert.match(source, /getDocFromServer/);
  assert.match(source, /limit\(4\)/);
  assert.match(source, /privateDocumentsRead: false/);
  assert.match(source, /privateDocumentsWritten: false/);
  assert.doesNotMatch(source, /\b(getAuth|signInWith|writeBatch|setDoc|updateDoc|deleteDoc|addDoc|runTransaction)\s*\(/);
  assert.doesNotMatch(source, /"users"\s*,\s*(uid|userId|email)/);
  assert.doesNotMatch(source, /\b(process\.env\.[A-Z_]*(SECRET|TOKEN)|localStorage)\b/);
  assert.match(source, /reports".*, "public-service-smoke[.]json"/);
});

test("scheduled smoke has no write permissions, no secrets, bounded runtime", () => {
  const flow = read(".github/workflows/public-service-live-smoke.yml");
  assert.match(flow, /cron: '30 0 [*] [*] [*]'/);
  assert.match(flow, /contents: read/);
  assert.match(flow, /timeout-minutes: 10/);
  assert.match(flow, /node scripts\/public-service-live-smoke[.]mjs/);
  assert.match(flow, /actions\/upload-artifact@v4/);
  assert.doesNotMatch(flow, /(?:contents:\s*write|secrets[.]|CLOUDFLARE_API_TOKEN)/);
});

test("admin backup can be checked without initiating restore or exposing data", () => {
  const html = read("operations.html");
  const source = read("operations.js");
  assert.match(html, /백업 파일 검증 및 복구/);
  assert.match(html, /검증만 할 때는/);
  assert.match(source, /async function readRestoreFile\(file\)/);
  assert.match(source, /state\.restorePayload = await readRestoreFile\(file\)/);
  assert.match(source, /백업 파일 검사 통과\(읽기 전용\)/);
  assert.match(source, /if \(!confirm\(/);
  assert.match(source, /validateBackup\(payload\)/);
  const eventFrom = source.indexOf('$("operations-restore-file").addEventListener("change"');
  const eventTo = source.indexOf('$("operations-restore").addEventListener("click"', eventFrom);
  assert.ok(eventFrom > 0 && eventTo > eventFrom);
  const selectionCode = source.slice(eventFrom, eventTo);
  assert.doesNotMatch(selectionCode, /restoreBackup\(|\.commit\(|\.set\(/);
});
