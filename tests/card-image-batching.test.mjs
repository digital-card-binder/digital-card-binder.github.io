import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");

function assets(project, root, count) {
  return Array.from({ length: count }, (_, index) => ({
    project,
    root,
    relativePath: `${root}/${String(index + 1).padStart(4, "0")}.webp`,
  }));
}

test("batch planner preserves SV, M, S, then remaining order", () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dcb-batch-plan-"));
  const manifestPath = path.join(temporaryDirectory, "manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      assets: [
        ...assets("modern", "SV", 1_201),
        ...assets("modern", "MEGA", 601),
        ...assets("modern", "S", 1),
        ...assets("legacy", "SM", 100),
      ],
    }),
  );

  try {
    const output = execFileSync(
      process.execPath,
      [
        path.join(repositoryRoot, "scripts", "plan-card-image-batches.mjs"),
        `--manifest=${manifestPath}`,
        "--batch-size=600",
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    const plan = JSON.parse(output);
    assert.deepEqual(plan.order, ["SV", "M (MEGA)", "S", "remaining"]);
    assert.deepEqual(plan.phases.sv.matrix.include, [
      { batch: 1, offset: 0, limit: 600 },
      { batch: 2, offset: 600, limit: 600 },
      { batch: 3, offset: 1_200, limit: 1 },
    ]);
    assert.deepEqual(plan.phases.mega.matrix.include, [
      { batch: 1, offset: 0, limit: 600 },
      { batch: 2, offset: 600, limit: 1 },
    ]);
    assert.equal(plan.phases.s.count, 1);
    assert.equal(plan.phases.legacy.count, 100);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("workflow chains priority phases and keeps the live CDN switch off", () => {
  const workflow = fs.readFileSync(
    path.join(repositoryRoot, ".github", "workflows", "deploy-card-images.yml"),
    "utf8",
  );
  assert.match(workflow, /download-mega:[\s\S]*needs: \[prepare, download-sv\]/);
  assert.match(workflow, /download-s:[\s\S]*needs: \[prepare, download-mega\]/);
  assert.match(workflow, /download-remaining:[\s\S]*needs: \[prepare, download-s\]/);
  assert.match(workflow, /verify-and-deploy:[\s\S]*needs: \[prepare, download-remaining\]/);
  assert.match(workflow, /cancel-in-progress: true/);

  const batchAction = fs.readFileSync(
    path.join(repositoryRoot, ".github", "actions", "download-card-image-batch", "action.yml"),
    "utf8",
  );
  assert.match(batchAction, /--min-delay 2[.]0/);
  assert.match(batchAction, /--allow-failures/);
  assert.match(batchAction, /card-images-v1-/);

  const downloader = fs.readFileSync(
    path.join(repositoryRoot, "scripts", "download_card_images.py"),
    "utf8",
  );
  assert.match(downloader, /PERMANENT_HTTP_STATUSES = \{400, 401, 403, 404, 410, 415\}/);
  assert.match(downloader, /--root/);
  assert.match(downloader, /--allow-failures/);

  const router = fs.readFileSync(path.join(repositoryRoot, "card-image-cdn.js"), "utf8");
  assert.match(router, /active:\s*false/);
});
