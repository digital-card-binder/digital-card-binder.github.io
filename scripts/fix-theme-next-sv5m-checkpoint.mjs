import { readFile, writeFile } from "node:fs/promises";
const parse=async p=>JSON.parse(await readFile(p,"utf8"));
const [cov,img,state]=await Promise.all([
  parse("data/audits/theme-series-coverage.json"),
  parse("data/audits/theme-image-selfhost-audit.json"),
  parse("data/audits/theme-series-review-status.json")
]);
const byCode=new Map(cov.sets.map(x=>[x.code,x])); // preserve completion and collection state
if(byCode.has("sv5")||byCode.get("sv5a")?.status!=="complete"||
  byCode.get("sv5M")?.status!=="pending"||
  byCode.get("sv5K")?.status!=="pending")
  throw Error("SV5 cohort status changed; refuse checkpoint adjustment.");
if(img.nextStart==="sv5M canonical 001"){
 console.log("SV5M checkpoint already normalized; no-op");process.exit(0);
}
if(img.nextStart!=="sv5 canonical 001"||
 img.batches.at(-1)?.set!=="sv5a"||
 img.batches.at(-1)?.nextStart!=="sv5 canonical 001")
 throw Error("Expected previous SV5a successful checkpoint before correction.");
let count=0;
function correct(node){
 if(!node||typeof node!=="object")return;
 for(const [key,value] of Object.entries(node)){
  if(typeof value==="string" && value.includes("sv5 canonical 001")){
   node[key]=value.replaceAll("sv5 canonical 001","sv5M canonical 001");count++;
  }else if(value&&typeof value==="object")correct(value);
 }
}
correct(state);
if(count===0)throw Error("Failed to locate state checkpoint; do not update image audit separately.");
img.nextStart="sv5M canonical 001";
img.batches.at(-1).nextStart=img.nextStart;
img.batches.at(-1).note+=" Correct next cohort is SV5M or SV5K; non-existent sv5 code normalized to SV5M.";
await Promise.all([
 writeFile("data/audits/theme-image-selfhost-audit.json",JSON.stringify(img,null,2)+"\n"),
 writeFile("data/audits/theme-series-review-status.json",JSON.stringify(state,null,2)+"\n")
]);
console.log("Normalized "+count+" checkpoint markers; resume SV5M canonical 001.");
