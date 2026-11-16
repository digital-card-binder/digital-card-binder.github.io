// 홈 대시보드가 진행률 계산에 쓰는 최소 카탈로그 요약을 생성한다.
// 기준은 collector-collection-registry.js 의 loadCatalog 결과이며, 요약은 같은 makeCatalog 로 다시 만들어진다.
// 사용: node scripts/build-dashboard-catalog-summary.mjs [--check]
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const target = path.join(root, "data/dashboard-catalog-summary.json");
const read = (relative) => readFileSync(path.join(root, relative.split("?")[0].replace(/^\.\//, "")), "utf8");

export async function loadRegistry() {
  const node = { value: "", textContent: "", disabled: false, dataset: {}, addEventListener() {} };
  const context = vm.createContext({
    URL, URLSearchParams, TextEncoder, crypto: webcrypto, setTimeout, clearTimeout,
    console: { warn() {}, error() {}, log() {} },
    document: { readyState: "loading", body: { dataset: {} }, addEventListener() {}, querySelector: () => node, querySelectorAll: () => [], getElementById: () => node },
    fetch: async (url) => ({ ok: true, status: 200, json: async () => JSON.parse(read(String(url))), text: async () => read(String(url)) }),
    localStorage: { getItem: () => null, setItem() {} },
    window: { location: { href: "https://digital-card-binder.github.io/", search: "", hash: "", pathname: "/" } },
  });
  context.window.window = context.window;
  for (const file of ["core/catalog/card-identity.js", "core/catalog/catalog-service.js", "core/account/firebase-account.js", "collector-collection-registry.js"]) {
    vm.runInContext(read(file), context, { filename: file });
  }
  return context.window.CollectorCollectionRegistry;
}

export async function buildSummary() {
  const registry = await loadRegistry();
  const collections = {};
  for (const id of Object.keys(registry.COLLECTIONS)) {
    const catalog = await registry.loadCatalog(id);
    const groupIndex = new Map();
    const groups = [];
    const items = catalog.items.map((item) => {
      if (!groupIndex.has(item.groupKey)) {
        groupIndex.set(item.groupKey, groups.length);
        groups.push([item.groupKey, item.groupName]);
      }
      const row = [item.key, groupIndex.get(item.groupKey), item.baselineOwned ? 1 : 0];
      if (item.compatibilityKeys?.length) row.push(item.compatibilityKeys);
      return row;
    });
    collections[id] = { groups, items };
  }
  return { format: "dashboard-catalog-summary-v1", collections };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const next = `${JSON.stringify(await buildSummary())}\n`;
  if (checkOnly) {
    const current = await readFile(target, "utf8").catch(() => "");
    if (current !== next) {
      console.error("data/dashboard-catalog-summary.json 이 최신이 아닙니다. npm run dashboard-summary:sync 를 실행하세요.");
      process.exit(1);
    }
    console.log("dashboard catalog summary is current");
  } else {
    await writeFile(target, next);
    console.log(`wrote data/dashboard-catalog-summary.json (${(next.length / 1024).toFixed(0)} KB)`);
  }
}
