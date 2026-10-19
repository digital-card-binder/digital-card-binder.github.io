// One-time, fixed-data bootstrap for the dedicated Card Radar Firebase PROJECT.
// No external input, no inventory quantities, no external provider credentials.
// Activation is limited to a temporary server-only environment variable.
import { MASTER_SEED } from "./master-seed.mjs";
import { gridCell } from "./radar-query.mjs";

const EXPECTED = Object.freeze({sets:151,retailers:10,products:2,stores:1});
function assert(test,label){if(!test)throw Error("RADAR_BOOTSTRAP_INVALID_"+label);}
function unique(rows){return new Set(rows.map(x=>x.id)).size===rows.length;}

export function preparedBootstrapDocuments(seed=MASTER_SEED) {
  for(const [kind,count] of Object.entries(EXPECTED)){
    const rows=seed?.[kind];
    assert(Array.isArray(rows)&&rows.length===count&&unique(rows),kind.toUpperCase()+"_COUNT");
  }
  const retailerIds=new Set(seed.retailers.map(x=>x.id));
  const setIds=new Set(seed.sets.map(x=>x.id));
  for(const s of seed.sets){
    assert(/^[a-z0-9+_-]{1,35}$/.test(s.id)&&s.setCode.toLowerCase()===s.id,
      "SET_ID");
    assert(typeof s.title==="string" && s.title.length>0,"SET_TITLE");
  }
  for(const retailer of seed.retailers){
    assert(["mart","convenience","cardshop"].includes(retailer.kind),"RETAILER_KIND");
    assert(retailer.permissionStatus==="unverified","RETAILER_PERMISSION_NOT_UNVERIFIED");
  }
  for(const product of seed.products){
    assert(setIds.has(product.setId),"PRODUCT_SET");
    assert(product.identityStatus==="internal_catalog_only","PRODUCT_EXTERNAL_SKU");
  }
  for(const store of seed.stores){
    assert(retailerIds.has(store.retailerId),"STORE_RETAILER");
    assert(Number.isFinite(store.lat)&&Number.isFinite(store.lng)&&
      Math.abs(store.lat)<=90 && Math.abs(store.lng)<=180,"STORE_COORDINATE");
    assert(store.locationStatus==="verified","STORE_NOT_VERIFIED");
    assert(store.kind===seed.retailers.find(r=>r.id===store.retailerId)?.kind,"STORE_KIND");
  }
  const docs=[
    ...seed.retailers.map(({id,...fields})=>({
      collection:"radarRetailers",id,body:{retailerId:id,...fields}})),
    ...seed.sets.map(({id,...fields})=>({
      collection:"radarSets",id,body:{setId:id,...fields}})),
    ...seed.products.map(({id,...fields})=>({
      collection:"radarProducts",id,body:{productId:id,...fields}})),
    ...seed.stores.map(({id,...fields})=>({
      collection:"radarStores",id,body:{storeId:id,...fields,cell:gridCell(fields.lat,fields.lng)}}))
  ];
  assert(docs.length===164,"WRITES");
  assert(!docs.some(x=>x.body.quantity!==undefined || x.body.latestStock!==undefined),
    "UNAUTHORIZED_INVENTORY");
  return docs;
}

export async function bootstrapMasterOnce(db,{
  enabled=process.env.RADAR_BOOTSTRAP_ONCE==="yes",
  projectId=process.env.GOOGLE_CLOUD_PROJECT,
  databaseId=process.env.RADAR_FIRESTORE_DATABASE
}={}) {
  if(!enabled)return {outcome:"disabled"};
  if(projectId!=="digital-card-radar-db" || databaseId!=="(default)")
    throw Error("RADAR_BOOTSTRAP_REFUSED_WRONG_PROJECT");
  const docs=preparedBootstrapDocuments();
  const marker=db.collection("radarSystem").doc("status");
  const status=await db.runTransaction(async transaction=>{
    const previous=await transaction.get(marker);
    if(previous.exists)return "already_seeded";
    for(const item of docs){
      transaction.create(db.collection(item.collection).doc(item.id),item.body);
    }
    transaction.create(marker,{
      schemaVersion:2,service:"card-radar",masterReady:true,seededAt:new Date().toISOString(),
      source:"data/radar-master",confirmedStock:0,inventoryStatus:"unconnected",
      seedCollectionCounts:{retailers:10,sets:151,products:2,stores:1}
    });
    return "seeded";
  });
  return {outcome:status,documentCount:docs.length};
}
