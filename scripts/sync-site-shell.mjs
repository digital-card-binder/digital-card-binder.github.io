import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const navigation = Object.freeze([
  { href: "./", page: "index.html", icon: "홈", title: "통합 대시보드", subtitle: "모든 도감" },
  { href: "./pokemon-search.html", page: "pokemon-search.html", icon: "⌕", title: "포켓몬 검색", subtitle: "전체 카드 검색" },
  { section: "주요 도감" },
  { href: "./national.html", page: "national.html", icon: "01", title: "전국도감", subtitle: "1세대–9세대" },
  { href: "./series.html", page: "series.html", icon: "02", title: "시리즈 도감", subtitle: "ORIGIN · ADV · DP · BW · XY · SM · S · SV · M" },
  { href: "./ar.html", page: "ar.html", icon: "03", title: "AR 전종도감", subtitle: "SV · M · 510장" },
  { href: "./packs.html", page: "packs.html", icon: "04", title: "팩 전종수집", subtitle: "S · SV · M · 프로모" },
  { section: "테마 도감" },
  { href: "./pokemon-collections.html", page: "pokemon-collections.html", icon: "05", title: "포켓몬 컬렉션", subtitle: "67종 포켓몬" },
  { href: "./artists.html", page: "artists.html", icon: "06", title: "작가 도감", subtitle: "40명 작가" },
  { href: "./people.html", page: "people.html", icon: "07", title: "인물도감", subtitle: "인물 아카이브" },
  { href: "./trainer-pokemon.html", page: "trainer-pokemon.html", icon: "08", title: "트레이너 × 포켓몬", subtitle: "트레이너 × 포켓몬" },
  { href: "./fossil.html", page: "fossil.html", icon: "09", title: "화석 도감", subtitle: "화석 카드" },
  { href: "./world.html", page: "world.html", icon: "10", title: "월드탐험도감", subtitle: "4×3 스토리 바인더" },
  { href: "./custom.html", page: "custom.html", icon: "나", title: "나만의 도감", subtitle: "직접 만드는 도감" },
  { href: "./collectors.html", page: "collectors.html", icon: "모", title: "커뮤니티", subtitle: "공개 컬렉션" },
]);

const brand = `<a class="brand" href="./" aria-label="디지털 카드 바인더 홈">
        <span class="brand-mark" aria-hidden="true"><span></span></span>
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
    const current = active ? ' aria-current="page"' : "";
    lines.push(
      `          <a class="${linkClass}" href="${item.href}"${current}><span class="${iconClass}" aria-hidden="true">${item.icon}</span><span><strong>${item.title}</strong><small>${item.subtitle}</small></span></a>`,
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
