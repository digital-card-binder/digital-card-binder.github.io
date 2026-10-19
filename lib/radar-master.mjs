// Card Radar's normalized, provider-independent identity and observation layer.
// Pure data functions: do not contact retailers or imply that unknown stock is zero.
export const MASTER_SCHEMA_VERSION = 1;
export const FRESHNESS_MS = 15 * 60 * 1000;
const KEY_RE = /^[a-z0-9][a-z0-9+_-]{0,79}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function canonicalSetId(code) {
  const value = String(code || "").trim().toLowerCase();
  if (!KEY_RE.test(value)) throw new Error("INVALID_SET_CODE");
  return value;
}
export function normalizedStoreKey(retailerId,providerStoreId) {
  const retailer=String(retailerId||"").trim();
  const store=String(providerStoreId||"").trim();
  if(!KEY_RE.test(retailer) || !store || store.length>100)throw new Error("INVALID_STORE_ALIAS");
  return JSON.stringify([retailer,store]);
}
export function normalizedSkuKey(retailerId,retailerItemCode) {
  const retailer=String(retailerId||"").trim();
  const sku=String(retailerItemCode||"").trim();
  if(!KEY_RE.test(retailer) || !sku || sku.length>150)throw new Error("INVALID_RETAILER_SKU");
  return JSON.stringify([retailer,sku]);
}
export function isFresh(observedAt,expiresAt,now=Date.now()) {
  const observed=Date.parse(observedAt),expired=Date.parse(expiresAt);
  return typeof observedAt==="string" && ISO_RE.test(observedAt) &&
    typeof expiresAt==="string" && ISO_RE.test(expiresAt) &&
    Number.isFinite(observed) && Number.isFinite(expired) &&
    observed<=now+60000 && observed>=now-FRESHNESS_MS && expired>now &&
    expired>observed;
}
function assert(condition,message){if(!condition)throw new Error(message);}
function distinct(rows,key,label) {
  const seen=new Set();
  for(const row of rows){const value=key(row);assert(!seen.has(value),"DUPLICATE_"+label+":"+value);seen.add(value);}
}
function validateBatch(doc,label) {
  assert(doc && doc.schemaVersion===MASTER_SCHEMA_VERSION && Array.isArray(doc.items),
    "INVALID_COLLECTION_"+label);
  return doc.items;
}
export function validateMaster(master,{packSource=null}={}) {
  const retailers=validateBatch(master.retailers,"retailers");
  const sets=validateBatch(master.sets,"sets");
  const products=validateBatch(master.products,"products");
  const stores=validateBatch(master.stores,"stores");
  const aliases=validateBatch(master.aliases,"aliases");
  const skus=validateBatch(master.skus,"skus");
  const observations=validateBatch(master.observations,"observations");
  distinct(retailers,x=>x.retailerId,"RETAILER");
  distinct(sets,x=>x.setId,"SET");
  distinct(products,x=>x.productId,"PRODUCT");
  distinct(stores,x=>x.storeId,"STORE");
  distinct(aliases,x=>normalizedStoreKey(x.retailerId,x.providerStoreId),"STORE_ALIAS");
  distinct(skus,x=>normalizedSkuKey(x.retailerId,x.retailerItemCode),"SKU");
  distinct(observations,x=>x.observationId,"OBSERVATION");
  const retailerById=new Map(retailers.map(x=>[x.retailerId,x]));
  const setById=new Map(sets.map(x=>[x.setId,x]));
  const productById=new Map(products.map(x=>[x.productId,x]));
  const storeById=new Map(stores.map(x=>[x.storeId,x]));
  const storeAliasByKey=new Map(aliases.map(x=>[normalizedStoreKey(x.retailerId,x.providerStoreId),x]));
  const skuByKey=new Map(skus.map(x=>[normalizedSkuKey(x.retailerId,x.retailerItemCode),x]));
  for(const s of sets) {
    assert(s.setId===canonicalSetId(s.setCode),"BAD_SET_CODE:"+s.setId);
    assert(typeof s.title==="string" && s.title.length>0,"BAD_SET_TITLE");
    assert(typeof s.series==="string" && s.series.length>0,"BAD_SERIES");
  }
  for(const r of retailers) {
    assert(KEY_RE.test(r.retailerId),"BAD_RETAILER_ID");
    assert(["mart","convenience","cardshop"].includes(r.kind),"BAD_RETAILER_KIND");
    assert(["unverified","approved","revoked"].includes(r.permissionStatus),"BAD_RETAILER_PERMISSION");
  }
  for(const p of products){
    assert(setById.has(p.setId),"PRODUCT_UNKNOWN_SET:"+p.productId);
    assert(["booster_pack","booster_box","starter_deck","starter_set","other_card_product"].includes(p.packageType),"BAD_PACKAGE_TYPE");
    assert(p.identityStatus==="internal_catalog_only"||p.identityStatus==="retailer_verified","BAD_PRODUCT_IDENTITY");
    assert(p.retailerItemCode===null && p.barcode===null || p.identityStatus==="retailer_verified","UNVERIFIED_PRODUCT_EXTERNAL_CODE");
    assert(p.claimOfCurrentStock===false,"PRODUCT_MUST_NOT_ASSERT_STOCK");
  }
  for(const store of stores) {
    assert(retailerById.has(store.retailerId),"STORE_UNKNOWN_RETAILER");
    assert(store.kind===retailerById.get(store.retailerId).kind,"STORE_KIND_MISMATCH");
    assert(Number.isFinite(store.latitude) && Math.abs(store.latitude)<=90 &&
      Number.isFinite(store.longitude) && Math.abs(store.longitude)<=180,"BAD_STORE_COORDINATES");
    assert(["verified","candidate","closed"].includes(store.locationStatus),"BAD_LOCATION_STATUS");
    assert(store.inventoryStatus==="unconnected" || store.inventoryStatus==="connected","BAD_STORE_INVENTORY_STATE");
  }
  for(const alias of aliases) {
    assert(retailerById.has(alias.retailerId) && storeById.has(alias.storeId),"STORE_ALIAS_MISSING_FK");
    assert(storeById.get(alias.storeId).retailerId===alias.retailerId,"STORE_ALIAS_FOREIGN_RETAILER");
    assert(typeof alias.verifiedSource==="string" && alias.verifiedSource.length>0,"STORE_ALIAS_NEEDS_PROOF");
  }
  for(const sku of skus) {
    assert(retailerById.has(sku.retailerId) && productById.has(sku.productId),"SKU_MISSING_FK");
    assert(typeof sku.verifiedSource==="string" && sku.verifiedSource.length>0,"SKU_NEEDS_PROOF");
  }
  for(const obs of observations) {
    assert(retailerById.has(obs.retailerId),"OBS_UNKNOWN_RETAILER");
    assert(storeAliasByKey.has(normalizedStoreKey(obs.retailerId,obs.providerStoreId)),"OBS_UNMAPPED_STORE");
    assert(skuByKey.has(normalizedSkuKey(obs.retailerId,obs.retailerItemCode)),"OBS_UNMAPPED_PRODUCT");
    assert(["in_stock","out_of_stock","unknown","request_failed"].includes(obs.stockStatus),"OBS_BAD_STATUS");
    if(obs.stockStatus==="in_stock")assert(Number.isSafeInteger(obs.quantity)&&obs.quantity>0,"OBS_BAD_POSITIVE");
    else if(obs.stockStatus==="out_of_stock")assert(obs.quantity===0,"OBS_BAD_ZERO");
    else assert(obs.quantity===null,"OBS_UNKNOWN_NOT_NULL");
    assert(obs.sourcePermission==="approved","OBS_UNAUTHORIZED_SOURCE");
    assert(typeof obs.licenseReference==="string" && obs.licenseReference.trim().length>=8,"OBS_MISSING_LICENSE");
    assert(typeof obs.sourceId==="string" && obs.sourceId.length>0,"OBS_SOURCE_ID");
    assert(["in_stock","out_of_stock"].includes(obs.stockStatus) ?
      Number.isFinite(Date.parse(obs.observedAt)) && Number.isFinite(Date.parse(obs.expiresAt)) :
      true,"OBS_MISSING_TIMESTAMP");
  }
  if(packSource){
    const matches=[...packSource.matchAll(/\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*[01]\s*\]/g)];
    assert(matches.length===sets.length,"PACK_CATALOG_SET_COUNT_DRIFT");
    for(const [,series,title,code] of matches){
      const set=setById.get(canonicalSetId(code));
      assert(set && set.series===series && set.title===title,"PACK_CATALOG_SET_DRIFT:"+code);
    }
  }
  return {retailers:retailers.length,sets:sets.length,products:products.length,
    stores:stores.length,aliases:aliases.length,skuMappings:skus.length,
    observations:observations.length};
}
export function latestConfirmedStock(master,now=Date.now()) {
  validateMaster(master);
  const rows=new Map();
  for(const obs of master.observations.items) {
    if(!["in_stock","out_of_stock"].includes(obs.stockStatus))continue;
    if(!isFresh(obs.observedAt,obs.expiresAt,now))continue;
    const key=JSON.stringify([obs.retailerId,obs.providerStoreId,obs.retailerItemCode]);
    const other=rows.get(key);
    if(!other || Date.parse(obs.observedAt)>Date.parse(other.observedAt))rows.set(key,obs);
  }
  return [...rows.values()].sort((a,b)=>a.retailerId.localeCompare(b.retailerId)||
    String(a.providerStoreId).localeCompare(String(b.providerStoreId)));
}
