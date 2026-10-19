// Candidate discovery only. Third-party search is NOT primary SKU/store evidence.
// Nothing from here is approved, directly importable, or proof of stock.
import {catalogueCandidates,storeCandidates,proposeCardProduct}
  from "./retailer-review.mjs";

const PROVIDERS=new Set(["cu","gs25","seveneleven","emart24"]);
function rowsForProvider(provider,data){
  if(provider==="cu")return {
    products:[{itemCode:data.nearbyStores?.itemCode||data.product?.itemCode,
      name:data.nearbyStores?.stockItemName||data.product?.name}],
    stores:data.nearbyStores?.stores||[]
  };
  if(provider==="gs25")return {
    products:[{itemCode:data.itemCode||data.product?.itemCode,
      name:data.product?.name}],
    stores:data.inventory?.stores||[]
  };
  if(provider==="seveneleven")return {
    products:[{itemCode:data.product?.itemCode||data.product?.itemCd,
      name:data.product?.itemName}],
    stores:data.inventory?.stores||[]
  };
  const candidateRows=Array.isArray(data.productCandidates)?
    data.productCandidates.slice(0,30):[];
  const known=String(data.pluCd||data.goodsInfo?.pluCd||"");
  if(known && !candidateRows.some(p=>String(p.pluCd||"")===known))
    candidateRows.push({pluCd:known,goodsName:data.goodsInfo?.goodsName||
      data.goodsInfo?.goodsNm});
  const nearby=Array.isArray(data.nearbyStores)?data.nearbyStores:
    data.nearbyStores?.stores||[];
  const byId=new Map(nearby.filter(p=>p&&p.storeCode)
    .map(p=>[String(p.storeCode),p]));
  const stores=(Array.isArray(data.stores)?data.stores:[])
    .map(p=>{
      const matched=byId.get(String(p.bizNo||""));
      return {...p,
        storeCode:String(p.bizNo||""),
        latitude:p.latitude??p.lat??matched?.latitude??matched?.lat,
        longitude:p.longitude??p.lng??matched?.longitude??matched?.lng,
        storeName:p.storeName||matched?.storeName,
        address:p.address||matched?.address};
    });
  return {products:candidateRows,stores};
}
export function publicRetailerMappingCandidates(provider,payload,{
  requestedKeyword="",discoveredAt=new Date().toISOString()
}={}){
  if(!PROVIDERS.has(provider))throw Error("UNKNOWN_CANDIDATE_PROVIDER");
  if(!payload||payload.success!==true||!payload.data)
    return {retailerId:provider,retailerSkus:[],storeAliases:[],
      reviewed:false,stockVerified:false};
  const {products,stores}=rowsForProvider(provider,payload.data);
  const intendedSet=proposeCardProduct("포켓몬카드 "+requestedKeyword+" 부스터팩").suggestedSetId;
  const candidates=catalogueCandidates(provider,products,{observedAt:discoveredAt})
    .filter(p=>!intendedSet||p.suggestedSetId===intendedSet);
  const matchingStores=storeCandidates(provider,stores);
  // Public API discovery cannot satisfy the primary-evidence gate.
  return {retailerId:provider,retailerSkus:candidates,
    storeAliases:matchingStores,reviewed:false,stockVerified:false};
}
