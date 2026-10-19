// Privileged operation ONLY. Requires reviewed primary evidence; never infer item codes.
import {readFile} from "node:fs/promises";
import {radarDatabase} from "../lib/db.mjs";
import {mappingDocId} from "../lib/observation.mjs";
import {verifyProposedSku,verifyProposedStore} from "../lib/retailer-evidence.mjs";
async function main(){
  if(process.env.RADAR_ALLOW_MAPPING_IMPORT!=="yes")throw Error("EXPLICIT_MAPPING_APPROVAL_REQUIRED");
  const path=process.argv[2];
  if(!path)throw Error("USAGE: node scripts/import-mappings.mjs <reviewed-file.json>");
  const doc=JSON.parse(await readFile(path,"utf8"));
  if(doc.schemaVersion!==1||doc.reviewed!==true||!Array.isArray(doc.storeAliases)||
    !Array.isArray(doc.retailerSkus)||doc.storeAliases.length+doc.retailerSkus.length>250)
    throw Error("UNVERIFIED_MAPPING_DOCUMENT");
  const db=radarDatabase();
  const records=[];
  for(const a of doc.storeAliases){
    if(!a.providerStoreId || !a.storeId)throw Error("STORE_EVIDENCE_MISSING");
    const store=await db.collection("radarStores").doc(a.storeId).get();
    if(!store.exists ||store.data()?.retailerId!==a.retailerId)throw Error("STORE_NOT_REGISTERED");
    verifyProposedStore(a,store.data());
    records.push({collection:"radarStoreAliases",id:mappingDocId(a.retailerId,a.providerStoreId),
      body:{...a,verified:true,verifiedSource:a.evidenceUrl,verifiedAt:a.reviewedAt}});
  }
  for(const s of doc.retailerSkus){
    if(!s.retailerItemCode ||!s.productId)throw Error("SKU_EVIDENCE_MISSING");
    const product=await db.collection("radarProducts").doc(s.productId).get();
    if(!product.exists||!product.data()?.setId)throw Error("SKU_PRODUCT_NOT_REGISTERED");
    verifyProposedSku(s,product.data());
    const retailer=await db.collection("radarRetailers").doc(s.retailerId).get();
    if(!retailer.exists)throw Error("SKU_RETAILER_NOT_REGISTERED");
    records.push({collection:"radarSkuMappings",id:mappingDocId(s.retailerId,s.retailerItemCode),
      body:{...s,setId:product.data().setId,productName:product.data().name,
        verified:true,verifiedSource:s.evidenceUrl,verifiedAt:s.reviewedAt}});
  }
  const batch=db.batch();
  for(const rec of records){
    const ref=db.collection(rec.collection).doc(rec.id);
    const existing=await ref.get();
    if(existing.exists && JSON.stringify(existing.data())!==JSON.stringify(rec.body))
      throw Error("MAPPING_EXISTS_REVIEW_CONFLICT:"+rec.id);
    if(!existing.exists)batch.create(ref,rec.body);
  }
  await batch.commit();
  console.log(JSON.stringify({imported:records.length,stores:doc.storeAliases.length,skus:doc.retailerSkus.length}));
}
main().catch(error=>{console.error("MAPPING_IMPORT_FAILED",String(error?.message||error));process.exitCode=1;});
