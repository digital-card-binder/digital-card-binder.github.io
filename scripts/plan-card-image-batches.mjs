import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

const manifestPath = path.resolve(
  option("manifest", path.join(repositoryRoot, "tmp", "card-images", "manifest.json")),
);
const batchSize = Number.parseInt(option("batch-size", "600"), 10);
if (!Number.isInteger(batchSize) || batchSize < 100 || batchSize > 1_000) {
  throw new Error("--batch-size must be an integer from 100 to 1000");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const phases = [
  { key: "sv", label: "SV", project: "modern", root: "SV" },
  { key: "mega", label: "M (MEGA)", project: "modern", root: "MEGA" },
  { key: "s", label: "S", project: "modern", root: "S" },
  { key: "legacy", label: "remaining", project: "legacy", root: "" },
];

function buildMatrix(phase) {
  const count = manifest.assets.filter((asset) => {
    return asset.project === phase.project && (!phase.root || asset.root === phase.root);
  }).length;
  const include = [];
  for (let offset = 0, batch = 1; offset < count; offset += batchSize, batch += 1) {
    include.push({
      batch,
      offset,
      limit: Math.min(batchSize, count - offset),
    });
  }
  if (!include.length) {
    throw new Error(`No assets found for ${phase.label}`);
  }
  return { count, matrix: { include } };
}

const plan = {
  schemaVersion: 1,
  order: phases.map((phase) => phase.label),
  batchSize,
  phases: {},
};

for (const phase of phases) {
  plan.phases[phase.key] = { ...phase, ...buildMatrix(phase) };
}

if (process.argv.includes("--github-output")) {
  const outputPath = String(process.env.GITHUB_OUTPUT || "").trim();
  if (!outputPath) throw new Error("GITHUB_OUTPUT is required with --github-output");
  const lines = phases.map((phase) => {
    return `${phase.key}=${JSON.stringify(plan.phases[phase.key].matrix)}`;
  });
  lines.push(`summary=${JSON.stringify({
    order: plan.order,
    batchSize: plan.batchSize,
    counts: Object.fromEntries(
      phases.map((phase) => [phase.key, plan.phases[phase.key].count]),
    ),
  })}`);
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
}

console.log(JSON.stringify(plan));
