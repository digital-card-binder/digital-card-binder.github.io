import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = "https://digital-card-binder.github.io";
const output = "data/audits/ui-visual-20261014";
await mkdir(output, { recursive: true });

const sites = [
  ["national", "/national.html"],
  ["series", "/series.html?group=m6a"],
  ["ar", "/ar.html"],
  ["pack", "/packs.html"],
  ["pokemon", "/pokemon-collections.html"],
  ["artist", "/artists.html"],
  ["people", "/people.html"],
  ["trainerPokemon", "/trainer-pokemon.html"],
  ["fossil", "/fossil.html"],
  ["world", "/world.html"],
  ["artThemes", "/art-themes.html?theme=sleeping"],
];
const viewports = [
  ["desktop", { width: 1365, height: 900, deviceScaleFactor: 1, isMobile: false }],
  ["mobile", { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }],
];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const results = [];
for (const [screen, viewport] of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, isMobile: viewport.isMobile, hasTouch: !!viewport.hasTouch, reducedMotion: "reduce" });
  for (const [name, path] of sites) {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error).slice(0, 220)));
    try {
      const response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(name === "series" ? 5500 : 2400);
      if (name === "series" && !(await page.locator(".catalog-summary").isVisible().catch(() => false))) {
        const possible = page.locator('button[data-era="M"]');
        if (await possible.count()) {
          await possible.first().click().catch(() => {});
          await page.waitForTimeout(1000);
        }
      }
      let interaction = null;
      if (name === "pack" && screen === "mobile") {
        const picker = page.locator("#pack-era-mobile");
        if (await picker.count()) {
          await picker.selectOption("M");
          const megaCount = await page.locator("#pack-result-count").innerText().catch(() => "");
          await picker.selectOption("all");
          const allCount = await page.locator("#pack-result-count").innerText().catch(() => "");
          interaction = { packMobileSelect: true, megaCount, allCount, restoresAll: allCount === "151" };
        }
      }
      const info = await page.evaluate(() => {
        const rect = (selector) => {
          const node = document.querySelector(selector);
          if (!node) return null;
          const r = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            x: Math.round(r.x), y: Math.round(r.y + scrollY),
            width: Math.round(r.width), height: Math.round(r.height),
            visible: style.display !== "none" && style.visibility !== "hidden" && r.height > 0,
            position: style.position,
          };
        };
        const controls = document.querySelector(".collector-quick-controls");
        const toolCluster = document.querySelector(".results-bar-actions");
        const filter = document.querySelector(".collector-quick-filter-surface");
        const buttons = controls ? [...controls.querySelectorAll("button")].map(x => x.textContent.trim()) : [];
        const era = document.querySelector("#era-filters");
        const gap = filter && toolCluster ? Math.round(toolCluster.getBoundingClientRect().top - filter.getBoundingClientRect().bottom) : null;
        const header = document.querySelector(".site-header");
        return {
          path: location.pathname + location.search,
          title: document.title, viewport: innerWidth,
          catalogSelectedValue: document.querySelector("#catalog-select")?.value || null,
          selectedName: document.querySelector("#selected-name")?.textContent?.trim() || null,
          mobileEraSelectVisible: !!document.querySelector("#pack-era-mobile") && getComputedStyle(document.querySelector("#pack-era-mobile")).display !== "none",

          documentWidth: document.documentElement.scrollWidth,
          overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          bodyClass: document.body.className,
          quickStatusLabels: buttons,
          filter: rect(".collector-quick-filter-surface"),
          filterPanel: rect(".pack-filter-panel"),
          quick: rect(".collector-quick-controls"),
          search: rect('.collector-quick-filter-surface input[type="search"]'),
          selector: rect(".catalog-select"),
          resultBar: rect(".catalog-panel .results-bar"),
          toolCluster: rect(".results-bar-actions"),
          quickCollect: rect("#catalog-quick-collect"),
          quickCollectInResults: !!document.querySelector(".results-bar .results-bar-actions #catalog-quick-collect"),
          duplicatedLayoutGroups: document.querySelectorAll(".card-layout-options").length,
          layoutButtons: [...document.querySelectorAll(".card-layout-toggle")].filter(x => getComputedStyle(x).display !== "none").map(x => x.textContent.trim()),
          cardCount: document.querySelectorAll("#catalog-grid .pokemon-card, #pack-groups .pack-card, #card-grid .pokemon-card").length,
          filterToToolsGap: gap,
          headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
          hasEmptyFilterRow: !!document.querySelector(".catalog-filter-row:not(.collector-redundant-filter-row)")?.getBoundingClientRect().height && !!document.querySelector(".catalog-filter-row:not(.collector-redundant-filter-row) .collector-status-source"),
          eraButtonsRows: era ? [...new Set([...era.querySelectorAll("button")].map(x => Math.round(x.getBoundingClientRect().top)))].length : null,
          verticalScrollable: document.documentElement.scrollHeight > innerHeight,
        };
      });
      results.push({ screen, name, httpStatus: response?.status() ?? null, url: page.url(), ...info, interaction, errors });
      if (name === "series" || name === "pack" || name === "ar") {
        const target = page.locator(".collector-quick-controls");
        if (await target.count()) {
          await target.first().scrollIntoViewIfNeeded().catch(() => {});
        }
        await page.screenshot({ path: `${output}/${name}-${screen}.jpg`, type: "jpeg", quality: 68, animations: "disabled" });
      }
      console.log(screen, name, response?.status(), "overflow", info.overflowX, "toolbar", !!info.toolCluster, "gap", info.filterToToolsGap, "quick", info.quickCollectInResults);
    } catch (error) {
      results.push({ screen, name, failed: String(error).slice(0, 600), errors });
      console.error("FAILED", screen, name, error);
    } finally {
      await page.close();
    }
  }
  await context.close();
}
await browser.close();
const report = { created: new Date().toISOString(), base, results };
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + "\n");
const failures = results.filter(x => x.failed || (x.overflowX > 8) || (x.httpStatus !== 200));
console.log("Summary", results.length, "cases,", failures.length, "failures", JSON.stringify(failures.map(x=>({screen:x.screen,name:x.name,reason:x.failed,overflowX:x.overflowX,status:x.httpStatus}))));
