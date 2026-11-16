import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const sources = [
  ...readdirSync(root).filter((name) => name.endsWith(".js")).map((name) => name),
  ...readdirSync(join(root, "core"), { recursive: true }).filter((name) => String(name).endsWith(".js")).map((name) => `core/${name}`),
];
const read = (file) => readFileSync(join(root, file), "utf8");

// 알려진 예외. 줄이는 방향으로만 바꾼다(추가 금지).
// packs.js 는 10.12.5 를 쓴다. 같은 페이지의 다른 스크립트는 12.16.0 이라 SDK 가 두 벌 로드된다.
// 팩 보유 저장 경로라서 계정 로그인 상태로 검증하기 전에는 올리지 않는다.
const SDK_EXCEPTIONS = new Map([["packs.js", "10.12.5"]]);

// window.fetch 를 감싸는 파일. 새 파일을 추가하지 않는다(모든 데이터 요청에 숨은 영향을 주기 때문).
const FETCH_OVERRIDE_ALLOWLIST = new Set(["firebase-collection-manager.js", "firebase-people-manager.js", "guest-empty-dex.js"]);

test("every Firebase SDK import uses the same version, except the documented exception", () => {
  const canonical = read("core/account/firebase-account.js").match(/SDK_VERSION = "(\d+\.\d+\.\d+)"/)?.[1];
  assert.ok(canonical, "core account module declares the canonical SDK version");
  const seen = new Map();
  for (const file of sources) {
    const text = read(file);
    for (const match of text.matchAll(/(?:FIREBASE_)?(?:SDK_)?VERSION\s*=\s*"(\d+\.\d+\.\d+)"/g)) {
      if (!text.includes("gstatic.com/firebasejs/")) continue;
      seen.set(file, match[1]);
    }
    assert.doesNotMatch(text, /firebasejs\/\d+\.\d+\.\d+\//, `${file}: hard-coded SDK version in the import URL`);
  }
  assert.ok(seen.size >= 25, `expected many SDK users, found ${seen.size}`);
  for (const [file, version] of seen) {
    const expected = SDK_EXCEPTIONS.get(file) || canonical;
    assert.equal(version, expected, `${file}: SDK ${version}, expected ${expected}`);
  }
  for (const file of SDK_EXCEPTIONS.keys()) assert.ok(seen.has(file), `${file}: stale exception, remove it`);
});

test("only the documented files override window.fetch and the unused demo manager stays removed", () => {
  const overriding = sources.filter((file) => /window\.fetch\s*=/.test(read(file)));
  assert.deepEqual(new Set(overriding), FETCH_OVERRIDE_ALLOWLIST);
  assert.equal(existsSync(join(root, "firebase-demo-manager.js")), false);
});
