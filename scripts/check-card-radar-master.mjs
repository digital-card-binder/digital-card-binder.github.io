import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMaster,latestConfirmedStock } from "../lib/radar-master.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const files={
  retailers:"retailers.json",sets:"sets.json",products:"products.json",
  stores:"stores.json",aliases:"store-aliases.json",skus:"retailer-skus.json",
  observations:"inventory-observations.json"
};
export async function loadMaster() {
  const pairs=await Promise.all(Object.entries(files).map(async([name,file])=>{
    const content=await readFile(path.join(root,"data","radar-master",file),"utf8");
    return [name,JSON.parse(content)];
  }));
  return Object.fromEntries(pairs);
}
export async function checkMaster() {
  const master=await loadMaster();
  const packSource=await readFile(path.join(root,"packs.js"),"utf8");
  const counts=validateMaster(master,{packSource});
  const current=latestConfirmedStock(master);
  if(current.some(row=>row.stockStatus==="in_stock" && row.quantity<=0))
    throw Error("INVALID_CONFIRMED_STOCK");
  return {schemaVersion:1,counts,confirmedStockRows:current.length,
    sourceOfTruth:"data/radar-master",hostedDatabaseConfigured:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try {
    const report=await checkMaster();
    console.log(JSON.stringify(report,null,2));
  } catch(error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode=1;
  }
}
