import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../dex-compact.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../dex-compact.css", import.meta.url), "utf8");

test("모든 도감의 보기 메뉴는 필터 버튼이나 창 없이 밖에 표시한다", () => {
  const items = source.match(/const MENU_ITEMS = \[([\s\S]*?)\]/)[1];
  for (const name of [
    "#catalog-scope", "filter-row", "people-filter-groups", "artist-filter-row",
    "tp-filter-row", "pack-filter-row", "fossil-select-field", "ar-rarity-chips",
  ]) assert.ok(items.includes(name), name);
  assert.doesNotMatch(source, /dex-sheet|dex-filter-button|showModal/);
  assert.doesNotMatch(styles, /dex-sheet|dex-filter-button/);
});

test("이미 옮긴 메뉴는 다시 붙이지 않아 키보드 포커스가 유지된다", () => {
  assert.match(source, /if \(!menus\.contains\(item\)\) menus\.append\(item\)/);
});

test("분류를 골라도 시리즈 카테고리 위의 도감 구성 선택은 계속 보인다", async () => {
  const scope = await readFile(new URL("../series-scope-filter.js", import.meta.url), "utf8");
  assert.match(scope, /const topControl = control\.cloneNode\(true\);/);
  assert.match(scope, /querySelector\("\.catalog-era-filter"\)\?\.before\(topSlot\)/);
  assert.match(scope, /\[control, topControl\]\.forEach/);
  assert.match(scope, /querySelectorAll\("\.series-scope-switch"\)\.forEach/);
  assert.match(scope, /body\.series-dashboard-mode \.series-scope-slot\{display:none;\}/);
  assert.match(styles, /:is\(\.dex-tools \.dex-menus, \.series-scope-slot\) \.series-scope-options button/);
  assert.match(styles, /body\.dex-compact\.series-dashboard-mode \.dex-search \{\s*display: none;/);
});
