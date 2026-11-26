import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../dex-compact.js", import.meta.url), "utf8");

test("도감 구성·포켓몬만 보기는 필터 창에 넣지 않는다", () => {
  const sheetItems = source.match(/const SHEET_ITEMS = \[([\s\S]*?)\]/)[1];
  assert.doesNotMatch(sheetItems, /series-scope-switch/);
  assert.match(source, /inlineSlot\.append\(scope\)/);
});

test("이미 옮긴 메뉴는 다시 붙이지 않아 키보드 포커스가 유지된다", () => {
  assert.match(source, /scope\.parentNode !== inlineSlot/);
});
