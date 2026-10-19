// Offline official-app stock cross-check. Never treats a query miss as sold out.
// Input is supplied by an operator who personally verified shop + SKU in an
// authorized, official app. No scraping, credentials or network requests.
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";

const VALID=new Set(["cu","gs25","seveneleven","emart24","emart","lottemart","traders","homeplus"]);
const MAX_CLOCK_SKEW_MS=15*60*1000;
function identity(row){
  return JSON.stringify([row.retailerId,row.providerStoreId,row.retailerItemCode]);
}
function checkedRow(raw,source){
  if(!raw || !VALID.has(raw.retailerId) ||
    typeof raw.providerStoreId!=="string"||!raw.providerStoreId.trim()||
    typeof raw.retailerItemCode!=="string"||!raw.retailerItemCode.trim()||
    !Number.isSafeInteger(raw.quantity)||raw.quantity<0 ||
    typeof raw.observedAt!=="string"||!Number.isFinite(Date.parse(raw.observedAt)))
    throw Error("INVALID_"+source.toUpperCase()+"_ROW");
  return raw;
}
function indexRows(rows,source){
  if(!Array.isArray(rows)||rows.length>250)throw Error("INVALID_"+source.toUpperCase()+"_BATCH");
  const map=new Map();
  for(const value of rows){
    const row=checkedRow(value,source);
    const key=identity(row);
    if(map.has(key))throw Error("DUPLICATE_"+source.toUpperCase()+"_IDENTITY");
    map.set(key,row);
  }
  return map;
}
export function compareRetailerStock(official,radar){
  if(!official||official.schemaVersion!==1||
    official.source!=="official-app-manually-verified"||
    official.reviewed!==true ||typeof official.reviewedAt!=="string" ||
    !Number.isFinite(Date.parse(official.reviewedAt)))
    throw Error("REVIEWED_OFFICIAL_APP_OBSERVATIONS_REQUIRED");
  if(!radar||radar.schemaVersion!==1||radar.source!=="card-radar-observation")
    throw Error("RADAR_OBSERVATIONS_REQUIRED");
  const baseline=indexRows(official.items,"official");
  const result=indexRows(radar.items,"radar");
  const counts={officialCompared:baseline.size,matched:0,mismatch:0,
    unobserved:0,stale:0,quantityAgreement:0};
  for(const [key,reference] of baseline){
    const current=result.get(key);
    if(!current){counts.unobserved++;continue;}
    if(Math.abs(Date.parse(current.observedAt)-Date.parse(reference.observedAt))>
      MAX_CLOCK_SKEW_MS){counts.stale++;continue;}
    if(reference.quantity===current.quantity){
      counts.matched++;counts.quantityAgreement++;
    }else counts.mismatch++;
  }
  const comparable=counts.matched+counts.mismatch;
  return {schemaVersion:1,unit:"retailer-product-store",
    // No false precision and no comparisons between wrong shop/SKU or >15 min.
    ...counts,comparable,
    agreementRate:comparable?Math.round(counts.matched/comparable*1000)/10:null,
    allChecked:counts.unobserved===0&&counts.stale===0,
    disclaimer:"Unverified outside manually reviewed official app observations"};
}
async function main(){
  const [a,b]=process.argv.slice(2);
  if(!a||!b)throw Error("USAGE: node scripts/card-radar-compare-stock.mjs <official-reviewed.json> <radar-snapshot.json>");
  const official=JSON.parse(await readFile(a,"utf8"));
  const radar=JSON.parse(await readFile(b,"utf8"));
  process.stdout.write(JSON.stringify(compareRetailerStock(official,radar),null,2)+"\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error=>{console.error(String(error.message||error));process.exitCode=1;});
