import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");

test("phase 4 audit checks current image manifest without modifying card data",()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"dcb-image-integrity-"));
  const manifest=path.join(temp,"manifest.json"),reportPath=path.join(temp,"report.json");
  const seriesBefore=fs.statSync(path.join(root,"data/series.json")).size;
  try {
    execFileSync(process.execPath,[path.join(root,"scripts/build-card-image-manifest.mjs"),
      "--output="+manifest],{cwd:root,stdio:"pipe"});
    execFileSync(process.execPath,[path.join(root,"scripts/audit-card-image-integrity.mjs"),
      "--manifest="+manifest,"--output="+reportPath],{cwd:root,stdio:"pipe"});
    const report=JSON.parse(fs.readFileSync(reportPath,"utf8"));
    assert.equal(report.schemaVersion,1);
    assert.equal(report.verifiedScope,"static-identity-and-routing-only");
    assert.equal(report.criticalCount,0,JSON.stringify(report.critical));
    assert.ok(report.manifestAssets>20_000);
    assert.ok(report.counters.seriesCards>15_000);
    assert.equal(report.counters.imagesMissingFromManifest,0);
    assert.equal(fs.statSync(path.join(root,"data/series.json")).size,seriesBefore);
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
});

test("phase 4 recovery preserves production CDN and does not remove original card images",()=>{
  const flow=read(".github/workflows/deploy-card-images.yml");
  const script=read("scripts/restore_card_images_from_cloudflare.py");
  assert.match(flow,/Restore verified images from existing Cloudflare Pages archives/);
  assert.match(flow,/max-unavailable 600/);
  assert.match(flow,/\.github\/card-image-deploy-request[.]json/);
  assert.doesNotMatch(flow,/^      - 'data\/[*][.]json'$/m);
  assert.match(flow,/Validate every expected image before deployment/);
  assert.ok(flow.indexOf("Validate every expected image before deployment")<
    flow.indexOf("Save repaired modern archive"));
  assert.match(script,/--probe-only/);
  assert.match(script,/verified_webp/);
  assert.match(script,/os[.]replace/);
  assert.doesNotMatch(script,/delete.*(cloudflare|pages)|purge.*(cloudflare|pages)/i);
});
