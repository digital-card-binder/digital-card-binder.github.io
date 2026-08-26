import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 기본 수록 보기는 별도 도감이 아니라 시리즈도감의 범위 필터로 유지한다.
const nav = readFileSync(new URL("../collector-nav.js", import.meta.url), "utf8");
const legacyPage = readFileSync(new URL("../base-series.html", import.meta.url), "utf8");
const seriesPage = readFileSync(new URL("../series.html", import.meta.url), "utf8");
const scopeFilter = readFileSync(
  new URL("../series-scope-filter.js", import.meta.url),
  "utf8",
);

test("시리즈도감 기본 수록 필터는 각 세트의 분모 이하 카드만 표시한다", () => {
  assert.match(scopeFilter, /params\.get\("scope"\) === "base"/);
  assert.match(scopeFilter, /range\.number <= range\.denominator/);
  assert.match(scopeFilter, /pathname\.endsWith\("\/data\/series\.json"\)/);
  assert.match(seriesPage, /series-scope-filter\.js/);
});

test("기본 수록은 별도 카테고리 없이 시리즈도감 내부 필터로 제공된다", () => {
  assert.match(scopeFilter, /data-scope="all"/);
  assert.match(scopeFilter, /data-scope="base"/);
  assert.match(scopeFilter, />기본 수록<\/button>/);
  assert.doesNotMatch(nav, /navigationLink\(\s*"\.\/base-series\.html"/);
  assert.doesNotMatch(nav, /"기본 수록 도감"/);
});

test("기존 기본 수록 도감 주소는 시리즈도감 기본 수록 보기로 연결된다", () => {
  assert.match(legacyPage, /series\.html\?scope=base/);
  assert.doesNotMatch(legacyPage, /data-series-scope="base"/);
  assert.doesNotMatch(legacyPage, /<h1>기본 수록 도감<\/h1>/);
});
