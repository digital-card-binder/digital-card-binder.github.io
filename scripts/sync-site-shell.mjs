import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const navigation = Object.freeze([
  { href: "./", page: "index.html", icon: "home", title: "통합 대시보드", subtitle: "모든 도감" },
  { href: "./pokemon-search.html", page: "pokemon-search.html", icon: "search", title: "카드 검색", subtitle: "통합 카드 검색" },
  { section: "주요 도감" },
  { href: "./national.html", page: "national.html", title: "전국도감", catalogId: "national" },
  { href: "./series.html", page: "series.html", title: "시리즈 도감", catalogId: "series" },
  { href: "./ar.html", page: "ar.html", title: "AR 전종도감", catalogId: "ar" },
  { href: "./packs.html", page: "packs.html", title: "팩 전종수집", catalogId: "pack" },
  { href: "./theme.html", page: "theme.html", title: "테마 도감", subtitle: "잠·연결·진화·밤·풍경·컬러" },
  { section: "테마 컬렉션" },
  { href: "./pokemon-collections.html", page: "pokemon-collections.html", title: "포켓몬 컬렉션", catalogId: "pokemon" },
  { href: "./artists.html", page: "artists.html", title: "작가 도감", catalogId: "artist" },
  { href: "./people.html", page: "people.html", title: "인물도감", catalogId: "people" },
  { href: "./trainer-pokemon.html", page: "trainer-pokemon.html", title: "트레이너 × 포켓몬", catalogId: "trainerPokemon" },
  { href: "./fossil.html", page: "fossil.html", title: "화석 도감", catalogId: "fossil" },
  { href: "./world.html", page: "world.html", title: "월드탐험도감", catalogId: "world" },
  { href: "./custom.html", page: "custom.html", icon: "binder", title: "나만의 도감", subtitle: "직접 만드는 도감" },
  { href: "./collectors.html", page: "collectors.html", icon: "community", title: "커뮤니티", subtitle: "공개 컬렉션", standalone: true },
]);

let catalogMetrics = Object.freeze({});

function formatCount(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
}

function navigationSubtitle(item) {
  if (!item.catalogId) return item.subtitle || "";
  const metric = catalogMetrics[item.catalogId] || {};
  const items = formatCount(metric.itemCount);
  const groups = formatCount(metric.groupCount);

  switch (item.catalogId) {
    case "national":
      return `${items}종 · 1–9세대`;
    case "series":
      return `${groups}세트 · ${items}장`;
    case "ar":
      return `${groups}세트 · ${items}장`;
    case "pack":
      return `${items}팩 · 프로모 ${formatCount(metric.promoItemCount)}`;
    case "pokemon":
      return `${groups}종 · ${items}장`;
    case "artist":
      return `${groups}명 · ${items}장`;
    case "people":
      return `${items}명`;
    case "trainerPokemon":
    case "fossil":
      return `${items}장`;
    case "world":
      return `${groups}세대 · ${items}장`;
    default:
      return `${items}`;
  }
}

async function loadCatalogMetrics() {
  const source = await readFile(
    path.join(root, "core/catalog/catalog-service.js"),
    "utf8",
  );
  const match = source.match(
    /\/\/ <catalog-metrics-generated>[\s\S]*?const CATALOG_METRICS = Object[.]freeze[(]([\s\S]*?)[)][;][\s\S]*?\/\/ <\/catalog-metrics-generated>/,
  );
  if (!match) throw new Error("Generated catalog metrics are missing.");
  return Object.freeze(JSON.parse(match[1]));
}

const brand = `<a class="brand" href="./" aria-label="디지털 카드 바인더 홈">
        <img class="brand-horizontal" src="./assets/brand/logo-horizontal.png" alt="디지털 카드 바인더" />
        <img class="brand-symbol" src="./assets/brand/logo-symbol.png" alt="" aria-hidden="true" />
        <span class="brand-copy"><strong>디지털 카드 바인더</strong></span>
      </a>`;

function activePageFor(filename) {
  return filename === "collector.html" ? "collectors.html" : filename;
}

function renderNavigation(filename) {
  const activePage = activePageFor(filename);
  const lines = ['<nav class="collection-nav">'];
  for (const item of navigation) {
    if (item.section) {
      lines.push(`          <div class="sidebar-label collection-nav-section">${item.section}</div>`);
      continue;
    }
    const active = item.page === activePage;
    const linkClass = active ? "collection-link is-active" : "collection-link";
    const iconClass = active ? "collection-icon collection-icon--red" : "collection-icon";
    const icon = item.icon ? `<span class="${iconClass} ui-icon ui-icon--${item.icon}" aria-hidden="true"></span>` : "";
    const current = active ? ' aria-current="page"' : "";
    const standalone = item.standalone ? ' data-nav-standalone="true"' : "";
    lines.push(
      `          <a class="${linkClass}" href="${item.href}"${current}${standalone}>${icon}<span><strong>${item.title}</strong><small>${navigationSubtitle(item)}</small></span></a>`,
    );
  }
  lines.push("        </nav>");
  return lines.join("\n");
}

function footerLink(href, label, filename, activeFilename = "") {
  const current = activeFilename && filename === activeFilename ? ' aria-current="page"' : "";
  return `              <a href="${href}"${current}>${label}</a>`;
}

function renderFooterMain(filename) {
  return `<div class="site-footer-main">
            <nav class="site-footer-links" aria-label="정책 및 문의">
${footerLink("./news.html", "새소식", filename, "news.html")}
${footerLink("./privacy.html", "개인정보처리방침", filename, "privacy.html")}
${footerLink("./terms.html", "이용약관", filename, "terms.html")}
              <a href="mailto:pokemon.dogam.support@gmail.com">문의·삭제 요청</a>
            </nav>
            <p>본 사이트는 개인이 운영하는 비공식 팬 사이트이며, 포켓몬 관련 권리자 및 ㈜포켓몬코리아와 제휴·승인·후원 관계가 없습니다.</p>
            <p>Pokémon 및 관련 명칭·상표·캐릭터, 카드 이미지와 카드 텍스트의 권리는 각 권리자에게 있습니다. ©<span data-current-year>2026</span> Pokémon. ©1995–<span data-current-year>2026</span> Nintendo/Creatures Inc./GAME FREAK inc.</p>
          </div>`;
}

function synchronize(filename, source) {
  let next = source;

  if (next.includes('class="site-header"')) {
    const brandPattern = /<a class="brand"[\s\S]*?<\/a>/;
    if (!brandPattern.test(next)) throw new Error(`${filename}: site header brand is missing`);
    next = next.replace(brandPattern, brand);
  }

  if (next.includes('class="collection-nav"')) {
    const navPattern = /<nav class="collection-nav">[\s\S]*?<\/nav>/;
    if (!navPattern.test(next)) throw new Error(`${filename}: collection navigation is malformed`);
    next = next.replace(navPattern, renderNavigation(filename));
    next = next.replace(/<aside class="sidebar"(?:\s+aria-label="[^"]*")?>/, '<aside class="sidebar" aria-label="도감 메뉴">');
  }

  if (next.includes('class="site-footer')) {
    const footerPattern = /<div class="site-footer-main">[\s\S]*?<\/div>/;
    if (!footerPattern.test(next)) throw new Error(`${filename}: site footer main block is malformed`);
    next = next.replace(footerPattern, renderFooterMain(filename));
  }

  return next;
}

async function main() {
  catalogMetrics = await loadCatalogMetrics();
  const htmlFiles = (await readdir(root))
    .filter((name) => name.endsWith(".html"))
    .sort();

  const stale = [];
  const expected = new Map();

  for (const filename of htmlFiles) {
    if (filename === "base-series.html") continue;
    const source = await readFile(path.join(root, filename), "utf8");
    const next = synchronize(filename, source);
    expected.set(filename, next);
    if (next !== source) stale.push(filename);
  }

  if (checkOnly) {
    if (stale.length) {
      console.error(`Shared site shell is out of sync: ${stale.join(", ")}`);
      console.error("Run: npm run shell:sync");
      process.exit(1);
    }
    console.log(`Shared site shell is synchronized across ${expected.size} pages.`);
    return;
  }

  for (const filename of stale) {
    await writeFile(path.join(root, filename), expected.get(filename));
  }
  console.log(stale.length
    ? `Synchronized shared site shell in ${stale.length} pages.`
    : `Shared site shell already synchronized across ${expected.size} pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
