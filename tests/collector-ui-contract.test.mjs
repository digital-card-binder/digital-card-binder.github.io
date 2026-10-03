import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const collectionPages = {
  national: ["national.html", "firebase-collection-manager.js"],
  pack: ["packs.html", "packs.js"],
  artist: ["artists.html", "firebase-page-manager.js"],
  series: ["series.html", "firebase-page-manager.js"],
  pokemon: ["pokemon-collections.html", "firebase-page-manager.js"],
  ar: ["ar.html", "firebase-page-manager.js"],
  people: ["people.html", "firebase-people-manager.js"],
  trainerPokemon: ["trainer-pokemon.html", "firebase-page-manager.js"],
  fossil: ["fossil.html", "firebase-page-manager.js"],
  world: ["world.html", "firebase-page-manager.js"],
  artThemes: ["art-themes.html", "firebase-page-manager.js"],
};
const sitePages = [
  "index.html",
  "national.html",
  "packs.html",
  "artists.html",
  "series.html",
  "pokemon-collections.html",
  "ar.html",
  "people.html",
  "trainer-pokemon.html",
  "fossil.html",
  "world.html",
  "art-themes.html",
  "custom.html",
  "collectors.html",
  "collector.html",
  "collector-settings.html",
  "news.html",
  "privacy.html",
  "terms.html",
];

async function source(file) {
  return readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

function publicViewContext(search, hash = "") {
  const addedClasses = new Set();
  const bodyAttributes = new Map();
  const context = {
    URLSearchParams,
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    console,
    document: {
      documentElement: { classList: { add: (...values) => values.forEach((value) => addedClasses.add(value)) } },
      body: { setAttribute: (name, value) => bodyAttributes.set(name, value) },
      querySelector: () => null,
    },
  };
  context.window = {
    location: { search, hash },
    dispatchEvent: () => {},
    setTimeout,
    CollectorCollectionRegistry: {
      supportedCollectionId: (value) => Object.hasOwn(collectionPages, value),
    },
  };
  vm.createContext(context);
  return { context, addedClasses, bodyAttributes };
}

function navigationLayoutContext(moduleSource, initialWidth) {
  class FakeElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.attributes = new Map();
      this.children = [];
      this.className = "";
      this.dataset = {};
      this.listeners = new Map();
      this.textContent = "";
      this.title = "";
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    append(...children) {
      this.children.push(...children);
    }

    matches(selector) {
      return selector === "button" && this.tagName === "BUTTON";
    }

    querySelector(selector) {
      const className = selector.startsWith(".") ? selector.slice(1) : "";
      for (const child of this.children) {
        if (className && child.className.split(/\s+/).includes(className)) return child;
        const nested = child.querySelector?.(selector);
        if (nested) return nested;
      }
      return null;
    }

    setAttribute(name, value) {
      this.attributes.set(name, value);
    }

    trigger(type) {
      this.listeners.get(type)?.();
    }
  }

  const mediaByQuery = new Map();
  const queryMatches = (query, width) => {
    if (query.includes("max-width: 690px")) return width <= 690;
    if (query.includes("max-width: 920px")) return width <= 920;
    return false;
  };
  const matchMedia = (query) => {
    if (!mediaByQuery.has(query)) {
      const listeners = [];
      mediaByQuery.set(query, {
        matches: queryMatches(query, initialWidth),
        addEventListener: (type, listener) => {
          if (type === "change") listeners.push(listener);
        },
        listeners,
      });
    }
    return mediaByQuery.get(query);
  };
  const stored = new Map();
  const resultsBar = new FakeElement("div");
  const documentElement = new FakeElement("html");
  const context = {
    console,
    Element: FakeElement,
    MutationObserver: class MutationObserver {
      observe() {}
    },
    document: {
      body: Object.assign(new FakeElement("body"), { dataset: {} }),
      createElement: (tagName) => new FakeElement(tagName),
      documentElement,
      querySelector: (selector) => selector.includes(".catalog-panel .results-bar")
        ? resultsBar
        : null,
    },
  };
  context.window = {
    CollectorCollectionRegistry: { collectionIdForPage: () => "national" },
    addEventListener: () => {},
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
    location: { pathname: "/national.html" },
    matchMedia,
  };
  vm.createContext(context);
  vm.runInContext(moduleSource, context);
  const options = resultsBar.querySelector(".card-layout-options");
  return {
    buttons: Object.fromEntries(options.children.map((button) => [button.dataset.columns, button])),
    documentElement,
    stored,
    setViewportWidth(width) {
      for (const [query, media] of mediaByQuery) {
        const next = queryMatches(query, width);
        if (next === media.matches) continue;
        media.matches = next;
        media.listeners.forEach((listener) => listener({ matches: next }));
      }
    },
  };
}

test("every page uses the one-line Digital Card Binder brand and tab title", async () => {
  const commonCss = await source("styles.css");
  for (const page of sitePages) {
    const html = await source(page);
    assert.match(html, /<title>디지털 카드 바인더<\/title>/, `${page}: browser title`);
    assert.match(
      html,
      /<span class="brand-copy">\s*<strong>디지털 카드 바인더<\/strong>\s*<\/span>/,
      `${page}: one-line brand`,
    );
    assert.equal(html.includes("MY POKÉMON DEX"), false, `${page}: legacy brand`);
    assert.equal(html.includes("COLLECTION ARCHIVE"), false, `${page}: legacy subtitle`);
    assert.match(html, /styles[.]css[?]v=[0-9a-f]{12}/, `${page}: shared styles version`);
  }

  const collectorClient = await source("collector.js");
  assert.match(collectorClient, /document[.]title = "디지털 카드 바인더"/);
  assert.match(commonCss, /[.]brand-copy strong \{[\s\S]*?font-size: 1[.]06rem/);
  assert.match(commonCss, /[.]site-header > [.]brand \{[\s\S]*?grid-row: 1;[\s\S]*?align-self: center/);
  assert.match(commonCss, /[.]site-header > [.]site-header-metrics \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1/);
  assert.match(commonCss, /[.]site-header > [.]header-chip\[hidden\] \{\s*display: none !important/);
});

test("dashboard and news page expose a quiet latest-news flow", async () => {
  const dashboard = await source("index.html");
  const newsPage = await source("news.html");
  const newsClient = await source("news.js");
  const newsCss = await source("news.css");
  const newsData = JSON.parse(await source("news.json"));

  assert.match(dashboard, /id="dashboard-news-strip"[^>]*hidden/);
  assert.match(dashboard, /news[.]js[?]v=[0-9a-f]{12}/);
  assert.equal(newsClient.includes("pwa.js"), false);
  assert.match(dashboard, /pwa[.]js[?]v=[0-9a-f]{12}/);
  assert.match(newsPage, /pwa[.]js[?]v=[0-9a-f]{12}/);
  const pwaClient = await source("pwa.js");
  assert.match(pwaClient, /sw[.]js[?]v=[0-9a-f]{12}/);
  assert.match(dashboard, /class="dashboard-news-label"[^>]*href="[.]\/news[.]html"[^>]*>새소식<\/a>/);
  assert.match(dashboard, /id="dashboard-news-preview-list"/);
  assert.doesNotMatch(dashboard, /<a id="dashboard-news-strip"/);
  assert.match(newsPage, /id="news-list"[^>]*hidden/);
  assert.match(newsPage, /제목을 누르면 상세 내용을 볼 수 있습니다/);
  assert.match(newsClient, /items[.]slice\(0, 2\)/);
  assert.match(newsClient, /document[.]createElement\("details"\)/);
  assert.equal(newsClient.includes("firebase"), false);
  assert.match(newsCss, /[.]dashboard-news-strip \{/);
  assert.match(newsCss, /@media \(max-width: 690px\)/);

  assert.ok(newsData.items.length >= 10, "major update history should be populated");
  assert.equal(newsData.items[0].id, "android-app-v10-update-20260928");
  assert.ok(newsData.items.every((item) => item.category === "업데이트" || item.category === "공지"));
  const serialized = JSON.stringify(newsData);
  assert.equal(serialized.includes("pokemon-dogam"), false);
  assert.equal(serialized.includes("digital-card-binder.github.io"), false);
  assert.equal(serialized.includes("새 주소"), false);
  assert.equal(serialized.includes("주소 이전"), false);
});

test("Pokemon search refreshes and reuses series ownership state", async () => {
  const page = await source("pokemon-search.html");
  const client = await source("pokemon-search.js");
  const manager = await source("firebase-page-manager.js");

  assert.match(page, /data-catalog="series"/);
  assert.match(page, /firebase-page-manager[.]js[?]v=[0-9a-f]{12}/);
  assert.match(page, /pokemon-search[.]js[?]v=[0-9a-f]{12}/);
  assert.ok(client.includes("await account.refreshAccountData?.();"));
  assert.ok(client.includes("account.applyGroups(state.groups);"));
  assert.match(client, /card[.]owned/);
  assert.ok(client.includes("await account.saveOwned(item.card.accountKey, nextOwned);"));
  assert.match(manager, /readCollectionSnapshot/);
  assert.match(await source("core/account/firebase-account.js"), /getDocFromServer/);
  assert.match(manager, /refreshAccountData/);
});

test("Pokemon search aggregates exact-card ownership without linking dexes", async () => {
  const page = await source("pokemon-search.html");
  const client = await source("pokemon-search.js");
  const manager = await source("firebase-page-manager.js");

  assert.doesNotMatch(page, /class="catalog-caption"/);
  assert.doesNotMatch(page, /보유 여부는 카드 단위로 식별 가능한 내 도감 전체를 종합/);
  assert.match(page, /id="pokemon-search-dialog-sources"/);
  assert.ok(client.includes('addOwnershipSource(index, parts[1], parts[2], "작가 도감")'));
  assert.ok(client.includes('"AR 전종도감"'));
  assert.ok(client.includes('"포켓몬 컬렉션"'));
  assert.ok(client.includes('"트레이너 × 포켓몬"'));
  assert.ok(client.includes('"화석 도감"'));
  assert.ok(client.includes('"나만의 도감"'));
  assert.ok(client.includes('"전국도감"'));
  assert.ok(client.includes('"인물도감"'));
  assert.ok(client.includes('"월드탐험도감"'));
  assert.ok(client.includes('if (card.seriesOwned) labels.add("시리즈 도감")'));
  assert.ok(client.includes("item.card.seriesOwned = nextOwned;"));
  assert.ok(client.includes("applyOwnershipToItem(item);"));
  assert.ok(client.includes("addPeopleOwnership(index, national);"));
  assert.ok(client.includes("renderOwnershipSources("));
  assert.match(client, /className = "pokemon-search-ownership-chip"/);
  const searchCss = await source("pokemon-search.css");
  assert.match(page, /pokemon-search[.]css[?]v=[0-9a-f]{12}/);
  assert.match(searchCss, /[.]pokemon-search-ownership-chip\{/);
  assert.match(searchCss, /#pokemon-search-dialog-sources [.]pokemon-search-ownership-chip\{/);
  assert.ok(manager.includes("async function readCollectionDocument(documentId)"));
  assert.ok(manager.includes("readCollectionDocument,"));
});

test("dashboard loads every registered catalog through the shared registry", async () => {
  const dashboard = await source("dashboard.js");
  assert.match(dashboard, /CATEGORY_ORDER[.]filter/);
  assert.match(dashboard, /registry[.]loadCatalog\(category\)/);
  assert.match(dashboard, /cloneRegistryCatalog/);
  assert.doesNotMatch(dashboard, /[.]\/data\/trainer-pokemon[.]json/);
});

test("dashboard ignores stale saved displayOrder and follows the current navigation order", async () => {
  const dashboard = await source("dashboard.js");
  assert.match(
    dashboard,
    /const visibleCategories = CATEGORY_ORDER[.]filter\([\s\S]*?dashboardVisible !== false/,
  );
  const metricsBlock = dashboard.slice(
    dashboard.indexOf("function getMetrics()"),
    dashboard.indexOf("function renderSummary"),
  );
  assert.equal(metricsBlock.includes("displayOrder"), false);
});

test("dashboard polish follows navigation labels and restrained motion", async () => {
  const dashboard = await source("dashboard.js");
  const css = await source("dashboard.css");
  const sheets = await source("owner-sheets-sync.js");
  assert.match(dashboard, /AR 전종도감/);
  assert.match(dashboard, /트레이너 × 포켓몬/);
  assert.doesNotMatch(dashboard, /SV · M 시리즈 AR 510장/);
  assert.match(dashboard, /canonicalTotal/);
  assert.match(
    dashboard,
    /THEME_CATEGORIES = new Set\(\["pokemon", "artist", "people", "trainerPokemon", "fossil", "world", "artThemes"\]\)/,
  );
  assert.doesNotMatch(dashboard, /EXTRA_THEME_COLLECTIONS/);
  assert.doesNotMatch(dashboard, /dashboard-card-icon/);
  assert.match(css, /[.]dashboard-collection-card:hover \{[\s\S]*?translateY\(-3px\)/);
  assert.match(css, /data-category="people"/);
  assert.match(css, /data-category="trainerPokemon"/);
  assert.match(sheets, /trainerPokemon: "트레이너 × 포켓몬"/);
});

test("dashboard keeps support and app access secondary while removing public traffic", async () => {
  const page = await source("index.html");
  const css = await source("dashboard.css");
  const metrics = await source("site-metrics.js");
  assert.equal(page.includes('id="dashboard-traffic"'), false);
  assert.equal(page.includes("오늘 방문자"), false);
  assert.equal(page.includes("누적 방문자"), false);
  assert.equal(page.includes("카드 미리보기"), false);
  assert.doesNotMatch(page, /home-recent-preview/);
  assert.match(metrics, /DISPLAY_PUBLIC_METRICS = false/);
  assert.match(page, /class="dashboard-utility-panel"/);
  assert.match(page, /id="feedback-open"/);
  assert.match(page, /id="platform-app-grid"/);
  assert.match(page, /id="android-app-download"/);
  assert.match(page, /id="ios-pwa-card"/);
  assert.match(page, /안드로이드·아이폰 앱/);
  assert.match(page, /home-feature-card--custom/);
  assert.match(page, /home-feature-card--studio/);
  assert.match(page, /class="home-community-banner"/);
  assert.doesNotMatch(page, /dashboard-shortcut-section/);
  assert.ok(
    page.indexOf("dashboard-utility-panel") > page.indexOf("home-community-banner"),
    "utility actions should follow the promoted collection and community entry points",
  );
  assert.match(css, /[.]dashboard-utility-panel\{/);
  const pwa = await source("pwa.js");
  const pwaCss = await source("pwa.css");
  assert.match(pwa, /function configureAppCards\(\)/);
  assert.match(pwa, /if \(isAndroid\(\)\)/);
  assert.match(pwa, /else if \(isIOS\(\)\)/);
  assert.match(pwa, /function bindAndroidDownload\(\)/);
  assert.equal(page.includes("const isAndroid = /Android/i"), false);
  assert.match(pwaCss, /[.]platform-app-card\[hidden\]/);
});

test("decorative English UI labels are retired while official series codes remain", async () => {
  const page = await source("index.html");
  const shell = await source("scripts/sync-site-shell.mjs");
  const styles = await source("styles.css");
  for (const retired of [
    "ALL COLLECTIONS",
    "ALL CARD SEARCH",
    "TRAINER ARCHIVE",
    "FOSSIL DEX",
    "MY CUSTOM DEX",
    "COLLECTOR COMMUNITY",
  ]) {
    assert.equal(page.includes(retired), false, retired);
    assert.equal(shell.includes(retired), false, retired);
  }
  assert.match(shell, /catalogId: "series"/);
  assert.match(shell, /navigationSubtitle/);
  assert.match(shell, /273|groupCount/);
  assert.match(styles, /[.]eyebrow,[.]section-kicker\{display:none!important\}/);
});

test("dashboard includes custom dex in cards, totals, and settings order", async () => {
  const page = await source("index.html");
  const client = await source("dashboard.js");
  const css = await source("dashboard.css");
  const customSharing = await source("custom-sharing.js");

  const registryIndex = page.indexOf("collector-collection-registry.js");
  const customIndex = page.indexOf("custom-sharing.js");
  const dashboardIndex = page.indexOf("dashboard.js");
  assert.ok(customIndex > registryIndex, "custom registry extension order");
  assert.ok(dashboardIndex > customIndex, "dashboard must start after custom registration");
  assert.match(page, /dashboard[.]css[?]v=[0-9a-f]{12}/);
  assert.match(page, /dashboard[.]js[?]v=[0-9a-f]{12}/);

  assert.match(client, /CATEGORY_ORDER = registry[?][.]COLLECTION_ORDER/);
  assert.match(client, /documentId: "pokemonCollectionsDex"/);
  assert.match(client, /loaded[.]custom = createCategory\("custom", \[\], \[\]\)/);
  assert.match(client, /category === "custom"[\s\S]*?registry[?][.]customOwnership/);
  assert.match(css, /dashboard-collection-card\[data-category="custom"\]/);
  assert.match(customSharing, /registry[.]customOwnership = customOwnership/);
});

test("collection pages load shared catalog, identity, and account cores before managers", async () => {
  for (const [collectionId, [page, manager]] of Object.entries(collectionPages)) {
    const html = await source(page);
    const catalogCore = html.indexOf("core/catalog/catalog-service.js");
    const identityCore = html.indexOf("core/catalog/card-identity.js");
    const accountCore = html.indexOf("core/account/firebase-account.js");
    const registryIndex = html.indexOf("collector-collection-registry.js");
    const managerIndex = html.indexOf(manager);
    assert.ok(catalogCore >= 0, `${collectionId}: catalog core missing`);
    assert.ok(identityCore > catalogCore, `${collectionId}: identity core order`);
    assert.ok(accountCore > identityCore, `${collectionId}: account core order`);
    assert.ok(registryIndex > accountCore, `${collectionId}: registry core order`);
    assert.ok(managerIndex > registryIndex, `${collectionId}: manager core order`);
  }
});

test("every existing collection page loads the public adapter before its manager", async () => {
  for (const [collectionId, [page, manager]] of Object.entries(collectionPages)) {
    const html = await source(page);
    const registryIndex = html.indexOf("collector-collection-registry.js");
    const publicIndex = html.indexOf("collector-public-view.js");
    const syncIndex = html.indexOf("collector-public-sync.js");
    const managerIndex = html.indexOf(manager);
    assert.ok(registryIndex >= 0, `${collectionId}: registry missing`);
    assert.ok(publicIndex > registryIndex, `${collectionId}: public adapter order`);
    assert.ok(syncIndex > publicIndex, `${collectionId}: public sync order`);
    assert.ok(managerIndex > syncIndex, `${collectionId}: manager order`);
    assert.ok(html.includes("collector.css"), `${collectionId}: collector CSS missing`);
  }
});

test("series catalog filters sets by Korean card era without hiding MEGA", async () => {
  const page = await source("series.html");
  const client = await source("catalog.js");
  const css = await source("catalog.css");

  assert.match(page, /id="catalog-era"[^>]*role="tablist"/);
  for (const [era, label] of [
    ["ALL", "전체"],
    ["SM", "썬&amp;문"],
    ["S", "소드&amp;실드"],
    ["SV", "스칼렛&amp;바이올렛"],
    ["M", "MEGA"],
  ]) {
    assert.match(page, new RegExp(`data-era="${era}"[^>]*>[\\s\\S]*?${label}`));
  }
  const eraIndices = ["ALL", "SM", "S", "SV", "M"].map((era) => page.indexOf(`data-era="${era}"`));
  assert.ok(eraIndices.every((index, position) => position === 0 || eraIndices[position - 1] < index));
  assert.match(page, /class="is-active"[^>]*data-era="ALL"[^>]*aria-selected="true"/);
  assert.match(client, /let activeEra = mode === "series" \? "ALL" : "SM";/);
  assert.match(page, /id="series-dashboard"/);
  assert.match(client, /function renderSeriesDashboard\(\)/);
  assert.match(client, /function seriesEra\(group\)/);
  assert.match(client, /groups[.]filter\(\(group\) => seriesEra\(group\) === activeEra\)/);
  assert.match(client, /group[.]displayName/);
  assert.match(css, /[.]catalog-era-tabs\{/);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.equal(page.includes("33 SETS"), false);
});

test("series navigation summary uses the generated set and card totals", async () => {
  for (const file of [...sitePages, "trades.html"]) {
    const html = await source(file);
    if (!html.includes('href="./series.html"')) continue;
    assert.match(
      html,
      /시리즈 도감<\/strong><small>[\d,]+세트 · [\d,]+장<\/small>/,
      file,
    );
  }
});

test("phone usability upgrades stay inside the 690px mobile boundary", async () => {
  const commonCss = await source("styles.css");
  const catalogCss = await source("catalog.css");
  const collectorCss = await source("collector.css");
  const managerCss = await source("collection-manager.css");
  const navigation = await source("collector-nav.js");
  const catalogClient = await source("catalog.js");

  assert.match(commonCss, /[.]hero \{[\s\S]*?min-height: 276px/);
  assert.match(commonCss, /[.]progress-ring \{[\s\S]*?width: 128px/);
  assert.match(commonCss, /[.]card-grid \{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);

  const phoneCss = commonCss.slice(
    commonCss.indexOf("@media (max-width: 690px)"),
    commonCss.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  assert.match(phoneCss, /[.]collection-link \{[\s\S]*?min-width: 138px/);
  assert.match(phoneCss, /[.]hero \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(phoneCss, /[.]progress-ring \{[\s\S]*?width: 76px/);
  assert.match(phoneCss, /[.]stats-grid \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(phoneCss, /[.]card-dialog\[open\] \{[\s\S]*?100dvh/);

  assert.match(catalogCss, /@media\(max-width:690px\)[\s\S]*?scroll-margin-top:76px/);
  assert.match(collectorCss, /[.]mobile-filter-jump \{\s*display: none/);
  assert.match(collectorCss, /@media \(max-width: 690px\)[\s\S]*?[.]catalog-panel [.]results-bar \{[\s\S]*?position: sticky/);
  assert.match(collectorCss, /@media \(max-width: 680px\)[\s\S]*?[.]collector-directory-hero \{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(collectorCss, /[.]collector-directory-hero h1 \{\s*white-space: nowrap/);
  assert.match(managerCss, /@media\(max-width:690px\)[\s\S]*?[.]collection-complete-button\{min-height:44px/);
  assert.match(navigation, /function centerActiveNavigationOnMobile\(\)/);
  assert.match(navigation, /filterTarget[.]scrollIntoView/);
  assert.match(catalogClient, /pokemonDexMobileCatalogV1/);
  assert.match(catalogClient, /window[.]sessionStorage[.]setItem/);
});

test("new pages have unique element IDs and mobile/read-only CSS contracts", async () => {
  for (const page of ["collector-settings.html", "collectors.html", "collector.html", "news.html"]) {
    const html = await source(page);
    const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${page}: duplicate id`);
  }
  const settings = await source("collector-settings.html");
  for (const id of [
    "collector-nickname",
    "collector-profile-avatar-fallback",
    "collector-settings-grid",
    "collector-settings-save",
  ]) {
    assert.ok(settings.includes(`id="${id}"`), `${id} missing`);
  }
  const css = await source("collector.css");
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /collector-public-readonly \.collector-private-detail/);
});

test("collector settings restores the existing login before showing its sign-in gate", async () => {
  const settingsPage = await source("collector-settings.html");
  const settingsClient = await source("collector-settings.js");
  const css = await source("collector.css");
  assert.match(
    settingsPage,
    /id="collector-signin-gate"[^>]*hidden/,
    "the sign-in gate must stay hidden until auth restoration finishes",
  );
  assert.match(css, /collector-signin-gate\[hidden\]/);
  assert.match(settingsClient, /auth[.]authStateReady/);
  assert.match(settingsClient, /현재 세션 확인/);
  assert.equal(settingsClient.includes('prompt: "select_account"'), false);
});

test("fossil and world pages use their own registry collection identities", async () => {
  const fossil = await source("fossil.html");
  const world = await source("world.html");
  const worldClient = await source("world.js");

  assert.match(fossil, /<body data-catalog="fossil">/);
  assert.match(world, /data-catalog="world"/);
  for (const html of [fossil, world]) {
    assert.match(html, /collector-public-view[.]js[?]v=[0-9a-f]{12}/);
    assert.match(html, /collector-public-sync[.]js[?]v=[0-9a-f]{12}/);
    assert.match(html, /firebase-page-manager[.]js[?]v=[0-9a-f]{12}/);
  }
  assert.match(worldClient, /applyAccountOwnership/);
  assert.match(worldClient, /OWNED_MIGRATION_KEY/);
  assert.match(worldClient, /account[.]saveOwned/);
});

test("navigation uses Korean main and theme groups with standalone custom and community links", async () => {
  const shell = await source("scripts/sync-site-shell.mjs");
  const navigation = await source("collector-nav.js");
  assert.match(shell, /section: "주요 도감"/);
  assert.match(shell, /section: "테마 도감"/);
  assert.match(shell, /title: "팩 전종수집"/);
  assert.match(shell, /title: "화석 도감"/);
  assert.match(shell, /title: "나만의 도감"/);
  assert.match(shell, /title: "커뮤니티"/);
  assert.equal(shell.includes('"도감 갤러리"'), false);
  assert.equal(shell.includes('"공개 컬렉터"'), false);

  const menuStart = shell.indexOf("const navigation = Object.freeze([");
  const menuEnd = shell.indexOf("]);", menuStart);
  const menuLayout = shell.slice(menuStart, menuEnd);
  const order = [
    'page: "index.html"',
    'page: "pokemon-search.html"',
    'section: "주요 도감"',
    'page: "national.html"',
    'page: "series.html"',
    'page: "ar.html"',
    'page: "packs.html"',
    'section: "테마 도감"',
    'page: "pokemon-collections.html"',
    'page: "artists.html"',
    'page: "people.html"',
    'page: "trainer-pokemon.html"',
    'page: "fossil.html"',
    'page: "world.html"',
    'page: "art-themes.html"',
    'page: "custom.html"',
    'page: "collectors.html"',
  ].map((token) => menuLayout.indexOf(token));
  assert.ok(order.every((index) => index >= 0));
  assert.ok(order.every((index, position) => position === 0 || order[position - 1] < index));

  assert.equal(navigation.includes("nav.replaceChildren("), false);
  assert.match(navigation, /normalizeNavigationState\(nav\)/);

  for (const [page] of Object.values(collectionPages)) {
    assert.match(await source(page), /collector-nav[.]js\?v=[0-9a-f]{12}/);
  }
  const settingsPage = await source("collector-settings.html");
  assert.match(settingsPage, /collector-nav[.]js\?v=[0-9a-f]{12}/);
  assert.match(settingsPage, /<title>디지털 카드 바인더<\/title>/);
  assert.match(settingsPage, /<h1 id="page-title">내 프로필 관리<\/h1>/);
});
test("detail pages use the finalized navigation names in their static markup", async () => {
  const expected = [
    ["index.html", "통합 대시보드"],
    ["pokemon-search.html", "카드 검색"],
    ["national.html", "전국도감"],
    ["series.html", "시리즈 도감"],
    ["ar.html", "AR 전종도감"],
    ["packs.html", "팩 전종수집"],
    ["pokemon-collections.html", "포켓몬 컬렉션"],
    ["artists.html", "작가 도감"],
    ["people.html", "인물도감"],
    ["trainer-pokemon.html", "트레이너 × 포켓몬"],
    ["fossil.html", "화석 도감"],
    ["world.html", "월드탐험도감"],
    ["art-themes.html", "아트 테마 도감"],
    ["custom.html", "나만의 도감"],
    ["collectors.html", "커뮤니티"],
  ];
  for (const [page, title] of expected) {
    const html = await source(page);
    assert.match(html, /<div class="sidebar-label">도감 메뉴<\/div>/, page);
    assert.match(html, /class="sidebar-label collection-nav-section">주요 도감<\/div>/, page);
    assert.match(html, /class="sidebar-label collection-nav-section">테마 도감<\/div>/, page);
    assert.ok(html.includes(`<strong>${title}</strong>`) || html.includes(`>${title}</h1>`), page);
    assert.equal(html.includes("도감 갤러리"), false, page);
    assert.equal(html.includes("공개 컬렉터"), false, page);
  }
  assert.match(await source("trainer-pokemon.html"), /<h1 id="page-title">트레이너 × 포켓몬<\/h1>/);
  assert.match(await source("collectors.html"), /<h1 id="page-title">커뮤니티<\/h1>/);
});

test("the signed-in account name opens profile management", async () => {
  const navigation = await source("collector-nav.js");
  const css = await source("collector.css");
  assert.match(navigation, /PROFILE_SETTINGS_HREF = "[.]\/collector-settings[.]html"/);
  assert.match(navigation, /status[.]tagName !== "A"/);
  assert.match(navigation, /panel[.]classList[.]contains\("is-account"\)/);
  assert.match(navigation, /status[.]href = PROFILE_SETTINGS_HREF/);
  assert.match(navigation, /내 프로필 관리 열기/);
  assert.match(navigation, /childList: true/);
  assert.match(navigation, /characterData: true/);
  assert.match(navigation, /subtree: true/);
  assert.match(css, /#firebase-auth-status[.]firebase-profile-link/);
  assert.match(
    css,
    /@media \(max-width: 690px\)[\s\S]*?#firebase-auth-panel[.]is-account #firebase-auth-status[.]firebase-profile-link \{[\s\S]*?display: inline-flex/,
  );
});

test("collection pages share the same default header state", async () => {
  for (const page of [...Object.values(collectionPages).map(([file]) => file), "custom.html"]) {
    const html = await source(page);
    const headerStart = html.indexOf('<header class="site-header">');
    const header = html.slice(headerStart, html.indexOf("</header>", headerStart));
    assert.ok(headerStart >= 0, `${page}: common header missing`);
    assert.match(header, /<span class="header-chip">공개 보기<\/span>/, `${page}: default header state`);
    assert.match(html, /collector[.]css[?]v=[0-9a-f]{12}/, `${page}: current common header CSS`);
    assert.match(html, /collector-nav[.]js[?]v=[0-9a-f]{12}/, `${page}: current common header behavior`);
  }
});

test("ten native dexes activate one responsive collection UX shell", async () => {
  const navigation = await source("collector-nav.js");
  const css = await source("collector.css");

  assert.match(navigation, /function activateCollectionUiShell\(\)/);
  assert.match(navigation, /collectionId === "custom"/);
  assert.match(navigation, /collector-collection-page/);
  assert.match(navigation, /collector-collection-hero/);
  assert.match(navigation, /collector-collection-stats/);
  assert.match(navigation, /collector-content-panel/);
  assert.match(navigation, /collector-filter-surface/);
  assert.doesNotMatch(
    navigation,
    /standaloneAccountHeaderPages = new Set\(\["custom-dex", "world-exploration"\]\)/,
  );
  assert.match(navigation, /standaloneAccountHeaderPages = new Set\(\["custom-dex"\]\)/);
  assert.match(
    navigation,
    /people-filter-panel, [.]fossil-filter-panel, [.]tp-filter-panel, [.]catalog-toolbar/,
  );
  assert.ok(
    navigation.indexOf("activateCollectionUiShell();") <
      navigation.indexOf("addCardLayoutToggle();"),
    "shared page shell should be active before page controls are enhanced",
  );

  assert.match(css, /4단계: 정식 도감 10종/);
  assert.match(css, /body[.]collector-collection-page [.]collector-collection-hero/);
  assert.match(css, /body[.]collector-collection-page [.]collector-filter-surface/);
  assert.match(css, /body[.]collector-collection-page [.]collector-selection-summary/);
  assert.doesNotMatch(css, /data-collection-id="people"/);
  assert.match(
    css,
    /@media \(max-width: 690px\)[\s\S]*?body[.]collector-collection-page [.]catalog-heading/,
  );
  assert.match(
    css,
    /body[.]collector-collection-page [.]world-generation-panel,[\s\S]*?body[.]collector-collection-page [.]world-binder-panel/,
  );
});

test("native dex pages retire one-off heading clutter and share compact guide disclosures", async () => {
  const nativePages = [
    "national.html",
    "series.html",
    "ar.html",
    "packs.html",
    "pokemon-collections.html",
    "artists.html",
    "people.html",
    "trainer-pokemon.html",
    "fossil.html",
    "world.html",
  ];
  for (const page of nativePages) {
    const html = await source(page);
    assert.doesNotMatch(html, /class="catalog-caption"/, page);
  }

  const ar = await source("ar.html");
  const fossil = await source("fossil.html");
  const trainer = await source("trainer-pokemon.html");
  const people = await source("people.html");
  const peopleClient = await source("people.js");
  const css = await source("collector.css");

  assert.doesNotMatch(ar, /ar-hero-meta/);
  assert.doesNotMatch(fossil, /id="fossil-scope"/);
  assert.match(fossil, /<details class="collector-guide-panel">/);
  assert.match(trainer, /<details class="collector-guide-panel">/);
  assert.equal((people.match(/class="stat-card /g) || []).length, 3);
  assert.match(people, /id="stat-people-rate"/);
  assert.doesNotMatch(people, /stat-people-confirmed/);
  assert.doesNotMatch(peopleClient, /stat-people-confirmed/);
  assert.match(css, /[.]collector-guide-panel summary::after/);
  assert.match(css, /[.]collector-guide-panel\[open\] summary::after/);
});

test("shared collection UI uses one calm panel and interaction system", async () => {
  const css = await source("collector.css");
  assert.match(css, /--collector-filter-surface: #f8fafc/);
  assert.match(css, /--collector-panel-shadow: 0 10px 28px/);
  assert.match(css, /[.]collection-nav-section \{/);
  assert.match(css, /body [.]pack-filter-panel,[\s\S]*?body [.]tp-filter-panel \{/);
  assert.match(css, /[.]pokemon-card-button:hover \{[\s\S]*?translateY\(-3px\)/);
  assert.match(css, /@media \(max-width: 690px\)[\s\S]*?[.]pokemon-card-button:hover \{[\s\S]*?transform: none/);
});

test("service worker stays network-first without forced shell navigation", async () => {
  const worker = await source("sw.js");
  assert.match(worker, /request[.]mode === "navigate"/);
  assert.match(worker, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.equal(worker.includes("SHELL_BUILD_VERSION"), false);
  assert.equal(worker.includes("theme-navigation.js"), false);
  const activateBlock = worker.slice(
    worker.indexOf('self.addEventListener("activate"'),
    worker.indexOf('self.addEventListener("fetch"'),
  );
  assert.equal(activateBlock.includes("client.navigate"), false);
});

test("mobile shared header always shows the Digital Card Binder brand name", async () => {
  const css = await source("styles.css");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?[.]site-header > [.]brand [.]brand-copy \{[\s\S]*?display: block !important/);
  assert.match(css, /[.]site-header > [.]brand [.]brand-copy strong \{[\s\S]*?visibility: visible !important/);
  assert.match(css, /max-width: 126px/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*?max-width: 110px/);
});

test("shared navigation detects stale cached HTML and reloads with the latest build", async () => {
  const navigation = await source("collector-nav.js");
  const siteVersion = JSON.parse(await source("site-version.json"));
  assert.match(siteVersion.version, /^b-[0-9a-f]{12}$/);
  assert.match(navigation, /SITE_BUILD_VERSION = "b-[0-9a-f]{12}"/);
  assert.match(navigation, /site-version[.]json/);
  assert.match(navigation, /cache: "no-store"/);
  assert.match(navigation, /searchParams[.]set\("build", remoteVersion\)/);
  assert.match(navigation, /window[.]location[.]replace\(url[.]href\)/);
});

test("desktop keeps four or three columns while phones use two or four", async () => {
  const navigation = await source("collector-nav.js");
  const commonCss = await source("styles.css");
  const collectorCss = await source("collector.css");
  const packCss = await source("packs.css");

  assert.equal(/@media \(min-width: 1500px\)[\s\S]*?[.]card-grid[\s\S]*?repeat\(5/.test(commonCss), false);
  assert.match(commonCss, /[.]card-grid \{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(packCss, /[.]promo-pack-grid \{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  for (const grid of ["card-grid", "pack-grid", "promo-pack-grid"]) {
    assert.match(collectorCss, new RegExp(`data-card-columns="4"[^}]*[.]${grid}`));
    assert.match(collectorCss, new RegExp(`data-card-columns="3"[^}]*[.]${grid}`));
    assert.match(collectorCss, new RegExp(`data-card-columns="2"[^}]*[.]${grid}`));
  }
  assert.match(navigation, /pokemonDexCardColumnsV1/);
  assert.match(navigation, /pokemonDexCompactCardColumnsV1/);
  assert.match(navigation, /pokemonDexMobileCardColumnsV1/);
  assert.match(navigation, /COMPACT_CARD_LAYOUT_QUERY = "\(max-width: 920px\)"/);
  assert.match(navigation, /MOBILE_CARD_LAYOUT_QUERY = "\(max-width: 690px\)"/);
  assert.match(navigation, /defaultColumns: "2"/);
  assert.match(navigation, /alternateColumns: "4"/);
  assert.match(navigation, /card-layout-options/);
  assert.match(navigation, /button[.]textContent = `[$][{]columns[}]열`/);
  assert.match(navigation, /compactCardLayoutMedia[.]addEventListener\("change", restoreLayout\)/);
  assert.match(navigation, /mobileCardLayoutMedia[.]addEventListener\("change", restoreLayout\)/);
  assert.match(navigation, /localStorage[.]setItem/);
  assert.match(
    collectorCss,
    /@media \(max-width: 690px\)[\s\S]*?data-card-columns="4"[\s\S]*?[.]pack-image[\s\S]*?calc\(100% - 8px\)/,
  );
  for (const [page] of Object.values(collectionPages)) {
    const html = await source(page);
    assert.match(html, /collector[.]css\?v=[0-9a-f]{12}/);
    assert.match(html, /collector-nav[.]js\?v=[0-9a-f]{12}/);
  }
});

test("mobile, compact, and desktop column choices restore independently", async () => {
  const layout = navigationLayoutContext(await source("collector-nav.js"), 390);

  assert.equal(layout.documentElement.dataset.cardColumns, "2");
  assert.equal(layout.buttons["2"].attributes.get("aria-pressed"), "true");
  assert.equal(layout.buttons["4"].attributes.get("aria-pressed"), "false");

  layout.buttons["4"].trigger("click");
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.equal(layout.stored.get("pokemonDexMobileCardColumnsV1"), "4");
  assert.equal(layout.buttons["4"].attributes.get("aria-pressed"), "true");

  layout.setViewportWidth(800);
  assert.equal(layout.documentElement.dataset.cardColumns, "2");
  assert.equal(layout.buttons["2"].attributes.get("aria-pressed"), "true");

  layout.buttons["4"].trigger("click");
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.equal(layout.stored.get("pokemonDexCompactCardColumnsV1"), "4");

  layout.setViewportWidth(1200);
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.equal(layout.buttons["2"].hidden, true);
  assert.equal(layout.buttons["3"].hidden, false);

  layout.buttons["3"].trigger("click");
  assert.equal(layout.documentElement.dataset.cardColumns, "3");
  assert.equal(layout.stored.get("pokemonDexCardColumnsV1"), "3");

  layout.setViewportWidth(390);
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.equal(layout.buttons["2"].hidden, false);
  assert.equal(layout.buttons["3"].hidden, true);
  assert.equal(layout.buttons["4"].attributes.get("aria-pressed"), "true");
});

test("signed-in visitors automatically repair stale public projections once", async () => {
  const navigation = await source("collector-nav.js");
  const publicSync = await source("collector-public-sync.js");

  assert.match(navigation, /PUBLIC_PROJECTION_REPAIR_VERSION = "projection-50k-v1"/);
  assert.match(navigation, /schedulePublicProjectionRepair/);
  assert.match(navigation, /CollectorPublicSync[?][.]syncCollectionWithRetry/);
  assert.match(navigation, /preferServer: true/);
  assert.match(navigation, /registry[.]COLLECTION_ORDER/);
  assert.match(navigation, /digitalCardBinderPublicProjectionRepairV1/);
  assert.match(publicSync, /getDocFromServer/);
  assert.match(publicSync, /preferServer: Boolean\(options[?][.]preferServer\)/);
});

test("public collector board reads only directory and existing public projections", async () => {
  const boardPage = await source("collectors.html");
  const boardClient = await source("collector-directory.js");
  const settingsClient = await source("collector-settings.js");
  assert.match(boardPage, /id="collector-directory-grid"/);
  assert.match(boardPage, /나만 보기 도감/);
  assert.equal(boardPage.includes("UNLISTED"), false);
  assert.match(boardClient, /publicCollectorDirectory/);
  assert.match(boardClient, /publicProfiles/);
  assert.match(boardClient, /"collections"/);
  assert.equal(boardClient.includes('"users"'), false);
  assert.equal(boardClient.includes("ownerUid"), false);
  assert.equal(boardClient.includes("email"), false);
  assert.match(boardClient, /publicProjectionMetrics/);
  assert.match(settingsClient, /syncDirectoryInBatch/);
  assert.match(settingsClient, /visibility === "public"/);
});

test("public projection adapters discard private card and people details", async () => {
  const moduleSource = await source("collector-public-view.js");
  const { context } = publicViewContext("?collector=abc123def456");
  vm.runInContext(moduleSource, context);
  const view = context.window.CollectorPublicView;

  const overrides = view.projectionOverrides({
    ownedKeys: ["1"],
    note: "private",
    quantity: 9,
    tradeStatus: "sale",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(overrides)), { "1": { owned: true } });
  assert.deepEqual(
    JSON.parse(JSON.stringify(view.projectionPackDocument({
      ownedKeys: ["sv1S"],
      promoOwnedKeys: ["promo-1"],
      customPromoPacks: [{ note: "private" }],
    }))),
    {
      baseMode: "empty",
      ownedCodes: ["sv1S"],
      ownedPromoPackIds: ["promo-1"],
      customPromoPacks: [],
    },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(view.projectionPeopleDocument({
      ownedKeys: ["red"],
      peopleOverrides: { red: { imageUrl: "private" } },
    }))),
    {
      baseMode: "empty",
      peopleOwned: { red: true },
      peopleOverrides: {},
    },
  );
});

test("public read-only data waits for its projection instead of rendering an empty fallback", async () => {
  const moduleSource = await source("collector-public-view.js");
  const { context } = publicViewContext("?collector=abc123def456");
  vm.runInContext(moduleSource, context);

  let releaseProjection;
  const projectionReady = new Promise((resolve) => {
    releaseProjection = resolve;
  });
  let rendered = false;
  const waiting = context.window.CollectorPublicView
    .waitForDataReady(projectionReady, 1)
    .then(() => {
      rendered = true;
    });

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(rendered, false, "public cards must not render before projection data");
  releaseProjection();
  await waiting;
  assert.equal(rendered, true);

  for (const manager of [
    "firebase-collection-manager.js",
    "firebase-people-manager.js",
  ]) {
    const managerSource = await source(manager);
    assert.match(
      managerSource,
      /CollectorPublicView[.]waitForDataReady\(firebaseReady\)/,
      `${manager}: public projection wait missing`,
    );
  }
});


test("detached image probes retry the original source after a CDN miss", async () => {
  const lookup = await source("core/catalog/card-lookup.js");
  assert.match(
    lookup,
    /DigitalCardBinderImageCdn[?][.]restoreOriginal[?][.][(]/,
  );
  for (const file of [
    "firebase-collection-manager.js",
    "firebase-people-manager.js",
    "world.js",
  ]) {
    const client = await source(file);
    assert.match(
      client,
      /cardLookup[.](?:imageLoads|findRepresentativeCard)/,
      `${file}: shared card lookup core missing`,
    );
  }

  const nationalPage = await source("national.html");
  const peoplePage = await source("people.html");
  const worldPage = await source("world.html");
  assert.match(nationalPage, /firebase-collection-manager[.]js[?]v=[0-9a-f]{12}/);
  assert.match(peoplePage, /firebase-people-manager[.]js[?]v=[0-9a-f]{12}/);
  assert.match(worldPage, /world[.]js[?]v=[0-9a-f]{12}/);
  for (const page of [nationalPage, peoplePage, worldPage]) {
    assert.ok(
      page.indexOf("core/catalog/card-lookup.js") <
        Math.max(
          page.indexOf("firebase-collection-manager.js"),
          page.indexOf("firebase-people-manager.js"),
          page.indexOf("world.js"),
        ),
    );
  }
});

test("the signed-out guest fallback never wipes a public read-only projection", async () => {
  const guestClient = await source("guest-empty-dex.js");
  const page = await source("national.html");
  const guard = guestClient.indexOf(
    "if (window.CollectorPublicView?.requested) return response;",
  );
  const guestReset = guestClient.indexOf(
    "const data = makeGuestData(await response.clone().json());",
  );

  assert.ok(guard >= 0, "public projection guard missing");
  assert.ok(guard < guestReset, "public projection must be preserved before guest reset");
  assert.match(
    guestClient,
    /const apply = \(\) => \{\s*if \(window[.]CollectorPublicView[?][.]requested\) return;/,
  );
  assert.match(page, /guest-empty-dex[.]js[?]v=[0-9a-f]{12}/);
});

test("public collection loads never request a private users path", async () => {
  const moduleSource = await source("collector-public-view.js");
  const profile = { nickname: "드기", profileCompleted: true };
  const projection = {
    schemaVersion: 1,
    publicId: "abc123def456",
    collectionId: "national",
    ownedKeys: ["1"],
  };

  const { context, addedClasses } = publicViewContext("?collector=abc123def456");
  vm.runInContext(moduleSource, context);
  const reads = [];
  const firestoreModule = {
    doc: (db, ...parts) => ({ path: parts.join("/") }),
    getDoc: async (reference) => {
      reads.push(reference.path);
      if (reference.path === "publicProfiles/abc123def456") {
        return { exists: () => true, data: () => profile };
      }
      if (reference.path === "publicProfiles/abc123def456/collections/national") {
        return { exists: () => true, data: () => projection };
      }
      return { exists: () => false, data: () => undefined };
    },
  };
  await context.window.CollectorPublicView.loadProjection(
    {},
    firestoreModule,
    "national",
  );
  assert.equal(reads.some((path) => path.startsWith("users/")), false);
  assert.equal(addedClasses.has("collector-public-readonly"), true);
});

test("link-only sharing and link-copy controls are removed", async () => {
  const publicClient = await source("collector-public-view.js");
  const settingsClient = await source("collector-settings.js");
  const settingsPage = await source("collector-settings.html");
  const publicProfilePage = await source("collector.html");
  const publicProfileClient = await source("collector.js");
  const publicSync = await source("collector-public-sync.js");
  const customLoader = await source("custom-loader.js");
  const customPublic = await source("custom-public.js");
  const customSync = await source("custom-sync.js");
  const customSettings = await source("custom-granular-settings.js");

  assert.equal(publicClient.includes("window.location.hash"), false);
  assert.equal(publicClient.includes("sharedCollections"), false);
  assert.equal(publicClient.includes("requestedShareId"), false);
  assert.equal(publicSync.includes("sharedProjectionRef"), false);
  assert.equal(customLoader.includes("window.location.hash"), false);
  assert.equal(customPublic.includes("sharedCollections"), false);
  assert.equal(customSync.includes("custom-share-button"), false);
  assert.equal(customSync.includes("navigator.clipboard"), false);
  assert.equal(settingsClient.includes("unlisted"), false);
  assert.equal(settingsClient.includes("data-copy-share"), false);
  assert.match(settingsClient, /copyPublicBinderLink/);
  assert.match(settingsClient, /navigator[.]clipboard[.]writeText/);
  assert.equal(settingsPage.includes('id="collector-profile-copy"'), false);
  assert.equal(publicProfilePage.includes("collector-public-share"), false);
  assert.equal(publicProfileClient.includes("navigator.clipboard"), false);
  assert.equal(settingsClient.includes('<option value="private">나만 보기</option>'), false);
  assert.equal(settingsClient.includes('<option value="public">공개</option>'), false);
  assert.match(settingsClient, /collector-public-switch/);
  assert.match(settingsClient, /data-setting="visibility"/);
  assert.match(settingsPage, /id="binder-settings"/);
  assert.match(settingsPage, /id="collector-binder-settings-grid"/);
  assert.match(settingsClient, /function loadBinderSettings/);
  assert.match(settingsClient, /function renderBinderSettings/);
  assert.match(settingsClient, /function changeBinderVisibility/);
  assert.match(settingsClient, /function deletePublicBinderProjection/);
  assert.match(settingsClient, /publicBinderIds/);
  assert.match(settingsClient, /hasPublicContent/);
  assert.match(settingsClient, /function publicBinderUrl/);
  assert.match(settingsClient, /function copyPublicBinderLink/);
  assert.match(settingsClient, /공개 페이지 보기/);
  assert.match(settingsClient, /링크 복사/);
  assert.match(settingsClient, /공개 중/);
  assert.match(settingsPage, /바인더의 공개 여부는 여기서만 관리/);
  assert.match(settingsClient, /visibility[.]checked/);
  assert.equal(customSettings.includes('<option value="private">나만 보기</option>'), false);
  assert.equal(customSettings.includes('<option value="public">공개</option>'), false);
  assert.match(customSettings, /custom-granular-switch/);
  assert.match(customSettings, /toggle[.]checked/);
});

test("collection public visibility uses simple on-off switches while preserving stored public-private compatibility", async () => {
  const settingsClient = await source("collector-settings.js");
  const settingsPage = await source("collector-settings.html");
  const collectorCss = await source("collector.css");

  assert.match(settingsClient, /<span>공개 프로필에 표시<[/]span>/);
  assert.match(settingsClient, /visibility: card[.]querySelector\('\[data-setting="visibility"\]'\)[.]checked[\s\S]*?\? "public"[\s\S]*?: "private"/);
  assert.match(settingsPage, /보여줄 도감만 켜기/);
  assert.equal(settingsPage.includes("나만 보기</span>"), false);
  assert.match(collectorCss, /[.]collector-public-switch/);
});

test("the public profile client has no private user-document read route", async () => {
  const client = await source("collector.js");
  assert.equal(client.includes('"users"'), false);
  assert.equal(client.includes("ownerUid"), false);
  assert.equal(client.includes("email"), false);
  assert.match(client, /publicProfiles/);
  assert.match(client, /publicProjectionMetrics/);
  assert.match(client, /code === "permission-denied"/);
  assert.match(client, /showError\(publicProfileErrorMessage\(error\)\)/);
  assert.equal(client.includes("showError(error.message"), false);
});

test("public profile summaries cache-bust the current catalog metrics", async () => {
  const profilePage = await source("collector.html");
  const directoryPage = await source("collectors.html");

  assert.match(profilePage, /collector-collection-registry[.]js[?]v=[0-9a-f]{12}/);
  assert.match(profilePage, /collector[.]js[?]v=[0-9a-f]{12}/);
  assert.match(directoryPage, /collector-collection-registry[.]js[?]v=[0-9a-f]{12}/);
  assert.match(directoryPage, /collector-directory[.]js[?]v=[0-9a-f]{12}/);
});

test("the free profile path has no Firebase Storage or image URL dependency", async () => {
  const settingsClient = await source("collector-settings.js");
  const settingsPage = await source("collector-settings.html");
  const publicPage = await source("collector.html");
  const firestoreRules = await source("firestore.rules");
  const firebaseConfig = await source("firebase.json");
  assert.equal(settingsClient.includes("firebase-storage.js"), false);
  assert.equal(settingsClient.includes("avatarUrl"), false);
  assert.equal(settingsPage.includes('type="file"'), false);
  assert.equal(publicPage.includes("collector-public-avatar\""), false);
  assert.equal(firestoreRules.includes("avatarUrl"), false);
  assert.equal(firestoreRules.includes("profileImageUrl"), false);
  assert.equal(JSON.parse(firebaseConfig).storage, undefined);
  assert.match(settingsPage, /닉네임 첫 글자/);
});

test("nickname creation and rename use server-backed Firestore transactions", async () => {
  const settingsClient = await source("collector-settings.js");
  assert.ok(
    [...settingsClient.matchAll(/runTransaction/g)].length >= 2,
    "profile creation and rename must both use transactions",
  );
  assert.match(settingsClient, /transaction[.]get\(nicknameRef\)/);
  assert.match(settingsClient, /transaction[.]get\(nextNicknameRef\)/);
});

test("owner Sheets writes also refresh an enabled public projection", async () => {
  const ownerSync = await source("owner-sheets-sync.js");
  const dashboard = await source("index.html");
  assert.match(ownerSync, /CollectorPublicSync[?][.]syncCollectionWithRetry/);
  assert.ok(
    [...ownerSync.matchAll(/projectionCategories[.]push\(category\)/g)].length >= 2,
    "pack and card-catalog Sheet writes must both refresh projections",
  );
  assert.match(ownerSync, /projectionCategories[.]map/);
  assert.match(ownerSync, /projectionCategories[.]includes\("pack"\)/);
  assert.match(ownerSync, /getIdToken\(user, true\)/);
  assert.match(ownerSync, /권한을 확인하지 못했습니다/);
  assert.ok(
    dashboard.indexOf("collector-public-sync.js") <
      dashboard.indexOf("owner-sheets-sync.js"),
    "dashboard must load projection sync before owner Sheets sync",
  );
});


test("Android owner Sheets uses native authorization while browsers keep popup flow", async () => {
  const ownerSync = await source("owner-sheets-sync.js");
  const androidActivity = await source(
    "android-app/app/src/main/java/io/github/digitalcardbinder/app/MainActivity.java",
  );
  const androidGradle = await source("android-app/app/build.gradle");
  const dashboard = await source("index.html");

  assert.match(ownerSync, /function isAndroidApp[(][)]/);
  assert.match(ownerSync, /requestNativeSheetsAuthorization/);
  assert.match(ownerSync, /DigitalCardBinderApp[.]startSheetsAuthorization[(][)]/);
  assert.match(ownerSync, /PokemonDexOwnerSheetsNativeResult/);
  assert.match(ownerSync, /native[/]update-required/);
  assert.match(ownerSync, /signInWithPopup/);

  assert.match(androidActivity, /AuthorizationRequest[.]builder[(][)]/);
  assert.match(androidActivity, /new Scope[(]SHEETS_SCOPE[)]/);
  assert.match(androidActivity, /getAccessToken[(][)]/);
  assert.match(androidActivity, /PokemonDexOwnerSheetsNativeResult/);
  assert.match(androidActivity, /HOME_HOST[.]equalsIgnoreCase[(]current[.]getHost[(][)][)]/);
  assert.match(androidGradle, /play-services-auth:22[.]0[.]0/);
  assert.match(androidGradle, /versionCode 15/);
  assert.match(dashboard, /owner-sheets-sync[.]js[?]v=[0-9a-f]{12}/);
});


test("trainer Pokemon filter includes an explicit all-cards option and neutral scene heading", async () => {
  const page = await source("trainer-pokemon.html");
  const client = await source("trainer-pokemon.js");
  assert.match(client, /TP_ALL_VALUE = "__all__"/);
  assert.match(client, /option[.]textContent = `전체 · \$\{allCards\(\)[.]length\}장`/);
  assert.match(client, /if \(tpSelected === TP_ALL_VALUE\) return allCards\(\)/);
  assert.match(page, /인물과 포켓몬이 함께한 카드/);
  assert.equal(page.includes("사람과 포켓몬이 함께한 카드"), false);
});

test("approved collection preview styling covers public collection flows without data writes", async () => {
  const css = await source("collection-preview.css");
  const client = await source("collection-preview.js");
  const pages = [
    "national.html",
    "series.html",
    "ar.html",
    "packs.html",
    "pokemon-collections.html",
    "artists.html",
    "people.html",
    "trainer-pokemon.html",
    "fossil.html",
    "world.html",
    "custom.html",
    "collector-settings.html",
    "pokemon-search.html",
    "collectors.html",
    "collector.html",
    "news.html",
  ];

  for (const pageName of pages) {
    const page = await source(pageName);
    assert.match(page, /collection-preview[.]css[?]v=[0-9a-f]{12}/, pageName);
    assert.match(page, /collection-preview[.]js[?]v=[0-9a-f]{12}/, pageName);
  }

  assert.match(css, /[.]collection-mobile-tabs/);
  assert.match(css, /@media \(max-width: 690px\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(client, /모바일 주요 메뉴/);
  assert.match(client, /도감 메뉴 열기/);
  assert.doesNotMatch(client, /firebase|firestore|ownedCodes|localStorage/i);
});

test("stage 5 mobile precision preserves touch targets and narrow-screen grids", async () => {
  const collectionCss = await source("collection-preview.css");
  const homeCss = await source("home-preview.css");

  assert.match(collectionCss, /[.]collection-mobile-menu-button \{[\s\S]*?min-height: 44px/);
  assert.match(collectionCss, /[.]pill-group button \{\s*min-width: 44px/);
  assert.match(
    collectionCss,
    /body[.]collector-collection-page :is\([\s\S]*?[.]segmented-control[\s\S]*?\) button \{\s*min-height: 44px/,
  );
  assert.match(
    homeCss,
    /@media \(max-width: 340px\) \{[\s\S]*?[.]home-feature-grid \{\s*grid-template-columns: minmax\(0, 1fr\)/,
  );
  assert.match(homeCss, /[.]home-binder-page/);
  assert.match(homeCss, /[.]home-binder-pocket img/);
  assert.match(homeCss, /[.]home-studio-window/);
  assert.match(homeCss, /[.]home-studio-canvas/);
});

test("series era filters use representative cards without changing filter keys", async () => {
  const page = await source("series.html");
  const css = await source("series-era-thumbnails.css");
  const eraKeys = ["ALL", "ORIGIN", "ADV", "DP", "BW", "XY", "SM", "S", "SV", "M"];

  assert.match(page, /series-era-thumbnails[.]css[?]v=[0-9a-f]{12}/);
  assert.equal([...page.matchAll(/class="era-card-thumb"/g)].length, eraKeys.length);
  for (const era of eraKeys) {
    assert.match(page, new RegExp(`data-era="${era}"`));
  }
  assert.match(page, /data-card-tier="SAR"/);
  assert.match(page, /data-card-tier="MUR"/);
  assert.match(css, /[.]era-card-thumb img/);
  assert.match(css, /aspect-ratio: 5 \/ 7/);
  assert.match(css, /object-fit: contain/);
});

test("current dashboard is the only production shell and carries the latest nav", async () => {
  const current = await source("index.html");
  assert.match(current, /주요 도감/);
  assert.match(current, /AR 전종도감/);
  assert.match(current, /팩 전종수집/);
  assert.match(current, /커뮤니티/);
  assert.equal(current.includes("도감 갤러리"), false);
  assert.equal(current.includes("<strong>팩 도감</strong>"), false);
  assert.match(current, /collector-nav[.]js[?]v=[0-9a-f]{12}/);
  assert.doesNotMatch(current, /assets\/home\/custom-dex-binder[.]svg/);
  assert.doesNotMatch(current, /assets\/home\/binder-studio[.]svg/);
  assert.match(current, /home-feature-scene--binder/);
  assert.match(current, /home-binder-page/);
  assert.match(current, /home-binder-pocket/);
  assert.match(current, /home-feature-scene--studio/);
  assert.match(current, /home-studio-window/);
  assert.match(current, /home-studio-canvas/);
});


test("Binder Studio custom editor keeps saved work isolated from collection state", async () => {
  const page = await source("studio.html");
  const editor = await source("studio-custom.js");
  const customPage = await source("custom.html");
  const library = await source("custom-binder-library.js");
  const help = await source("studio-help.js");
  const visualMatcher = await source("card-visual-matcher.js");
  const photoScanner = await source("binder-photo-scanner.js");

  assert.match(page, /id="studio-custom-page-list"/);
  assert.match(page, /id="studio-custom-page-add"/);
  assert.match(page, /id="studio-custom-page-duplicate"/);
  assert.match(page, /id="studio-custom-page-left"/);
  assert.match(page, /id="studio-custom-page-right"/);
  assert.match(page, /id="studio-custom-page-delete"/);
  assert.match(page, /사진으로 바인더 가져오기/);
  assert.match(page, /id="studio-custom-photo-camera"/);
  assert.match(page, /id="studio-custom-photo-album"/);
  assert.match(page, /id="studio-custom-photo-status"/);
  assert.match(page, /id="studio-custom-photo-recognize"/);
  assert.match(page, /id="studio-custom-photo-recognition-results"/);
  assert.match(page, /data-studio-help="photo"/);
  assert.match(page, /card-visual-matcher[.]js/);
  assert.match(page, /binder-photo-scanner[.]js/);
  assert.match(page, /id="studio-custom-slot-layer"/);
  assert.match(page, /id="studio-custom-art-file"/);
  assert.match(page, /id="studio-custom-slot-select-toggle"/);
  assert.match(page, /id="studio-custom-slot-select-all"/);
  assert.match(page, /id="studio-custom-art-apply"/);
  assert.match(page, /id="studio-custom-slot-clear"/);
  for (const grid of ["2x2", "3x3", "3x4", "4x3", "4x4", "4x5", "5x4"]) {
    assert.match(page, new RegExp(`value="${grid}"`));
  }
  assert.match(page, /id="studio-custom-card-search"/);
  assert.match(page, /id="studio-custom-card-layer"/);
  assert.match(page, /data-custom-action="snap"/);
  assert.match(page, /id="studio-custom-linked-dex"/);
  assert.match(page, /id="studio-custom-linked-dex-status"/);
  assert.match(page, /name="studio-custom-missing-display"/);
  assert.match(page, /id="studio-custom-save-button"/);
  assert.doesNotMatch(page, /id="studio-custom-publish-button"/);
  assert.doesNotMatch(page, /id="studio-custom-unpublish-button"/);
  assert.doesNotMatch(page, /id="studio-custom-share-url"/);
  assert.doesNotMatch(page, /id="studio-custom-copy-link"/);
  assert.match(page, /공개 여부는/);
  assert.match(page, /collector-settings[.]html#binder-settings/);
  assert.match(page, /id="studio-help-dialog"/);
  assert.match(page, /data-studio-help="1"/);
  assert.match(page, /data-studio-help="4"/);
  assert.match(page, /data-studio-help="8"/);
  assert.doesNotMatch(page, /data-studio-help="9"/);
  assert.equal((page.match(/data-studio-help="/g) || []).length, 9);
  assert.equal((page.match(/studio-step-badge is-required/g) || []).length, 3);
  assert.equal((page.match(/studio-step-badge is-optional/g) || []).length, 5);
  assert.match(page, /바인더 페이지 <span class="studio-step-badge is-required">필수<\/span>/);
  assert.match(page, /확장 이미지 배치 <span class="studio-step-badge is-optional">선택<\/span>/);
  assert.match(page, /확장 이미지 배치/);
  assert.match(page, /id="studio-custom-print-button"/);
  assert.match(page, /A4 한 장 맞춤/);
  assert.match(page, /실제 카드 63 × 88 mm/);
  assert.match(page, /실제 슬리브 65 × 90 mm/);
  assert.match(page, /name="studio-custom-print-size"/);
  assert.match(page, /저장한 커스텀 바인더/);

  assert.match(help, /const HELP =/);
  assert.match(help, /"1": \{/);
  assert.match(help, /"8": \{/);
  assert.match(help, /"photo": \{/);
  assert.match(help, /카드 자동인식/);
  assert.doesNotMatch(help, /"9": \{/);
  assert.doesNotMatch(help, /공개 · 공유/);
  assert.match(help, /showModal/);
  assert.match(help, /확장 이미지 배치/);
  assert.match(editor, /catalogService[?][.]series/);
  assert.match(editor, /identityService[?][.]cardIdentity/);
  assert.match(editor, /function addPage/);
  assert.match(editor, /function duplicatePage/);
  assert.match(editor, /function deletePage/);
  assert.match(editor, /function movePage/);
  assert.match(editor, /function switchPage/);
  assert.match(editor, /function normalizeSlots/);
  assert.match(editor, /function loadCustomDexes/);
  assert.match(editor, /function loadPublicProfile/);
  assert.match(editor, /function publishCurrentBinder/);
  assert.match(editor, /저장 후 공개하기/);
  assert.match(editor, /params[.]get\("publish"\) === "1"/);
  assert.match(editor, /params[.]get\("return"\) === "settings"/);
  assert.match(editor, /function removePublicBinderProjection/);
  assert.match(editor, /function renderPublicPageSnapshot/);
  assert.match(editor, /function writePublicBlobChunks/);
  assert.match(editor, /function reconcilePublicDirectory/);
  assert.match(editor, /"publicProfiles"/);
  assert.match(editor, /"binders"/);
  assert.match(editor, /"publicCollectorDirectory"/);
  assert.match(editor, /PUBLIC_PREVIEW_PX_PER_MM = 4/);
  assert.match(editor, /function ownershipForCard/);
  assert.match(editor, /function binderOwnershipStats/);
  assert.match(editor, /customDexKey/);
  assert.match(editor, /linkedDexId: state[.]linkedDexId/);
  assert.match(editor, /missingCardDisplay: state[.]missingCardDisplay/);
  assert.match(editor, /function importBinderPhoto/);
  assert.match(editor, /function recognizeImportedPhotoCards/);
  assert.match(editor, /function renderPhotoRecognitionReview/);
  assert.match(editor, /function replaceSlotWithCard/);
  assert.match(editor, /root[.]visualMatcher/);
  assert.match(editor, /rawCode: rawCustomCode/);
  assert.match(visualMatcher, /function rankImageCrop/);
  assert.match(visualMatcher, /function confident/);
  assert.match(visualMatcher, /card-visual-fingerprints[.]json/);
  assert.match(editor, /function normalizeBinderPhoto/);
  assert.match(editor, /photoScanner/);
  assert.match(editor, /scanMode/);
  assert.match(editor, /네 모서리·기울기·원근 보정 완료/);
  assert.match(photoScanner, /function detectPage/);
  assert.match(photoScanner, /function warpPerspective/);
  assert.match(photoScanner, /function unitSquareToQuad/);
  assert.match(photoScanner, /function validCorners/);
  assert.match(photoScanner, /function edit/);
  assert.match(photoScanner, /imageOrientation: "from-image"/);
  assert.match(photoScanner, /setPointerCapture/);
  assert.match(page, /id="studio-scan-dialog"/);
  assert.equal((page.match(/data-scan-corner=/g) || []).length, 4);
  assert.match(page, /data-scan-grid aria-describedby="studio-scan-grid-note"/);
  assert.match(page, /path data-scan-grid-lines/);
  assert.match(photoScanner, /function detectPocketGrid/);
  assert.match(photoScanner, /gridSelect[.]addEventListener\("change"/);
  assert.match(photoScanner, /confidence, grid/);
  assert.match(editor, /scanResult[.]grid[?][.]cols/);
  assert.match(editor, /scanGridInput[.]checked = true/);
  assert.doesNotMatch(page, /빠른 시작|빠른 가져오기/);
  assert.match(photoScanner, /mode: "perspective"/);
  assert.doesNotMatch(editor, /사진은 최대 25MB/);
  assert.doesNotMatch(editor, /최적화한 뒤에도 용량이 큽니다/);
  assert.match(editor, /targetBytes = 8[.]5 \* 1024 \* 1024/);
  assert.match(editor, /while \(blob[.]size > targetBytes/);
  assert.match(editor, /originalSize: Number\(file[.]size\)/);
  assert.match(editor, /currentPageHasSlotContent/);
  assert.match(editor, /photoCameraInput[?][.]addEventListener/);
  assert.match(editor, /photoAlbumInput[?][.]addEventListener/);
  assert.match(editor, /function loadArtFile/);
  assert.match(editor, /function applyArtToSelectedSlots/);
  assert.match(editor, /function movePlacementToSlot/);
  assert.match(editor, /function applyCropStyle/);
  assert.match(editor, /images: \(page[.]images \|\| \[\]\)[.]map\(persistedImageSource\)/);
  assert.match(editor, /studio-custom-print-image-tile/);
  assert.match(editor, /type: "empty"/);
  assert.match(editor, /type: "card"/);
  assert.match(editor, /type === "image"/);
  assert.match(editor, /pageOrder: state[.]pages[.]map/);
  assert.match(editor, /customBinderEditor/);
  assert.match(editor, /getDraft: draftSnapshot/);
  assert.match(editor, /kind: "custom-binder-layout"/);
  assert.match(editor, /CARD_WIDTH_MM = 63/);
  assert.match(editor, /CARD_HEIGHT_MM = 88/);
  assert.match(editor, /canvasWidthMm: grid[.]cols \* CARD_WIDTH_MM/);
  assert.match(editor, /canvasHeightMm: grid[.]rows \* CARD_HEIGHT_MM/);
  assert.match(editor, /"customBinders"/);
  assert.match(editor, /"chunks"/);
  assert.match(editor, /Bytes[.]fromUint8Array/);
  assert.match(editor, /function customPrintPlan/);
  assert.match(editor, /function customPrintPlanForGrid/);
  assert.match(editor, /function allCustomPrintPlans/);
  assert.match(editor, /function prepareAllPagesForPrint/);
  assert.match(editor, /dataset[.]binderPage/);
  assert.match(editor, /plans[.]forEach/);
  assert.match(editor, /selectedCustomPrintMode/);
  assert.match(editor, /SLEEVE_WIDTH_MM = 65/);
  assert.match(editor, /SLEEVE_HEIGHT_MM = 90/);
  assert.match(editor, /mode === "fit"/);
  assert.match(editor, /pageCols = Math[.]max\(1, Math[.]floor\(availableWidth \/ cellWidth\)\)/);
  assert.match(editor, /pageRows = Math[.]max\(1, Math[.]floor\(availableHeight \/ cellHeight\)\)/);
  assert.match(editor, /perPage = pageCols \* pageRows/);
  assert.match(editor, /pageCount: Math[.]ceil\(slotCount \/ perPage\)/);
  assert.match(editor, /studio-custom-print-cell/);
  assert.match(editor, /window[.]DigitalCardBinderApp[.]startPrint\(printTitle, false\)/);
  assert.match(editor, /CARD_WIDTH_MM/);
  assert.match(editor, /CARD_HEIGHT_MM/);
  const studioCss = await source("studio.css");
  assert.match(studioCss, /studio-custom-print-cell::after/);
  assert.match(studioCss, /border: [. ]*25mm solid #4b4b4b/);
  assert.match(studioCss, /studio-custom-print-sheet \{[\s\S]{0,320}page-break-inside: avoid !important/);
  assert.match(studioCss, /studio-custom-print-cell \{[\s\S]{0,320}break-inside: avoid !important/);
  assert.match(editor, /페이지별로 자동 분할하며 칸이 잘리지 않습니다/);
  assert.doesNotMatch(studioCss, /studio-custom-print-sheet \{[\s\S]{0,180}grid-template-columns: repeat\(3, 63mm\) !important/);
  assert.doesNotMatch(page, /data-custom-action="smaller"/);
  assert.doesNotMatch(page, /data-custom-action="larger"/);
  assert.doesNotMatch(editor, /function resizeSelected/);
  assert.match(editor, /"pokemonCollectionsDex"/);
  assert.match(editor, /const snapshot = await firestoreModule[.]getDoc\(reference\)/);
  assert.doesNotMatch(editor, /customDexes:\s*state[.]customDexes/);

  assert.match(customPage, /id="custom-binders"/);
  assert.match(customPage, /custom-binder-library[.]js[?]v=/);
  assert.match(library, /"customBinders"/);
  assert.match(library, /customDexTitles/);
  assert.match(library, /linkedDexId/);
  assert.match(library, /pokemonCollectionsDex/);
  assert.doesNotMatch(library, /setDoc[(]|updateDoc[(]|deleteDoc[(]/);

  const publicPage = await source("binder.html");
  const publicClient = await source("binder-public.js");
  const publicCss = await source("binder-public.css");
  const collectorPage = await source("collector.html");
  const collectorClient = await source("collector.js");
  const directoryClient = await source("collector-directory.js");
  assert.match(publicPage, /id="binder-public-view"/);
  assert.match(publicPage, /id="binder-public-page-list"/);
  assert.match(publicPage, /id="binder-public-shell"/);
  assert.match(publicPage, /binder-public-pocket-grid/);
  assert.match(publicClient, /"publicProfiles"/);
  assert.match(publicClient, /"binders"/);
  assert.match(publicClient, /function pageBlob/);
  assert.match(publicClient, /URL[.]createObjectURL/);
  assert.match(publicClient, /--binder-cols/);
  assert.match(publicClient, /--binder-rows/);
  assert.match(publicCss, /binder-public-canvas/);
  assert.match(publicCss, /binder-public-shell/);
  assert.match(publicCss, /binder-public-spine/);
  assert.match(publicCss, /binder-public-pocket-grid/);
  assert.match(collectorPage, /id="collector-public-binders"/);
  assert.match(collectorClient, /function normalizePublicBinder/);
  assert.match(collectorClient, /"binders"/);
  assert.match(directoryClient, /function normalizedBinder/);
  assert.match(directoryClient, /collector[.]binders/);
});
