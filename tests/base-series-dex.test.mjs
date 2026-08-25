import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const catalog = readFileSync(new URL("../catalog.js", import.meta.url), "utf8");
const nav = readFileSync(new URL("../collector-nav.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../base-series.html", import.meta.url), "utf8");

test("기본 수록 도감은 시리즈 보유 키를 부여한 뒤 분모 이하만 필터링한다", () => {
  assert.match(catalog, /dataset\.seriesScope === "base"/);
  assert.match(catalog, /range\.number <= range\.denominator/);
  const applyAccount = catalog.indexOf("account.applyGroups(groups)");
  const applyScope = catalog.indexOf("applySeriesScope();", applyAccount);
  assert.ok(applyAccount >= 0);
  assert.ok(applyScope > applyAccount);
});

test("기본 수록 도감 페이지와 메뉴가 제공된다", () => {
  assert.match(page, /data-series-scope="base"/);
  assert.match(page, /<h1>기본 수록 도감<\/h1>/);
  assert.match(page, /분모를 초과하는 AR·SR·SAR/);
  assert.match(nav, /base-series\.html/);
  assert.match(nav, /기본 수록 도감/);
});
