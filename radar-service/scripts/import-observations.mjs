// Privileged ingest. NEVER expose as HTTP endpoint; executes only with server credentials.
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {radarDatabase} from "../lib/db.mjs";
import {mappingDocId,mergeLatestStock,verifySourceAndObservation} from "../lib/observation.mjs";
async function main(){
  const allowlist=String(process.env.RADAR_APPROVED_SOURCE_IDS||"").split(",").map(x=>x.trim()).filter(Boolean);
  if(process.env.RADAR_ALLOW_STOCK_IMPORT!=="yes"||!allowlist.length)throw Error("STOCK_SOURCE_NOT_APPROVED");
  const path=process.argv[2];
  if(!path)throw Error("USAGE: node scripts/import-observations.mjs <feed.json>");
  const feed=JSON.parse(await readFile(path,"utf8"));
  if(feed.schemaVersion!==1||!Array.isArray(feed.items)||feed.items.length>150)
    throw Error("INVALID_OBSERVATION_BATCH");
  const db=radarDatabase();
  let imported=0,duplicates=0;
  for(const record of feed.items){
    const [sourceDoc,aliasDoc,skuDoc]=await Promise.all([
      db.collection("radarSources").doc(record.sourceId).get(),
      db.collection("radarStoreAliases").doc(mappingDocId(record.retailerId,record.providerStoreId)).get(),
      db.collection("radarSkuMappings").doc(mappingDocId(record.retailerId,record.retailerItemCode)).get()
    ]);
    const observed=verifySourceAndObservation(record,sourceDoc.data(),aliasDoc.data(),skuDoc.data(),
      {allowlist});
    const id=createHash("sha256").update(JSON.stringify([
      observed.sourceId,observed.retailerId,observed.providerStoreId,
      observed.retailerItemCode,observed.observedAt,observed.quantity
    ])).digest("hex");
    const obsRef=db.collection("radarObservations").doc(id);
    const storeRef=db.collection("radarStores").doc(observed.storeId);
    const didWrite=await db.runTransaction(async tx=>{
      const [prior,store]=await Promise.all([tx.get(obsRef),tx.get(storeRef)]);
      if(prior.exists)return false;
      if(!store.exists||store.data()?.retailerId!==record.retailerId)
        throw Error("ALIAS_STORE_MISSING");
      const stock=mergeLatestStock(store.data()?.latestStock,observed);
      tx.create(obsRef,{...observed,createdAt:new Date().toISOString()});
      tx.update(storeRef,{latestStock:stock,latestStockUpdatedAt:new Date().toISOString()});
      return true;
    });
    if(didWrite)imported++;else duplicates++;
  }
  console.log(JSON.stringify({imported,duplicates,total:feed.items.length}));
}
main().catch(error=>{console.error("OBSERVATION_IMPORT_FAILED",String(error?.message||error));process.exitCode=1;});
