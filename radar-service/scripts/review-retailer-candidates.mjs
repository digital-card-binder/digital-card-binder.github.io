// Read-only, offline preparation utility. Review candidate identities manually.
import {readFile} from "node:fs/promises";
import {catalogueCandidates,storeCandidates} from "../lib/retailer-review.mjs";

async function main(){
  const [retailerId,kind,file]=process.argv.slice(2);
  if(!retailerId || !["products","stores"].includes(kind)|| !file)throw Error(
    "USAGE: node scripts/review-retailer-candidates.mjs <cu|gs25|seveneleven|emart24> <products|stores> <input.json>");
  const data=JSON.parse(await readFile(file,"utf8"));
  const entries=Array.isArray(data)?data:Array.isArray(data.items)?data.items:
    Array.isArray(data.data?.items)?data.data.items:Array.isArray(data.data?.stores)?
    data.data.stores:null;
  const result=kind==="products"?
    catalogueCandidates(retailerId,entries,{sourceUrl:null}):
    storeCandidates(retailerId,entries,{sourceUrl:null});
  console.log(JSON.stringify({schemaVersion:1,retailerId,kind,verified:false,
    stockCollected:false,candidateCount:result.length,
    note:"Offline candidates only. Reconcile original retailer SKU / store code, source permission and evidence before any DB import.",
    candidates:result},null,2));
}
main().catch(e=>{console.error(String(e.message||e));process.exitCode=1;});
