#!/usr/bin/env node
// Phase 4: read-only card-identity and image-routing audit.
// Does not alter images, card IDs, ownership records or collection membership.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeCardImage } from "./card-image-routing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function option(name, defaultValue) {
  const arg = process.argv.find((item) => item.startsWith("--" + name + "="));
  return arg ? arg.slice(name.length + 3) : defaultValue;
}
const manifestPath = path.resolve(option("manifest",path.join(root,"tmp/card-images/manifest.json")));
const outputPath = path.resolve(option("output",path.join(root,"tmp/card-images/integrity-audit.json")));
const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
const manifestKeys=new Set();
const critical=[], warnings=[];
for (const asset of manifest.assets) {
  const key=asset.project+":"+asset.relativePath;
  if (manifestKeys.has(key)) critical.push({type:"duplicate-archive-path",key});
  manifestKeys.add(key);
  if (!["modern","legacy"].includes(asset.project) ||
      !/^(?:data\/wmimages\/|external\/)[^\\]+[.]webp$/.test(asset.relativePath) ||
      asset.relativePath.split("/").includes("..") ||
      !Array.isArray(asset.sourceUrls) || !asset.sourceUrls.length) {
    critical.push({type:"invalid-archive-record",key});
  }
}
const counters={
  seriesGroups:0, seriesCards:0, cardsWithoutImages:0,
  cardCodesRepeatedWithinSet:0, unroutableImageLinks:0,
  imagesMissingFromManifest:0, cardCodesWithoutValue:0,
};
const collect=(arr,max=40)=>arr.length<max;
for (const filename of ["data/series.json","data/series-legacy.json"]) {
  let groups;
  try {groups=JSON.parse(readFileSync(path.join(root,filename),"utf8"));}
  catch(error) {critical.push({type:"unreadable-series-data",file:filename,reason:error.message});continue;}
  if (!Array.isArray(groups)) {critical.push({type:"invalid-series-data",file:filename});continue;}
  for (const group of groups) {
    counters.seriesGroups++;
    const seenCodes=new Set();
    for (const card of group.cards||[]) {
      counters.seriesCards++;
      const code=String(card.code||"").trim();
      if (!code) {
        counters.cardCodesWithoutValue++;
        if(collect(warnings)) warnings.push({type:"empty-card-code",file:filename,set:group.code});
      } else if (seenCodes.has(code)) {
        counters.cardCodesRepeatedWithinSet++;
        if(collect(warnings)) warnings.push({type:"repeated-card-code",file:filename,set:group.code,code});
      }
      seenCodes.add(code);
      const source=String(card.image||"").trim();
      if (!source) {
        counters.cardsWithoutImages++;
        if(collect(warnings)) warnings.push({type:"no-card-image",file:filename,set:group.code,code});
        continue;
      }
      const route=routeCardImage(source);
      if (!route) {
        counters.unroutableImageLinks++;
        if(collect(warnings)) warnings.push({type:"unroutable-source",file:filename,set:group.code,code});
        continue;
      }
      const key=route.project+":"+route.relativePath;
      if (!manifestKeys.has(key)) {
        counters.imagesMissingFromManifest++;
        if(collect(warnings)) warnings.push({type:"missing-manifest-path",file:filename,set:group.code,code,key});
      }
    }
  }
}
if (counters.imagesMissingFromManifest) critical.push({
  type:"series-images-unmapped-to-archive",
  count:counters.imagesMissingFromManifest,
});
const result={
  schemaVersion:1,
  verifiedScope:"static-identity-and-routing-only",
  manifestAssets:manifest.assets.length,
  projects:manifest.counts ? {modern:manifest.counts.modern,legacy:manifest.counts.legacy}:null,
  counters,
  criticalCount:critical.length,
  critical:critical.slice(0,60),
  warningsShown:warnings.length,
  warningSamples:warnings,
  notes:[
    "No card images or ownership data were modified.",
    "A valid URL and card code do not prove the pictured card artwork is correct.",
    "A separate read-only CDN probe checks whether sampled WebP bytes are served."
  ],
};
mkdirSync(path.dirname(outputPath),{recursive:true});
writeFileSync(outputPath,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({manifestAssets:result.manifestAssets,...counters,criticalCount:critical.length}));
if (critical.length) process.exitCode=1;
