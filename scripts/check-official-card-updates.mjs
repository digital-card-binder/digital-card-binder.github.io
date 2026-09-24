import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const reportUrl = new URL("data/update-watch.json", root);
const seriesUrl = new URL("data/series.json", root);
const legacyUrl = new URL("data/series-legacy.json", root);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value)
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s·._()"'「」『』\-–—:]/g, "");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractProductNames(html) {
  const text = decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\u300c/g, "「")
    .replace(/\\u300d/g, "」")
    .replace(/\\n/g, " ")
    .replace(/\\\"/g, '"')
    .replace(/\s+/g, " ");

  const names = new Set();
  const patterns = [
    /(?:강화\s*)?확장팩\s*[「"]([^」"]{2,60})[」"]/g,
    /하이클래스팩\s*[「"]([^」"]{2,60})[」"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const name = clean(match[1]);
      if (name) names.add(name);
    }
  }
  return [...names].slice(0, 20);
}

function localNames(groups) {
  const values = new Set();
  for (const group of groups) {
    [group?.title, group?.displayName, group?.name, ...(group?.sourceProducts || [])]
      .map(clean)
      .filter(Boolean)
      .forEach((value) => {
        values.add(normalize(value));
        const quoted = value.match(/[「"]([^」"]+)[」"]/);
        if (quoted) values.add(normalize(quoted[1]));
      });
  }
  return values;
}

const [reportRaw, seriesRaw, legacyRaw] = await Promise.all([
  readFile(reportUrl, "utf8"),
  readFile(seriesUrl, "utf8"),
  readFile(legacyUrl, "utf8"),
]);
const report = JSON.parse(reportRaw);
const local = localNames([...JSON.parse(seriesRaw), ...JSON.parse(legacyRaw)]);
for (const value of report.knownOfficialProducts || []) local.add(normalize(value));

const response = await fetch(report.officialUrl, {
  headers: {
    "User-Agent": "digital-card-binder-update-watch/1.0",
    "Accept": "text/html,application/xhtml+xml",
  },
});
if (!response.ok) throw new Error(`Pokemon Korea HTTP ${response.status}`);

const products = extractProductNames(await response.text());
if (!products.length) throw new Error("공식 제품 페이지에서 확장팩 이름을 확인하지 못했습니다.");

const detectedProducts = products.filter((name) => !local.has(normalize(name))).sort((a, b) => a.localeCompare(b, "ko"));
const previous = Array.isArray(report.detectedProducts) ? [...report.detectedProducts].sort((a, b) => a.localeCompare(b, "ko")) : [];
const status = detectedProducts.length ? "attention" : "clear";
const changed = status !== report.status || JSON.stringify(detectedProducts) !== JSON.stringify(previous);

if (!changed) {
  console.log(`Update watch: no catalog change (${products.length} official products checked).`);
  process.exit(0);
}

report.status = status;
report.detectedProducts = detectedProducts;
report.lastChangedAt = new Date().toISOString();
report.lastOfficialProducts = products;
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);
console.log(detectedProducts.length
  ? `Update watch: ${detectedProducts.length} product(s) need review: ${detectedProducts.join(", ")}`
  : "Update watch: previously detected products are now covered by the local catalog.");
