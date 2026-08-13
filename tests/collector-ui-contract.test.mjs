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
  return {
    button: resultsBar.querySelector(".card-layout-toggle"),
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
    assert.match(html, /styles[.]css[?]v=20260813-3/, `${page}: shared styles version`);
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
  assert.match(dashboard, /news[.]js[?]v=20260813-1/);
  assert.match(dashboard, /href="[.]\/news[.]html">새소식<\/a>/);
  assert.match(newsPage, /id="news-list"[^>]*hidden/);
  assert.match(newsPage, /제목을 누르면 상세 내용을 볼 수 있습니다/);
  assert.match(newsClient, /items\[0\]/);
  assert.match(newsClient, /document[.]createElement\("details"\)/);
  assert.equal(newsClient.includes("firebase"), false);
  assert.match(newsCss, /[.]dashboard-news-strip \{/);
  assert.match(newsCss, /@media \(max-width: 690px\)/);

  assert.ok(newsData.items.length >= 10, "major update history should be populated");
  assert.equal(newsData.items[0].id, "series-s-sm-catalogs");
  assert.ok(newsData.items.every((item) => item.category === "업데이트" || item.category === "공지"));
  const serialized = JSON.stringify(newsData);
  assert.equal(serialized.includes("pokemon-dogam"), false);
  assert.equal(serialized.includes("digital-card-binder.github.io"), false);
  assert.equal(serialized.includes("새 주소"), false);
  assert.equal(serialized.includes("주소 이전"), false);
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
    ["S", "소드&amp;실드"],
    ["SV", "스칼렛&amp;바이올렛"],
    ["SM", "썬&amp;문"],
    ["M", "MEGA"],
  ]) {
    assert.match(page, new RegExp(`data-era="${era}"[^>]*>[\\s\\S]*?${label}`));
  }
  assert.match(client, /function seriesEra\(group\)/);
  assert.match(client, /groups[.]filter\(\(group\) => seriesEra\(group\) === activeEra\)/);
  assert.match(client, /group[.]displayName/);
  assert.match(css, /[.]catalog-era-tabs\{/);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.equal(page.includes("33 SETS"), false);
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

test("profile management leaves the sidebar and public collectors stays below dashboard", async () => {
  const navigation = await source("collector-nav.js");
  assert.match(navigation, /settings[?][.]remove\(\)/);
  assert.match(navigation, /dashboard[.]after\(directory\)/);
  assert.equal(navigation.includes('"도감 관리"'), false);
  assert.match(navigation, /공개 컬렉터/);
  for (const [page] of Object.values(collectionPages)) {
    assert.match(await source(page), /collector-nav[.]js\?v=20260813-4/);
  }
  const settingsPage = await source("collector-settings.html");
  assert.match(settingsPage, /collector-nav[.]js\?v=20260813-4/);
  assert.match(settingsPage, /<title>디지털 카드 바인더<\/title>/);
  assert.match(settingsPage, /<h1 id="page-title">내 프로필 관리<\/h1>/);
  for (const page of [settingsPage, await source("collectors.html")]) {
    const navStart = page.indexOf('<nav class="collection-nav">');
    const nav = page.slice(navStart, page.indexOf("</nav>", navStart));
    assert.equal(nav.includes('href="./collector-settings.html"'), false);
    assert.ok(nav.indexOf('href="./collectors.html"') > nav.indexOf('href="./"'));
    assert.ok(nav.indexOf('href="./national.html"') > nav.indexOf('href="./collectors.html"'));
  }
});

test("the signed-in account name opens profile management", async () => {
  const navigation = await source("collector-nav.js");
  const css = await source("collector.css");
  assert.match(navigation, /PROFILE_SETTINGS_HREF = "[.]\/collector-settings[.]html"/);
  assert.match(navigation, /status[.]tagName !== "A"/);
  assert.match(navigation, /panel[.]classList[.]contains\("is-account"\)/);
  assert.match(navigation, /status[.]href = PROFILE_SETTINGS_HREF/);
  assert.match(navigation, /내 프로필 관리 열기/);
  assert.match(css, /#firebase-auth-status[.]firebase-profile-link/);
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
  assert.match(navigation, /3열 크게 보기/);
  assert.match(navigation, /4열 기본 보기/);
  assert.match(navigation, /4열로 보기/);
  assert.match(navigation, /2열 기본 보기/);
  assert.match(navigation, /compactCardLayoutMedia[.]addEventListener\("change", restoreLayout\)/);
  assert.match(navigation, /mobileCardLayoutMedia[.]addEventListener\("change", restoreLayout\)/);
  assert.match(navigation, /localStorage[.]setItem/);
  assert.match(
    collectorCss,
    /@media \(max-width: 690px\)[\s\S]*?data-card-columns="4"[\s\S]*?[.]pack-image[\s\S]*?calc\(100% - 8px\)/,
  );
  for (const [page] of Object.values(collectionPages)) {
    const html = await source(page);
    assert.match(html, /collector[.]css\?v=20260813-4/);
    assert.match(html, /collector-nav[.]js\?v=20260813-4/);
  }
});

test("mobile, compact, and desktop column choices restore independently", async () => {
  const layout = navigationLayoutContext(await source("collector-nav.js"), 390);

  assert.equal(layout.documentElement.dataset.cardColumns, "2");
  assert.equal(layout.button.textContent, "▦ 4열");

  layout.button.trigger("click");
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.equal(layout.stored.get("pokemonDexMobileCardColumnsV1"), "4");
  assert.equal(layout.button.textContent, "▦ 2열");

  layout.setViewportWidth(800);
  assert.equal(layout.documentElement.dataset.cardColumns, "2");
  assert.match(layout.button.textContent, /4열로 보기/);

  layout.button.trigger("click");
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.equal(layout.stored.get("pokemonDexCompactCardColumnsV1"), "4");

  layout.setViewportWidth(1200);
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.match(layout.button.textContent, /3열 크게 보기/);

  layout.button.trigger("click");
  assert.equal(layout.documentElement.dataset.cardColumns, "3");
  assert.equal(layout.stored.get("pokemonDexCardColumnsV1"), "3");

  layout.setViewportWidth(390);
  assert.equal(layout.documentElement.dataset.cardColumns, "4");
  assert.equal(layout.button.textContent, "▦ 2열");
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
  assert.match(page, /guest-empty-dex[.]js[?]v=20260813-1/);
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
  assert.equal(settingsClient.includes("navigator.clipboard"), false);
  assert.equal(settingsPage.includes('id="collector-profile-copy"'), false);
  assert.equal(publicProfilePage.includes("collector-public-share"), false);
  assert.equal(publicProfileClient.includes("navigator.clipboard"), false);
  assert.match(settingsClient, /<option value="private">나만 보기<[/]option>/);
  assert.match(settingsClient, /<option value="public">공개<[/]option>/);
  assert.match(customSettings, /<option value="private">나만 보기<[/]option>/);
  assert.match(customSettings, /<option value="public">공개<[/]option>/);
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

  assert.match(profilePage, /collector-collection-registry[.]js[?]v=20260813-2/);
  assert.match(profilePage, /collector[.]js[?]v=20260813-4/);
  assert.match(directoryPage, /collector-collection-registry[.]js[?]v=20260813-2/);
  assert.match(directoryPage, /collector-directory[.]js[?]v=20260813-3/);
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
