import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("binder photo scanner refines page edges to the detected pocket grid", async () => {
  const scanner = await read("binder-photo-scanner.js");

  assert.match(scanner, /function fitAxisBounds\(/);
  assert.match(scanner, /function refineCornersToPocket\(/);
  assert.match(scanner, /initialLayout = detectPocketGrid\(image, points\)/);
  assert.match(scanner, /refineCornersToPocket\(points, initialLayout, image\.width, image\.height\)/);
  assert.match(scanner, /포켓 바깥 여백까지 자동 정리했습니다/);
});

test("binder photo scanner returns card-aspect slot crops instead of raw equal cells", async () => {
  const scanner = await read("binder-photo-scanner.js");
  const studio = await read("studio-custom.js");

  assert.match(scanner, /function buildSlotCrops\(/);
  assert.match(scanner, /const slotCrops = buildSlotCrops\(/);
  assert.match(scanner, /cropMode: latestLayout \? "pocket-adaptive" : "card-safe"/);
  assert.match(studio, /Array\.isArray\(scanResult\.slotCrops\)/);
  assert.match(studio, /const crop = scanCrops\?\.\[index\] \|\| fallback/);
  assert.match(studio, /포켓 여백·카드 크기 자동 정렬 완료/);
});

test("scanner keeps manual correction available when auto detection is uncertain", async () => {
  const scanner = await read("binder-photo-scanner.js");
  const html = await read("studio.html");

  assert.match(scanner, /자동 감지가 불확실합니다\. 네 점을 카드 포켓 영역의 바깥 모서리에 맞춰 주세요/);
  assert.match(scanner, /gridSelect\.addEventListener\("change", \(\) => \{ manualGrid = true; checkGrid\(\); \}/);
  assert.match(html, /어긋난 경우 네 점만 카드 포켓 바깥 모서리에 맞추세요/);
});
