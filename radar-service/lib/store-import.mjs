// Independent radar project: explicitly reviewed canonical store import only.
// NEVER imports quantities, stockStatus, provider tokens or customer data.
import {gridCell,VALID_RETAILERS} from "./radar-query.mjs";
import {isSpecificEvidenceUrl} from "./retailer-evidence.mjs";

const RETAILER_KINDS=Object.freeze({
  cu:"convenience",gs25:"convenience",seveneleven:"convenience",
  emart24:"convenience",emart:"mart",traders:"mart",lottemart:"mart",
  homeplus:"mart",costco:"mart",hanaro:"mart"
});
const ID_REGEX=/^(?:cu|gs25|seveneleven|emart24|emart|traders|lottemart|homeplus|costco|hanaro)-[a-z0-9][a-z0-9-]{2,84}$/;
export function prepareVerifiedStoreImport(document,{now=Date.now()}={}){
  if(!document || document.schemaVersion!==1 || document.reviewed!==true ||
    !Array.isArray(document.stores) || !document.stores.length ||
    document.stores.length>100 || typeof document.reviewer!=="string" ||
    document.reviewer.trim().length<2 || document.reviewer.length>80)
    throw Error("STORE_BATCH_UNREVIEWED");
  const reviewTime=Date.parse(document.reviewedAt||"");
  if(!Number.isFinite(reviewTime)||reviewTime>now+60000||reviewTime<=0)
    throw Error("STORE_REVIEW_TIME_INVALID");
  const seen=new Set();
  return document.stores.map(raw=>{
    if(!raw || typeof raw!=="object" || !ID_REGEX.test(raw.storeId||"") ||
      !VALID_RETAILERS.includes(raw.retailerId) ||
      !raw.storeId.startsWith(raw.retailerId+"-") ||
      raw.kind!==RETAILER_KINDS[raw.retailerId] ||
      typeof raw.name!=="string" || !raw.name.trim() || raw.name.length>95 ||
      typeof raw.address!=="string" || !raw.address.trim() || raw.address.length>170 ||
      typeof raw.lat!=="number" || typeof raw.lng!=="number" ||
      !Number.isFinite(raw.lat)||!Number.isFinite(raw.lng) ||
      raw.lat<33||raw.lat>39.5||raw.lng<124||raw.lng>132 ||
      !isSpecificEvidenceUrl(raw.locationEvidenceUrl) ||
      !isSpecificEvidenceUrl(raw.coordinateEvidenceUrl) ||
      raw.locationReviewed!==true || seen.has(raw.storeId))
      throw Error("STORE_IDENTITY_OR_EVIDENCE_UNVERIFIED");
    seen.add(raw.storeId);
    return {id:raw.storeId,retailerId:raw.retailerId,
      body:{storeId:raw.storeId,retailerId:raw.retailerId,
        name:raw.name.trim(),kind:raw.kind,lat:raw.lat,lng:raw.lng,
        address:raw.address.trim(),cell:gridCell(raw.lat,raw.lng),
        locationStatus:"verified",inventoryStatus:"not_connected",
        verifiedLocationSource:raw.locationEvidenceUrl,
        verifiedCoordinateSource:raw.coordinateEvidenceUrl,
        reviewedAt:document.reviewedAt,reviewedBy:document.reviewer.trim(),
        // No stock or retailer identifiers are copied from candidate payload.
        latestStock:[]}};
  });
}
export async function writeVerifiedStoreImport(db,docs,{dryRun=true}={}){
  if(!Array.isArray(docs)||!docs.length || docs.length>100)
    throw Error("STORE_IMPORT_INVALID");
  const existing=await Promise.all(docs.map(doc=>db.collection("radarStores").doc(doc.id).get()));
  if(existing.some(row=>row.exists))throw Error("STORE_IMPORT_CONFLICT_EXISTING_RECORD");
  const retailers=[...new Set(docs.map(x=>x.retailerId))];
  const configs=await Promise.all(retailers.map(id=>db.collection("radarRetailers").doc(id).get()));
  if(configs.some((row,i)=>!row.exists || row.data()?.kind!==RETAILER_KINDS[retailers[i]]))
    throw Error("STORE_RETAILER_NOT_REGISTERED");
  if(dryRun)return {wouldCreate:docs.length,created:0,mode:"dry_run"};
  const batch=db.batch();
  for(const doc of docs)batch.create(db.collection("radarStores").doc(doc.id),doc.body);
  await batch.commit();
  return {created:docs.length,mode:"create_only"};
}
