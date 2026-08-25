from pathlib import Path
import json
import re

catalog_path = Path("catalog.js")
catalog = catalog_path.read_text()

needle = "const mode = document.body.dataset.catalog;\n"
insert = "const mode = document.body.dataset.catalog;\nconst seriesBaseOnly =\n  mode === \"series\" && document.body.dataset.seriesScope === \"base\";\n"
if "const seriesBaseOnly =" not in catalog:
    assert needle in catalog
    catalog = catalog.replace(needle, insert, 1)

old_key = "const MOBILE_CATALOG_PREFERENCES_KEY = `pokemonDexMobileCatalogV1:${mode}`;"
new_key = "const MOBILE_CATALOG_PREFERENCES_KEY = `pokemonDexMobileCatalogV1:${mode}:${seriesBaseOnly ? \"base\" : \"all\"}`;"
if old_key in catalog:
    catalog = catalog.replace(old_key, new_key, 1)

function_needle = '''function seriesCardNumber(card) {
  const match = String(card.code || card.meta || "").match(/_([0-9]+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}
'''
function_insert = function_needle + '''
function seriesCardRange(card) {
  const match = String(card.code || card.meta || "").match(
    /_([0-9]+)\\/([0-9]+)/,
  );
  if (!match) return null;
  return {
    number: Number(match[1]),
    denominator: Number(match[2]),
  };
}

function isBaseSeriesCard(card) {
  const range = seriesCardRange(card);
  return !range || range.number <= range.denominator;
}

function applySeriesScope() {
  if (!seriesBaseOnly) return;
  groups = groups
    .map((group) => ({
      ...group,
      cards: (group.cards || []).filter(isBaseSeriesCard),
    }))
    .filter((group) => group.cards.length > 0);
}
'''
if "function applySeriesScope()" not in catalog:
    assert function_needle in catalog
    catalog = catalog.replace(function_needle, function_insert, 1)

scope_needle = '''    if (account) {
      await account.ready;
      account.applyGroups(groups);
    }

    groups.forEach((group) => {
'''
scope_insert = '''    if (account) {
      await account.ready;
      account.applyGroups(groups);
    }

    // 기본 수록 도감은 기존 시리즈도감과 같은 accountKey를 먼저 부여한 뒤
    // 분모 번호 이하 카드만 화면에 남겨 보유 상태를 완전히 공유합니다.
    applySeriesScope();

    groups.forEach((group) => {
'''
if "    applySeriesScope();\n\n    groups.forEach" not in catalog:
    assert scope_needle in catalog
    catalog = catalog.replace(scope_needle, scope_insert, 1)

catalog_path.write_text(catalog)

nav_path = Path("collector-nav.js")
nav = nav_path.read_text()
nav_needle = '''    const pokemonCollections = nav.querySelector('[href*="pokemon-collections.html"]');
    const pokemonCount = pokemonCollections?.querySelector("small");
    if (pokemonCount) pokemonCount.textContent = "67 POKÉMON";

    settings?.remove();
'''
nav_insert = '''    const pokemonCollections = nav.querySelector('[href*="pokemon-collections.html"]');
    const pokemonCount = pokemonCollections?.querySelector("small");
    if (pokemonCount) pokemonCount.textContent = "67 POKÉMON";

    const series = nav.querySelector('a.collection-link[href="./series.html"]');
    const baseSeries =
      nav.querySelector('a.collection-link[href="./base-series.html"]') ||
      navigationLink(
        "./base-series.html",
        "04B",
        "기본 수록 도감",
        "BASE SET · 분모까지",
      );
    if (series) {
      baseSeries.remove();
      series.after(baseSeries);
    }

    const ar = nav.querySelector('a.collection-link[href="./ar.html"]');
    const arCount = ar?.querySelector("small");
    if (arCount) arCount.textContent = "SV · M · 522 CARDS";

    settings?.remove();
'''
if '"./base-series.html"' not in nav:
    assert nav_needle in nav
    nav = nav.replace(nav_needle, nav_insert, 1)
nav_path.write_text(nav)

source = Path("series.html").read_text()
base = source
base = base.replace('<body data-catalog="series">', '<body data-catalog="series" data-series-scope="base">', 1)
base = base.replace('<a class="collection-link is-active" href="./series.html">', '<a class="collection-link" href="./series.html">', 1)

series_block = '''          <a class="collection-link" href="./series.html">
            <span class="collection-icon collection-icon--red">04</span>
            <span><strong>시리즈 도감</strong><small>SM · S · SV · M</small></span>
          </a>
'''
base_block = series_block + '''          <a class="collection-link is-active" href="./base-series.html" aria-current="page">
            <span class="collection-icon collection-icon--red">04B</span>
            <span><strong>기본 수록 도감</strong><small>BASE SET · 분모까지</small></span>
          </a>
'''
assert series_block in base
base = base.replace(series_block, base_block, 1)

base = base.replace("SERIES CARD ARCHIVE · COLLECTION 04", "BASE SET ARCHIVE · SERIES", 1)
base = base.replace("<h1>시리즈 도감</h1>", "<h1>기본 수록 도감</h1>", 1)
base = base.replace(
    """              확장팩별 카드 목록과 수집 현황을<br>
              한눈에 확인하는 시리즈 컬렉션""",
    """              각 세트의 기본 수록번호까지만 모아보는<br>
              정규번호 완성 컬렉션""",
    1,
)
base = base.replace("<span>전체 카드</span>", "<span>기본 수록 카드</span>", 1)
base = base.replace('<p class="section-kicker">SERIES CATALOG</p>', '<p class="section-kicker">BASE SET CATALOG</p>', 1)
base = base.replace("<h2>시리즈별 카드 목록</h2>", "<h2>기본 수록 카드 목록</h2>", 1)
base = base.replace(
    '<p class="catalog-caption">미보유 카드는 흑백으로 표시됩니다.</p>',
    '<p class="catalog-caption">각 세트의 분모 번호까지 표시하며, 분모를 초과하는 AR·SR·SAR 등은 제외됩니다. 미보유 카드는 흑백으로 표시됩니다.</p>',
    1,
)
base = base.replace('<p class="site-footer-note">최신 시리즈도감 기준</p>', '<p class="site-footer-note">기본 수록번호(분모) 이하 기준 · 분모 초과 시크릿/고레어 카드 제외</p>', 1)
Path("base-series.html").write_text(base)

for html_path in Path(".").glob("*.html"):
    text = html_path.read_text()
    text = re.sub(r"collector-nav\.js\?v=[^\"']+", "collector-nav.js?v=20260826-1", text)
    text = re.sub(r"catalog\.js\?v=[^\"']+", "catalog.js?v=20260826-1", text)
    html_path.write_text(text)

test_path = Path("tests/base-series-dex.test.mjs")
test_path.write_text('''import test from "node:test";
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
''')

package_path = Path("package.json")
package = json.loads(package_path.read_text())
ui = package["scripts"]["test:ui"]
extra = "tests/base-series-dex.test.mjs"
if extra not in ui:
    package["scripts"]["test:ui"] = ui + " " + extra
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n")
