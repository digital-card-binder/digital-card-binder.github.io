import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../dex-compact.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../dex-compact.css", import.meta.url), "utf8");

test("모든 도감의 보기 메뉴는 필터 버튼이나 창 없이 밖에 표시한다", () => {
  const items = source.match(/const MENU_ITEMS = \[([\s\S]*?)\]/)[1];
  for (const name of [
    "series-scope-switch", "filter-row", "people-filter-groups", "artist-filter-row",
    "tp-filter-row", "pack-filter-row", "fossil-select-field", "ar-rarity-chips",
  ]) assert.ok(items.includes(name), name);
  assert.doesNotMatch(source, /dex-sheet|dex-filter-button|showModal/);
  assert.doesNotMatch(styles, /dex-sheet|dex-filter-button/);
});

test("이미 옮긴 메뉴는 다시 붙이지 않아 키보드 포커스가 유지된다", () => {
  assert.match(source, /if \(!menus\.contains\(item\)\) menus\.append\(item\)/);
});
