import {STOCK_TTL_MS,VALID_RETAILERS} from "./radar-query.mjs";
export function mappingDocId(retailerId,code){
  if(!VALID_RETAILERS.includes(retailerId)||typeof code!=="string"||!code.trim()||code.length>120)
    throw new Error("INVALID_PROVIDER_IDENTITY");
  return Buffer.from(JSON.stringify([retailerId,code.trim()]),"utf8").toString("base64url");
}
export function verifySourceAndObservation(raw,source,alias,sku,{now=Date.now(),allowlist=[]}={}){
  if(!raw || !source || !alias || !sku)throw Error("UNMAPPED_SOURCE_STORE_OR_SKU");
  if(source.permissionStatus!=="approved"||!allowlist.includes(raw.sourceId) ||
    typeof source.licenseReference!=="string"||source.licenseReference.trim().length<8 ||
    source.retailerId!==raw.retailerId)throw Error("UNAUTHORIZED_RETAILER_SOURCE");
  if(!VALID_RETAILERS.includes(raw.retailerId) ||
    alias.retailerId!==raw.retailerId||sku.retailerId!==raw.retailerId ||
    alias.providerStoreId!==raw.providerStoreId||
    sku.retailerItemCode!==raw.retailerItemCode||
    !alias.storeId||!sku.productId||!sku.setId||
    alias.verified!==true||sku.verified!==true)
    throw Error("UNVERIFIED_PROVIDER_MAPPING");
  if(!Number.isSafeInteger(raw.quantity)||raw.quantity<0)
    throw Error("QUANTITY_UNAVAILABLE_IS_NOT_ZERO");
  const observed=Date.parse(raw.observedAt);
  if(typeof raw.observedAt!=="string"||!Number.isFinite(observed)||
    observed>now+60000||now-observed>STOCK_TTL_MS)
    throw Error("STALE_OR_INVALID_OBSERVATION");
  const expiresAt=new Date(observed+STOCK_TTL_MS).toISOString();
  if(Date.parse(expiresAt)<=now)throw Error("EXPIRED_STOCK");
  return {
    retailerId:raw.retailerId,providerStoreId:raw.providerStoreId,
    retailerItemCode:raw.retailerItemCode,storeId:alias.storeId,
    productId:sku.productId,setId:sku.setId,
    name:String(sku.productName||"").slice(0,100),
    sourceId:raw.sourceId,sourcePermission:"approved",
    licenseReference:source.licenseReference,
    quantity:raw.quantity,stockStatus:raw.quantity===0?"out_of_stock":"in_stock",
    observedAt:raw.observedAt,expiresAt
  };
}
export function mergeLatestStock(previous=[],next,now=Date.now()) {
  const valid=(Array.isArray(previous)?previous:[]).filter(p=>{
    const t=Date.parse(p.expiresAt),observed=Date.parse(p.observedAt);
    return Number.isFinite(t)&&Number.isFinite(observed)&&t>now&&
      observed<=now+60000&&now-observed<=STOCK_TTL_MS;
  });
  const index=valid.findIndex(p=>p.productId===next.productId);
  if(index===-1)valid.push(next);
  else if(Date.parse(next.observedAt)>=Date.parse(valid[index].observedAt))
    valid[index]=next;
  return valid.slice(0,80);
}
